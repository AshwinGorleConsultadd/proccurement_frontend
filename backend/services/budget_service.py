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

async def _max_order(project_id: str) -> int:
    col = _col()
    cur = col.find(
        {"project": project_id},
        {"order_index": 1}
    ).sort("order_index", -1).limit(1)
    docs = await cur.to_list(1)
    return docs[0]["order_index"] if docs else -1


# ── CRUD ─────────────────────────────────────────────────────────────────────

async def list_items(
    project_id: str,
    search: str = "",
    page: int = 1,
    page_size: int = 12,
    group_by_room: bool = False,
    group_by_page: bool = False,
    rooms_filter: str = "",
) -> dict:
    from db.mongo import get_rooms_collection
    rooms_coll = get_rooms_collection()
    
    col = _col()
    filt: dict = {"project": project_id, "is_sub_item": {"$ne": True}}
    if search:
        filt["spec_no"] = {"$regex": search, "$options": "i"}

    if rooms_filter:
        # expects a comma-separated string of pure mongoid room IDs
        rooms_list = [r.strip() for r in rooms_filter.split(",")]
        # Support fetching budget items which explicitly have no room or match the filter
        # It's better to just strictly use $in 
        filt["room"] = {"$in": rooms_list}

    total = await col.count_documents(filt)

    if group_by_page:
        sort_key = [("page_no", 1), ("order_index", 1)]
    elif group_by_room:
        sort_key = [("room", 1), ("order_index", 1)]
    else:
        sort_key = [("order_index", 1)]

    cursor = col.find(filt).sort(sort_key).skip((page - 1) * page_size).limit(page_size)
    docs = await cursor.to_list(page_size)
    
    # Preload rooms for population
    room_ids = list({ObjectId(d["room"]) for d in docs if d.get("room") and ObjectId.is_valid(d["room"])})
    if room_ids:
        rooms = await rooms_coll.find({"_id": {"$in": room_ids}}).to_list(None)
        room_map = {str(r["_id"]): r for r in rooms}
        for r in room_map.values():
            r["_id"] = str(r["_id"])
    else:
        room_map = {}
        
    for d in docs:
        if d.get("room") and d["room"] in room_map:
            d["room_name"] = room_map[d["room"]].get("name", d["room"])

    # Fetch subitems
    all_subitem_ids = []
    for d in docs:
        sub_list = d.get("subitems", [])
        if sub_list and isinstance(sub_list, list):
            # some might be dictionaries or strings, we expect strings
            all_subitem_ids.extend([ObjectId(s) for s in sub_list if ObjectId.is_valid(s)])

    subitems_map = {}
    if all_subitem_ids:
        sub_docs = await col.find({"_id": {"$in": all_subitem_ids}}).to_list(None)
        for s in sub_docs:
            if s.get("room") and s["room"] in room_map:
                s["room_name"] = room_map[s["room"]].get("name", s["room"])
            subitems_map[str(s["_id"])] = _serialize(s)

    items = []
    for d in docs:
        d_serial = _serialize(d)
        resolved_subitems = []
        for sid in d.get("subitems", []):
            if isinstance(sid, str) and sid in subitems_map:
                resolved_subitems.append(subitems_map[sid])
        d_serial["subitems"] = resolved_subitems
        items.append(d_serial)

    # Grand total (all non-hidden, not just this page)
    all_cursor = col.find(filt, {"extended": 1, "hidden_from_total": 1, "room": 1})
    all_docs = await all_cursor.to_list(None)
    
    # Preload all rooms for totals
    all_room_ids = list({ObjectId(d["room"]) for d in all_docs if d.get("room") and ObjectId.is_valid(d["room"])})
    all_room_map = {}
    if all_room_ids:
        all_rooms = await rooms_coll.find({"_id": {"$in": all_room_ids}}).to_list(None)
        all_room_map = {str(r["_id"]): r.get("name", str(r["_id"])) for r in all_rooms}

    grand_total = sum(
        (d.get("extended") or 0) for d in all_docs if not d.get("hidden_from_total")
    )

    room_totals: dict[str, float] = {}
    for d in all_docs:
        raw_room_id = d.get("room", "")
        key = str(all_room_map.get(raw_room_id, raw_room_id)) if raw_room_id else "Unassigned Room"
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
    group_by_room: bool = False,
    group_by_page: bool = False,
) -> dict:
    from db.mongo import get_rooms_collection
    rooms_coll = get_rooms_collection()

    col = _col()
    filt = {"project": project_id, "is_sub_item": {"$ne": True}}

    if group_by_page:
        sort = [("page_no", 1), ("order_index", 1)]
    elif group_by_room:
        sort = [("room", 1), ("order_index", 1)]
    else:
        sort = [("order_index", 1)]

    docs = await col.find(filt).sort(sort).to_list(None)

    room_ids = list({ObjectId(d["room"]) for d in docs if d.get("room") and ObjectId.is_valid(d["room"])})
    if room_ids:
        rooms = await rooms_coll.find({"_id": {"$in": room_ids}}).to_list(None)
        room_map = {str(r["_id"]): r for r in rooms}
        for r in room_map.values():
            r["_id"] = str(r["_id"])
    else:
        room_map = {}
        
    for d in docs:
        if d.get("room") and d["room"] in room_map:
            # We preserve the raw room_id for updates! The frontend handles mapping!
            d["room_name"] = room_map[d["room"]].get("name", d["room"])

    # Resolve subitems properly
    all_subitem_ids = []
    for d in docs:
        sub_list = d.get("subitems", [])
        if sub_list and isinstance(sub_list, list):
            all_subitem_ids.extend([ObjectId(s) for s in sub_list if isinstance(s, str) and ObjectId.is_valid(s)])

    subitems_map = {}
    if all_subitem_ids:
        sub_docs = await col.find({"_id": {"$in": all_subitem_ids}}).to_list(None)
        for s in sub_docs:
            if s.get("room") and s["room"] in room_map:
                s["room_name"] = room_map[s["room"]].get("name", s["room"])
            subitems_map[str(s["_id"])] = _serialize(s)
            
    items = []
    for d in docs:
        d_serial = _serialize(d)
        resolved_subitems = []
        for sid in d.get("subitems", []):
            if isinstance(sid, str) and sid in subitems_map:
                resolved_subitems.append(subitems_map[sid])
        d_serial["subitems"] = resolved_subitems
        items.append(d_serial)

    grand_total = sum((d.get("extended") or 0) for d in docs if not d.get("hidden_from_total"))
    room_totals: dict[str, float] = {}
    for d in docs:
        raw_room_id = d.get("room", "")
        mapped_room = room_map.get(raw_room_id, {})
        room_name = mapped_room.get("name", raw_room_id) if isinstance(mapped_room, dict) else raw_room_id
        key = str(room_name) if raw_room_id else "Unassigned Room"
        room_totals[key] = room_totals.get(key, 0.0) + (
            (d.get("extended") or 0) if not d.get("hidden_from_total") else 0.0
        )

    return {"items": items, "grand_total": grand_total, "room_totals": room_totals}


async def create_item(project_id: str, data: dict) -> dict:
    col = _col()
    ref_id     = data.pop("insert_relative_to", None)
    position   = data.pop("position", "below")

    if ref_id and ObjectId.is_valid(ref_id):
        ref = await col.find_one({"_id": ObjectId(ref_id)})
        if ref:
            pivot = ref["order_index"]
            new_index = pivot if position == "above" else pivot + 1
            # Shift everything >= new_index up by 1
            await col.update_many(
                {"project": project_id, "order_index": {"$gte": new_index}},
                {"$inc": {"order_index": 1}},
            )
        else:
            new_index = await _max_order(project_id) + 1
    else:
        new_index = await _max_order(project_id) + 1

    extended = _calc_extended(data.get("qty", "1"), data.get("unit_cost"))
    now = _now()
    doc = {
        "project":            project_id,
        "page_id":            data.get("page_id", ""),
        "room":               data.get("room", ""),
        "spec_no":            data.get("spec_no", ""),
        "description":        data.get("description", ""),
        "page_no":            data.get("page_no"),
        "qty":                data.get("qty", "1 Ea."),
        "unit_cost":          data.get("unit_cost"),
        "extended":           extended,
        "order_index":        new_index,
        "hidden_from_total":  data.get("hidden_from_total", False),
        "is_sub_item":        data.get("is_sub_item", False),
        "created_by":         data.get("created_by", "user"),
        "subitems":           data.get("subitems", []),
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
    if not doc:
        return None
        
    doc_serial = _serialize(doc)
    
    # Resolve subitems for the single fetched document
    sub_list = doc_serial.get("subitems", [])
    if sub_list and isinstance(sub_list, list):
        sub_ids = [ObjectId(s) for s in sub_list if isinstance(s, str) and ObjectId.is_valid(s)]
        if sub_ids:
            sub_docs = await col.find({"_id": {"$in": sub_ids}}).to_list(None)
            sub_map = {str(s["_id"]): _serialize(s) for s in sub_docs}
            resolved = []
            for s in sub_list:
                if isinstance(s, str) and s in sub_map:
                    resolved.append(sub_map[s])
                elif isinstance(s, dict): # robust for old data
                    resolved.append(s)
            doc_serial["subitems"] = resolved

    return doc_serial


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
    doc = await col.find_one({"_id": ObjectId(item_id)}, {"order_index": 1, "project": 1})
    if not doc:
        return False
    await col.delete_one({"_id": ObjectId(item_id)})
    # Compact order_index gap
    await col.update_many(
        {"project": doc["project"], "order_index": {"$gt": doc["order_index"]}},
        {"$inc": {"order_index": -1}},
    )
    return True


# ── Sub-item operations ───────────────────────────────────────────────────────

async def add_subitem(item_id: str, data: dict) -> dict | None:
    if not ObjectId.is_valid(item_id):
        return None
    col = _col()
    parent = await col.find_one({"_id": ObjectId(item_id)})
    if not parent:
        return None

    # Determine order index relative to other subitems
    subitems = parent.get("subitems", [])
    if subitems and isinstance(subitems, list) and len(subitems) > 0:
        # If it contains dictionaries from old format, ignore or fetch them.
        pass
        
    data["is_sub_item"] = True
    # For now, create the subitem as a brand new item in the flat collection
    new_subitem = await create_item(parent["project"], data)
    new_subitem_id = str(new_subitem["_id"])

    # Make old dictionaries backwards compatible gracefully
    cleaned_subitems = [s for s in subitems if isinstance(s, str)]
    cleaned_subitems.append(new_subitem_id)
    
    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": cleaned_subitems, "updated_at": _now()}},
    )
    doc = await col.find_one({"_id": ObjectId(item_id)})
    return await get_item(item_id)  # fetch populated


async def update_subitem(item_id: str, sub_id: str, updates: dict) -> dict | None:
    if not ObjectId.is_valid(item_id) or not ObjectId.is_valid(sub_id):
        return None
    col = _col()
    parent = await col.find_one({"_id": ObjectId(item_id)})
    if not parent:
        return None

    # update the actual item doc
    await update_item(sub_id, updates)
    return await get_item(item_id)




async def delete_subitem(item_id: str, sub_id: str) -> dict | None:
    if not ObjectId.is_valid(item_id) or not ObjectId.is_valid(sub_id):
        return None
    col = _col()
    parent = await col.find_one({"_id": ObjectId(item_id)})
    if not parent:
        return None

    subitems = parent.get("subitems", [])
    if sub_id in subitems:
        subitems.remove(sub_id)
        
    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": subitems, "updated_at": _now()}},
    )
    # Actually delete the subitem completely
    await delete_item(sub_id)
    return await get_item(item_id)




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

    target_sub_id = None
    remaining = []
    for s in parent.get("subitems", []):
        if s == sub_id:
            target_sub_id = s
        else:
            remaining.append(s)

    if not target_sub_id:
        return None, None

    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"subitems": remaining, "updated_at": _now()}},
    )

    # Detach by removing is_sub_item flag and positioning it below parent
    parent_index = parent.get("order_index", 0)
    await col.update_many(
        {"project": parent["project"], "order_index": {"$gt": parent_index}},
        {"$inc": {"order_index": 1}},
    )
    
    await col.update_one(
        {"_id": ObjectId(target_sub_id)},
        {"$set": {"is_sub_item": False, "order_index": parent_index + 1}}
    )

    updated_parent = await get_item(item_id)
    new_top = await get_item(target_sub_id)
    return updated_parent, new_top


async def assign_to_parent(item_id: str, parent_id: str) -> bool:
    if not ObjectId.is_valid(item_id) or not ObjectId.is_valid(parent_id):
        return False
    col = _col()
    item = await col.find_one({"_id": ObjectId(item_id)})
    parent = await col.find_one({"_id": ObjectId(parent_id)})
    if not item or not parent:
        return False

    # Pull from any existing parent
    await col.update_many(
        {"subitems": item_id},
        {"$pull": {"subitems": item_id}}
    )
    # Add to new parent
    await col.update_one(
        {"_id": ObjectId(parent_id)},
        {"$addToSet": {"subitems": item_id}, "$set": {"updated_at": _now()}}
    )
    # Mark as subitem
    await col.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"is_sub_item": True, "updated_at": _now()}}
    )
    return True

