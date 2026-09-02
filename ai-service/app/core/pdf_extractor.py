import os
import re
from typing import List, Dict, Any

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

class PDFExtractor:
    """
    Extracts text and structural elements from PDF statutory and regulatory documents.
    """
    
    @staticmethod
    def extract_document(file_path: str) -> List[Dict[str, Any]]:
        """
        Extract pages with text, page numbers, and structural blocks.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Source file not found: {file_path}")
            
        pages_data = []
        
        # If text/markdown file
        if file_path.endswith(('.txt', '.md')):
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            pages_data.append({
                "page_number": 1,
                "text": content,
                "blocks": [{"text": content, "type": "text"}]
            })
            return pages_data
            
        # PDF Extraction via PyMuPDF
        if fitz is not None:
            try:
                doc = fitz.open(file_path)
                for page_idx, page in enumerate(doc):
                    text = page.get_text("text")
                    blocks = page.get_text("blocks")
                    pages_data.append({
                        "page_number": page_idx + 1,
                        "text": text,
                        "blocks": [{"text": b[4], "bbox": b[:4]} for b in blocks if len(b) >= 5]
                    })
                doc.close()
                return pages_data
            except Exception as e:
                print(f"[PDF Extractor] PyMuPDF failed on {file_path}: {e}")
                
        # Fallback reading
        with open(file_path, 'rb') as f:
            raw_bytes = f.read()
        cleaned_text = raw_bytes.decode('utf-8', errors='ignore')
        pages_data.append({
            "page_number": 1,
            "text": cleaned_text,
            "blocks": [{"text": cleaned_text, "type": "raw"}]
        })
        return pages_data
