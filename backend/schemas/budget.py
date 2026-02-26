from pydantic import BaseModel
from typing import Optional, List

class BudgetItemCreate(BaseModel):
    spec_no:            str   = ""
    vendor:             str   = "TBD"
    vendor_description: str   = ""
    description:        str   = ""
    room_name:          str   = ""
    page_no:            Optional[int]   = None
    qty:                str   = ""
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    section:            str   = "general"
    insert_relative_to: Optional[int]   = None
    position:           str   = "below"
    pdf_filename:       Optional[str]   = None

class BudgetItemUpdate(BaseModel):
    spec_no:            Optional[str]   = None
    vendor:             Optional[str]   = None
    vendor_description: Optional[str]   = None
    description:        Optional[str]   = None
    room_name:          Optional[str]   = None
    page_no:            Optional[int]   = None
    qty:                Optional[str]   = None
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    pdf_filename:       Optional[str]   = None
    hidden_from_total:  Optional[bool]  = None

class BudgetItemOut(BaseModel):
    id:                 int
    spec_no:            str
    vendor:             str
    vendor_description: str
    description:        str
    room_name:          str
    page_no:            Optional[int]   = None
    qty:                str
    unit_cost:          Optional[float] = None
    extended:           Optional[float] = None
    section:            str
    order_index:        int
    pdf_filename:       Optional[str]   = None
    hidden_from_total:  bool            = False
    class Config:
        from_attributes = True

class PdfDocumentOut(BaseModel):
    id:           int
    filename:     str
    original_name:str
    file_path:    str
    file_size:    int
    section:      str
    page_count:   Optional[int] = None
    uploaded_at:  str
    project_id:   Optional[str] = None
    class Config:
        from_attributes = True

class JobOut(BaseModel):
    id:          int
    pdf_id:      int
    status:      str
    step:        str
    progress:    int
    job_dir:     str
    error_msg:   Optional[str] = None
    created_at:  str
    dpi:         int
    min_area_pct:float
    project_id:  Optional[str] = None
    class Config:
        from_attributes = True

class ProjectSqlCreate(BaseModel):
    name:          str = "Unnamed Project"
    pdf_name:      Optional[str] = None
    job_id:        Optional[int] = None
    image_count:   int = 0
    metadata_path: Optional[str] = None

class ProjectSqlOut(BaseModel):
    id:            int
    name:          str
    pdf_name:      Optional[str] = None
    job_id:        Optional[int] = None
    image_count:   int
    metadata_path: Optional[str] = None
    created_at:    str
    updated_at:    str
    class Config:
        from_attributes = True

class PageUpdateBody(BaseModel):
    add_filenames:    list = []
    remove_filenames: list = []
