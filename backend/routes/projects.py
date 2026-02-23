"""
routes/projects.py
──────────────────
All /projects/* REST endpoints, backed by MongoDB via the project service.
"""

from fastapi import APIRouter, HTTPException
from models.project import ProjectCreate, ProjectOut, ProjectUpdate
from services import project_service

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
