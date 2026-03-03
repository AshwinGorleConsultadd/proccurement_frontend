#!/usr/bin/env python3
"""
migrate_budget.py
One-time script: copy all rows from SQLite budget_items → MongoDB budget_items.
Run from backend/ directory:
    python migrate_budget.py
"""
import os, sys, sqlite3, asyncio, uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, MONGO_DB_NAME

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "budget.db")

SEED_ROWS = [
    ("DC-01",   "TBD", "Decorative Pendant", "Lobby Mail/Sitting", "Club Room",       1, "1 Ea.",  350.0,  350.0,  "general", 0),
    ("LOB-200", "TBD", "Coffee Table",        "Lobby Mail/Sitting", "Club Room",       1, "1 Ea.", 1350.0, 1350.0, "general", 1),
    ("LOB-200", "TBD", "Coffee Table",        "Lobby Livingroom",   "Game Room",       2, "1 Ea.", 1350.0, 1350.0, "general", 2),
    ("LOB-201", "TBD", "Console",             "Lobby Mail/Sitting", "Game Room",       2, "1 Ea.", 1600.0, 1600.0, "general", 3),
    ("LOB-202", "TBD", "Media Cabinet",       "Lobby Livingroom",   "Conference Room", 3, "1 Ea.", 2800.0, 2800.0, "general", 4),
]


async def migrate():
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db     = client[MONGO_DB_NAME]
    col    = db["budget_items"]

    # Check if collection already has data
    existing = await col.count_documents({})
    if existing > 0:
        print(f"[migrate] MongoDB budget_items already has {existing} docs — skipping to avoid duplicates.")
        print("[migrate] Delete the collection manually if you want to re-migrate.")
        client.close()
        return

    rows_from_sqlite = []

    # Try reading from SQLite
    if os.path.exists(SQLITE_PATH):
        try:
            conn = sqlite3.connect(SQLITE_PATH)
            conn.row_factory = sqlite3.Row
            cur  = conn.cursor()
            cur.execute("SELECT * FROM budget_items ORDER BY order_index")
            rows_from_sqlite = [dict(r) for r in cur.fetchall()]
            conn.close()
            print(f"[migrate] Read {len(rows_from_sqlite)} rows from SQLite")
        except Exception as e:
            print(f"[migrate] Could not read SQLite: {e}")
    else:
        print("[migrate] budget.db not found — will use seed data")

    source = rows_from_sqlite if rows_from_sqlite else []

    # Build sentinel project for legacy items (no project_id)
    sentinel_id = None
    if source:
        proj_col = db["projects"]
        sentinel = await proj_col.find_one({"name": "__budget_seed__"})
        if not sentinel:
            from bson import ObjectId
            res = await proj_col.insert_one({
                "name": "__budget_seed__",
                "description": "Auto-created to host migrated budget items from SQLite",
                "status": "draft",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            sentinel_id = str(res.inserted_id)
        else:
            sentinel_id = str(sentinel["_id"])
        print(f"[migrate] Sentinel project id: {sentinel_id}")

    docs = []
    now  = datetime.now(timezone.utc).isoformat()

    for row in source:
        docs.append({
            "project_id":         sentinel_id or "",
            "page_id":            str(row.get("page_no") or ""),
            "room_id":            "",
            "spec_no":            row.get("spec_no") or "",
            "vendor":             row.get("vendor") or "TBD",
            "vendor_description": row.get("vendor_description") or "",
            "description":        row.get("description") or "",
            "room_name":          row.get("room_name") or "",
            "page_no":            row.get("page_no"),
            "qty":                row.get("qty") or "1 Ea.",
            "unit_cost":          row.get("unit_cost"),
            "extended":           row.get("extended"),
            "section":            row.get("section") or "general",
            "order_index":        row.get("order_index") or 0,
            "pdf_filename":       row.get("pdf_filename"),
            "hidden_from_total":  bool(row.get("hidden_from_total", False)),
            "subitems":           [],
            "created_at":         now,
            "updated_at":         now,
        })

    # If no SQLite rows, insert seed data
    if not docs:
        print("[migrate] Inserting seed data into MongoDB...")
        for s in SEED_ROWS:
            spec_no, vendor, vdesc, desc, room, page_no, qty, uc, ext, section, order_i = s
            docs.append({
                "project_id": "", "page_id": str(page_no), "room_id": "",
                "spec_no": spec_no, "vendor": vendor, "vendor_description": vdesc,
                "description": desc, "room_name": room, "page_no": page_no,
                "qty": qty, "unit_cost": uc, "extended": ext,
                "section": section, "order_index": order_i, "pdf_filename": None,
                "hidden_from_total": False, "subitems": [],
                "created_at": now, "updated_at": now,
            })

    if docs:
        res = await col.insert_many(docs)
        print(f"[migrate] ✅ Inserted {len(res.inserted_ids)} documents into MongoDB budget_items")
    else:
        print("[migrate] Nothing to insert.")

    # Create indexes
    await col.create_index([("project_id", 1), ("section", 1), ("order_index", 1)])
    await col.create_index([("project_id", 1), ("section", 1), ("room_name", 1)])
    print("[migrate] ✅ Indexes created")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
