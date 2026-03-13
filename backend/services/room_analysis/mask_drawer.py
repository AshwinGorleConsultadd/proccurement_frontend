import cv2
import numpy as np
import pickle
import os

def draw_masks_on_image(image_path: str, pkl_path: str, output_path: str):
    """
    Reads the original (or preprocessed) image and the generated SAM masks (pkl),
    overlays the masks as random, semi-transparent colored polygons,
    and saves the resulting overlaid image.
    This is primarily used for debugging/visualization.
    """
    if not os.path.exists(image_path):
        print(f"[Debug] Could not find image at {image_path}")
        return
    if not os.path.exists(pkl_path):
        print(f"[Debug] Could not find mask pkl at {pkl_path}")
        return

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        print(f"[Debug] Failed to read image with cv2: {image_path}")
        return

    # Load masks
    with open(pkl_path, "rb") as f:
        masks_data = pickle.load(f)

    # Overlay masks
    for mask_obj in masks_data:
        # mask shape from SAM is typically under 'segmentation' and is a boolean ndarray
        segmentation = mask_obj.get("segmentation")
        if segmentation is not None:
            # Generate random color
            color = np.random.randint(0, 255, (3,), dtype=np.uint8).tolist()
            # Apply color overlay with 50% opacity onto the True pixels of the mask
            img[segmentation] = img[segmentation] * 0.5 + np.array(color) * 0.5

    # Save output
    cv2.imwrite(output_path, img)
    print(f"[Debug] Saved mask overlay image to {output_path}")
