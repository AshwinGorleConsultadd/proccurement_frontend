"""
services/budget_service.py
Business logic for the MongoDB budget_items collection.
"""
from __future__ import annotations
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from db.mongo import get_db


def _col():
    return get_db()["budget_items"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _calc_extended(qty: str, unit_cost: Optional[float]) -> Optional[float]:
    """Parse qty string, extract leading number, multiply by unit_cost."""
    if unit_cost is None:
        return None
    m = re.match(r"[\s]*([0-9]+(?:\.[0-9]*)?)", str(qty or "1"))
    n = float(m.group(1)) if m else 1.0
    return round(n * unit_cost, 2)


def _serialize(doc: dict) -> dict:
    """Convert ObjectId → str for JSON serialisation."""
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return doc


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _max_order(project_id: str, section: str) -> int:
    col = _col()
    cur = col.find(
        {"project_id": project_id, "section": section},
        {"order_index": 1}
    ).sort("order_index", -1).limit(1)
    docs = await cur.to_list(1)
    return docs[0]["order_index"] if docs else -1


# ── CRUD ─────────────────────────────────────────────────────────────────────

async def list_items(
    project_id: str,
    section: str,
    search: str = "",
    page: int = 1,
    page_size: int = 12,
    group_by_room: bool = False,
    group_by_page: bool = False,
) -> dict:
    col = _col()
    filt: dict = {"project_id": project_id, "section": section}
    if search:
        filt["spec_no"] = {"$regex": search, "$options": "i"}

    total = await col.count_documents(filt)

    if group_by_page:
        sort_key = [("page_no", 1), ("order_index", 1)]
    elif group_by_room:
        sort_key = [("room_name", 1), ("order_index", 1)]
    else:
        sort_key = [("order_index", 1)]

    cursor = col.find(filt).sort(sort_key).skip((page - 1) * page_size).limit(page_size)
    docs = await cursor.to_list(page_size)
    items = [_serialize(d) for d in docs]

    # Grand total (all non-hidden, not just this page)
    all_cursor = col.find(filt, {"extended": 1, "hidden_from_total": 1, "room_name": 1})
    all_docs = await all_cursor.to_list(None)
    grand_total = sum(
        (d.get("extended") or 0) for d in all_docs if not d.get("hidden_from_total")
    )

    room_totals: dict[str, float] = {}
    for d in all_docs:
        key = d.get("room_name") or "Unassigned Room"
        room_totals[key] = room_totals.get(key, 0.0) + (
            (d.get("extended") or 0) if not d.get("hidden_from_total") else 0.0
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_subtotal": grand_total,
        "room_totals": room_totals,
    }


async def export_items(
    project_id: str,
    section: str,
    group_by_room: bool = False,
    group_by_page: bool = False,
) -> dict:
    col = _col()
    filt = {"project_id": project_id, "section": section}

    if group_by_page:
        sort = [("page_no", 1), ("order_index", 1)]
    elif group_by_room:
        sort = [("room_name", 1), ("order_index", 1)]
    else:
        sort = [("order_index", 1)]

    docs = await col.find(filt).sort(sort).to_list(None)
    items = [_serialize(d) for d in docs]

    grand_total = sum((d.get("extended") or 0) for d in docs if not d.get("hidden_from_total"))
    room_totals: dict[str, float] = {}
    for d in docs:
        key = d.get("room_name") or "Unassigned Room"
        room_totals[key] = room_totals.get(key, 0.0) + (
            (d.get("extended") or 0) if not d.get("hidden_from_total") else 0.0
        )

    return {"items": items, "grand_total": grand_total, "room_totals": room_totals, "section": section}


async def create_item(project_id: str, data: dict) -> dict:
    col = _col()
    section    = data.get("section", "general")
    ref_id     = data.pop("insert_relative_to", None)
    position   = data.pop("position", "below")

    if ref_id and ObjectId.is_valid(ref_id):
        ref = await col.find_one({"_id": ObjectId(ref_id)})
        if ref:
            pivot = ref["order_index"]
            new_index = pivot if position == "above" else pivot + 1
            # Shift everything >= new_index up by 1
            await col.update_many(
                {"project_id": project_id, "section": section, "order_index": {"$gte": new_index}},
                {"$inc": {"order_index": 1}},
            )
        else:
            new_index = await _max_order(project_id, section) + 1
    else:
        new_index = await _max_order(project_id, section) + 1

    extended = _calc_extended(data.get("qty", "1"), data.get("unit_cost"))
    now = _now()
    doc = {
        "project_id":         project_id,
        "page_id":            data.get("page_id", ""),
        "room_id":            data.get("room_id", ""),
        "spec_no":            data.get("spec_no", ""),
        "vendor":             data.get("vendor", "TBD"),
        "vendor_description": data.get("vendor_description", ""),
        "description":        data.get("description", ""),
        "room_name":          data.get("room_name", ""),
        "page_no":            data.get("page_no"),
        "qty":                data.get("qty", "1 Ea."),
        "unit_cost":          data.get("unit_cost"),
        "extended":           extended,
        "section":            section,
        "order_index":        new_index,
        "pdf_filename":       data.get("pdf_filename"),
        "hidden_from_total":  False,
        "subitems":           [],
        "created_at":         now,
        "updated_at":         now,
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_item(item_id: str) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)})
    return _serialize(doc) if doc else None


async def update_item(item_id: str, updates: dict) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)})
    if not doc:
        return None

    # Merge updates
    for k, v in updates.items():
        if v is not None:
            doc[k] = v

    # Recalculate extended
    doc["extended"] = _calc_extended(doc.get("qty", "1"), doc.get("unit_cost"))
    doc["updated_at"] = _now()

    await col.replace_one({"_id": ObjectId(item_id)}, doc)
    return _serialize(doc)


async def delete_item(item_id: str) -> bool:
    if not ObjectId.is_valid(item_id):
        return False
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)}, {"order_index": 1, "project_id": 1, "section": 1})
    if not doc:
        return False
    await col.delete_one({"_id": ObjectId(item_id)})
    # Compact order_index gap
    await col.update_many(
        {"project_id": doc["project_id"], "section": doc["section"], "order_index": {"$gt": doc["order_index"]}},
        {"$inc": {"order_index": -1}},
    )
    return True


# ── Sub-item operations ───────────────────────────────────────────────────────

async def add_subitem(item_id: str, data: dict) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)})
    if not doc:
        return None

    subitems = doc.get("subitems", [])
    unit_cost = data.get("unit_cost")
    extended  = _calc_extended(data.get("qty", "1"), unit_cost)

    sub = {
        "_id":                str(uuid.uuid4()),
        "spec_no":            data.get("spec_no", ""),
        "vendor":             data.get("vendor", "TBD"),
        "vendor_description": data.get("vendor_description", ""),
        "description":        data.get("description", ""),
        "qty":                data.get("qty", "1 Ea."),
        "unit_cost":          unit_cost,
        "extended":           extended,
        "hidden_from_total":  data.get("hidden_from_total", False),
        "order_index":        len(subitems),
    }
    subitems.append(sub)
    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": subitems, "updated_at": _now()}},
    )
    doc = await col.find_one({"_id": ObjectId(item_id)})
    return _serialize(doc)


async def update_subitem(item_id: str, sub_id: str, updates: dict) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)})
    if not doc:
        return None

    subitems = doc.get("subitems", [])
    for sub in subitems:
        if sub["_id"] == sub_id:
            for k, v in updates.items():
                if v is not None:
                    sub[k] = v
            sub["extended"] = _calc_extended(sub.get("qty", "1"), sub.get("unit_cost"))
            break
    else:
        return None

    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": subitems, "updated_at": _now()}},
    )
    doc = await col.find_one({"_id": ObjectId(item_id)})
    return _serialize(doc)


async def delete_subitem(item_id: str, sub_id: str) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    doc = await col.find_one({"_id": ObjectId(item_id)})
    if not doc:
        return None

    subitems = [s for s in doc.get("subitems", []) if s["_id"] != sub_id]
    # Re-index order_index
    for i, s in enumerate(subitems):
        s["order_index"] = i

    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": subitems, "updated_at": _now()}},
    )
    doc = await col.find_one({"_id": ObjectId(item_id)})
    return _serialize(doc)


async def detach_subitem(item_id: str, sub_id: str) -> tuple[dict | None, dict | None]:
    """
    Promote a subitem to a top-level budget item.
    Returns (updated_parent, new_top_level_item).
    """
    if not ObjectId.is_valid(item_id):
        return None, None
    col = _col()
    parent = await col.find_one({"_id": ObjectId(item_id)})
    if not parent:
        return None, None

    target_sub = None
    remaining = []
    for s in parent.get("subitems", []):
        if s["_id"] == sub_id:
            target_sub = s
        else:
            remaining.append(s)

    if not target_sub:
        return None, None

    # Re-index remaining
    for i, s in enumerate(remaining):
        s["order_index"] = i

    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": remaining, "updated_at": _now()}},
    )

    # Create new top-level item from the subitem
    new_data = {
        "spec_no":            target_sub.get("spec_no", ""),
        "vendor":             target_sub.get("vendor", "TBD"),
        "vendor_description": target_sub.get("vendor_description", ""),
        "description":        target_sub.get("description", ""),
        "qty":                target_sub.get("qty", "1 Ea."),
        "unit_cost":          target_sub.get("unit_cost"),
        "page_id":            parent.get("page_id", ""),
        "room_id":            parent.get("room_id", ""),
        "room_name":          parent.get("room_name", ""),
        "page_no":            parent.get("page_no"),
        "section":            parent.get("section", "general"),
        "pdf_filename":       parent.get("pdf_filename"),
        "insert_relative_to": item_id,
        "position":           "below",
    }
    new_item = await create_item(parent["project_id"], new_data)

    updated_parent = await get_item(item_id)
    return updated_parent, new_item
