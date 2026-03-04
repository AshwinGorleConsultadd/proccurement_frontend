"""
services/editor_service.py
──────────────────────────
Extracts object names and codes from floorplan groups using Gemini Vision API.

For each group in editor_data, it:
1. Finds a representative mask polygon
2. Crops that object from the floorplan image (with red overlay)
3. Sends both the crop and full floorplan to Gemini
4. Parses the returned object_name and code
"""

import io
import json
import re
import time
from pathlib import Path
from PIL import Image, ImageDraw
from google import genai
from google.genai import types

# ── Config ─────────────────────────────────────────────────────────────────────
GEMINI_API_KEY  = "AIzaSyDUO2XYxmc4WAHlLWIA_Ku8pskLbUezN5k"
MODEL           = "gemini-2.5-pro"
CROP_PADDING    = 60     # px around polygon bbox
FULL_MAX_SIZE   = 1400   # max pixels for full-plan thumbnail
DELAY           = 1.5    # seconds between API calls


# ── Gemini client (module-level, created once) ──────────────────────────────
_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


# ── Image helpers ──────────────────────────────────────────────────────────────
def _pil_to_bytes(img: Image.Image, fmt="JPEG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _crop_object(floorplan_img: Image.Image, polygon: list) -> Image.Image:
    """Crop the bounding box of a polygon from the floorplan with padding.
    Also draws a semi-transparent red overlay on the masked area."""
    pts = [(p[0], p[1]) for p in polygon]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    w, h = floorplan_img.size

    x1 = max(0, min(xs) - CROP_PADDING)
    y1 = max(0, min(ys) - CROP_PADDING)
    x2 = min(w, max(xs) + CROP_PADDING)
    y2 = min(h, max(ys) + CROP_PADDING)

    cropped = floorplan_img.crop((x1, y1, x2, y2)).convert("RGBA")

    # Draw red overlay
    overlay = Image.new("RGBA", cropped.size, (0, 0, 0, 0))
    draw    = ImageDraw.Draw(overlay)
    shifted = [(x - x1, y - y1) for x, y in pts]
    draw.polygon(shifted, fill=(220, 50, 50, 100))
    result = Image.alpha_composite(cropped, overlay).convert("RGB")
    return result


def _thumbnail(img: Image.Image, max_px: int) -> Image.Image:
    """Downscale image so its longest edge ≤ max_px (preserving aspect ratio)."""
    w, h = img.size
    if max(w, h) <= max_px:
        return img
    scale = max_px / max(w, h)
    return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


# ── Response parser ────────────────────────────────────────────────────────────
_CODE_RE = re.compile(r"(?:[A-Z]{1,4}[-_]?\d{2,6}|[A-Z]{2,6}\d{2,4})", re.IGNORECASE)


def _parse_response(raw: str) -> tuple:
    """Return (object_name, code) from the LLM response."""
    raw = raw.strip()

    # 1) Try strict JSON
    try:
        # handle markdown code fences
        text = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE).strip()
        data = json.loads(text)
        name = str(data.get("object_name", "") or "").strip()
        code = str(data.get("code", "")        or "").strip()
        if code.upper() in ("", "NONE", "N/A", "NOT FOUND"):
            code = ""
        return name, code
    except Exception:
        pass

    # 2) Fallback: regex search for known patterns
    name_match = re.search(r'"?object_name"?\s*[=:]\s*"?([^"{\n,]+)"?', raw, re.IGNORECASE)
    code_match = re.search(r'"?code"?\s*[=:]\s*"?([A-Z]{1,4}[-_]?\d{2,6})"?',  raw, re.IGNORECASE)

    name = name_match.group(1).strip() if name_match else ""
    code = code_match.group(1).strip() if code_match else ""

    if not code:
        # Last-resort: pick the first code-like token from the raw text
        codes = _CODE_RE.findall(raw)
        if codes:
            code = codes[0]

    return name, code


# ── Main extraction ────────────────────────────────────────────────────────────
def extract_group_info_from_editor_data(
    editor_data: dict,
    floorplan_image_path: str,
    progress_callback=None,
) -> dict:
    """
    Process all groups in editor_data, calling Gemini to identify each object.

    Parameters
    ----------
    editor_data          : dict  — the full parsed editor_data.json
    floorplan_image_path : str   — absolute path to floorplan.png / .jpg
    progress_callback    : callable(group_id, index, total, name, code) | None

    Returns
    -------
    dict  — editor_data with every group enriched with 'object_name' and 'code'
    """
    client = _get_client()
    groups = editor_data.get("groups", {})
    masks  = editor_data.get("masks",  [])
    total  = len(groups)

    # Build mask index: mask_id → mask
    mask_index = {m["id"]: m for m in masks}

    # Build group → mask list
    group_masks: dict[str, list] = {gid: [] for gid in groups}
    for mask in masks:
        gid = mask.get("group_id")
        if gid and gid in group_masks:
            group_masks[gid].append(mask)

    # Load and thumbnail the full floorplan
    fp_img     = Image.open(floorplan_image_path).convert("RGB")
    fp_thumb   = _thumbnail(fp_img, FULL_MAX_SIZE)
    fp_bytes   = _pil_to_bytes(fp_thumb)

    output_groups = {}

    for idx, (gid, group) in enumerate(groups.items(), start=1):
        # If already enriched (resume support)
        if group.get("object_name") or group.get("code"):
            output_groups[gid] = group
            if progress_callback:
                progress_callback(gid, idx, total, group.get("object_name",""), group.get("code",""), skipped=True)
            continue

        # Pick the largest polygon from this group's masks
        best_polygon = None
        best_area    = -1
        for mask in group_masks.get(gid, []):
            for poly in mask.get("polygons", []):
                if len(poly) < 3:
                    continue
                xs = [p[0] for p in poly]
                ys = [p[1] for p in poly]
                area = (max(xs) - min(xs)) * (max(ys) - min(ys))
                if area > best_area:
                    best_area    = area
                    best_polygon = poly

        if best_polygon is None:
            output_groups[gid] = {**group, "object_name": "", "code": ""}
            if progress_callback:
                progress_callback(gid, idx, total, "", "", skipped=False)
            continue

        # Crop object
        crop_img   = _crop_object(fp_img, best_polygon)
        crop_bytes = _pil_to_bytes(crop_img)

        # Build prompt
        prompt = """You are an interior-design procurement specialist analysing a floorplan.

IMAGE 1 = a cropped view of ONE object highlighted with a red overlay.
IMAGE 2 = the full floorplan.

Your tasks:
1. Identify what the highlighted object is (e.g. "Chair", "Dining Table", "Side Table").
2. In the full floorplan, that identical object type is labelled with an alphanumeric code
   (e.g. "CH-502", "TC-508", "DW", "A-01"). Find that code in IMAGE 2.
   - Return ONLY the code that belongs to this object type.
   - If you cannot find any code, return "NONE".

Respond ONLY with valid JSON:
{"object_name": "<name>", "code": "<code or NONE>"}"""

        try:
            response = client.models.generate_content(
                model   = MODEL,
                contents= [
                    types.Part.from_bytes(data=crop_bytes, mime_type="image/jpeg"),
                    types.Part.from_bytes(data=fp_bytes,   mime_type="image/jpeg"),
                    prompt,
                ],
                config = types.GenerateContentConfig(
                    response_mime_type = "application/json",
                    temperature        = 0.1,
                ),
            )
            raw = response.text or ""
        except Exception as e:
            raise RuntimeError(f"Gemini API error on {gid}: {e}")

        name, code = _parse_response(raw)
        enriched   = {**group, "object_name": name, "code": code}
        output_groups[gid] = enriched

        if progress_callback:
            progress_callback(gid, idx, total, name, code, skipped=False)

        time.sleep(DELAY)

    result = dict(editor_data)
    result["groups"] = output_groups
    return result
