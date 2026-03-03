import os
import cv2
import pickle
from pymongo import MongoClient
from bson import ObjectId
from pathlib import Path
from config import MONGO_URI, MONGO_DB_NAME
from services.project_service import LOCAL_FILE_DB

from services.room_analysis.image_preprocessor import preprocess_floorplan_for_sam
from services.room_analysis.mask_generator import MaskGenerator
from services.room_analysis.grouping_engine import build_groups, save_groups_to_json
from services.room_analysis.mask_and_group_combiner import combine_masks_and_groups


def update_room_analysis_status(room_id: str, status: str, progress: int, message: str = "", extra_fields: dict = None):
    """Utility to update the MongoDB room document with processing state"""
    try:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        rooms_coll = db["rooms"]
        update_doc = {
            "analysis_status": status,
            "analysis_progress": progress,
            "analysis_message": message
        }
        if extra_fields:
            update_doc.update(extra_fields)
            
        rooms_coll.update_one(
            {"_id": ObjectId(room_id)},
            {"$set": update_doc}
        )
        client.close()
    except Exception as e:
        print(f"[Orchestrator] Failed to update status for room {room_id}: {e}")


def run_room_analysis_pipeline(room_id: str, project_id: str, room_image_url: str):
    """
    Background Task: Executes the full SAM mask generation and grouping pipeline.
    """
    try:
        print(f"[Orchestrator] Starting analysis for room {room_id}")
        update_room_analysis_status(room_id, "preprocessing", 5, "Initializing analysis...")
        
        # 1. Setup paths
        # Ensure we have the physical path to the input image
        rel_img_path = room_image_url.replace("/local_file_db/", "").lstrip("/")
        input_image_path = os.path.join(LOCAL_FILE_DB, rel_img_path)
        
        if not os.path.exists(input_image_path):
            raise FileNotFoundError(f"Source image not found at {input_image_path}")
            
        # Create output directory for this room's analysis artifacts
        room_output_dir = os.path.join(LOCAL_FILE_DB, f"project_{project_id}", "rooms", str(room_id), "analysis")
        os.makedirs(room_output_dir, exist_ok=True)
        
        # Define output artifact paths
        preprocessed_img_path = os.path.join(room_output_dir, "preprocessed.png")
        masks_pkl_path = os.path.join(room_output_dir, "masks.pkl")
        groups_json_path = os.path.join(room_output_dir, "groups.json")
        masks_polygons_json_path = os.path.join(room_output_dir, "masks_polygons.json")

        base_url = f"/local_file_db/project_{project_id}/rooms/{room_id}/analysis"

        # 2. Preprocess Image
        update_room_analysis_status(room_id, "preprocessing", 10, "Preprocessing image for SAM...")
        img_bgr = cv2.imread(input_image_path)
        if img_bgr is None:
            raise ValueError(f"Could not read image using OpenCV: {input_image_path}")
            
        preprocess_floorplan_for_sam(
            img_bgr=img_bgr,
            save_output=True,
            output_dir=room_output_dir,
            output_name="preprocessed.png"
        )

        # 3. Generate Masks (SAM)
        update_room_analysis_status(room_id, "generating_masks", 30, "Generating segmentation masks using SAM Model (This may take a while)...")
        # Initialize generator (assuming model downloaded in root or accessible path)
        try:
            generator = MaskGenerator()
            generator.load_model()
        except Exception as e:
            raise RuntimeError(f"Failed to load SAM model. Ensure sam_vit_h_4b8939.pth exists. Error: {e}")
            
        generator.process_image(
            image_path=preprocessed_img_path,
            output_pkl_path=masks_pkl_path,
            do_merge=True
        )

        # 4. Group Masks
        update_room_analysis_status(room_id, "grouping", 70, "Clustering similar masks into groups...")
        with open(masks_pkl_path, "rb") as f:
            masks_data = pickle.load(f)
            
        # Build relational groups dictionary
        groups_dict = build_groups(masks_data)
        save_groups_to_json(groups_dict, groups_json_path)

        # 5. Combine Masks and Groups into Polygons
        update_room_analysis_status(room_id, "combining", 85, "Converting masks to lightweight polygons...")
        combine_masks_and_groups(
            pkl_path=masks_pkl_path,
            groups_path=groups_json_path,
            image_path=preprocessed_img_path,
            output_json_path=masks_polygons_json_path,
            epsilon_ratio=0.0001,
            min_area=50
        )

        # 6. Finalize Payload and Update MongoDB
        update_room_analysis_status(
            room_id=room_id,
            status="completed",
            progress=100,
            message="Room analysis successfully completed.",
            extra_fields={
                "masks_polygons_url": f"{base_url}/masks_polygons.json",
                "masks_groups_url": f"{base_url}/groups.json",
                "masks_pkl_url": f"{base_url}/masks.pkl"
            }
        )
        print(f"[Orchestrator] Successfully completed analysis for room {room_id}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[Orchestrator] Error processing room {room_id}: {e}")
        update_room_analysis_status(room_id, "error", 0, f"Error: {str(e)}")
