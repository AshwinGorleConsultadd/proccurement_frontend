"""
routes/budget_mongo.py
FastAPI router — MongoDB-backed budget items.
All routes are scoped under /budget/{project_id}.
"""
from fastapi import APIRouter, HTTPException, Query
from schemas.budget_mongo import (
    BudgetItemCreate, BudgetItemUpdate, BudgetItemOut
)
import services.budget_service as svc

router = APIRouter(prefix="/budget", tags=["Budget"])


# ── Item list / export ────────────────────────────────────────────────────────

@router.get("/{project_id}")
async def list_budget(
    project_id:    str,
    page:          int  = Query(1, ge=1),
    search:        str  = Query(""),
    group_by_room: bool = Query(False),
    group_by_page: bool = Query(False),
    rooms:         str  = Query(""),
):
    return await svc.list_items(
        project_id, search, page, 12, group_by_room, group_by_page, rooms
    )


@router.get("/{project_id}/export")
async def export_budget(
    project_id:    str,
    group_by_room: bool = Query(False),
    group_by_page: bool = Query(False),
):
    return await svc.export_items(project_id, group_by_room, group_by_page)


# ── Item CRUD ─────────────────────────────────────────────────────────────────

@router.post("/{project_id}/item", status_code=201)
async def create_budget_item(project_id: str, body: BudgetItemCreate):
    data = body.model_dump()
    return await svc.create_item(project_id, data)


@router.put("/{project_id}/item/{item_id}")
async def update_budget_item(project_id: str, item_id: str, body: BudgetItemUpdate):
    updates = body.model_dump(exclude_none=True)
    result = await svc.update_item(item_id, updates)
    if result is None:
        raise HTTPException(404, "Budget item not found")
    return result


@router.delete("/{project_id}/item/{item_id}")
async def delete_budget_item(project_id: str, item_id: str):
    ok = await svc.delete_item(item_id)
    if not ok:
        raise HTTPException(404, "Budget item not found")
    return {"ok": True}


# ── Sub-item CRUD ─────────────────────────────────────────────────────────────

@router.post("/{project_id}/item/{item_id}/subitems", status_code=201)
async def add_subitem(project_id: str, item_id: str, body: BudgetItemCreate):
    result = await svc.add_subitem(item_id, body.model_dump())
    if result is None:
        raise HTTPException(404, "Budget item not found")
    return result


@router.put("/{project_id}/item/{item_id}/subitems/{sub_id}")
async def update_subitem(project_id: str, item_id: str, sub_id: str, body: BudgetItemUpdate):
    updates = body.model_dump(exclude_none=True)
    result = await svc.update_subitem(item_id, sub_id, updates)
    if result is None:
        raise HTTPException(404, "Item or sub-item not found")
    return result


@router.delete("/{project_id}/item/{item_id}/subitems/{sub_id}")
async def delete_subitem(project_id: str, item_id: str, sub_id: str):
    result = await svc.delete_subitem(item_id, sub_id)
    if result is None:
        raise HTTPException(404, "Item or sub-item not found")
    return result


# ── Detach sub-item → top-level ───────────────────────────────────────────────

@router.post("/{project_id}/item/{item_id}/detach-subitem/{sub_id}")
async def detach_subitem(project_id: str, item_id: str, sub_id: str):
    parent, new_item = await svc.detach_subitem(item_id, sub_id)
    if parent is None:
        raise HTTPException(404, "Item or sub-item not found")
    return {"parent": parent, "new_item": new_item}

@router.put("/{project_id}/item/{item_id}/assign-to/{parent_id}")
async def assign_to_parent(project_id: str, item_id: str, parent_id: str):
    ok = await svc.assign_to_parent(item_id, parent_id)
    if not ok:
        raise HTTPException(404, "Item or target parent not found")
    return {"ok": True}

