"""
project_service.py
──────────────────
Business logic that sits between the route handlers and the database.
"""

import os
import json
import shutil
from datetime import datetime
from bson import ObjectId

from db.mongo import get_projects_collection

# ── Folder root (same as PROC_DIR in main.py) ─────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC_DIR = os.path.join(BASE_DIR, "local_pdf_processing")


async def create_project_document(data: dict) -> dict:
    """Insert a new project document into MongoDB and return the saved doc."""
    col = get_projects_collection()
    now = datetime.utcnow().isoformat()
    doc = {
        "name":                      data.get("name", "Untitled Project"),
        "description":               data.get("description", ""),
        "status":                    "draft",
        "source_pdf_path":           data.get("source_pdf_path"),
        "selected_diagram_metadata": data.get("selected_diagram_metadata"),
        "mask_registry":             data.get("mask_registry"),
        "polygon_registry":          data.get("polygon_registry"),
        "group_registry":            data.get("group_registry"),
        "created_at":                now,
        "updated_at":                now,
    }
    result = await col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_all_projects() -> list[dict]:
    """Return all projects, newest first."""
    col = get_projects_collection()
    cursor = col.find().sort("created_at", -1)
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


async def get_project_by_id(project_id: str) -> dict | None:
    """Return one project by its MongoDB ObjectId string."""
    col = get_projects_collection()
    if not ObjectId.is_valid(project_id):
        return None
    doc = await col.find_one({"_id": ObjectId(project_id)})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def update_project(project_id: str, updates: dict) -> dict | None:
    """Apply a partial update dict to a project. Always sets updated_at."""
    col = get_projects_collection()
    if not ObjectId.is_valid(project_id):
        return None
    updates["updated_at"] = datetime.utcnow().isoformat()
    updates = {k: v for k, v in updates.items() if v is not None}
    await col.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": updates},
    )
    return await get_project_by_id(project_id)


async def delete_project(project_id: str) -> bool:
    """Delete a project document. Returns True if deleted."""
    col = get_projects_collection()
    if not ObjectId.is_valid(project_id):
        return False
    result = await col.delete_one({"_id": ObjectId(project_id)})
    return result.deleted_count == 1


async def attach_diagram_metadata(project_id: str, metadata_path: str) -> dict | None:
    """
    Called after save-selected completes. This function:
      1. Renames the tmp_XXXXXX folder  →  project_{mongo_id}/
      2. Creates project_{mongo_id}/final/
      3. Moves + renames selected images  →  {mongo_id}_{page}_{seq}.png
      4. Writes project_{mongo_id}/metadata.json with updated paths
      5. Stores selected_diagram_metadata in the MongoDB project document
    """
    if not os.path.exists(metadata_path):
        print(f"[attach_metadata] ⚠️  metadata file not found: {metadata_path}")
        return None

    with open(metadata_path) as f:
        metadata = json.load(f)

    # ── Step 1:  Find and rename the tmp_ folder ───────────────────────────
    old_selected_dir = os.path.dirname(metadata_path)

    # Walk up from old_selected_dir until its parent is PROC_DIR
    old_tmp_dir = old_selected_dir
    while os.path.dirname(old_tmp_dir) != PROC_DIR:
        parent = os.path.dirname(old_tmp_dir)
        if parent == old_tmp_dir:       # reached filesystem root — safety guard
            break
        old_tmp_dir = parent

    # Rename tmp_XXXXXX  →  project_{mongo_id}
    project_folder = os.path.join(PROC_DIR, f"project_{project_id}")
    if old_tmp_dir != project_folder and os.path.exists(old_tmp_dir):
        os.rename(old_tmp_dir, project_folder)
        print(f"[attach_metadata] 📁 '{os.path.basename(old_tmp_dir)}' → 'project_{project_id}'")
    else:
        os.makedirs(project_folder, exist_ok=True)

    # Recalculate old_selected_dir now that the folder has been renamed
    rel_from_tmp     = old_selected_dir[len(old_tmp_dir):].lstrip("/\\")
    old_selected_dir = os.path.join(project_folder, rel_from_tmp)

    # ── Step 2:  Create final/ and move + rename images ────────────────────
    final_folder = os.path.join(project_folder, "final")
    os.makedirs(final_folder, exist_ok=True)

    updated_images = []
    for img in metadata.get("images", []):
        page_num    = img.get("page_number", 0)
        diagram_seq = img.get("diagram_seq", "a")

        # Canonical filename: {mongo_id}_{page}_{seq}.png
        new_filename  = f"{project_id}_{page_num}_{diagram_seq}.png"
        new_full_path = os.path.join(final_folder, new_filename)

        # Locate the old file, remapping path under renamed folder if needed
        old_path = img.get("saved_path", "")
        if old_path:
            old_path = old_path.replace(old_tmp_dir, project_folder)
        if not old_path or not os.path.exists(old_path):
            old_path = os.path.join(old_selected_dir, img.get("filename", ""))

        if os.path.exists(old_path):
            shutil.move(old_path, new_full_path)

        rel_path = new_full_path.replace(PROC_DIR, "").lstrip("/\\").replace("\\", "/")
        new_url  = f"/local_pdf_processing/{rel_path}"

        updated_images.append({
            **img,
            "filename":   new_filename,
            "saved_path": new_full_path,
            "url":        new_url,
        })

    # ── Step 3:  Write metadata.json into project root ─────────────────────
    new_meta_path           = os.path.join(project_folder, "metadata.json")
    metadata["images"]      = updated_images
    metadata["project_id"]  = project_id
    with open(new_meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[attach_metadata] ✅ {len(updated_images)} image(s) → project_{project_id}/final/")

    # ── Step 4:  Store in MongoDB ──────────────────────────────────────────
    selected_diagram_metadata = {
        "total":     len(updated_images),
        "dpi":       metadata.get("dpi"),
        "timestamp": metadata.get("timestamp"),
        "images":    updated_images,
    }

    return await update_project(project_id, {
        "selected_diagram_metadata": selected_diagram_metadata,
    })
