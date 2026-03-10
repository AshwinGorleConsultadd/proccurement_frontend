"""
schemas/budget_mongo.py
Pydantic v2 models for MongoDB-backed budget items.
"""
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid



# ── Top-level Budget Item ──────────────────────────────────────────────────────

class BudgetItemCreate(BaseModel):
    spec_no:            str   = ""
    description:        str   = ""
    room:               str   = ""
    project:            str   = ""
    page_no:            Optional[int]   = None
    page_id:            str   = ""
    qty:                str   = "1 Ea."
    unit_cost:          Optional[float] = None
    # Ordering hint — insert above/below another item
    insert_relative_to: Optional[str]   = None   # _id string of neighbour
    position:           str   = "below"           # "above" | "below"
    is_sub_item:        bool  = False
    created_by:         str   = "user"            # "user" or "system"

class BudgetItemUpdate(BaseModel):
    spec_no:            Optional[str]   = None
    description:        Optional[str]   = None
    room:               Optional[str]   = None
    project:            Optional[str]   = None
    page_no:            Optional[int]   = None
    page_id:            Optional[str]   = None
    qty:                Optional[str]   = None
    unit_cost:          Optional[float] = None
    hidden_from_total:  Optional[bool]  = None
    is_sub_item:        Optional[bool]  = None
    created_by:         Optional[str]   = None

class BudgetItemOut(BaseModel):
    id:                 str   = Field(alias="_id")
    project:            str   = ""
    page_id:            str   = ""
    room:               str   = ""  # Will be populated with room name or remain ID if unpopulated
    spec_no:            str   = ""
    description:        str   = ""
    page_no:            Optional[int]   = None
    qty:                str   = ""
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    order_index:        int   = 0
    hidden_from_total:  bool  = False
    is_sub_item:        bool  = False
    created_by:         str   = "user"
    subitems:           List['BudgetItemOut'] = []
    created_at:         Optional[str]   = None
    updated_at:         Optional[str]   = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_mongo(cls, doc: dict) -> "BudgetItemOut":
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return cls(**doc)
