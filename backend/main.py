from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import os, shutil, json, glob
from datetime import datetime
from dotenv import load_dotenv

# Load .env before anything else
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ─── MongoDB router ────────────────────────────────────────────────────────────
from routes.projects import router as projects_router
from db.mongo import get_client

# ─── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'budget.db')}"
UPLOAD_DIR   = os.path.join(BASE_DIR, "uploads", "pdfs")
PROC_DIR     = os.path.join(BASE_DIR, "local_pdf_processing")  # per-job subdirs live here
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROC_DIR,   exist_ok=True)

# ─── Load DocLayout-YOLO model at startup ─────────────────────────────────────
_yolo_model       = None
_yolo_load_error  = None

def _load_yolo_model():
    global _yolo_model, _yolo_load_error
    try:
        from doclayout_yolo import YOLOv10
        model_path = os.path.join(BASE_DIR, "doclayout_yolo_docstructbench_imgsz1024.pt")
        if not os.path.exists(model_path):
            _yolo_load_error = f"Model weights not found at: {model_path}"
            print(f"[YOLO] ⚠️  {_yolo_load_error}")
            return
        print("[YOLO] Loading model…")
        _yolo_model = YOLOv10(model_path)
        print(f"[YOLO] ✅ Model loaded. Classes: {list(_yolo_model.names.values())}")
    except Exception as e:
        _yolo_load_error = str(e)
        print(f"[YOLO] ❌ Failed to load model: {e}")

_load_yolo_model()   # runs once on startup

# ─── DB ────────────────────────────────────────────────────────────────────────
engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()

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

# Job status table
class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id          = Column(Integer, primary_key=True, index=True)
    pdf_id      = Column(Integer)
    status      = Column(String, default="pending")   # pending|processing|done|error
    step        = Column(String, default="")
    progress    = Column(Integer, default=0)
    job_dir     = Column(String, default="")
    error_msg   = Column(String, nullable=True)
    created_at  = Column(String)
    dpi         = Column(Integer, default=300)
    min_area_pct= Column(Float,  default=5.0)

# Projects table
class Project(Base):
    __tablename__ = "projects"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String,  default="Unnamed Project")
    pdf_name      = Column(String,  nullable=True)
    job_id        = Column(Integer, nullable=True)
    image_count   = Column(Integer, default=0)
    metadata_path = Column(String,  nullable=True)   # abs path to selected_images_metadata.json
    created_at    = Column(String)
    updated_at    = Column(String)

Base.metadata.create_all(bind=engine)

# ─── Seed ──────────────────────────────────────────────────────────────────────
def seed_data():
    db = SessionLocal()
    try:
        if db.query(BudgetItem).count() == 0:
            seeds = [
                BudgetItem(spec_no="DC-01",   vendor="TBD", vendor_description="Decorative Pendant",
                           description="Lobby Mail/Sitting", room_name="Club Room",       page_no=1,
                           qty="1 Ea.", unit_cost=350,  extended=350,  section="general", order_index=0),
                BudgetItem(spec_no="LOB-200", vendor="TBD", vendor_description="Coffee Table",
                           description="Lobby Mail/Sitting", room_name="Club Room",       page_no=1,
                           qty="1 Ea.", unit_cost=1350, extended=1350, section="general", order_index=1),
                BudgetItem(spec_no="LOB-200", vendor="TBD", vendor_description="Coffee Table",
                           description="Lobby Livingroom",  room_name="Game Room",        page_no=2,
                           qty="1 Ea.", unit_cost=1350, extended=1350, section="general", order_index=2),
                BudgetItem(spec_no="LOB-201", vendor="TBD", vendor_description="Console",
                           description="Lobby Mail/Sitting", room_name="Game Room",       page_no=2,
                           qty="1 Ea.", unit_cost=1600, extended=1600, section="general", order_index=3),
                BudgetItem(spec_no="LOB-202", vendor="TBD", vendor_description="Media Cabinet",
                           description="Lobby Livingroom",  room_name="Conference Room",  page_no=3,
                           qty="1 Ea.", unit_cost=2800, extended=2800, section="general", order_index=4),
            ]
            db.add_all(seeds)
            db.commit()
    finally:
        db.close()

seed_data()

# ─── Pydantic schemas ──────────────────────────────────────────────────────────
class BudgetItemCreate(BaseModel):
    spec_no:            str   = ""
    vendor:             str   = "TBD"
    vendor_description: str   = ""
    description:        str   = ""
    room_name:          str   = ""
    page_no:            int   = None
    qty:                str   = ""
    unit_cost:          float = None
    extended:           float = None
    section:            str   = "general"
    insert_relative_to: int   = None
    position:           str   = "below"
    pdf_filename:       str   = None

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
    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name:          str = "Unnamed Project"
    pdf_name:      Optional[str] = None
    job_id:        Optional[int] = None
    image_count:   int = 0
    metadata_path: Optional[str] = None

class ProjectOut(BaseModel):
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

# ─── App lifespan (MongoDB connect / disconnect) ──────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — verify MongoDB connection
    try:
        client = get_client()
        await client.admin.command("ping")
        print("[MongoDB] ✅ Connected to Atlas")
    except Exception as e:
        print(f"[MongoDB] ⚠️  Could not connect: {e}")
    yield
    # Shutdown — close MongoDB connection
    client = get_client()
    client.close()
    print("[MongoDB] 🔌 Connection closed")

app = FastAPI(title="Procurement and Co. API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_path = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads",              StaticFiles(directory=uploads_path), name="uploads")
app.mount("/local_pdf_processing", StaticFiles(directory=PROC_DIR),     name="local_pdf_processing")

# ─── Mount routers ─────────────────────────────────────────────────────────────
app.include_router(projects_router)   # MongoDB-backed /projects/* endpoints

# ─── Budget endpoints ──────────────────────────────────────────────────────────
@app.get("/budget/{section}")
def get_budget(
    section:       str,
    page:          int  = Query(1, ge=1),
    search:        str  = Query(""),
    group_by_page: bool = Query(False),
    group_by_room: bool = Query(False),
):
    db = SessionLocal()
    try:
        q = db.query(BudgetItem).filter(BudgetItem.section == section)
        if search:
            q = q.filter(BudgetItem.spec_no.ilike(f"%{search}%"))
        total          = q.count()
        total_subtotal = sum(i.extended or 0 for i in q.all())
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
        }
    finally:
        db.close()

@app.post("/budget/item")
def create_budget_item(item: BudgetItemCreate):
    db = SessionLocal()
    try:
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
    finally:
        db.close()

@app.put("/budget/item/{item_id}")
def update_budget_item(item_id: int, item: BudgetItemUpdate):
    db = SessionLocal()
    try:
        db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
        if not db_item:
            raise HTTPException(404, "Item not found")
        for field, value in item.model_dump(exclude_none=True).items():
            setattr(db_item, field, value)

        # Auto-recalculate extended = qty_number × unit_cost
        import re
        qty_str = db_item.qty or "1"
        qty_match = re.match(r'[\s]*([0-9]+(?:\.[0-9]*)?)', qty_str)
        qty_num = float(qty_match.group(1)) if qty_match else 1.0
        if db_item.unit_cost is not None:
            db_item.extended = round(qty_num * db_item.unit_cost, 2)

        db.commit(); db.refresh(db_item)
        return BudgetItemOut.model_validate(db_item)
    finally:
        db.close()

@app.delete("/budget/item/{item_id}")
def delete_budget_item(item_id: int):
    db = SessionLocal()
    try:
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
    finally:
        db.close()

# ─── PDF upload ────────────────────────────────────────────────────────────────
@app.post("/pdf/upload")
async def upload_pdf(file: UploadFile = File(...), section: str = Form("general")):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    content   = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    file_size = os.path.getsize(file_path)

    # Try to get page count via PyMuPDF if available
    page_count = None
    try:
        import fitz
        doc        = fitz.open(file_path)
        page_count = doc.page_count
        doc.close()
    except Exception:
        pass

    db = SessionLocal()
    try:
        doc = PdfDocument(
            filename=safe_name, original_name=file.filename,
            file_path=f"/uploads/pdfs/{safe_name}",
            file_size=file_size, section=section,
            page_count=page_count,
            uploaded_at=datetime.now().isoformat(),
        )
        db.add(doc); db.commit(); db.refresh(doc)
        return PdfDocumentOut.model_validate(doc)
    finally:
        db.close()

@app.get("/pdf/list")
def list_pdfs(section: str = Query("general")):
    db = SessionLocal()
    try:
        docs = db.query(PdfDocument).filter(PdfDocument.section == section).all()
        return [PdfDocumentOut.model_validate(d) for d in docs]
    finally:
        db.close()

@app.delete("/pdf/{pdf_id}")
def delete_pdf(pdf_id: int):
    db = SessionLocal()
    try:
        doc = db.query(PdfDocument).filter(PdfDocument.id == pdf_id).first()
        if not doc:
            raise HTTPException(404, "PDF not found")
        full_path = os.path.join(UPLOAD_DIR, doc.filename)
        if os.path.exists(full_path):
            os.remove(full_path)
        db.delete(doc); db.commit()
        return {"ok": True}
    finally:
        db.close()

# ─── PDF Processing (Floor Plan) ───────────────────────────────────────────────

def _update_job(db, job, **kwargs):
    for k, v in kwargs.items():
        setattr(job, k, v)
    db.commit()


# ── Helper: DocLayout-YOLO crop (mirrors doclayout.py logic) ──────────────────
def _yolo_crop_page(img_path: str, out_path: str) -> bool:
    """
    Run DocLayout-YOLO on a single page image.
    Finds the best box (prioritising 'figure' and 'table'), crops it, saves to out_path.
    Returns True if a crop was made, False if falling back to full image.
    """
    if _yolo_model is None:
        return False

    import cv2

    PRIORITY = {"figure", "table"}
    IGNORE   = {"abandon", "plain text", "table_footnote",
                 "figure_caption", "table_caption"}

    try:
        img = cv2.imread(img_path)
        if img is None:
            return False
        h, w = img.shape[:2]

        results = _yolo_model.predict(img_path, imgsz=1024, conf=0.25, device="cpu")

        best_score, best_box = -1.0, None

        for r in results:
            for box in r.boxes:
                cls_name = _yolo_model.names[int(box.cls[0])]
                if cls_name in IGNORE:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                area  = (x2 - x1) * (y2 - y1)
                score = float(box.conf[0]) * area
                if cls_name in PRIORITY:
                    score *= 10.0
                if score > best_score:
                    best_score, best_box = score, (x1, y1, x2, y2)

        if best_box is not None:
            x1, y1, x2, y2 = best_box
            # Add a small padding (10 px) to avoid clipping edges
            pad = 10
            x1 = max(0, x1 - pad); y1 = max(0, y1 - pad)
            x2 = min(w, x2 + pad); y2 = min(h, y2 + pad)
            crop = img[y1:y2, x1:x2]
            cv2.imwrite(out_path, crop)
            print(f"[YOLO] ✅ cropped {os.path.basename(img_path)} → box ({x1},{y1},{x2},{y2})")
            return True
        else:
            print(f"[YOLO] ⚠️  no detections for {os.path.basename(img_path)}, using full page")
            return False

    except Exception as e:
        print(f"[YOLO] ❌ error on {os.path.basename(img_path)}: {e}")
        return False


# ── Helper: OpenCV multi-diagram detection (mirrors split_diagram.py logic) ───
def _detect_multiple_diagrams(image_path: str, min_area_ratio: float = 0.05):
    """
    Detect if an image contains multiple separate diagrams using connected-component analysis.
    Returns list of region dicts: {label, x_percent, y_percent, width_percent, height_percent}
    Returns a single 'full' region if only one diagram is detected.
    """
    import cv2

    image = cv2.imread(image_path)
    if image is None:
        return [{"label": "full", "x_percent": 0, "y_percent": 0,
                 "width_percent": 100, "height_percent": 100}]

    height, width = image.shape[:2]
    total_area = height * width

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = total_area * min_area_ratio
    valid_regions = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area >= min_area:
            valid_regions.append({
                "x": x, "y": y, "width": w, "height": h, "area": area,
                "x_percent":      (x / width)  * 100,
                "y_percent":      (y / height) * 100,
                "width_percent":  (w / width)  * 100,
                "height_percent": (h / height) * 100,
            })

    # Sort by area descending
    valid_regions.sort(key=lambda r: r["area"], reverse=True)

    # Single region or none
    if len(valid_regions) <= 1:
        return [{"label": "full", "x_percent": 0, "y_percent": 0,
                 "width_percent": 100, "height_percent": 100}]

    # Largest region covers most of image  → single diagram
    if valid_regions[0]["area"] > total_area * 0.70:
        return [{"label": "full", "x_percent": 0, "y_percent": 0,
                 "width_percent": 100, "height_percent": 100}]

    # Multiple diagrams — assign positional labels
    diagram_regions = []
    for idx, region in enumerate(valid_regions[:4]):   # max 4 sub-regions
        yp = region["y_percent"]
        xp = region["x_percent"]
        wp = region["width_percent"]

        if yp < 40:
            label = "top-left"  if xp < 50 else "top-right"
        else:
            label = "bottom-left" if xp < 50 else "bottom-right"

        # Wide bottom region → just "bottom"
        if yp > 50 and wp > 60:
            label = "bottom"

        diagram_regions.append({
            "label":          label,
            "x_percent":      region["x_percent"],
            "y_percent":      region["y_percent"],
            "width_percent":  region["width_percent"],
            "height_percent": region["height_percent"],
        })

    return diagram_regions


# ── Helper: crop and save sub-regions ─────────────────────────────────────────
def _crop_regions(image_path: str, page_num: int, regions, out_dir: str):
    """
    Given a list of region dicts (from _detect_multiple_diagrams),
    crop each from the image and save to out_dir.
    Returns list of (out_path, filename, label, diagram_seq) tuples.
    diagram_seq is '' for a single-diagram page, or 'a'/'b'/... for multi-diagram pages.
    """
    import cv2

    image = cv2.imread(image_path)
    if image is None:
        return []

    height, width = image.shape[:2]
    created = []

    for idx, region in enumerate(regions):
        x = int(region["x_percent"] * width  / 100)
        y = int(region["y_percent"] * height / 100)
        w = int(region["width_percent"]  * width  / 100)
        h = int(region["height_percent"] * height / 100)

        # Clamp
        x = max(0, min(x, width  - 1))
        y = max(0, min(y, height - 1))
        w = max(1, min(w, width  - x))
        h = max(1, min(h, height - y))

        cropped = image[y:y+h, x:x+w]

        # diagram_seq is ALWAYS a letter — 'a' for single-diagram, 'a'/'b'/… for multi
        sub_letter  = chr(ord("a") + idx)          # idx=0 → 'a', idx=1 → 'b', …
        diagram_seq = sub_letter
        filename    = f"crop{page_num}.{sub_letter}.png"

        out_path = os.path.join(out_dir, filename)
        cv2.imwrite(out_path, cropped)
        created.append((out_path, filename, region["label"], diagram_seq))

    return created


# ── Main background processing task ───────────────────────────────────────────
def _run_processing(job_id: int, pdf_path: str, dpi: int, min_area_pct: float):
    """
    Full pipeline:
      Step 1  PDF → 300-DPI page images
      Step 2  DocLayout-YOLO → crop main content area per page
      Step 3  OpenCV         → detect & split multiple sub-diagrams
      Writes manifest.json on completion.
    """
    db  = SessionLocal()
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        db.close(); return

    job_dir       = job.job_dir
    temp_dir      = os.path.join(job_dir, "temp")       # raw PDF page images
    crops_dir     = os.path.join(job_dir, "sectioned")  # YOLO-cropped diagram images
    sectioned_dir = os.path.join(job_dir, "sectioned")  # sub-split diagrams (same folder)
    os.makedirs(temp_dir,      exist_ok=True)
    os.makedirs(crops_dir,     exist_ok=True)

    try:
        # ── STEP 1: PDF → page images ─────────────────────────────────────────
        _update_job(db, job,
                    status="processing",
                    step="Step 1/3 — Converting PDF to images (300 DPI)",
                    progress=5)
        import fitz
        pdf_doc     = fitz.open(pdf_path)
        total_pages = pdf_doc.page_count
        zoom        = dpi / 72
        mat         = fitz.Matrix(zoom, zoom)
        page_paths  = []

        for i, page in enumerate(pdf_doc):
            pix  = page.get_pixmap(matrix=mat)
            name = os.path.join(temp_dir, f"page_{i+1}_{dpi}dpi.png")
            pix.save(name)
            page_paths.append(name)
            prog = 5 + int(25 * (i + 1) / total_pages)
            _update_job(db, job, progress=prog)
        pdf_doc.close()
        print(f"[JOB {job_id}] Step 1 done — {len(page_paths)} page images")

        # ── STEP 2: DocLayout-YOLO crop ───────────────────────────────────────
        yolo_available = _yolo_model is not None
        if yolo_available:
            _update_job(db, job,
                        step="Step 2/3 — Extracting main areas with DocLayout-YOLO",
                        progress=30)
        else:
            warn = _yolo_load_error or "doclayout_yolo not available"
            _update_job(db, job,
                        step=f"Step 2/3 — YOLO unavailable ({warn}), using full pages",
                        progress=30)

        crop_paths = []
        for idx, img_path in enumerate(page_paths):
            out_path = os.path.join(crops_dir, f"crop{idx+1}.png")
            if yolo_available:
                cropped = _yolo_crop_page(img_path, out_path)
            else:
                cropped = False

            if not cropped:
                # Fallback: use the full page image
                shutil.copy(img_path, out_path)

            crop_paths.append(out_path)
            prog = 30 + int(30 * (idx + 1) / len(page_paths))
            _update_job(db, job, progress=prog)

        print(f"[JOB {job_id}] Step 2 done — {len(crop_paths)} crops")

        # ── STEP 3: OpenCV diagram splitting ──────────────────────────────────
        _update_job(db, job,
                    step="Step 3/3 — Detecting and splitting multiple diagrams",
                    progress=62)

        min_area_ratio = min_area_pct / 100.0
        all_images     = []

        for idx, crop_path in enumerate(crop_paths):
            page_num = idx + 1

            if not os.path.exists(crop_path):
                print(f"[JOB {job_id}] ⚠️  crop not found: {crop_path}")
                continue

            # Detect whether there are multiple sub-diagrams
            regions = _detect_multiple_diagrams(crop_path, min_area_ratio=min_area_ratio)
            print(f"[JOB {job_id}] Page {page_num}: {len(regions)} region(s) → {[r['label'] for r in regions]}")

            if len(regions) == 1 and regions[0]["label"] == "full":
                # Single diagram — copy as-is, but still use 'a' as diagram_seq
                filename_single = f"crop{page_num}.a.png"
                dest = os.path.join(sectioned_dir, filename_single)
                shutil.copy2(crop_path, dest)
                all_images.append({
                    "path":        dest,
                    "filename":    filename_single,
                    "label":       "full",
                    "diagram_seq": "a",    # always 'a' — consistent with multi-diagram convention
                    "page_num":    page_num,
                    "sub_index":   0,
                })
            else:
                # Multiple diagrams — crop each sub-region
                created = _crop_regions(crop_path, page_num, regions, sectioned_dir)
                for si, (out_path, filename, label, diagram_seq) in enumerate(created):
                    all_images.append({
                        "path":        out_path,
                        "filename":    filename,
                        "label":       label,
                        "diagram_seq": diagram_seq,
                        "page_num":    page_num,
                        "sub_index":   si,
                    })

            prog = 62 + int(35 * (idx + 1) / len(crop_paths))
            _update_job(db, job, progress=prog)

        # Save manifest
        manifest_path = os.path.join(job_dir, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump({"images": all_images, "total": len(all_images)}, f, indent=2)

        print(f"[JOB {job_id}] ✅ Done — {len(all_images)} output images in manifest")
        _update_job(db, job, status="done", step="Complete — all steps finished", progress=100)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[JOB {job_id}] ❌ Fatal error:\n{tb}")
        _update_job(db, job, status="error", error_msg=str(e), progress=0,
                    step=f"Error: {str(e)}")
    finally:
        db.close()


# ─── Floor-plan API endpoints ──────────────────────────────────────────────────

@app.post("/floorplan/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    pdf_id:       int   = Form(...),
    dpi:          int   = Form(300),
    min_area_pct: float = Form(5.0),
):
    dpi = 300   # always 300 DPI
    db = SessionLocal()
    try:
        pdf_doc = db.query(PdfDocument).filter(PdfDocument.id == pdf_id).first()
        if not pdf_doc:
            raise HTTPException(404, "PDF not found")
        pdf_path = os.path.join(UPLOAD_DIR, pdf_doc.filename)
        if not os.path.exists(pdf_path):
            raise HTTPException(404, "PDF file missing on disk")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        job_dir   = os.path.join(PROC_DIR, f"tmp_{timestamp}_{pdf_id}")  # renamed to project_N on project creation
        os.makedirs(job_dir, exist_ok=True)

        job = ProcessingJob(
            pdf_id=pdf_id, status="pending", step="Queued — waiting to start",
            progress=0, job_dir=job_dir, dpi=dpi,
            min_area_pct=min_area_pct, created_at=datetime.now().isoformat(),
        )
        db.add(job); db.commit(); db.refresh(job)
        job_id = job.id
        background_tasks.add_task(_run_processing, job_id, pdf_path, dpi, min_area_pct)
        return JobOut.model_validate(job)
    finally:
        db.close()


@app.get("/floorplan/job/{job_id}")
def get_job_status(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(404, "Job not found")
        return JobOut.model_validate(job)
    finally:
        db.close()


@app.get("/floorplan/job/{job_id}/images")
def get_job_images(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(404, "Job not found")
        if job.status != "done":
            return {"images": [], "total": 0, "status": job.status}
        manifest_path = os.path.join(job.job_dir, "manifest.json")
        if not os.path.exists(manifest_path):
            return {"images": [], "total": 0, "status": "done"}
        with open(manifest_path) as f:
            data = json.load(f)
        # Convert absolute paths to relative URLs served by /local_pdf_processing mount
        rel_base = job.job_dir.replace(PROC_DIR, "").lstrip("/\\")
        for img in data["images"]:
            fname    = img["filename"]
            img["url"] = f"/local_pdf_processing/{rel_base}/sectioned/{fname}"
        return data
    finally:
        db.close()


@app.post("/floorplan/job/{job_id}/save-selected")
def save_selected_images(job_id: int, body: dict):
    """
    body: { "selected": ["crop1.png", "crop2.a.png", ...] }
    Copies files to selected_images/ subdirectory and writes metadata JSON.
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            raise HTTPException(404, "Job not found")
        if job.status != "done":
            raise HTTPException(400, "Job not complete yet")

        manifest_path = os.path.join(job.job_dir, "manifest.json")
        with open(manifest_path) as f:
            manifest = json.load(f)

        selected_names = set(body.get("selected", []))
        # Temporary staging area inside the job folder (images will move to project_N/final/ on project creation)
        selected_dir   = os.path.join(job.job_dir, "sectioned", "selected")
        os.makedirs(selected_dir, exist_ok=True)

        result_images = []
        rel_base = job.job_dir.replace(PROC_DIR, "").lstrip("/\\")
        for img in manifest["images"]:
            if img["filename"] in selected_names:
                src = img["path"]
                dst = os.path.join(selected_dir, img["filename"])
                if os.path.exists(src):
                    shutil.copy(src, dst)
                result_images.append({
                    "filename":      img["filename"],
                    "page_number":   img["page_num"],
                    "label":         img["label"],
                    "diagram_seq":   img.get("diagram_seq", "a"),  # always a letter; 'a' for single-diagram
                    "sub_index":     img["sub_index"],
                    "original_path": src,
                    "saved_path":    dst,
                    "url": f"/local_pdf_processing/{rel_base}/sectioned/selected/{img['filename']}",
                })

        metadata = {
            "project_id":     None,            # filled in by create_project (will be MongoDB _id)
            "total_selected": len(result_images),
            "timestamp":      datetime.now().isoformat(),
            "dpi":            job.dpi,
            "images":         result_images,
        }
        meta_path = os.path.join(selected_dir, "selected_images_metadata.json")
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        return metadata
    finally:
        db.close()


@app.get("/floorplan/jobs")
def list_jobs():
    db = SessionLocal()
    try:
        jobs = db.query(ProcessingJob).order_by(ProcessingJob.id.desc()).all()
        return [JobOut.model_validate(j) for j in jobs]
    finally:
        db.close()


# ─── Debug / Health ────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":      "ok",
        "service":     "Procurement and Co. API v2",
        "yolo_ready":  _yolo_model is not None,
        "yolo_error":  _yolo_load_error,
    }

@app.get("/floorplan/yolo-status")
def yolo_status():
    """Check whether the YOLO model loaded successfully."""
    return {
        "model_loaded": _yolo_model is not None,
        "error":        _yolo_load_error,
        "model_path":   os.path.join(BASE_DIR, "doclayout_yolo_docstructbench_imgsz1024.pt"),
        "model_exists": os.path.exists(os.path.join(BASE_DIR, "doclayout_yolo_docstructbench_imgsz1024.pt")),
        "classes":      list(_yolo_model.names.values()) if _yolo_model else [],
    }


# ─── Project endpoints are handled by MongoDB router (routes/projects.py) ──────
# POST   /projects              → create
# GET    /projects              → list all
# GET    /projects/{id}         → get one (with selected_diagram_metadata)
# PATCH  /projects/{id}         → update fields
# DELETE /projects/{id}         → delete
# POST   /projects/{id}/attach-metadata  → sync processing JSON → MongoDB





# ── Upload external image to project ────────────────────────────────────────
PROJECT_UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "project_images")
os.makedirs(PROJECT_UPLOADS_DIR, exist_ok=True)

@app.post("/projects/{project_id}/upload-image")
async def upload_image_to_project(
    project_id: int,
    file: UploadFile = File(...),
    page_number: int = Form(1),
    label: str = Form("UPLOADED"),
):
    """Upload an external image file and add it to the project's saved pages."""
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise HTTPException(404, "Project not found")

        # Save file to a per-project subfolder
        proj_upload_dir = os.path.join(PROJECT_UPLOADS_DIR, f"project_{project_id}")
        os.makedirs(proj_upload_dir, exist_ok=True)

        # Sanitise filename to avoid collisions
        original_name = os.path.basename(file.filename or "upload.png")
        base, ext = os.path.splitext(original_name)
        unique_name = f"{base}_{int(datetime.now().timestamp()*1000)}{ext or '.png'}"
        dest_path = os.path.join(proj_upload_dir, unique_name)

        contents = await file.read()
        with open(dest_path, "wb") as f_out:
            f_out.write(contents)

        # Relative URL served by /uploads static mount
        rel_url = f"/uploads/project_images/project_{project_id}/{unique_name}"

        new_entry = {
            "filename": unique_name,
            "url": rel_url,
            "page_number": page_number,
            "label": label,
            "source": "uploaded",
        }

        # Load / create metadata JSON
        if proj.metadata_path and os.path.exists(proj.metadata_path):
            with open(proj.metadata_path) as mf:
                metadata = json.load(mf)
        else:
            # Create a fresh metadata file next to the db
            meta_dir = os.path.join(BASE_DIR, "project_metadata")
            os.makedirs(meta_dir, exist_ok=True)
            meta_path = os.path.join(meta_dir, f"project_{project_id}.json")
            metadata = {"project_id": project_id, "images": []}
            proj.metadata_path = meta_path
            db.commit()

        if "images" not in metadata:
            metadata["images"] = []
        metadata["images"].append(new_entry)

        with open(proj.metadata_path, "w") as mf:
            json.dump(metadata, mf, indent=2)

        # Update image count on project row
        proj.image_count = len(metadata["images"])
        proj.updated_at = datetime.now().isoformat()
        db.commit()

        return {"ok": True, "image": new_entry}
    finally:
        db.close()

@app.get("/projects/{project_id}/pages")
def get_project_pages(project_id: int):
    """
    Return the list of images stored in the project's metadata JSON.
    Each entry: {filename, page_number, label, sub_index, url, saved_path, original_path}
    """
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise HTTPException(404, "Project not found")
        if not proj.metadata_path or not os.path.exists(proj.metadata_path):
            return {"images": [], "total_selected": 0}
        with open(proj.metadata_path) as f:
            data = json.load(f)
        return data
    finally:
        db.close()


class PageUpdateBody(BaseModel):
    """Body for adding or removing pages from a project's metadata JSON."""
    add_filenames:    list = []   # filenames to add (must exist in sectioned_crops)
    remove_filenames: list = []   # filenames to remove from the saved list


@app.patch("/projects/{project_id}/pages")
def update_project_pages(project_id: int, body: PageUpdateBody):
    """
    Add or remove images from a project's saved_images_metadata.json.
    - remove_filenames: list of filenames to drop from 'images'
    - Returns the updated metadata and updates image_count in DB.
    """
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise HTTPException(404, "Project not found")
        if not proj.metadata_path or not os.path.exists(proj.metadata_path):
            raise HTTPException(404, "Metadata file not found on disk")

        with open(proj.metadata_path) as f:
            metadata = json.load(f)

        images: list = metadata.get("images", [])

        # ── Remove ────────────────────────────────────────────────────────────
        if body.remove_filenames:
            remove_set = set(body.remove_filenames)
            images = [img for img in images if img["filename"] not in remove_set]

        # ── Add ───────────────────────────────────────────────────────────────
        if body.add_filenames:
            # Resolve from the job's sectioned/ dir (sibling of selected/)
            selected_dir  = os.path.dirname(proj.metadata_path)    # …/selected
            sectioned_dir = os.path.dirname(selected_dir)           # …/sectioned
            job_dir       = os.path.dirname(sectioned_dir)          # …/project_N or tmp_XXXXX

            # Build a lookup of everything in sectioned/ (and sub-dirs)
            existing_filenames = {img["filename"] for img in images}

            # Load the original manifest to get metadata for requested files
            manifest_path = os.path.join(job_dir, "manifest.json")
            manifest_images = []
            if os.path.exists(manifest_path):
                with open(manifest_path) as mf:
                    manifest_data = json.load(mf)
                manifest_images = manifest_data.get("images", [])

            manifest_lookup = {img["filename"]: img for img in manifest_images}

            # Relative path base for URLs
            rel_base = job_dir.replace(PROC_DIR, "").lstrip("/\\")

            for fname in body.add_filenames:
                if fname in existing_filenames:
                    continue  # already present

                src = os.path.join(sectioned_dir, fname)
                if not os.path.exists(src):
                    continue  # source image not found – skip

                dst = os.path.join(selected_dir, fname)
                shutil.copy2(src, dst)

                manifest_entry = manifest_lookup.get(fname, {})
                images.append({
                    "filename":      fname,
                    "page_number":   manifest_entry.get("page_num", 0),
                    "label":         manifest_entry.get("label", "full"),
                    "sub_index":     manifest_entry.get("sub_index", 0),
                    "original_path": manifest_entry.get("path", src),
                    "saved_path":    dst,
                    "url":           f"/local_pdf_processing/{rel_base}/sectioned/selected/{fname}",
                })
                existing_filenames.add(fname)

        # ── Persist ───────────────────────────────────────────────────────────
        metadata["images"]         = images
        metadata["total_selected"] = len(images)
        metadata["timestamp"]      = datetime.now().isoformat()

        with open(proj.metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        # Sync DB
        proj.image_count = len(images)
        proj.updated_at  = datetime.now().isoformat()
        db.commit(); db.refresh(proj)

        return metadata
    finally:
        db.close()


@app.get("/projects/{project_id}/available-pages")
def get_available_pages(project_id: int):
    """
    Return ALL images in the sectioned_crops directory for the project's job,
    so the UI can offer them for adding back to the project.
    """
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise HTTPException(404, "Project not found")
        if not proj.metadata_path or not os.path.exists(proj.metadata_path):
            return {"images": [], "total": 0}

        selected_dir  = os.path.dirname(proj.metadata_path)
        sectioned_dir = os.path.dirname(selected_dir)
        job_dir       = os.path.dirname(sectioned_dir)

        manifest_path = os.path.join(job_dir, "manifest.json")
        if not os.path.exists(manifest_path):
            return {"images": [], "total": 0}

        with open(manifest_path) as f:
            manifest_data = json.load(f)

        rel_base = job_dir.replace(PROC_DIR, "").lstrip("/\\")
        images = []
        for img in manifest_data.get("images", []):
            images.append({
                "filename":  img["filename"],
                "page_num":  img["page_num"],
                "label":     img["label"],
                "sub_index": img["sub_index"],
                "url":       f"/local_pdf_processing/{rel_base}/sectioned/{img['filename']}",
            })

        return {"images": images, "total": len(images)}
    finally:
        db.close()

