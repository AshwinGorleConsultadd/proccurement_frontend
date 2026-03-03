import re

with open("src/pages/project/ProjectEditorPage.jsx", "r") as f:
    lines = f.readlines()

# Extract lines 45 to 685 (0-indexed 45 to 685)
start_idx = 45 # line 46
end_idx = 686 # line 686 inclusive

extracted_lines = lines[start_idx:end_idx]

# Remove extracted lines from ProjectEditorPage and add import
new_project_page_lines = lines[:start_idx] + [
    "\nexport { SourceTab } from \"./SourceTab\"; // Re-export if needed or just let it be imported\n"
] + lines[end_idx:]

# We need to add the import to ProjectEditorPage.jsx
# let's find the absolute imports and add SourceTab
for i, line in enumerate(new_project_page_lines):
    if line.startswith("import { RoomProcessorTab }"):
        new_project_page_lines.insert(i + 1, 'import { SourceTab } from "./SourceTab";\n')
        break

# What are the imports for SourceTab.jsx?
imports = """import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useProjects } from "../../redux/hooks/project/useProjects";
import { Button } from "../../components/ui/button";
import {
  X, ChevronLeft, ChevronRight, ExternalLink, ImageOff, ZoomIn, ChevronDown,
  Upload, Loader2, Images, RefreshCw, Plus, CheckSquare, Square, Download
} from "lucide-react";

const BASE = "http://localhost:8000";

"""

with open("src/pages/project/SourceTab.jsx", "w") as f:
    f.write(imports + "".join(extracted_lines))

with open("src/pages/project/ProjectEditorPage.jsx", "w") as f:
    f.writelines(new_project_page_lines)

print("Extraction complete.")
