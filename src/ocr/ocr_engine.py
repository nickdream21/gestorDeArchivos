import sys
import json
import os
import easyocr
import fitz  # PyMuPDF
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""
    
    # Initialize reader with English and Spanish
    reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
    
    # Limit to first 3 pages to save time/resources
    max_pages = min(len(doc), 3)
    
    for i in range(max_pages):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Zoom 2x for better OCR
        
        # Save temp image
        img_path = f"temp_page_{i}.png"
        pix.save(img_path)
        
        try:
            result = reader.readtext(img_path, detail=0)
            text_page = " ".join(result)
            full_text += f"\n--- Page {i+1} ---\n{text_page}\n"
        finally:
            if os.path.exists(img_path):
                os.remove(img_path)
                
    return full_text

def extract_text_from_image(img_path):
    reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
    result = reader.readtext(img_path, detail=0)
    return " ".join(result)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        return

    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({"error": "File not found"}))
        return
        
    try:
        ext = os.path.splitext(file_path)[1].lower()
        text = ""
        
        if ext == '.pdf':
            text = extract_text_from_pdf(file_path)
        elif ext in ['.jpg', '.jpeg', '.png']:
            text = extract_text_from_image(file_path)
        else:
            print(json.dumps({"error": "Unsupported file format"}))
            return
            
        print(json.dumps({
            "success": True,
            "text": text,
            "length": len(text)
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    main()
