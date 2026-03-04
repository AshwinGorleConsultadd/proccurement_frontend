"""
routes/editor.py
────────────────
Endpoints for the mask editor, primarily the Gemini-powered code-extraction flow.

POST /editor/extract-codes
  Body (multipart form):
    - editor_data  : JSON string  (the full editor_data payload from the canvas)
    - floorplan    : image file   (the floorplan PNG/JPG the masks were drawn on)

  Returns: updated editor_data JSON with 'object_name' and 'code' filled in for
           every group.

SSE variant (streaming progress):
POST /editor/extract-codes/stream
  Same body – responses are Server-Sent Events so the frontend can show a live
  progress bar while Gemini processes each group.
"""

import io
import json
import os
import tempfile
from typing import AsyncGenerator

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from services.editor_service import extract_group_info_from_editor_data

router = APIRouter(prefix="/editor", tags=["Editor"])


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _save_floorplan_temp(file: UploadFile) -> str:
    """Write the uploaded floorplan to a temp file and return its path."""
    suffix = os.path.splitext(file.filename or "floorplan.png")[1] or ".png"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    return tmp.name


def _cleanup(path: str):
    try:
        os.unlink(path)
    except Exception:
        pass


# ── Non-streaming endpoint ─────────────────────────────────────────────────────
@router.post("/extract-codes")
async def extract_codes(
    editor_data: str  = Form(..., description="JSON string of the editor data"),
    floorplan:   UploadFile = File(..., description="Floorplan image (PNG/JPG)"),
):
    """
    Run Gemini extraction on all groups in editor_data.
    Blocks until all groups are processed, then returns the enriched JSON.
    Use /extract-codes/stream for a live-progress version.
    """
    # Parse editor_data JSON
    try:
        data = json.loads(editor_data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid editor_data JSON: {e}")

    # Save floorplan to a temp file (service needs a file path for PIL)
    tmp_path = await _save_floorplan_temp(floorplan)

    try:
        result = extract_group_info_from_editor_data(data, tmp_path)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        _cleanup(tmp_path)

    return result


# ── Streaming (SSE) endpoint ───────────────────────────────────────────────────
@router.post("/extract-codes/stream")
async def extract_codes_stream(
    editor_data: str  = Form(..., description="JSON string of the editor data"),
    floorplan:   UploadFile = File(..., description="Floorplan image (PNG/JPG)"),
):
    """
    Same as /extract-codes but streams progress via Server-Sent Events.

    Each SSE event is a JSON object:
      { "type": "progress", "group_id": "group_1", "index": 1, "total": 69,
        "object_name": "Chair", "code": "CH-502", "skipped": false }
      { "type": "done",     "data": { ...full enriched editor_data... } }
      { "type": "error",    "message": "..." }
    """

    # Parse early so we can reject bad payloads before streaming
    try:
        data = json.loads(editor_data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid editor_data JSON: {e}")

    tmp_path = await _save_floorplan_temp(floorplan)

    async def event_stream() -> AsyncGenerator[str, None]:
        # We'll collect the final result as each group resolves
        state: dict = {}

        def on_progress(gid, idx, total, name, code, skipped=False):
            evt = json.dumps({
                "type":        "progress",
                "group_id":    gid,
                "index":       idx,
                "total":       total,
                "object_name": name,
                "code":        code,
                "skipped":     skipped,
            })
            # Note: we can't use `yield` inside a sync callback, so we store
            # progress events in a list and flush them at the end of each group.
            state.setdefault("events", []).append(f"data: {evt}\n\n")

        try:
            result = extract_group_info_from_editor_data(
                data, tmp_path, progress_callback=on_progress
            )
        except RuntimeError as e:
            err_evt = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {err_evt}\n\n"
            _cleanup(tmp_path)
            return

        # Yield all queued progress events
        for evt in state.get("events", []):
            yield evt

        # Final done event with full result
        done_evt = json.dumps({"type": "done", "data": result})
        yield f"data: {done_evt}\n\n"
        _cleanup(tmp_path)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
