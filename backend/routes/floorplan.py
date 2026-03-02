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
from db.mongo import get_diagrams_collection, get_pages_collection
from bson import ObjectId

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
async def get_job_images(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        return {"images": [], "total": 0, "status": job.status}
    if not job.project_id:
        return {"images": [], "total": 0, "status": "done"}

    pages_coll = get_pages_collection()
    diagrams_coll = get_diagrams_collection()

    pages = await pages_coll.find({"project": ObjectId(job.project_id)}).to_list(length=None)
    page_map = {p["_id"]: p["page_no"] for p in pages}

    diagrams = await diagrams_coll.find({"project": ObjectId(job.project_id)}).to_list(length=None)
    
    images = []
    for d in diagrams:
        images.append({
            "id": str(d["_id"]),
            "filename": d.get("filename", ""),
            "page_number": page_map.get(d.get("page"), 0),
            "label": d.get("label", ""),
            "diagram_seq": d.get("diagram_seq", ""),
            "sub_index": d.get("sub_index", 0),
            "url": d.get("diagram_image_url", ""),
            "is_selected": d.get("is_selected", False)
        })

    return {"images": images, "total": len(images), "status": "done"}

@router.post("/job/{job_id}/save-selected")
async def save_selected_images(job_id: int, body: dict, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, "Job not complete yet")

    selected_names = set(body.get("selected", []))
    selected_dir   = os.path.join(job.job_dir, "sectioned", "selected")
    os.makedirs(selected_dir, exist_ok=True)

    diagrams_coll = get_diagrams_collection()
    pages_coll = get_pages_collection()

    diagrams = await diagrams_coll.find({"project": ObjectId(job.project_id)}).to_list(length=None)
    pages = await pages_coll.find({"project": ObjectId(job.project_id)}).to_list(length=None)
    page_map = {p["_id"]: p["page_no"] for p in pages}

    # Reset all to not selected first
    await diagrams_coll.update_many({"project": ObjectId(job.project_id)}, {"$set": {"is_selected": False}})
    
    result_images = []
    rel_base = job.job_dir.replace(LOCAL_FILE_DB, "").lstrip("/\\").replace("\\", "/")
    
    for d in diagrams:
        if str(d["_id"]) in selected_names:
            await diagrams_coll.update_one({"_id": d["_id"]}, {"$set": {"is_selected": True}})
            # Optional: update the page is_selected to True if any of its diagrams are selected
            await pages_coll.update_one({"_id": d["page"]}, {"$set": {"is_selected": True}})
            
            # Keep copying the physical files and populating metadata for backward compatibility (selected_images_metadata.json etc)
            rel_source_url = d.get("diagram_image_url", "").replace("/local_file_db/", "").lstrip("/")
            src_path = os.path.join(LOCAL_FILE_DB, rel_source_url)
            dst_path = os.path.join(selected_dir, d.get("filename"))
            if os.path.exists(src_path):
                shutil.copy(src_path, dst_path)
            
            result_images.append({
                "id":            str(d["_id"]),
                "filename":      d.get("filename"),
                "page_number":   page_map.get(d.get("page"), 0),
                "label":         d.get("label"),
                "diagram_seq":   d.get("diagram_seq", "a"),
                "sub_index":     d.get("sub_index", 0),
                "original_path": src_path,
                "saved_path":    dst_path,
                "url":           f"/local_file_db/{rel_base}/sectioned/selected/{d.get('filename')}",
            })

    metadata = {
        "project_id":     job.project_id,
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
