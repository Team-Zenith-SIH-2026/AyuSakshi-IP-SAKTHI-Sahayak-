import re
from typing import List, Dict, Any, Tuple

class LegalAwareChunker:
    """
    Structure-aware chunker for legal statutes, rules, pharmacopoeial standards, and treaties.

    Chunks along legal structure: one section, rule or article per chunk, never by
    arbitrary character count. Splitting mid-section produces citations that point
    at the wrong provision, which is the worst failure this system can have.

    Text from every page is joined into one stream before splitting, because a
    section routinely runs across a page break. An earlier version reset its
    buffer at each page boundary, which silently cut sections in half and
    attributed the tail of one section to the heading of another.
    """

    # Common legal section heading patterns. Anchored to a line start so that a
    # cross-reference inside a sentence ("...as defined in Section 3(p)...") is
    # not mistaken for the start of a new section.
    SECTION_REGEX = re.compile(
        r'^[ \t]*('
        r'Section\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'Sec\.\s*[0-9]+[A-Za-z]*|'
        r'Rule\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'Regulation\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'Article\s+[0-9]+[A-Za-z]*(?:\([a-zA-Z0-9]+\))*|'
        r'CHAPTER\s+[IVXLCDM0-9]+[A-Za-z\-]*|'
        r'SCHEDULE\s+[IVXLCDM0-9A-Z]*|'
        r'Schedule\s+[IVXLCDM0-9]+|'
        r'FORM\s+[A-Z0-9\-]+|'
        r'[0-9]+[A-Za-z]*\.\s+(?=[A-Z])'   # bare numbered clause: "3. What are not inventions"
        r')',
        re.MULTILINE
    )

    CHAPTER_REGEX = re.compile(r'^[ \t]*(CHAPTER\s+[IVXLCDM0-9]+[^\n]*)', re.MULTILINE | re.IGNORECASE)

    @staticmethod
    def _join_pages(pages_data: List[Dict[str, Any]]) -> Tuple[str, List[Tuple[int, int]]]:
        """
        Join page text into one stream, returning it with an offset-to-page index
        so each chunk can still record the page it started on.
        """
        parts = []
        offsets = []
        cursor = 0
        for page in pages_data:
            text = page.get("text", "") or ""
            page_no = page.get("page_number", len(offsets) + 1)
            offsets.append((cursor, page_no))
            parts.append(text)
            cursor += len(text) + 1  # +1 for the newline joiner below
        return "\n".join(parts), offsets

    @staticmethod
    def _page_for_offset(offset: int, offsets: List[Tuple[int, int]]) -> int:
        page = offsets[0][1] if offsets else 1
        for start, page_no in offsets:
            if start <= offset:
                page = page_no
            else:
                break
        return page

    @classmethod
    def chunk_document(
        cls,
        pages_data: List[Dict[str, Any]],
        max_chunk_size: int = 6000,
        overlap: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Produce one chunk per legal section, with metadata.

        max_chunk_size is a safety valve for a single enormous section, not the
        primary splitting rule. When it triggers, the split happens at a paragraph
        boundary and the chunk is marked as a continuation so the citation still
        names the right provision.
        """
        full_text, offsets = cls._join_pages(pages_data)
        if not full_text.strip():
            return []

        # Locate every section heading in the joined stream.
        matches = list(cls.SECTION_REGEX.finditer(full_text))

        # Track which chapter each offset falls under.
        chapters = [(m.start(), m.group(1).strip()) for m in cls.CHAPTER_REGEX.finditer(full_text)]

        def chapter_for(offset: int) -> str:
            current = "General Provisions"
            for start, name in chapters:
                if start <= offset:
                    current = name
                else:
                    break
            return current

        # Build (start, end, identifier) spans. Text before the first heading is
        # front matter and is kept as a preamble chunk if it has substance.
        spans: List[Tuple[int, int, str]] = []
        if not matches:
            spans.append((0, len(full_text), "General"))
        else:
            if matches[0].start() > 200:
                spans.append((0, matches[0].start(), "Preamble"))
            for i, m in enumerate(matches):
                end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
                spans.append((m.start(), end, m.group(1).strip().rstrip('.')))

        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for start, end, section_id in spans:
            body = full_text[start:end].strip()
            if len(body) < 40:
                continue

            page_no = cls._page_for_offset(start, offsets)
            chapter = chapter_for(start)

            # Title is the heading line, or its first sentence if the heading and
            # title share a line ("3. What are not inventions").
            first_line = body.split("\n", 1)[0].strip()
            title = first_line[:200] if first_line else section_id

            # Split only if a single section is very large, and only at a
            # paragraph boundary.
            pieces = [body]
            if len(body) > max_chunk_size:
                pieces = []
                buf = ""
                for para in body.split("\n\n"):
                    if buf and len(buf) + len(para) + 2 > max_chunk_size:
                        pieces.append(buf.strip())
                        buf = para
                    else:
                        buf = f"{buf}\n\n{para}" if buf else para
                if buf.strip():
                    pieces.append(buf.strip())

            for part_no, piece in enumerate(pieces):
                chunks.append({
                    "chunk_index": chunk_idx,
                    "section_identifier": section_id,
                    "title": title,
                    "chapter": chapter,
                    "page_number": page_no,
                    "content": piece,
                    "metadata": {
                        "section": section_id,
                        "title": title,
                        "chapter": chapter,
                        "page": page_no,
                        "part": part_no + 1 if len(pieces) > 1 else None,
                        "part_count": len(pieces) if len(pieces) > 1 else None,
                        "oversized_section_split": len(pieces) > 1,
                    },
                })
                chunk_idx += 1

        return chunks
