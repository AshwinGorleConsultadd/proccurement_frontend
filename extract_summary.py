import re

with open("src/pages/project/ProjectEditorPage.jsx", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if line.startswith("/* ── Summary Tab"):
        skip = True
        continue
    if skip and line.startswith("/* ── Inline project name editor"):
        skip = False
    
    if not skip:
        if line.startswith("import { SourceTab } from \"./SourceTab\";"):
            new_lines.append(line)
            new_lines.append("import { SummaryTab } from \"./SummaryTab\";\n")
        else:
            new_lines.append(line)

with open("src/pages/project/ProjectEditorPage.jsx", "w") as f:
    f.writelines(new_lines)
print("Finished!")
