import fitz  # PyMuPDF
import json
import os
import sys

username = sys.argv[1]
filename = sys.argv[2]
file_base = os.path.splitext(filename)[0]

form_path = f"./form-volt/{username}/{filename}"
acro_path = f"./temp-process/{username}/{file_base}-acro.json"
final_path = f"./temp-process/{username}/{file_base}-final-acro.json"
output_path = f"./filled-forms/{username}/{file_base}-filled.pdf"

os.makedirs(f"./temp-process/{username}", exist_ok=True)
os.makedirs(f"./filled-forms/{username}", exist_ok=True)

doc = fitz.open(form_path)

# Case 1: Extract field names (no final JSON exists yet)
if not os.path.exists(final_path):
    field_names = []
    for page in doc:
        widgets = page.widgets()
        if widgets:
            for widget in widgets:
                field_names.append(widget.field_name)

    with open(acro_path, "w", encoding="utf-8") as f:
        json.dump(field_names, f, indent=2)
    doc.close()
    exit()

# Case 2: Fill form using final-acro.json
with open(final_path, "r", encoding="utf-8") as f:
    values = json.load(f)

for page in doc:
    widgets = page.widgets()
    if widgets:
        for widget in widgets:
            field_name = widget.field_name
            if field_name in values:
                widget.field_value = values[field_name]
                widget.update()

doc.save(output_path)
doc.close()

# Clean up
os.remove(final_path)
