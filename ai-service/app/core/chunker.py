import re
from typing import List, Dict, Any

class LegalAwareChunker:
    """
    Structure-aware chunker for legal statutes, rules, pharmacopoeial standards, and treaties.
    Preserves Chapter, Section, Subsection, Rule, Article, and Schedule boundaries.
    """
    
    # Common legal section heading patterns
    SECTION_REGEX = re.compile(
        r'(?:^|\n)(Section\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'Sec\.\s*[0-9]+[A-Za-z]*|'
        r'Rule\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'Article\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'CHAPTER\s+[IVXLCDM0-9]+|'
        r'Schedule\s+[IVXLCDM0-9]+|'
        r'Form\s+[A-Z0-9\-]+|'
        r'\[[0-9]+\]\s+[A-Z])',
        re.IGNORECASE
    )
    
    @classmethod
    def chunk_document(cls, pages_data: List[Dict[str, Any]], max_chunk_size: int = 1000, overlap: int = 150) -> List[Dict[str, Any]]:
        """
        Produce structured chunks with legal metadata from extracted pages.
        """
        full_text_blocks = []
        for page in pages_data:
            p_num = page.get("page_number", 1)
            raw_text = page.get("text", "")
            full_text_blocks.append((p_num, raw_text))
            
        chunks = []
        chunk_idx = 0
        current_chapter = "General Provisions"
        current_section_id = "General"
        current_section_title = "Overview"
        
        for p_num, text in full_text_blocks:
            # Detect chapters
            chap_match = re.search(r'CHAPTER\s+[IVXLCDM0-9]+[^\n]*', text, re.IGNORECASE)
            if chap_match:
                current_chapter = chap_match.group(0).strip()
                
            # Split page text into section-aware paragraphs
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            
            buffer_text = ""
            for para in paragraphs:
                # Check for section start
                sec_match = cls.SECTION_REGEX.search(para)
                if sec_match:
                    current_section_id = sec_match.group(1).strip()
                    # Extract first line as title
                    lines = para.split("\n")
                    current_section_title = lines[0].strip()[:120]
                    
                if len(buffer_text) + len(para) > max_chunk_size and len(buffer_text) > 200:
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "section_identifier": current_section_id,
                        "title": current_section_title,
                        "chapter": current_chapter,
                        "page_number": p_num,
                        "content": buffer_text.strip(),
                        "metadata": {
                            "section": current_section_id,
                            "title": current_section_title,
                            "chapter": current_chapter,
                            "page": p_num,
                        }
                    })
                    chunk_idx += 1
                    # Keep overlap from the end of buffer
                    buffer_text = buffer_text[-overlap:] + "\n" + para
                else:
                    buffer_text += "\n\n" + para if buffer_text else para
                    
            if buffer_text and len(buffer_text.strip()) > 50:
                chunks.append({
                    "chunk_index": chunk_idx,
                    "section_identifier": current_section_id,
                    "title": current_section_title,
                    "chapter": current_chapter,
                    "page_number": p_num,
                    "content": buffer_text.strip(),
                    "metadata": {
                        "section": current_section_id,
                        "title": current_section_title,
                        "chapter": current_chapter,
                        "page": p_num,
                    }
                })
                chunk_idx += 1
                buffer_text = ""
                
        return chunks
