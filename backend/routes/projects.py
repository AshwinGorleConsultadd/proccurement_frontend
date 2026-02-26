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
import time
import cv2
import numpy as np
import uuid

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
        # Load the processing manifest to get data for these files
        manifest_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
        if os.path.exists(manifest_path):
            with open(manifest_path) as f:
                manifest_data = json.load(f)
            manifest_images = {img["filename"]: img for img in manifest_data.get("images", [])}
            
            existing_fnames = {img["filename"] for img in images}
            for fname in add_list:
                if fname in existing_fnames: continue
                if fname in manifest_images:
                    m_img = manifest_images[fname]
                    images.append({
                        "filename": fname,
                        "page_number": m_img.get("page_num", 0),
                        "label": m_img.get("label", "full"),
                        "sub_index": m_img.get("sub_index", 0),
                        "url": f"/local_file_db/project_{project_id}/pdf_processing/sectioned/{fname}"
                    })

    # Update MongoDB
    metadata["images"] = images
    metadata["total"] = len(images)
    metadata["updated_at"] = datetime.utcnow().isoformat()
    
    await project_service.update_project(project_id, {"selected_diagram_metadata": metadata})
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
    
    filename = f"upload_{int(datetime.now().timestamp())}_{file.filename}"
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
        "source": "uploaded"
    }
    
    # Update project in Mongo
    col = get_projects_collection()
    await col.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"selected_diagram_metadata.images": new_img}}
    )
    
    return {"ok": True, "image": new_img}


# ── Room Extraction ────────────────────────────────────────────────────────────
@router.post("/{project_id}/rooms/extract")
async def extract_rooms(project_id: str, body: dict):
    """
    Extracts individual rooms from a floorplan based on drawn polygons.
    body: {
        "image_url": "/local_file_db/project_.../sectioned/filename.png",
        "rooms": [
            { "name": "Room 1", "polygon": [{"x": 0.1, "y": 0.2}, ...] }
        ]
    }
    """
    image_url = body.get("image_url", "")
    filename = body.get("filename", "")
    page_number = body.get("page_number", 1)
    diagram_seq = body.get("diagram_seq", "a")
    rooms = body.get("rooms", [])
    
    if not image_url.startswith("/local_file_db/"):
        raise HTTPException(status_code=400, detail="Invalid image URL")
        
    rel_path = image_url[len("/local_file_db/"):]
    abs_path = os.path.join(LOCAL_FILE_DB, rel_path)
    
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Image file not found")
        
    img = cv2.imread(abs_path)
    if img is None:
        raise HTTPException(status_code=500, detail="Could not read image file")
        
    h, w = img.shape[:2]
    
    out_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "rooms")
    os.makedirs(out_dir, exist_ok=True)
    
    results = []
    
    # Create an image with an alpha channel for transparent background editing
    img_bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    
    for idx, room in enumerate(rooms):
        room_id = room.get("id") or str(uuid.uuid4())
        name = room.get("name", f"room_{int(time.time())}_{idx}")
        polygon = room.get("polygon", [])
        
        if not polygon:
            continue
            
        saved_path = room.get("saved_path")
        if saved_path and os.path.exists(saved_path):
            # Already extracted & saved, just persist its metadata
            results.append({
                "id": room_id,
                "name": name,
                "filename": room.get("filename"),
                "url": room.get("url"),
                "saved_path": saved_path,
                "mask_array": polygon,
                "source_image": image_url,
                "created_at": room.get("created_at") or datetime.now().isoformat()
            })
            continue

        pts = []
        for p in polygon:
            pts.append([int(p["x"] * w), int(p["y"] * h)])
        pts = np.array(pts, dtype=np.int32)
        
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [pts], 255)
        
        img_bgra_masked = img_bgra.copy()
        img_bgra_masked[:, :, 3] = mask
        
        rx, ry, rbw, rbh = cv2.boundingRect(pts)
        
        # Safety guards
        rx, ry = max(0, rx), max(0, ry)
        rbw = min(rbw, w - rx)
        rbh = min(rbh, h - ry)
        
        cropped = img_bgra_masked[ry:ry+rbh, rx:rx+rbw]
        
        safe_name = "".join(c if c.isalnum() else "_" for c in name).strip("_")
        fname = f"page_{page_number}_seq_{diagram_seq}_{idx + 1}.png"
        out_path = os.path.join(out_dir, fname)
        
        cv2.imwrite(out_path, cropped)
        
        url = f"/local_file_db/project_{project_id}/rooms/{fname}"
        results.append({
            "id": room_id,
            "name": name,
            "filename": fname,
            "url": url,
            "saved_path": out_path,
            "mask_array": polygon,
            "source_image": image_url,
            "created_at": datetime.now().isoformat()
        })
        
    if results and filename:
        # 1. Update selected_image_registry.json (Single Source of Truth File)
        registry_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "selected_image_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, 'r') as f:
                try:
                    registry_data = json.load(f)
                except Exception:
                    registry_data = {}
            
            for img_doc in registry_data.get("images", []):
                if img_doc.get("filename") == filename:
                    img_doc["rooms"] = results
                    break
                    
            with open(registry_path, 'w') as f:
                json.dump(registry_data, f, indent=4)

        # 2. Update MongoDB to keep frontend State matching exactly
        col = get_projects_collection()
        await col.update_one(
            {
                "_id": ObjectId(project_id),
                "selected_diagram_metadata.images.filename": filename
            },
            {
                "$set": {"selected_diagram_metadata.images.$.rooms": results}
            }
        )
        
    return {"ok": True, "rooms": results}


# ── Delete Extracted Room ──────────────────────────────────────────────────────
@router.delete("/{project_id}/rooms/{room_id}")
async def delete_room(project_id: str, room_id: str, image_filename: str):
    """Deletes a specific extracted room mask based on its unique ID."""
    
    # 1. Update selected_image_registry.json physical file
    registry_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "selected_image_registry.json")
    if os.path.exists(registry_path):
        with open(registry_path, 'r') as f:
            try:
                registry_data = json.load(f)
            except Exception:
                registry_data = {}
        
        for img_doc in registry_data.get("images", []):
            if img_doc.get("filename") == image_filename:
                # Find the room to delete the physical file if it exists
                rooms_list = img_doc.get("rooms", [])
                for r in rooms_list:
                    if r.get("id") == room_id or r.get("name") == room_id:
                        saved_path = r.get("saved_path")
                        if saved_path and os.path.exists(saved_path):
                            os.remove(saved_path)
                        break
                # Remove from registry metadata
                img_doc["rooms"] = [r for r in rooms_list if r.get("id") != room_id and r.get("name") != room_id]
                break
                
        with open(registry_path, 'w') as f:
            json.dump(registry_data, f, indent=4)

    # 2. Update MongoDB securely using $pull to yank out the specifically matched room
    col = get_projects_collection()
    await col.update_one(
        {
            "_id": ObjectId(project_id),
            "selected_diagram_metadata.images.filename": image_filename
        },
        {
            "$pull": {
                "selected_diagram_metadata.images.$.rooms": {
                    "$or": [
                        {"id": room_id},
                        {"name": room_id}
                    ]
                }
            }
        }
    )
    return {"ok": True}
