from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
import cv2
import numpy as np
import pickle
import os
from db.database import BASE_DIR

class MaskGenerator:
    def __init__(self, checkpoint_path=None, model_type="vit_h"):
        if checkpoint_path is None:
            checkpoint_path = os.path.join(BASE_DIR, "services", "room_analysis", "sam_vit_h_4b8939.pth")
        self.checkpoint_path = checkpoint_path
        self.model_type = model_type
        self.sam = None
        self.mask_generator = None

    def load_model(self):
        """Load SAM model and initialize the mask generator"""
        if not os.path.exists(self.checkpoint_path):
            raise FileNotFoundError(f"Model checkpoint not found at {self.checkpoint_path}")
            
        print(f"Loading SAM model ({self.model_type})...")
        self.sam = sam_model_registry[self.model_type](checkpoint=self.checkpoint_path)
        self.mask_generator = SamAutomaticMaskGenerator(self.sam)
        print("Model loaded successfully!")

    def boxes_are_close(self, bbox1, bbox2, distance_threshold=25):
        """
        bbox = [x, y, w, h]
        Returns True if boxes overlap or are within distance_threshold pixels
        """
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2

        x1_min, y1_min = x1, y1
        x1_max, y1_max = x1 + w1, y1 + h1

        x2_min, y2_min = x2, y2
        x2_max, y2_max = x2 + w2, y2 + h2

        overlap_x = not (x1_max < x2_min or x2_max < x1_min)
        overlap_y = not (y1_max < y2_min or y2_max < y1_min)

        if overlap_x and overlap_y:
            return True

        dx = max(x2_min - x1_max, x1_min - x2_max, 0)
        dy = max(y2_min - y1_max, y1_min - y2_max, 0)
        distance = np.sqrt(dx * dx + dy * dy)

        return distance <= distance_threshold

    def merge_adjacent_masks(self, masks, distance_threshold=25, min_area=100):
        """
        Merge masks that belong to the same symbolic object
        """
        merged = []
        used = set()

        # Sort masks by area to process larger ones first
        masks = sorted(masks, key=lambda x: x['area'], reverse=True)

        for i, mask1 in enumerate(masks):
            if i in used:
                continue

            base_mask = mask1['segmentation'].copy()
            base_bbox = mask1['bbox']
            used.add(i)

            for j, mask2 in enumerate(masks[i + 1:], i + 1):
                if j in used or mask2['area'] < min_area:
                    continue

                if not self.boxes_are_close(base_bbox, mask2['bbox'], distance_threshold):
                    continue

                # Pixel-level touch / near-touch check
                overlap_pixels = np.logical_and(base_mask, mask2['segmentation']).sum()
                if overlap_pixels > 0:
                    base_mask |= mask2['segmentation']
                    used.add(j)
                    continue

                # Check for tiny gaps (dilation)
                dilated = cv2.dilate(base_mask.astype(np.uint8), np.ones((3,3), np.uint8), iterations=1)
                if np.logical_and(dilated.astype(bool), mask2['segmentation']).any():
                    base_mask |= mask2['segmentation']
                    used.add(j)

            # Recalculate bbox for merged mask
            y_indices, x_indices = np.where(base_mask)
            if len(x_indices) > 0:
                x_min, x_max = x_indices.min(), x_indices.max()
                y_min, y_max = y_indices.min(), y_indices.max()
                new_bbox = [int(x_min), int(y_min), int(x_max - x_min), int(y_max - y_min)]
                
                merged.append({
                    'segmentation': base_mask,
                    'area': int(base_mask.sum()),
                    'bbox': new_bbox
                })

        return merged

    def process_image(self, image_path, output_pkl_path, do_merge=True):
        """Main pipeline: Load image -> Generate Masks -> [Merge] -> Save PKL"""
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not read image at {image_path}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        print(f"Generating masks for {image_path}...")
        masks = self.mask_generator.generate(image)
        
        if do_merge:
            print(f"Merging adjacent masks (initial count: {len(masks)})...")
            masks = self.merge_adjacent_masks(masks)
            print(f"Final mask count: {len(masks)}")

        # Ensure directory exists
        os.makedirs(os.path.dirname(output_pkl_path), exist_ok=True)
        
        # Save to PKL
        with open(output_pkl_path, 'wb') as f:
            pickle.dump(masks, f)
        print(f"Successfully saved masks to {output_pkl_path}")

if __name__ == "__main__":
    # Example usage
    generator = MaskGenerator()
    generator.load_model()
    
    # Customize these paths as needed
    INPUT_IMAGE = "demo_preprocessed.png"
    OUTPUT_PKL = "generated_masks/masksnew.pkl"
    
    if os.path.exists(INPUT_IMAGE):
        generator.process_image(INPUT_IMAGE, OUTPUT_PKL)
    else:
        print(f"Please ensure {INPUT_IMAGE} exists to run the example.")
