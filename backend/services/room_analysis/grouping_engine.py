import numpy as np
import cv2
import random
import string
import json
import os


def save_groups_to_json(groups, filepath="groups.json"):
    with open(filepath, "w") as f:
        json.dump(groups, f, indent=4)


def load_groups_from_json(filepath="groups.json"):
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    return None

# ----------------------------
# Feature Extraction
# ----------------------------
def extract_mask_features(mask):
    seg = mask["segmentation"]

    area = np.sum(seg)

    ys, xs = np.where(seg)
    h = ys.max() - ys.min()
    w = xs.max() - xs.min()

    mask_uint8 = (seg.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(
        mask_uint8,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    contour = max(contours, key=cv2.contourArea) if contours else None

    vertex_count = 0
    if contour is not None:
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        vertex_count = len(approx)

    return {
        "area": area,
        "height": h,
        "width": w,
        "vertex": vertex_count,
        "contour": contour
    }


# ----------------------------
# Helpers
# ----------------------------
def random_color():
    return tuple(np.random.randint(50, 255, size=3).tolist())


def random_name():
    return "Object_" + ''.join(random.choices(string.ascii_uppercase, k=3))


# ----------------------------
# Similarity Logic
# ----------------------------
def is_similar(f1, f2,
               area_tol=0.08,
               size_tol=0.20,
               shape_tol=0.04,
               vertex_tol=2):

    area_diff = abs(f1["area"] - f2["area"]) / max(f1["area"], 1)
    if area_diff > area_tol:
        return False

    h_diff = abs(f1["height"] - f2["height"]) / max(f1["height"], 1)
    w_diff = abs(f1["width"] - f2["width"]) / max(f1["width"], 1)
    if h_diff > size_tol or w_diff > size_tol:
        return False

    if abs(f1["vertex"] - f2["vertex"]) > vertex_tol:
        return False

    if f1["contour"] is None or f2["contour"] is None:
        return False

    shape_score = cv2.matchShapes(
        f1["contour"],
        f2["contour"],
        cv2.CONTOURS_MATCH_I1,
        0.0
    )

    if shape_score > shape_tol:
        return False

    return True


# ----------------------------
# Group Builder
# ----------------------------
# def build_groups(masks):

#     features = [extract_mask_features(m) for m in masks]

#     groups = {}
#     assigned = {}

#     group_id_counter = 1

#     for i, feat in enumerate(features):

#         if i in assigned:
#             continue

#         group_id = f"group_{group_id_counter}"
#         group_id_counter += 1

#         groups[group_id] = {
#             "id": group_id,
#             "name": random_name(),
#             "color": random_color(),
#             "mask_indices": [i]
#         }


#         assigned[i] = group_id

#         for j in range(i + 1, len(features)):
#             if j in assigned:
#                 continue

#             if is_similar(feat, features[j]):
#                 groups[group_id]["mask_indices"].append(j)
#                 assigned[j] = group_id

#     return groups
def build_similarity_graph(masks):
    n = len(masks)
    features = [extract_mask_features(m) for m in masks]

    adjacency = {i: set() for i in range(n)}

    for i in range(n):
        for j in range(i + 1, n):
            if is_similar(features[i], features[j]):
                adjacency[i].add(j)
                adjacency[j].add(i)

    return adjacency

def get_connected_components(adjacency):
    visited = set()
    components = []

    for node in adjacency:
        if node in visited:
            continue

        stack = [node]
        component = []

        while stack:
            current = stack.pop()
            if current in visited:
                continue

            visited.add(current)
            component.append(current)

            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    stack.append(neighbor)

        components.append(component)

    return components


def build_groups(masks):

    adjacency = build_similarity_graph(masks)
    components = get_connected_components(adjacency)

    groups = {}

    for i, comp in enumerate(components, start=1):

        group_id = f"group_{i}"

        groups[group_id] = {
            "id": group_id,
            "name": random_name(),
            "code": "",
            "color": random_color(),
            "mask_indices": comp
        }

    return groups
