import cv2
import numpy as np
import os

def preprocess_floorplan_for_sam(
    img_bgr,
    bin_block_size=15,
    bin_c=2,
    dilate_kernel=3,
    close_kernel=7,
    fill_regions=True,
    save_output=True,
    output_dir="output",
    output_name="sam_preprocessed.png"
):
    """
    Preprocess vector-style floor plan images for SAM/SAM2
    and optionally save the result.

    Args:
        img_bgr (np.ndarray): Input image (BGR)
        bin_block_size (int): Adaptive threshold block size (odd)
        bin_c (int): Adaptive threshold constant
        dilate_kernel (int): Kernel size for stroke thickening
        close_kernel (int): Kernel size for closing open shapes
        fill_regions (bool): Fill enclosed regions
        save_output (bool): Save output image or not
        output_dir (str): Directory to save result
        output_name (str): Output image filename

    Returns:
        np.ndarray: 3-channel image ready for SAM
    """

    # 1. Grayscale
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 2. Contrast normalization
    gray = cv2.equalizeHist(gray)

    # 3. Adaptive threshold
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        bin_block_size,
        bin_c
    )

    # 4. Stroke thickening
    if dilate_kernel > 0:
        k = cv2.getStructuringElement(
            cv2.MORPH_RECT, (dilate_kernel, dilate_kernel)
        )
        binary = cv2.dilate(binary, k, iterations=1)

    # 5. Close open contours
    if close_kernel > 0:
        k = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (close_kernel, close_kernel)
        )
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k)

    # 6. Fill regions
    if fill_regions:
        filled = binary.copy()
        h, w = filled.shape
        mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(filled, mask, (0, 0), 0)
        filled = cv2.bitwise_not(filled)
    else:
        filled = binary

    # 7. Convert to 3-channel RGB
    sam_ready = cv2.cvtColor(filled, cv2.COLOR_GRAY2RGB)

    # 8. Save output
    if save_output:
        os.makedirs(output_dir, exist_ok=True)
        save_path = os.path.join(output_dir, output_name)
        cv2.imwrite(save_path, sam_ready)
        print(f"[INFO] Preprocessed image saved to: {save_path}")

    return sam_ready



# import cv2
# import numpy as np
# import os

# def preprocess_floorplan_for_sam(
#     img_bgr,
#     bin_block_size=15,
#     bin_c=2,
#     dilate_kernel=3,
#     close_kernel=7,
#     upscale_factor=2,
#     fill_regions=True,
#     save_output=True,
#     output_dir="output",
#     output_name="sam_preprocessed.png"
# ):

#     """
#     Preprocess vector-style floor plan images for SAM.

#     Improvements:
#     - Image upscaling for small objects
#     - Better noise handling
#     - Stronger stroke thickening
#     - Correct region filling
#     """

#     # 1. Grayscale
#     gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

#     # 2. Slight denoise (helps thresholding)
#     gray = cv2.GaussianBlur(gray, (3,3), 0)

#     # 3. Contrast normalization
#     gray = cv2.equalizeHist(gray)

#     # 4. Adaptive threshold
#     binary = cv2.adaptiveThreshold(
#         gray,
#         255,
#         cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#         cv2.THRESH_BINARY_INV,
#         bin_block_size,
#         bin_c
#     )

#     # 5. Stroke thickening
#     if dilate_kernel > 0:
#         k = cv2.getStructuringElement(
#             cv2.MORPH_RECT, (dilate_kernel, dilate_kernel)
#         )
#         binary = cv2.dilate(binary, k, iterations=1)

#     # 6. Close small gaps in shapes
#     if close_kernel > 0:
#         k = cv2.getStructuringElement(
#             cv2.MORPH_ELLIPSE, (close_kernel, close_kernel)
#         )
#         binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k)

#     # 7. Fill enclosed regions properly
#     if fill_regions:
#         flood = binary.copy()
#         h, w = binary.shape
#         mask = np.zeros((h + 2, w + 2), np.uint8)

#         cv2.floodFill(flood, mask, (0, 0), 255)
#         flood_inv = cv2.bitwise_not(flood)

#         filled = binary | flood_inv
#     else:
#         filled = binary

#     # 8. Upscale image (helps SAM detect small objects)
#     if upscale_factor > 1:
#         filled = cv2.resize(
#             filled,
#             None,
#             fx=upscale_factor,
#             fy=upscale_factor,
#             interpolation=cv2.INTER_NEAREST
#         )

#     # 9. Convert to 3-channel RGB
#     sam_ready = cv2.cvtColor(filled, cv2.COLOR_GRAY2RGB)

#     # 10. Save output
#     if save_output:
#         os.makedirs(output_dir, exist_ok=True)
#         save_path = os.path.join(output_dir, output_name)
#         cv2.imwrite(save_path, sam_ready)
#         print(f"[INFO] Preprocessed image saved to: {save_path}")

#     return sam_ready

# import cv2
# import numpy as np
# import os


# def preprocess_floorplan_for_sam(
#     img_bgr,
#     upscale_factor=2,
#     canny_low=50,
#     canny_high=150,
#     dilate_kernel=2,
#     save_output=True,
#     output_dir="output",
#     output_name="sam_preprocessed.png"
# ):
#     """
#     Optimized preprocessing for architectural floorplans before SAM segmentation.

#     Goals:
#     - Preserve object boundaries
#     - Thicken thin vector lines
#     - Avoid merging nearby objects
#     - Improve SAM detection of small symbols
#     """

#     # -------------------------------------------------
#     # 1. Convert to grayscale
#     # -------------------------------------------------
#     gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

#     # -------------------------------------------------
#     # 2. Slight blur to remove noise
#     # -------------------------------------------------
#     gray = cv2.GaussianBlur(gray, (3, 3), 0)

#     # -------------------------------------------------
#     # 3. Edge detection (best for vector drawings)
#     # -------------------------------------------------
#     edges = cv2.Canny(gray, canny_low, canny_high)

#     # -------------------------------------------------
#     # 4. Light dilation to thicken lines
#     # -------------------------------------------------
#     # if dilate_kernel > 0:
#     #     kernel = cv2.getStructuringElement(
#     #         cv2.MORPH_ELLIPSE,
#     #         (dilate_kernel, dilate_kernel)
#     #     )
#     #     edges = cv2.dilate(edges, kernel, iterations=1)
    
#     kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2,2))
#     edges = cv2.dilate(edges, kernel, iterations=1)
#     # -------------------------------------------------
#     # 5. Upscale image so small objects become larger
#     # -------------------------------------------------
#     # if upscale_factor > 1:
#     #     edges = cv2.resize(
#     #         edges,
#     #         None,
#     #         fx=upscale_factor,
#     #         fy=upscale_factor,
#     #         interpolation=cv2.INTER_NEAREST
#     #     )

#     # -------------------------------------------------
#     # 6. Convert to 3-channel image for SAM
#     # -------------------------------------------------
#     sam_ready = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)

#     # -------------------------------------------------
#     # 7. Save output (optional)
#     # -------------------------------------------------
#     if save_output:
#         os.makedirs(output_dir, exist_ok=True)
#         save_path = os.path.join(output_dir, output_name)
#         cv2.imwrite(save_path, sam_ready)
#         print(f"[INFO] Preprocessed image saved to: {save_path}")

#     return sam_ready