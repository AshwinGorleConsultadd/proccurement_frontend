import os, json, shutil
from datetime import datetime
from sqlalchemy.orm import Session
from models.sql_models import ProcessingJob
from db.database import SessionLocal, BASE_DIR
import fitz
import cv2
from pymongo import MongoClient
from bson import ObjectId
from config import MONGO_URI, MONGO_DB_NAME

LOCAL_FILE_DB = os.path.join(BASE_DIR, "local_file_db")
os.makedirs(LOCAL_FILE_DB, exist_ok=True)

_yolo_model = None
_yolo_load_error = None

def load_yolo_model():
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

def get_yolo_status():
    return {
        "model_loaded": _yolo_model is not None,
        "error":        _yolo_load_error,
        "model_path":   os.path.join(BASE_DIR, "doclayout_yolo_docstructbench_imgsz1024.pt"),
        "model_exists": os.path.exists(os.path.join(BASE_DIR, "doclayout_yolo_docstructbench_imgsz1024.pt")),
        "classes":      list(_yolo_model.names.values()) if _yolo_model else [],
    }

def _update_job(db: Session, job: ProcessingJob, **kwargs):
    for k, v in kwargs.items():
        setattr(job, k, v)
    db.commit()

def _yolo_crop_page(img_path: str, out_path: str) -> bool:
    if _yolo_model is None:
        return False
    import cv2
    PRIORITY = {"figure", "table"}
    IGNORE   = {"abandon", "plain text", "table_footnote", "figure_caption", "table_caption"}
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
            pad = 10
            x1 = max(0, x1 - pad); y1 = max(0, y1 - pad)
            x2 = min(w, x2 + pad); y2 = min(h, y2 + pad)
            crop = img[y1:y2, x1:x2]
            cv2.imwrite(out_path, crop)
            return True
        return False
    except Exception as e:
        print(f"[YOLO] ❌ error on {os.path.basename(img_path)}: {e}")
        return False

def _detect_multiple_diagrams(image_path: str, min_area_ratio: float = 0.05):
    import cv2
    image = cv2.imread(image_path)
    if image is None:
        return [{"label": "full", "x_percent": 0, "y_percent": 0, "width_percent": 100, "height_percent": 100}]
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
    valid_regions.sort(key=lambda r: r["area"], reverse=True)
    if len(valid_regions) <= 1 or valid_regions[0]["area"] > total_area * 0.70:
        return [{"label": "full", "x_percent": 0, "y_percent": 0, "width_percent": 100, "height_percent": 100}]
    diagram_regions = []
    for idx, region in enumerate(valid_regions[:4]):
        yp, xp, wp = region["y_percent"], region["x_percent"], region["width_percent"]
        if yp < 40:
            label = "top-left"  if xp < 50 else "top-right"
        else:
            label = "bottom-left" if xp < 50 else "bottom-right"
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

def _crop_regions(image_path: str, page_num: int, regions, out_dir: str):
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
        x = max(0, min(x, width  - 1))
        y = max(0, min(y, height - 1))
        w = max(1, min(w, width  - x))
        h = max(1, min(h, height - y))
        cropped = image[y:y+h, x:x+w]
        sub_letter  = chr(ord("a") + idx)
        filename    = f"crop{page_num}.{sub_letter}.png"
        out_path = os.path.join(out_dir, filename)
        cv2.imwrite(out_path, cropped)
        created.append((out_path, filename, region["label"], sub_letter))
    return created

def _sync_update_mongodb_project(project_id: str, registry_url: str):
    try:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        coll = db["projects"]
        coll.update_one(
            {"_id": ObjectId(project_id)},
            {
                "$set": {
                    "sectioned_diagram_registry": registry_url,
                    "updated_at": datetime.now().isoformat()
                }
            }
        )
        client.close()
    except Exception as e:
        print(f"[MongoDB] ❌ sync update failed: {e}")

def run_processing(job_id: int, pdf_path: str, dpi: int, min_area_pct: float):
    db  = SessionLocal()
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        db.close(); return
    
    job_dir       = job.job_dir
    temp_dir      = os.path.join(job_dir, "temp")
    crops_dir     = os.path.join(job_dir, "sectioned")
    sectioned_dir = os.path.join(job_dir, "sectioned")
    os.makedirs(temp_dir,      exist_ok=True)
    os.makedirs(crops_dir,     exist_ok=True)

    try:
        _update_job(db, job, status="processing", step="Step 1/3 — Converting PDF to images (300 DPI)", progress=5)
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

        yolo_available = _yolo_model is not None
        if yolo_available:
            _update_job(db, job, step="Step 2/3 — Extracting main areas with DocLayout-YOLO", progress=30)
        else:
            warn = _yolo_load_error or "doclayout_yolo not available"
            _update_job(db, job, step=f"Step 2/3 — YOLO unavailable ({warn}), using full pages", progress=30)

        crop_paths = []
        for idx, img_path in enumerate(page_paths):
            out_path = os.path.join(crops_dir, f"crop{idx+1}.png")
            if not yolo_available or not _yolo_crop_page(img_path, out_path):
                shutil.copy(img_path, out_path)
            crop_paths.append(out_path)
            prog = 30 + int(30 * (idx + 1) / len(page_paths))
            _update_job(db, job, progress=prog)

        _update_job(db, job, step="Step 3/3 — Detecting and splitting multiple diagrams", progress=62)
        min_area_ratio = min_area_pct / 100.0
        all_images     = []

        for idx, crop_path in enumerate(crop_paths):
            page_num = idx + 1
            if not os.path.exists(crop_path):
                continue
            regions = _detect_multiple_diagrams(crop_path, min_area_ratio=min_area_ratio)
            if len(regions) == 1 and regions[0]["label"] == "full":
                filename_single = f"crop{page_num}.a.png"
                dest = os.path.join(sectioned_dir, filename_single)
                shutil.copy2(crop_path, dest)
                all_images.append({
                    "path":        dest,
                    "filename":    filename_single,
                    "label":       "full",
                    "diagram_seq": "a",
                    "page_num":    page_num,
                    "sub_index":   0,
                })
            else:
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

        sectioned_registry_path = os.path.join(job_dir, "sectioned_diagram_registry.json")
        with open(sectioned_registry_path, "w") as f:
            json.dump({"images": all_images, "total": len(all_images)}, f, indent=2)

        # Update MongoDB project document (Sync call in threadpool)
        if job.project_id:
            registry_url = f"/local_file_db/project_{job.project_id}/pdf_processing/sectioned_diagram_registry.json"
            _sync_update_mongodb_project(job.project_id, registry_url)

        _update_job(db, job, status="done", step="Complete — all steps finished", progress=100)
    except Exception as e:
        _update_job(db, job, status="error", error_msg=str(e), progress=0, step=f"Error: {str(e)}")
    finally:
        db.close()
