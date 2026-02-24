import os
import json
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from sqlalchemy.orm import Session
from db.database import get_db, BASE_DIR
from models.sql_models import ProjectSql
from schemas.budget import PageUpdateBody
from services.pdf_processing import LOCAL_FILE_DB

router = APIRouter(prefix="/projects", tags=["Projects (SQL)"])

PROJECT_UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "project_images")
os.makedirs(PROJECT_UPLOADS_DIR, exist_ok=True)

@router.post("/{project_id}/upload-image")
async def upload_image_to_project(
    project_id: int,
    file: UploadFile = File(...),
    page_number: int = Form(1),
    label: str = Form("UPLOADED"),
    db: Session = Depends(get_db)
):
    proj = db.query(ProjectSql).filter(ProjectSql.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")

    proj_upload_dir = os.path.join(PROJECT_UPLOADS_DIR, f"project_{project_id}")
    os.makedirs(proj_upload_dir, exist_ok=True)

    original_name = os.path.basename(file.filename or "upload.png")
    base, ext = os.path.splitext(original_name)
    unique_name = f"{base}_{int(datetime.now().timestamp()*1000)}{ext or '.png'}"
    dest_path = os.path.join(proj_upload_dir, unique_name)

    contents = await file.read()
    with open(dest_path, "wb") as f_out:
        f_out.write(contents)

    rel_url = f"/uploads/project_images/project_{project_id}/{unique_name}"

    new_entry = {
        "filename": unique_name,
        "url": rel_url,
        "page_number": page_number,
        "label": label,
        "source": "uploaded",
    }

    if proj.metadata_path and os.path.exists(proj.metadata_path):
        with open(proj.metadata_path) as mf:
            metadata = json.load(mf)
    else:
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

    proj.image_count = len(metadata["images"])
    proj.updated_at = datetime.now().isoformat()
    db.commit()

    return {"ok": True, "image": new_entry}

@router.get("/{project_id}/pages")
def get_project_pages(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(ProjectSql).filter(ProjectSql.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    if not proj.metadata_path or not os.path.exists(proj.metadata_path):
        return {"images": [], "total_selected": 0}
    with open(proj.metadata_path) as f:
        data = json.load(f)
    return data

@router.patch("/{project_id}/pages")
def update_project_pages(project_id: int, body: PageUpdateBody, db: Session = Depends(get_db)):
    proj = db.query(ProjectSql).filter(ProjectSql.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    if not proj.metadata_path or not os.path.exists(proj.metadata_path):
        raise HTTPException(404, "Metadata file not found on disk")

    with open(proj.metadata_path) as f:
        metadata = json.load(f)

    images: list = metadata.get("images", [])

    if body.remove_filenames:
        remove_set = set(body.remove_filenames)
        images = [img for img in images if img["filename"] not in remove_set]

    if body.add_filenames:
        selected_dir  = os.path.dirname(proj.metadata_path)
        sectioned_dir = os.path.dirname(selected_dir)
        job_dir       = os.path.dirname(sectioned_dir)
        existing_filenames = {img["filename"] for img in images}

        manifest_path = os.path.join(job_dir, "selected_diagram.json")
        manifest_images = []
        if os.path.exists(manifest_path):
            with open(manifest_path) as mf:
                manifest_data = json.load(mf)
            manifest_images = manifest_data.get("images", [])

        manifest_lookup = {img["filename"]: img for img in manifest_images}
        rel_base = job_dir.replace(LOCAL_FILE_DB, "").lstrip("/\\")

        for fname in body.add_filenames:
            if fname in existing_filenames:
                continue
            src = os.path.join(sectioned_dir, fname)
            if not os.path.exists(src):
                continue
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
                "url":           f"/local_file_db/{rel_base}/sectioned/selected/{fname}",
            })
            existing_filenames.add(fname)

    metadata["images"]         = images
    metadata["total_selected"] = len(images)
    metadata["timestamp"]      = datetime.now().isoformat()

    with open(proj.metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    proj.image_count = len(images)
    proj.updated_at  = datetime.now().isoformat()
    db.commit(); db.refresh(proj)

    return metadata

@router.get("/{project_id}/available-pages")
def get_available_pages(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(ProjectSql).filter(ProjectSql.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    if not proj.metadata_path or not os.path.exists(proj.metadata_path):
        return {"images": [], "total": 0}

    selected_dir  = os.path.dirname(proj.metadata_path)
    sectioned_dir = os.path.dirname(selected_dir)
    job_dir       = os.path.dirname(sectioned_dir)

    manifest_path = os.path.join(job_dir, "selected_diagram.json")
    if not os.path.exists(manifest_path):
        return {"images": [], "total": 0}

    with open(manifest_path) as f:
        manifest_data = json.load(f)

    rel_base = job_dir.replace(LOCAL_FILE_DB, "").lstrip("/\\")
    images = []
    for img in manifest_data.get("images", []):
        images.append({
            "filename":  img["filename"],
            "page_num":  img["page_num"],
            "label":     img["label"],
            "sub_index": img["sub_index"],
            "url":       f"/local_file_db/{rel_base}/sectioned/{img['filename']}",
        })

    return {"images": images, "total": len(images)}
