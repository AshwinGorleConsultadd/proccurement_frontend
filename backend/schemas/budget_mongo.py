"""
schemas/budget_mongo.py
Pydantic v2 models for MongoDB-backed budget items.
"""
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


# ── Sub-item ──────────────────────────────────────────────────────────────────

class SubItemCreate(BaseModel):
    spec_no:            str   = ""
    vendor:             str   = "TBD"
    vendor_description: str   = ""
    description:        str   = ""
    qty:                str   = "1 Ea."
    unit_cost:          Optional[float] = None
    hidden_from_total:  bool  = False

class SubItemUpdate(BaseModel):
    spec_no:            Optional[str]   = None
    vendor:             Optional[str]   = None
    vendor_description: Optional[str]   = None
    description:        Optional[str]   = None
    qty:                Optional[str]   = None
    unit_cost:          Optional[float] = None
    hidden_from_total:  Optional[bool]  = None

class SubItemOut(BaseModel):
    id:                 str
    spec_no:            str   = ""
    vendor:             str   = "TBD"
    vendor_description: str   = ""
    description:        str   = ""
    qty:                str   = "1 Ea."
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    hidden_from_total:  bool  = False
    order_index:        int   = 0


# ── Top-level Budget Item ──────────────────────────────────────────────────────

class BudgetItemCreate(BaseModel):
    spec_no:            str   = ""
    vendor:             str   = "TBD"
    vendor_description: str   = ""
    description:        str   = ""
    room_name:          str   = ""
    room_id:            str   = ""
    page_no:            Optional[int]   = None
    page_id:            str   = ""
    qty:                str   = "1 Ea."
    unit_cost:          Optional[float] = None
    section:            str   = "general"
    pdf_filename:       Optional[str]   = None
    # Ordering hint — insert above/below another item
    insert_relative_to: Optional[str]   = None   # _id string of neighbour
    position:           str   = "below"           # "above" | "below"

class BudgetItemUpdate(BaseModel):
    spec_no:            Optional[str]   = None
    vendor:             Optional[str]   = None
    vendor_description: Optional[str]   = None
    description:        Optional[str]   = None
    room_name:          Optional[str]   = None
    room_id:            Optional[str]   = None
    page_no:            Optional[int]   = None
    page_id:            Optional[str]   = None
    qty:                Optional[str]   = None
    unit_cost:          Optional[float] = None
    pdf_filename:       Optional[str]   = None
    hidden_from_total:  Optional[bool]  = None

class BudgetItemOut(BaseModel):
    id:                 str   = Field(alias="_id")
    project_id:         str   = ""
    page_id:            str   = ""
    room_id:            str   = ""
    spec_no:            str   = ""
    vendor:             str   = ""
    vendor_description: str   = ""
    description:        str   = ""
    room_name:          str   = ""
    page_no:            Optional[int]   = None
    qty:                str   = ""
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    section:            str   = "general"
    order_index:        int   = 0
    pdf_filename:       Optional[str]   = None
    hidden_from_total:  bool  = False
    subitems:           List[SubItemOut] = []
    created_at:         Optional[str]   = None
    updated_at:         Optional[str]   = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_mongo(cls, doc: dict) -> "BudgetItemOut":
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return cls(**doc)
