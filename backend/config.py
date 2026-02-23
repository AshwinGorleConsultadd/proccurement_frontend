import os
from dotenv import load_dotenv

# Load variables from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── MongoDB ────────────────────────────────────────────────────────────────────
MONGO_URI     = os.getenv("MONGO_URI", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "procurement_db")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is not set. Add it to backend/.env")
