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
    """Return all projects, newest first. Also auto-registers any orphaned local folders."""
    docs = await project_service.get_all_projects()
    known_ids = {d["_id"] for d in docs}

    # Scan local_file_db for project folders not yet in MongoDB
    if os.path.exists(LOCAL_FILE_DB):
        col = get_projects_collection()
        now = datetime.utcnow().isoformat()
        for entry in os.scandir(LOCAL_FILE_DB):
            if not entry.is_dir() or not entry.name.startswith("project_"):
                continue
            pid = entry.name[len("project_"):]
            if pid in known_ids or not ObjectId.is_valid(pid):
                continue
            # This folder has no MongoDB record — auto-register it
            reg_path = os.path.join(entry.path, "selected_image_registry.json")
            selected_meta = {"images": [], "total": 0}
            project_name = "Recovered Project"
            if os.path.exists(reg_path):
                try:
                    with open(reg_path) as f:
                        reg_data = json.load(f)
                    imgs = reg_data.get("images", [])
                    selected_meta = {"images": imgs, "total": len(imgs)}
                    project_name = reg_data.get("name", project_name)
                except Exception:
                    pass
            try:
                await col.insert_one({
                    "_id": ObjectId(pid),
                    "name": project_name,
                    "status": "draft",
                    "selected_diagram_metadata": selected_meta,
                    "created_at": now,
                    "updated_at": now,
                })
                print(f"[list_projects] 🔄 Auto-registered orphan project {pid}")
            except Exception:
                pass  # already exists (race condition) or invalid — skip

    # Re-fetch the full list (including newly registered)
    docs = await project_service.get_all_projects()
    return [ProjectOut.from_mongo(d) for d in docs]



# ── Get one ────────────────────────────────────────────────────────────────────
@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str):
    """
    Fetch a single project by its MongoDB ObjectId.
    If not found in MongoDB but the local_file_db folder exists,
    auto-registers the project from disk data.
    """
    if not ObjectId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    doc = await project_service.get_project_by_id(project_id)

    # Auto-recover: project exists on disk but not in MongoDB
    if not doc:
        project_folder = os.path.join(LOCAL_FILE_DB, f"project_{project_id}")
        if not os.path.exists(project_folder):
            raise HTTPException(status_code=404, detail="Project not found")

        # Read whatever data we have from disk
        reg_path = os.path.join(project_folder, "selected_image_registry.json")
        selected_meta = {"images": [], "total": 0}
        project_name = f"Recovered Project"
        if os.path.exists(reg_path):
            try:
                with open(reg_path) as f:
                    reg_data = json.load(f)
                imgs = reg_data.get("images", [])
                selected_meta = {"images": imgs, "total": len(imgs)}
                project_name = reg_data.get("name", project_name)
            except Exception:
                pass

        # Insert with the exact _id from the path
        now = datetime.utcnow().isoformat()
        col = get_projects_collection()
        try:
            await col.insert_one({
                "_id": ObjectId(project_id),
                "name": project_name,
                "status": "draft",
                "selected_diagram_metadata": selected_meta,
                "created_at": now,
                "updated_at": now,
            })
            print(f"[get_project] 🔄 Auto-registered orphan project {project_id} from disk")
        except Exception as e:
            print(f"[get_project] ⚠️ Could not insert: {e}")

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
    """
    Permanently delete a project from MongoDB AND remove its local_file_db folder
    (all images, JSON registries, processed files, etc.).
    """
    deleted = await project_service.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")

    # Remove the project's folder from local_file_db
    project_folder = os.path.join(LOCAL_FILE_DB, f"project_{project_id}")
    if os.path.exists(project_folder):
        try:
            shutil.rmtree(project_folder)
            print(f"[delete_project] 🗑️ Removed local folder: {project_folder}")
        except Exception as e:
            # Log but don't fail — MongoDB record is already gone
            print(f"[delete_project] ⚠️ Could not remove local folder: {e}")

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
    body: { "add_filenames": [...], "remove_filenames": [...], "add_metadata": {...} }
    JSON registry is updated ONLY here (not during upload staging).
    """
    import asyncio
    from bson import ObjectId as _ObjId
    if not _ObjId.is_valid(project_id):
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    # Fetch the project — may be None if it was never registered in MongoDB,
    # but update_project uses upsert=True so writes will still succeed.
    doc = await project_service.get_project_by_id(project_id)
    metadata = (doc or {}).get("selected_diagram_metadata") or {"images": [], "total": 0}
    images = metadata.get("images", [])

    add_list = body.get("add_filenames", [])
    remove_list = body.get("remove_filenames", [])

    # Collect sectioned filenames that should be returned to "Add Pages" on removal
    restored_sectioned = []

    # Handle removals — restore source filenames back to the sectioned registry
    if remove_list:
        remove_set = set(remove_list)
        kept, removed = [], []
        for img in images:
            if img["filename"] in remove_set:
                removed.append(img)
            else:
                kept.append(img)
        images = kept
        # Collect original sectioned filenames to restore to the registry
        for img in removed:
            if img.get("source_filename"):
                restored_sectioned.append(img["source_filename"])

    # Track which sectioned filenames are being consumed (to remove from registry)
    consumed_sectioned = []

    # Handle additions
    if add_list:
        add_metadata = body.get("add_metadata", {})  # { filename: { page_number, label } }
        manifest_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
        final_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "final")
        os.makedirs(final_dir, exist_ok=True)

        if os.path.exists(manifest_path):
            with open(manifest_path) as f:
                manifest_data = json.load(f)
            manifest_images = {img["filename"]: img for img in manifest_data.get("images", [])}

            # Also block re-adding images already saved (by source_filename)
            already_saved_sources = {img.get("source_filename") for img in images if img.get("source_filename")}

            existing_fnames = {img["filename"] for img in images}
            new_entries = []
            copy_tasks = []

            for fname in add_list:
                if fname in existing_fnames:
                    continue
                if fname in already_saved_sources:
                    continue  # already added from this sectioned source
                if fname not in manifest_images:
                    continue
                m_img = manifest_images[fname]

                custom = add_metadata.get(fname, {})
                p_num = custom.get("page_number") or custom.get("page_num") or m_img.get("page_num", 0)
                lbl = custom.get("label") or m_img.get("label", "a")

                sanitized_lbl = "".join(x for x in str(lbl) if x.isalnum() or x in "._-").strip() or "a"
                new_filename = f"{project_id}_{p_num}_{sanitized_lbl}.png"

                src_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned", fname)
                dest_path = os.path.join(final_dir, new_filename)
                if os.path.exists(src_path):
                    copy_tasks.append((src_path, dest_path))

                new_entries.append({
                    "filename": new_filename,
                    "source_filename": fname,  # ← track original sectioned name to prevent re-adding
                    "page_number": int(p_num),
                    "label": lbl,
                    "diagram_seq": sanitized_lbl,
                    "url": f"/local_file_db/project_{project_id}/final/{new_filename}",
                    "source": m_img.get("source", "sectioned")
                })
                consumed_sectioned.append(fname)

            # Parallel async file copies for speed
            if copy_tasks:
                await asyncio.gather(*[
                    asyncio.to_thread(shutil.copy2, src, dst)
                    for src, dst in copy_tasks
                ])

            images.extend(new_entries)

    # Update MongoDB
    metadata["images"] = images
    metadata["total"] = len(images)
    metadata["updated_at"] = datetime.utcnow().isoformat()

    await project_service.update_project(project_id, {"selected_diagram_metadata": metadata})

    # Update sectioned_diagram_registry.json:
    # — remove consumed filenames (added to saved) so they don't reappear in "Add Pages"
    # — restore removed filenames (removed from saved) back to "Add Pages"
    manifest_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
    if (consumed_sectioned or restored_sectioned) and os.path.exists(manifest_path):
        def _update_sectioned_registry():
            try:
                with open(manifest_path) as f:
                    reg = json.load(f)
                existing = {img["filename"]: img for img in reg.get("images", [])}

                # Remove consumed (just added to saved)
                for fn in consumed_sectioned:
                    existing.pop(fn, None)

                # Restore removed (just removed from saved) — only if file still exists on disk
                for fn in restored_sectioned:
                    if fn not in existing:
                        sectioned_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned", fn)
                        if os.path.exists(sectioned_path):
                            # We don't have full metadata here, add a minimal entry
                            existing[fn] = {"filename": fn, "page_num": 0, "label": "a", "sub_index": 0,
                                            "url": f"/local_file_db/project_{project_id}/pdf_processing/sectioned/{fn}",
                                            "source": "uploaded"}

                reg["images"] = list(existing.values())
                with open(manifest_path, "w") as f:
                    json.dump(reg, f, indent=2)
            except Exception as e:
                print(f"[update_project_saved_pages] ⚠️ Failed to update sectioned registry: {e}")

        await asyncio.to_thread(_update_sectioned_registry)

    # Update selected_image_registry.json — only happens here, not on upload
    project_folder = os.path.join(LOCAL_FILE_DB, f"project_{project_id}")
    reg_path = os.path.join(project_folder, "selected_image_registry.json")
    if os.path.exists(project_folder):
        def _write_registry():   # must be a plain sync def for asyncio.to_thread
            try:
                reg_data = {"images": images, "total": len(images), "project_id": project_id, "updated_at": metadata["updated_at"]}
                if os.path.exists(reg_path):
                    with open(reg_path, "r") as f:
                        try:
                            old_reg = json.load(f)
                            reg_data = {**old_reg, **reg_data}
                        except Exception:
                            pass
                with open(reg_path, "w") as f:
                    json.dump(reg_data, f, indent=2)
            except Exception as e:
                print(f"[update_project_saved_pages] ⚠️ Failed to update JSON registry: {e}")

        await asyncio.to_thread(_write_registry)

    return {"images": images, "total_selected": len(images)}





@router.post("/{project_id}/upload-image")
async def upload_image_to_mongo_project(
    project_id: str,
    file: UploadFile = File(...),
    page_number: int = Form(1),
    label: str = Form("a")
):
    """
    Stage an uploaded image into the project's sectioned/ folder and register it
    in sectioned_diagram_registry.json so it appears in the 'Add Pages' tab.
    The image will NOT be added to Saved Pages until the user explicitly confirms
    through the Add-to-Project flow.
    """
    import asyncio

    # Save to sectioned/ folder (staging area for Add Pages)
    sectioned_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned")
    os.makedirs(sectioned_dir, exist_ok=True)

    sanitized_label = "".join(x for x in label if x.isalnum() or x in "._-").strip() or "a"
    filename = f"upload_{project_id}_{page_number}_{sanitized_label}.png"
    file_path = os.path.join(sectioned_dir, filename)

    content = await file.read()
    # Write file async to avoid blocking
    await asyncio.to_thread(lambda: open(file_path, "wb").write(content))

    url = f"/local_file_db/project_{project_id}/pdf_processing/sectioned/{filename}"
    new_img = {
        "filename": filename,
        "page_num": page_number,
        "label": sanitized_label,
        "sub_index": 0,
        "url": url,
        "source": "uploaded"
    }

    # Register in sectioned_diagram_registry.json so it appears in "Add Pages"
    registry_path = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "pdf_processing", "sectioned_diagram_registry.json")
    os.makedirs(os.path.dirname(registry_path), exist_ok=True)
    try:
        reg_data = {"images": []}
        if os.path.exists(registry_path):
            with open(registry_path) as f:
                reg_data = json.load(f)
        # Avoid duplicates
        reg_data.setdefault("images", [])
        if not any(img["filename"] == filename for img in reg_data["images"]):
            reg_data["images"].append(new_img)
        with open(registry_path, "w") as f:
            json.dump(reg_data, f, indent=2)
    except Exception as e:
        print(f"[upload_image] ⚠️ Failed to update sectioned registry: {e}")

    # NOTE: Do NOT update MongoDB or selected_image_registry.json here.
    # The JSON/MongoDB update happens only when the user explicitly adds
    # this image to Saved Pages via PATCH /projects/{id}/pages.
    return {"ok": True, "image": new_img}

