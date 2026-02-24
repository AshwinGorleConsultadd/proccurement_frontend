import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from db.database import get_db, BASE_DIR
from models.sql_models import PdfDocument
from schemas.budget import PdfDocumentOut

router = APIRouter(prefix="/pdf", tags=["PDF"])

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "pdfs")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), section: str = Form("general"), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    # Date time format for project name: 20-02-2026_8_30_PM
    project_name = now.strftime("%d-%m-%Y_%-I_%-M_%p")
    
    safe_name = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    content   = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    file_size = os.path.getsize(file_path)

    page_count = None
    try:
        import fitz
        doc        = fitz.open(file_path)
        page_count = doc.page_count
        doc.close()
    except Exception:
        pass

    # Create MongoDB Project
    from db.mongo import get_projects_collection
    projects_coll = get_projects_collection()
    new_project = {
        "name": project_name,
        "description": f"Uploaded from {file.filename}",
        "status": "draft",
        "source_pdf_path": f"/uploads/pdfs/{safe_name}",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    result = await projects_coll.insert_one(new_project)
    project_id = str(result.inserted_id)

    doc = PdfDocument(
        filename=safe_name, original_name=file.filename,
        file_path=f"/uploads/pdfs/{safe_name}",
        file_size=file_size, section=section,
        page_count=page_count,
        uploaded_at=now.isoformat(),
        project_id=project_id
    )
    db.add(doc); db.commit(); db.refresh(doc)
    return PdfDocumentOut.model_validate(doc)

@router.get("/list")
def list_pdfs(section: str = Query("general"), db: Session = Depends(get_db)):
    docs = db.query(PdfDocument).filter(PdfDocument.section == section).all()
    return [PdfDocumentOut.model_validate(d) for d in docs]

@router.delete("/{pdf_id}")
def delete_pdf(pdf_id: int, db: Session = Depends(get_db)):
    doc = db.query(PdfDocument).filter(PdfDocument.id == pdf_id).first()
    if not doc:
        raise HTTPException(404, "PDF not found")
    full_path = os.path.join(UPLOAD_DIR, doc.filename)
    if os.path.exists(full_path):
        os.remove(full_path)
    db.delete(doc); db.commit()
    return {"ok": True}
