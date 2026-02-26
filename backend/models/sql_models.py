from sqlalchemy import Column, Integer, String, Float, Boolean
from db.database import Base

class BudgetItem(Base):
    __tablename__ = "budget_items"
    id                = Column(Integer, primary_key=True, index=True)
    spec_no           = Column(String,  default="")
    vendor            = Column(String,  default="TBD")
    vendor_description= Column(String,  default="")
    description       = Column(String,  default="")
    room_name         = Column(String,  default="")
    page_no           = Column(Integer, nullable=True)
    qty               = Column(String,  default="")
    unit_cost         = Column(Float,   nullable=True)
    extended          = Column(Float,   nullable=True)
    section           = Column(String,  default="general")
    order_index       = Column(Integer, index=True, default=0)
    pdf_filename      = Column(String,  nullable=True)
    hidden_from_total = Column(Boolean,  default=False, nullable=False, server_default='0')

class PdfDocument(Base):
    __tablename__ = "pdf_documents"
    id            = Column(Integer, primary_key=True, index=True)
    filename      = Column(String)
    original_name = Column(String)
    file_path     = Column(String)
    file_size     = Column(Integer)
    section       = Column(String, default="general")
    page_count    = Column(Integer, nullable=True)
    uploaded_at   = Column(String)
    project_id    = Column(String, nullable=True)

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id          = Column(Integer, primary_key=True, index=True)
    pdf_id      = Column(Integer)
    status      = Column(String, default="pending")
    step        = Column(String, default="")
    progress    = Column(Integer, default=0)
    job_dir     = Column(String, default="")
    error_msg   = Column(String, nullable=True)
    created_at  = Column(String)
    dpi         = Column(Integer, default=300)
    min_area_pct= Column(Float,  default=5.0)
    project_id  = Column(String, nullable=True)

class ProjectSql(Base):
    __tablename__ = "projects"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String,  default="Unnamed Project")
    pdf_name      = Column(String,  nullable=True)
    job_id        = Column(Integer, nullable=True)
    image_count   = Column(Integer, default=0)
    metadata_path = Column(String,  nullable=True)
    created_at    = Column(String)
    updated_at    = Column(String)
