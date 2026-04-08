import sys
import json
import os
import tempfile
import easyocr
import fitz  # PyMuPDF
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""
    
    # Determine model storage directory (support for PyInstaller)
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        base_path = sys._MEIPASS
    else:
        # Running as script
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    model_dir = os.path.join(base_path, 'models')
    
    # Check if we have bundled models
    if os.path.exists(model_dir):
        # Use bundled models, disable download
        reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False, 
                               model_storage_directory=model_dir, 
                               download_enabled=False)
    else:
        # Use default behavior (download if needed to user home)
        reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
    
    # Limit to first 3 pages to save time/resources
    max_pages = min(len(doc), 3)
    
    for i in range(max_pages):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Zoom 2x for better OCR
        
        # Save temp image in secure temp directory
        tmp_fd, img_path = tempfile.mkstemp(suffix=f'_page_{i}.png')
        os.close(tmp_fd)
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
    # Determine model storage directory (support for PyInstaller)
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    model_dir = os.path.join(base_path, 'models')
    
    if os.path.exists(model_dir):
        reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False, model_storage_directory=model_dir, download_enabled=False)
    else:
        reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
        
    result = reader.readtext(img_path, detail=0)
    return " ".join(result)

import re

def extract_subject(text):
    if not text:
        return None
        
    # Pattern to find "ASUNTO", "SUMILLA", "REF", "ALCANZO" allowing for some OCR noise
    # e.g., "A S U N T O :" or "ASUNTO:"
    # Captures content until a double newline or a "safe" delimiter
    marker_pattern = r'(?i)(?:A\s*S\s*U\s*N\s*T\s*O|A\s*L\s*C\s*A\s*N\s*Z\s*O|S\s*U\s*B\s*J\s*E\s*C\s*T|T\s*E\s*M\s*A|R\s*E\s*F(?:\s*E\s*R\s*E\s*N\s*C\s*I\s*A)?|S\s*U\s*M\s*I\s*L\s*L\s*A)\s*[:.-]\s*(.+)'
    
    matches = re.finditer(marker_pattern, text[:3000]) # Check first 3000 chars
    
    for match in matches:
        raw_subject = match.group(1).strip()
        
        # If the line ends abruptly, check next line?
        # For now, let's take the single line match. If regex didn't capture newline, let's see.
        # Actually . in regex usually doesn't match newline.
        # Let's try to capture subsequent lines if they look like continuation (indented or not starting with another keyword)
        
        # Simple approach: Take the line, and if it's short, look ahead.
        # But regex '.' stops at newline.
        
        # Let's clean up the match
        clean = re.sub(r'\s+', ' ', raw_subject)
        
        # Heuristic: Valid subjects are usually > 5 chars
        if len(clean) > 5:
            return clean

    # Fallback: Look for lines that look like a subject (uppercase, centered?? tough in plain text)
    return None

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
            
        # Detect subject
        subject = extract_subject(text)
        
        print(json.dumps({
            "success": True,
            "text": text,
            "subject": subject,
            "length": len(text)
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    main()
