import pickle
import json
import cv2
import numpy as np
from pathlib import Path


def mask_to_polygons(mask, epsilon_ratio=0.005, max_points=500, min_area=50):
    mask = mask.astype(np.uint8)

    # 🔹 Smooth small jagged edges
    mask = cv2.medianBlur(mask, 3)

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE   # 🔥 change from NONE
    )

    polygons = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        epsilon = epsilon_ratio * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        # 🔹 If still too detailed → simplify more
        while len(approx) > max_points:
            epsilon *= 1.5
            approx = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) < 3:
            continue

        polygon = approx.reshape(-1, 2).tolist()
        polygons.append(polygon)

    return polygons


def combine_masks_and_groups(
    pkl_path: str, 
    groups_path: str, 
    image_path: str, 
    output_json_path: str,
    epsilon_ratio: float = 0.0001,
    min_area: int = 50
):
    print("Loading masks pickle...")
    with open(pkl_path, "rb") as f:
        data = pickle.load(f)

    print("Loading groups.json...")
    with open(groups_path, "r") as f:
        groups_data = json.load(f)

    print("Reading image for dimensions...")
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Image not found at {image_path}")

    image_height, image_width = image.shape[:2]

    # -----------------------------------
    # Build mask_index → group_id lookup
    # -----------------------------------
    mask_to_group = {}

    for group_id, group_info in groups_data.items():
        for mask_idx in group_info["mask_indices"]:
            mask_to_group[mask_idx] = group_id

    # -----------------------------------
    # Convert masks
    # -----------------------------------
    print("Converting masks to polygons...")

    masks_output = []

    for idx, item in enumerate(data):
        print("Processing mask:", idx)

        if isinstance(item, dict) and "segmentation" in item:
            mask = item["segmentation"]
        else:
            mask = item

        if not isinstance(mask, np.ndarray):
            continue

        polygons = mask_to_polygons(mask, epsilon_ratio=epsilon_ratio, min_area=min_area)

        if not polygons:
            continue

        masks_output.append({
            "id": idx,
            "polygons": polygons,
            "group_id": mask_to_group.get(idx, None)
        })

    print(f"Converted {len(masks_output)} masks")

    # -----------------------------------
    # Final Output Structure
    # -----------------------------------
    output = {
        "image_width": image_width,
        "image_height": image_height,
        "groups": groups_data,
        "masks": masks_output
    }

    with open(output_json_path, "w") as f:
        json.dump(output, f)

    print(f"Saved to {output_json_path}")

