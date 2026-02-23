import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Load .env before anything else
load_dotenv(os.path.join(BASE_DIR, ".env"))

from db.database import engine, Base, SessionLocal
from db.mongo import get_client
from models import sql_models  # Initialize metadata
from middlewares.cors import add_cors_middleware
from services.pdf_processing import load_yolo_model, PROC_DIR

from routes.budget import router as budget_router
from routes.pdf import router as pdf_router
from routes.floorplan import router as floorplan_router
from routes.project_sql import router as sql_projects_router
from routes.projects import router as mongo_projects_router

def seed_data():
    db = SessionLocal()
    try:
        if db.query(sql_models.BudgetItem).count() == 0:
            seeds = [
                sql_models.BudgetItem(spec_no="DC-01",   vendor="TBD", vendor_description="Decorative Pendant",
                                      description="Lobby Mail/Sitting", room_name="Club Room",       page_no=1,
                                      qty="1 Ea.", unit_cost=350,  extended=350,  section="general", order_index=0),
                sql_models.BudgetItem(spec_no="LOB-200", vendor="TBD", vendor_description="Coffee Table",
                                      description="Lobby Mail/Sitting", room_name="Club Room",       page_no=1,
                                      qty="1 Ea.", unit_cost=1350, extended=1350, section="general", order_index=1),
                sql_models.BudgetItem(spec_no="LOB-200", vendor="TBD", vendor_description="Coffee Table",
                                      description="Lobby Livingroom",  room_name="Game Room",        page_no=2,
                                      qty="1 Ea.", unit_cost=1350, extended=1350, section="general", order_index=2),
                sql_models.BudgetItem(spec_no="LOB-201", vendor="TBD", vendor_description="Console",
                                      description="Lobby Mail/Sitting", room_name="Game Room",       page_no=2,
                                      qty="1 Ea.", unit_cost=1600, extended=1600, section="general", order_index=3),
                sql_models.BudgetItem(spec_no="LOB-202", vendor="TBD", vendor_description="Media Cabinet",
                                      description="Lobby Livingroom",  room_name="Conference Room",  page_no=3,
                                      qty="1 Ea.", unit_cost=2800, extended=2800, section="general", order_index=4),
            ]
            db.add_all(seeds)
            db.commit()
    finally:
        db.close()

# Initialize DB tables and seed
Base.metadata.create_all(bind=engine)
seed_data()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup processing
    load_yolo_model()
    
    # Verify MongoDB connection
    try:
        client = get_client()
        await client.admin.command("ping")
        print("[MongoDB] ✅ Connected to Atlas")
    except Exception as e:
        print(f"[MongoDB] ⚠️  Could not connect: {e}")
        
    yield
    
    # Shutdown Processing
    client = get_client()
    if client:
        client.close()
        print("[MongoDB] 🔌 Connection closed")

app = FastAPI(title="Procurement and Co. API", version="2.0.0", lifespan=lifespan)

# Middlewares
add_cors_middleware(app)

# Static Files
uploads_path = os.path.join(BASE_DIR, "uploads")
os.makedirs(uploads_path, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")
app.mount("/local_pdf_processing", StaticFiles(directory=PROC_DIR), name="local_pdf_processing")

# Routers
app.include_router(budget_router)
app.include_router(pdf_router)
app.include_router(floorplan_router)
app.include_router(sql_projects_router)
app.include_router(mongo_projects_router)

@app.get("/health")
def health():
    from services.pdf_processing import get_yolo_status
    yolo_status = get_yolo_status()
    return {
        "status": "ok",
        "service": "Procurement and Co. API v2",
        "yolo_ready": yolo_status["model_loaded"],
        "yolo_error": yolo_status["error"],
    }
