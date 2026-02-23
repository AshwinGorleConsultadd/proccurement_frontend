from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field
from bson import ObjectId


# ── ObjectId helper ────────────────────────────────────────────────────────────
class PyObjectId(str):
    """Lets Pydantic v2 accept MongoDB ObjectId as a plain string."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, _info=None):
        if isinstance(v, ObjectId):
            return str(v)
        if ObjectId.is_valid(str(v)):
            return str(v)
        raise ValueError(f"Invalid ObjectId: {v!r}")


# ── Request body: create a new project ────────────────────────────────────────
class ProjectCreate(BaseModel):
    name:                       str
    description:                Optional[str] = ""
    source_pdf_path:            Optional[str] = None   # path to original PDF

    # These fields are populated later (after processing / editor work)
    selected_diagram_metadata:  Optional[dict] = None
    mask_registry:              Optional[dict] = None
    polygon_registry:           Optional[dict] = None
    group_registry:             Optional[dict] = None


# ── Request body: partial update ──────────────────────────────────────────────
class ProjectUpdate(BaseModel):
    name:                       Optional[str]  = None
    description:                Optional[str]  = None
    source_pdf_path:            Optional[str]  = None
    selected_diagram_metadata:  Optional[dict] = None
    mask_registry:              Optional[dict] = None
    polygon_registry:           Optional[dict] = None
    group_registry:             Optional[dict] = None
    status:                     Optional[str]  = None   # "draft"|"active"|"archived"


# ── Response model ─────────────────────────────────────────────────────────────
class ProjectOut(BaseModel):
    id:                         str            = Field(alias="_id")
    name:                       str
    description:                str            = ""
    status:                     str            = "draft"
    source_pdf_path:            Optional[str]  = None

    selected_diagram_metadata:  Optional[dict] = None
    mask_registry:              Optional[dict] = None
    polygon_registry:           Optional[dict] = None
    group_registry:             Optional[dict] = None

    created_at:                 Optional[str]  = None
    updated_at:                 Optional[str]  = None

    model_config = {"populate_by_name": True}

    @classmethod
    def from_mongo(cls, doc: dict) -> "ProjectOut":
        """Convert a raw MongoDB document → ProjectOut (stringifies ObjectId)."""
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return cls(**doc)
