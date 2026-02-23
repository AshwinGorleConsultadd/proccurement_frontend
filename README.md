
# Procurement and Co.

Full-stack Budget Management & PDF Floor Plan Processor Application.

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS v4, Redux Toolkit
- **Backend**: FastAPI, SQLAlchemy, SQLite, PyMuPDF, OpenCV, DocLayout-YOLO

## Prerequisites
- Node.js & npm
- Python 3.9+
- [DocLayout-YOLO model weights](https://huggingface.co/juliozhao/DocLayout-YOLO-DocStructBench/resolve/main/doclayout_yolo_docstructbench_imgsz1024.pt) (place in `backend/` or root)

## Setup

1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   # Download the model weights if you want to use the PDF processor features
   # wget https://huggingface.co/juliozhao/DocLayout-YOLO-DocStructBench/resolve/main/doclayout_yolo_docstructbench_imgsz1024.pt
   ```

2. **Frontend**:
   ```bash
   npm install
   ```

## Running the App

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   npm run dev
   ```

3. **Open Browser**:
   Navigate to [http://localhost:5173](http://localhost:5173)

## Features
- **Budget**: Full CRUD with grouping, search, and inline editing.
- **Floor Plans**: Upload PDFs, extract diagrams using AI/CV pipeline, select and export.
- **Dashboard**: Overview statistics.

## Project Structure
- `backend/`: FastAPI app, database models, and processing scripts.
- `src/`: React frontend code.
  - `components/`: UI and feature components.
  - `pages/`: Application pages.
  - `redux/`: State management (slices, actions, hooks).
