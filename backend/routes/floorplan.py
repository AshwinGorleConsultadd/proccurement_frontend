import os
import json
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Form, BackgroundTasks
from sqlalchemy.orm import Session
from db.database import get_db, BASE_DIR
from models.sql_models import ProcessingJob, PdfDocument
from schemas.budget import JobOut
from services.pdf_processing import run_processing, LOCAL_FILE_DB, get_yolo_status
from routes.pdf import UPLOAD_DIR

router = APIRouter(prefix="/floorplan", tags=["Floorplan"])

@router.post("/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    pdf_id:       int   = Form(...),
    dpi:          int   = Form(300),
    min_area_pct: float = Form(5.0),
    db: Session = Depends(get_db)
):
    dpi = 300
    pdf_doc = db.query(PdfDocument).filter(PdfDocument.id == pdf_id).first()
    if not pdf_doc:
        raise HTTPException(404, "PDF not found")
    pdf_path = os.path.join(UPLOAD_DIR, pdf_doc.filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(404, "PDF file missing on disk")

    project_id = pdf_doc.project_id
    if not project_id:
        raise HTTPException(400, "PDF is not associated with a MongoDB project")

    # Path: local_file_db/project_{project_id}/pdf_processing/
    job_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing")
    os.makedirs(job_dir, exist_ok=True)

    job = ProcessingJob(
        pdf_id=pdf_id, project_id=project_id, status="pending", step="Queued — waiting to start",
        progress=0, job_dir=job_dir, dpi=dpi,
        min_area_pct=min_area_pct, created_at=datetime.now().isoformat(),
    )
    db.add(job); db.commit(); db.refresh(job)
    job_id = job.id
    background_tasks.add_task(run_processing, job_id, pdf_path, dpi, min_area_pct)
    return JobOut.model_validate(job)

@router.get("/job/{job_id}")
def get_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return JobOut.model_validate(job)

@router.get("/job/{job_id}/images")
def get_job_images(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        return {"images": [], "total": 0, "status": job.status}
    manifest_path = os.path.join(job.job_dir, "sectioned_diagram_registry.json")
    if not os.path.exists(manifest_path):
        return {"images": [], "total": 0, "status": "done"}
    with open(manifest_path) as f:
        data = json.load(f)
    
    # rel_base should be project_699d.../pdf_processing
    rel_base = job.job_dir.replace(LOCAL_FILE_DB, "").lstrip("/\\").replace("\\", "/")
    for img in data["images"]:
        fname = img["filename"]
        img["url"] = f"/local_file_db/{rel_base}/sectioned/{fname}"
    return data

@router.post("/job/{job_id}/save-selected")
def save_selected_images(job_id: int, body: dict, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, "Job not complete yet")

    manifest_path = os.path.join(job.job_dir, "sectioned_diagram_registry.json")
    with open(manifest_path) as f:
        manifest = json.load(f)

    selected_names = set(body.get("selected", []))
    selected_dir   = os.path.join(job.job_dir, "sectioned", "selected")
    os.makedirs(selected_dir, exist_ok=True)

    result_images = []
    rel_base = job.job_dir.replace(LOCAL_FILE_DB, "").lstrip("/\\").replace("\\", "/")
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
                "diagram_seq":   img.get("diagram_seq", "a"),
                "sub_index":     img["sub_index"],
                "original_path": src,
                "saved_path":    dst,
                "url": f"/local_file_db/{rel_base}/sectioned/selected/{img['filename']}",
            })

    metadata = {
        "project_id":     None,
        "total_selected": len(result_images),
        "timestamp":      datetime.now().isoformat(),
        "dpi":            job.dpi,
        "images":         result_images,
    }
    meta_path = os.path.join(selected_dir, "selected_images_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata

@router.get("/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(ProcessingJob).order_by(ProcessingJob.id.desc()).all()
    return [JobOut.model_validate(j) for j in jobs]

@router.get("/yolo-status")
def get_yolo_status_route():
    return get_yolo_status()
