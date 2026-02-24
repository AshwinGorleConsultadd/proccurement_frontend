"""
routes/projects.py
──────────────────
All /projects/* REST endpoints, backed by MongoDB via the project service.
"""

from fastapi import APIRouter, HTTPException, File, Form, UploadFile, Depends
from models.project import ProjectCreate, ProjectOut, ProjectUpdate
from services import project_service
import os, json, shutil
from datetime import datetime
from services.project_service import LOCAL_FILE_DB
from db.mongo import get_projects_collection
from bson import ObjectId

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Create ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate):
    """
    Create a new project document in MongoDB.
    Returns the created project with its MongoDB _id.
    """
    doc = await project_service.create_project_document(body.model_dump())
    return ProjectOut.from_mongo(doc)


# ── List all ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ProjectOut])
async def list_projects():
    """Return all projects, newest first."""
    docs = await project_service.get_all_projects()
    return [ProjectOut.from_mongo(d) for d in docs]


# ── Get one ────────────────────────────────────────────────────────────────────
@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str):
    """
    Fetch a single project by its MongoDB ObjectId.
    Returns full detail including selected_diagram_metadata.
    """
    doc = await project_service.get_project_by_id(project_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.from_mongo(doc)


# ── Partial update ─────────────────────────────────────────────────────────────
@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, body: ProjectUpdate):
    """
    Update any subset of project fields (name, description, registries, status…).
    Only fields that are explicitly provided (non-None) will be changed.
    """
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    doc = await project_service.update_project(project_id, updates)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.from_mongo(doc)


# ── Attach diagram metadata ────────────────────────────────────────────────────
@router.post("/{project_id}/attach-metadata")
async def attach_metadata(project_id: str, body: dict):
    """
    body: { "metadata_path": "/absolute/path/to/metadata.json" }

    Reads the selected_images_metadata.json produced by the processing pipeline
    and stores its content as selected_diagram_metadata inside the MongoDB project.
    Also stamps the project's MongoDB _id back into the JSON file.
    """
    metadata_path = body.get("metadata_path", "")
    if not metadata_path:
        raise HTTPException(status_code=400, detail="metadata_path is required")

    doc = await project_service.attach_diagram_metadata(project_id, metadata_path)
    if not doc:
        raise HTTPException(status_code=404, detail="Project or metadata file not found")
    return ProjectOut.from_mongo(doc)


# ── Update individual registries ───────────────────────────────────────────────
@router.patch("/{project_id}/mask-registry")
async def update_mask_registry(project_id: str, body: dict):
    """Replace the mask_registry for this project."""
    doc = await project_service.update_project(project_id, {"mask_registry": body})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.from_mongo(doc)


@router.patch("/{project_id}/polygon-registry")
async def update_polygon_registry(project_id: str, body: dict):
    """Replace the polygon_registry for this project."""
    doc = await project_service.update_project(project_id, {"polygon_registry": body})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.from_mongo(doc)


@router.patch("/{project_id}/group-registry")
async def update_group_registry(project_id: str, body: dict):
    """Replace the group_registry for this project."""
    doc = await project_service.update_project(project_id, {"group_registry": body})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut.from_mongo(doc)


# ── Delete ─────────────────────────────────────────────────────────────────────
@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Permanently delete a project from MongoDB."""
    deleted = await project_service.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True, "deleted_id": project_id}


# ── Internal Pages (available in sectioned dir) ────────────────────────────────
@router.get("/{project_id}/available-pages")
async def get_available_pages(project_id: str):
    """
    Returns all detected diagrams for this project from its local_file_db manifest.
    Used in the 'Add Pages' tab of the Source manager.
    """
    manifest_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
    if not os.path.exists(manifest_path):
        return {"images": [], "total": 0}

    with open(manifest_path) as f:
        data = json.load(f)

    images = []
    for img in data.get("images", []):
        images.append({
            "filename":  img["filename"],
            "page_num":  img["page_num"],
            "label":     img["label"],
            "sub_index": img["sub_index"],
            "url":       f"/local_file_db/project_{project_id}/pdf_processing/sectioned/{img['filename']}",
        })
    return {"images": images, "total": len(images)}


@router.get("/{project_id}/pages")
async def get_project_saved_pages(project_id: str):
    """
    Returns the images currently saved in the project's MongoDB document.
    Used in the 'Saved Pages' tab.
    """
    doc = await project_service.get_project_by_id(project_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")

    metadata = doc.get("selected_diagram_metadata") or {}
    return {
        "images":          metadata.get("images", []),
        "total_selected":  metadata.get("total", 0)
    }


@router.patch("/{project_id}/pages")
async def update_project_saved_pages(project_id: str, body: dict):
    """
    Adds or removes images from the project's selected_diagram_metadata.
    body: { "add_filenames": [...], "remove_filenames": [...] }
    """
    doc = await project_service.get_project_by_id(project_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")

    metadata = doc.get("selected_diagram_metadata") or {"images": [], "total": 0}
    images = metadata.get("images", [])
    
    add_list = body.get("add_filenames", [])
    remove_list = body.get("remove_filenames", [])
    
    # Handle removals
    if remove_list:
        images = [img for img in images if img["filename"] not in remove_list]
        
    # Handle additions
    if add_list:
        add_metadata = body.get("add_metadata", {}) # { filename: { page_number, label } }
        # Load the processing manifest to get data for these files
        manifest_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
        final_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "final")
        os.makedirs(final_dir, exist_ok=True)

        if os.path.exists(manifest_path):
            with open(manifest_path) as f:
                manifest_data = json.load(f)
            manifest_images = {img["filename"]: img for img in manifest_data.get("images", [])}
            
            existing_fnames = {img["filename"] for img in images}
            for fname in add_list:
                if fname in existing_fnames: continue
                if fname in manifest_images:
                    m_img = manifest_images[fname]
                    
                    # Use provided metadata or fall back to manifest
                    custom = add_metadata.get(fname, {})
                    p_num = custom.get("page_number") or custom.get("page_num") or m_img.get("page_num", 0)
                    lbl = custom.get("label") or m_img.get("label", "full")
                    
                    # Canonical Filename: {project_id}_{page}_{label}.png
                    sanitized_lbl = "".join(x for x in str(lbl) if x.isalnum() or x in "._-").strip() or "full"
                    new_filename = f"{project_id}_{p_num}_{sanitized_lbl}.png"
                    
                    # Copy from sectioned to final
                    src_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned", fname)
                    dest_path = os.path.join(final_dir, new_filename)
                    if os.path.exists(src_path):
                        shutil.copy2(src_path, dest_path)

                    images.append({
                        "filename": new_filename,
                        "page_number": int(p_num),
                        "label": lbl,
                        "diagram_seq": sanitized_lbl,
                        "url": f"/local_file_db/project_{project_id}/final/{new_filename}",
                        "source": "sectioned"
                    })

    # Update MongoDB
    metadata["images"] = images
    metadata["total"] = len(images)
    metadata["updated_at"] = datetime.utcnow().isoformat()
    
    await project_service.update_project(project_id, {"selected_diagram_metadata": metadata})

    # ALSO update selected_image_registry.json on disk to stay in sync
    project_folder = os.path.join(LOCAL_FILE_DB, f"project_{project_id}")
    reg_path = os.path.join(project_folder, "selected_image_registry.json")
    if os.path.exists(project_folder):
        try:
            # We wrap it in a full registry object if it doesn't exist or just overwrite
            # Usually attach_metadata created this. We'll update it.
            reg_data = {"images": images, "total": len(images), "project_id": project_id, "updated_at": metadata["updated_at"]}
            if os.path.exists(reg_path):
                with open(reg_path, "r") as f:
                    try:
                        old_reg = json.load(f)
                        reg_data = {**old_reg, **reg_data}
                    except: pass
            
            with open(reg_path, "w") as f:
                json.dump(reg_data, f, indent=2)
        except Exception as e:
            print(f"[update_project_saved_pages] ⚠️ Failed to update JSON registry: {e}")

    return {"images": images, "total_selected": len(images)}


@router.post("/{project_id}/upload-image")
async def upload_image_to_mongo_project(
    project_id: str,
    file: UploadFile = File(...),
    page_number: int = Form(1),
    label: str = Form("UPLOADED")
):
    """Upload a custom image directly into the project's storage."""
    # Create project-specific upload dir
    upload_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    # Use canonical naming: {project_id}_{page}_{label}.png
    sanitized_label = "".join(x for x in label if x.isalnum() or x in "._-").strip() or "UPLOAD"
    filename = f"{project_id}_{page_number}_{sanitized_label}.png"
    file_path = os.path.join(upload_dir, filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
        
    url = f"/local_file_db/project_{project_id}/uploads/{filename}"
    new_img = {
        "filename": filename,
        "url": url,
        "page_number": page_number,
        "label": label,
        "source": "uploaded",
        "diagram_seq": sanitized_label
    }
    
    # Update project in Mongo
    col = get_projects_collection()
    await col.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$push": {"selected_diagram_metadata.images": new_img},
            "$inc": {"selected_diagram_metadata.total": 1},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )

    # Update JSON registry on disk
    project_folder = os.path.join(LOCAL_FILE_DB, f"project_{project_id}")
    reg_path = os.path.join(project_folder, "selected_image_registry.json")
    if os.path.exists(project_folder) and os.path.exists(reg_path):
        try:
            with open(reg_path, "r") as f:
                reg_data = json.load(f)
            
            if "images" not in reg_data: reg_data["images"] = []
            reg_data["images"].append(new_img)
            reg_data["total"] = len(reg_data["images"])
            reg_data["updated_at"] = datetime.utcnow().isoformat()

            with open(reg_path, "w") as f:
                json.dump(reg_data, f, indent=2)
        except Exception as e:
            print(f"[upload_image] ⚠️ Failed to update JSON registry: {e}")
    
    return {"ok": True, "image": new_img}
