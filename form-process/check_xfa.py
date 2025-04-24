import fitz  # PyMuPDF
import sys
import os

def check_pdf_properties(pdf_path):
    pdf = fitz.open(pdf_path)
    is_xfa = False
    has_permissions = pdf.is_encrypted or pdf.permissions != 0xFFFF

    try:
        catalog = pdf.pdf_catalog()
        acroform = pdf.xref_get_key(catalog, "AcroForm")
        if acroform[1] and "/XFA" in acroform[1]:
            is_xfa = True
    except Exception:
        pass

    pdf.close()

    if is_xfa:
        print("XFA_FOUND")
    elif has_permissions:
        print("RESTRICTED")
    else:
        print("OK")

if __name__ == "__main__":
    username = sys.argv[1]
    filename = sys.argv[2]
    path = f"./form-volt/{username}/{filename}"

    if not os.path.exists(path):
        print("MISSING")
        exit()

    check_pdf_properties(path)
