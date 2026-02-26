from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db.database import get_db
from models.sql_models import BudgetItem
from schemas.budget import BudgetItemCreate, BudgetItemUpdate, BudgetItemOut
import re

router = APIRouter(prefix="/budget", tags=["Budget"])

@router.get("/{section}/export")
def export_budget(
    section:       str,
    group_by_room: bool = Query(False),
    group_by_page: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Return ALL items for a section (no pagination) for client-side export."""
    q = db.query(BudgetItem).filter(BudgetItem.section == section)
    all_items = q.all()

    # Sort
    if group_by_page:
        all_items = sorted(all_items, key=lambda i: (i.page_no or 0, i.order_index))
    elif group_by_room:
        all_items = sorted(all_items, key=lambda i: (i.room_name or "", i.order_index))
    else:
        all_items = sorted(all_items, key=lambda i: i.order_index)

    grand_total = sum((i.extended or 0) for i in all_items if not i.hidden_from_total)

    room_totals: dict[str, float] = {}
    for i in all_items:
        key = i.room_name or "Unassigned Room"
        room_totals[key] = room_totals.get(key, 0.0) + (
            (i.extended or 0) if not i.hidden_from_total else 0.0
        )

    return {
        "items":       [BudgetItemOut.model_validate(i) for i in all_items],
        "grand_total": grand_total,
        "room_totals": room_totals,
        "section":     section,
    }


@router.get("/{section}")
def get_budget(
    section:       str,
    page:          int  = Query(1, ge=1),
    search:        str  = Query(""),
    group_by_page: bool = Query(False),
    group_by_room: bool = Query(False),
    db: Session = Depends(get_db)
):
    q = db.query(BudgetItem).filter(BudgetItem.section == section)
    if search:
        q = q.filter(BudgetItem.spec_no.ilike(f"%{search}%"))
    total = q.count()
    # Only sum items that are NOT hidden from total
    all_items = q.all()
    total_subtotal = sum(
        (i.extended or 0) for i in all_items if not i.hidden_from_total
    )

    # Build per-room totals (only non-hidden items, across all pages)
    room_totals: dict[str, float] = {}
    for i in all_items:
        key = i.room_name or "Unassigned Room"
        room_totals[key] = room_totals.get(key, 0.0) + (
            (i.extended or 0) if not i.hidden_from_total else 0.0
        )

    if group_by_page:
        q = q.order_by(BudgetItem.page_no, BudgetItem.order_index)
    elif group_by_room:
        q = q.order_by(BudgetItem.room_name, BudgetItem.order_index)
    else:
        q = q.order_by(BudgetItem.order_index)
    page_size = 12
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items":          [BudgetItemOut.model_validate(i) for i in items],
        "total":          total,
        "page":           page,
        "page_size":      page_size,
        "total_subtotal": total_subtotal,
        "room_totals":    room_totals,
    }

@router.post("/item")
def create_budget_item(item: BudgetItemCreate, db: Session = Depends(get_db)):
    if item.insert_relative_to is not None:
        ref = db.query(BudgetItem).filter(BudgetItem.id == item.insert_relative_to).first()
        if not ref:
            raise HTTPException(404, "Reference item not found")
        new_index = ref.order_index if item.position == "above" else ref.order_index + 1
        db.query(BudgetItem).filter(
            BudgetItem.section == (item.section or ref.section),
            BudgetItem.order_index >= new_index
        ).update({"order_index": BudgetItem.order_index + 1})
        db.flush()
    else:
        mx = db.query(BudgetItem).filter(BudgetItem.section == item.section)\
               .order_by(BudgetItem.order_index.desc()).first()
        new_index = (mx.order_index + 1) if mx else 0

    new_item = BudgetItem(
        spec_no=item.spec_no, vendor=item.vendor,
        vendor_description=item.vendor_description, description=item.description,
        room_name=item.room_name, page_no=item.page_no, qty=item.qty,
        unit_cost=item.unit_cost, extended=item.extended,
        section=item.section, order_index=new_index, pdf_filename=item.pdf_filename,
    )
    db.add(new_item); db.commit(); db.refresh(new_item)
    return BudgetItemOut.model_validate(new_item)

@router.put("/item/{item_id}")
def update_budget_item(item_id: int, item: BudgetItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(404, "Item not found")
    for field, value in item.model_dump(exclude_none=True).items():
        setattr(db_item, field, value)

    qty_str = db_item.qty or "1"
    qty_match = re.match(r'[\s]*([0-9]+(?:\.[0-9]*)?)', qty_str)
    qty_num = float(qty_match.group(1)) if qty_match else 1.0
    if db_item.unit_cost is not None:
        db_item.extended = round(qty_num * db_item.unit_cost, 2)

    db.commit(); db.refresh(db_item)
    return BudgetItemOut.model_validate(db_item)

@router.delete("/item/{item_id}")
def delete_budget_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not db_item:
        raise HTTPException(404, "Item not found")
    section, deleted_index = db_item.section, db_item.order_index
    db.delete(db_item); db.flush()
    db.query(BudgetItem).filter(
        BudgetItem.section == section,
        BudgetItem.order_index > deleted_index
    ).update({"order_index": BudgetItem.order_index - 1})
    db.commit()
    return {"ok": True}
