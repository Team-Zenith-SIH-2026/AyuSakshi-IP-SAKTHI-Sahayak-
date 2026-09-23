"""
Splitting the full text of an Indian statute into one passage per section.

LegalAwareChunker is general-purpose: it splits wherever a line starts with a
number and a full stop. On the India Code and Gazette PDFs of the core laws that
is not good enough, and the failure is the worst kind this system can have: a
right answer cited to the wrong provision, which citation verification then
approves because the label matches. Measured on these files:

  - Amendment footnotes ("1. Subs. by Act 15 of 2005, s. 2") start with a
    number and a full stop. In the Trade Marks Act they cut 37 sections in two
    and labelled the second half with the footnote's number.
  - The table of contents at the front repeats every section heading.
  - Gazette texts put the heading in the margin, so a section starts
    "1. (1) This Act may be called", which the general pattern misses; the GI
    Act's first three sections were merged into a chapter heading.

This parser uses what a reader uses instead. Footnotes are printed smaller than
the body text, so text below the body size is dropped. The table of contents is
skipped by starting where the enacting text starts. And a line is accepted as
the start of a section only if its number follows the previous section's: after
section 23 comes 23A or 24 (or a few further, where sections were omitted), never 1.
"""

import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    fitz = None

# A section starts at a line beginning with its number, optionally after an
# amendment bracket: "3. What are", "3A. ", "[3A. ", "1[3A. ", "1. (1) This Act".
# The footnote marker before a bracket is optional and only counts when a
# bracket follows it; otherwise it would eat the first digit of "10.". The
# number may stand alone on its line ("32." then "Anticipation" below it),
# which is how justified PDF text often comes out.
_HEADING = re.compile(r"(?m)^[ 	]*(?:\d{1,2}(?=\[))?\[?(\d{1,3})((?:-?[A-Z]){0,3})(?:\.\s*|[ 	]+(?=\(1\)))(?=[\[(\"'A-Z‘“])")

_CHAPTER_LINE = re.compile(r"^\s*CHAPTER\s+[IVXLC0-9]+[A-Z]?\s*$")
_PAGE_NUMBER = re.compile(r"^\s*[-–]?\s*\d{1,3}\s*[-–]?\s*$")
# Where a line break carries meaning: before a sub-section, clause, proviso or explanation.
_KEEP_BREAK = re.compile(r"\n(?=\s*(?:\(\w{1,5}\)|\[\(|Provided\b|Explanation\b|Illustration\b|\d+\[))")

# How far the numbering may jump between consecutive sections. Omitted and
# repealed sections leave gaps; a bigger jump is almost always a stray number.
MAX_GAP = 6


def _sizes(pages) -> Counter:
    """Characters set in each font size."""
    sizes: Counter = Counter()
    for page in pages:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    text = span["text"].strip()
                    if text:
                        sizes[round(span["size"], 1)] += len(text)
    return sizes


def _body_size(sizes: Counter, fallback: float = 10.0) -> float:
    """The font size most of the text is set in."""
    return sizes.most_common(1)[0][0] if sizes else fallback


def extract_body_text(path: str, first_page: int = 0, last_page: Optional[int] = None,
                      keep_small: bool = False) -> Tuple[str, List[Tuple[int, int]]]:
    """
    The body text of the PDF, one line per printed line, without anything set
    smaller than the body: footnotes, superscript footnote markers and running
    headers. Returns the text and (offset, page number) pairs.
    """
    if fitz is None:
        raise RuntimeError("PyMuPDF is required to parse statutes")
    doc = fitz.open(path)
    last = len(doc) if last_page is None else min(last_page, len(doc))
    overall = _body_size(_sizes(doc[i] for i in range(first_page, last)))

    page_lines: List[List[str]] = []
    for page_no in range(first_page, last):
        # "Smaller than the body" is judged page by page. One file can set parts
        # in different sizes: the Drugs and Cosmetics Act's Ayurveda chapter is
        # in 10 point where most of that file is 11, and a file-wide threshold
        # dropped sections 33D to 33J as if they were footnotes.
        # The lower of the page's and the file's body size: a page set mostly in a
        # larger size can still carry body text (a regulation's number) in the
        # file's usual size, and that must not be dropped either.
        page_sizes = _sizes([doc[page_no]])
        page_body = _body_size(page_sizes, overall) if sum(page_sizes.values()) >= 300 else overall
        floor = 0.0 if keep_small else min(page_body, overall) - 0.9
        lines = []
        for block in doc[page_no].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"] if s["size"] >= floor)
                if text.strip():
                    lines.append(text.rstrip())
        page_lines.append(lines)
    doc.close()

    # Running headers ("THE PATENTS ACT, 1970", "THE GAZETTE OF INDIA
    # EXTRAORDINARY") repeat on page after page; body text never does.
    seen: Counter = Counter()
    for lines in page_lines:
        seen.update({re.sub(r"\s+", " ", l).strip().upper() for l in lines})
    # A header has words in it. A bare "4." repeats on many pages of a short file
    # (numbered lists), and dropping it merged Regulations 4 and 5 into 3.
    repeated = {l for l, n in seen.items()
                if n >= max(3, len(page_lines) // 4) and len(l) < 90 and sum(c.isalpha() for c in l) >= 4}

    parts, offsets, cursor = [], [], 0
    for index, lines in enumerate(page_lines):
        kept, skip_title = [], False
        for line in lines:
            norm = re.sub(r"\s+", " ", line).strip().upper()
            if norm in repeated or _PAGE_NUMBER.match(line):
                continue
            # A chapter heading and the title line under it belong to no section.
            if _CHAPTER_LINE.match(line):
                skip_title = True
                continue
            if skip_title and line.strip().isupper():
                continue
            skip_title = False
            kept.append(line)
        page_text = "\n".join(kept)
        page_no = first_page + index
        offsets.append((cursor, page_no + 1))
        parts.append(page_text)
        cursor += len(page_text) + 1
    return "\n".join(parts), offsets


def tidy(text: str) -> str:
    """
    Rejoin lines the PDF wrapped (justified text often comes out one word per
    line), keeping a break only where the statute's own structure has one.
    """
    marked = _KEEP_BREAK.sub("<<BR>>", text)
    joined = re.sub(r"[ \t]*\n[ \t]*", " ", marked)
    joined = re.sub(r"-\s(?=[a-z])", "-", joined)  # "sub- section" split across lines
    joined = re.sub(r"[ \t]{2,}", " ", joined)
    return joined.replace("<<BR>>", "\n").strip()


def _page(offset: int, offsets: List[Tuple[int, int]]) -> int:
    page = offsets[0][1] if offsets else 1
    for start, number in offsets:
        if start > offset:
            break
        page = number
    return page


def _follows(prev: Optional[Tuple[int, str]], num: int, suffix: str) -> bool:
    """Whether section num+suffix can come straight after prev."""
    if prev is None:
        return num == 1 and not suffix
    p_num, p_suffix = prev
    if num == p_num:
        return suffix > p_suffix  # 3 -> 3A -> 3B
    return p_num < num <= p_num + MAX_GAP


def split_sections(
    text: str,
    offsets: List[Tuple[int, int]],
    unit: str = "Section",
    start: Optional[str] = None,
    end: Optional[str] = None,
    first_number: int = 1,
    last_number: Optional[int] = None,
) -> List[Dict]:
    """
    One passage per section of `text`, labelled "<unit> <number>".

    start and end are regular expressions that bound the enacting text: start
    skips the table of contents and front matter, end drops schedules or a
    second instrument printed in the same file.
    """
    lo = 0
    if start:
        m = re.search(start, text)
        if m:
            lo = m.start()
    hi = len(text)
    if end:
        m = re.search(end, text[lo:])
        if m:
            hi = lo + m.start()

    heads = []
    prev: Optional[Tuple[int, str]] = (first_number - 1, "") if first_number > 1 else None
    for m in _HEADING.finditer(text, lo, hi):
        num, suffix = int(m.group(1)), m.group(2).lstrip("-")
        if last_number is not None and num > last_number:
            continue
        if _follows(prev, num, suffix):
            heads.append((m.start(), m.group(1) + m.group(2)))
            prev = (num, suffix)

    sections = []
    for i, (pos, number) in enumerate(heads):
        stop = heads[i + 1][0] if i + 1 < len(heads) else hi
        body = tidy(text[pos:stop])
        first_line = re.sub(r"\s+", " ", body[:240])
        title_match = re.match(r"\[?\d+[A-Z]*\.\s*\[?([^—–⎯]{3,160}?)\s*[.:]?\s*[—–⎯]", first_line)
        sections.append({
            "section_identifier": f"{unit} {number}",
            "title": title_match.group(1).strip(" .[") if title_match else "",
            "content": body,
            "page_number": _page(pos, offsets),
        })
    return sections


# ---------------------------------------------------------------------------
# Long sections
#
# A section like the Patents Act's definitions runs to about 8,000 characters.
# Five of those in one prompt exceed the model's per-minute token budget, and a
# citation to "Section 2" says less than one to "Section 2(1)(j)". Long sections
# are therefore split along the statute's own structure: sub-sections "(1)",
# "(2)", then clauses "(a)", "(b)", "(ja)". A marker counts only if it follows
# the previous one in sequence, so a roman "(ii)" inside clause (c) is not taken
# for a clause.
# ---------------------------------------------------------------------------

MAX_PASSAGE = 2400

_SUBSECTION = re.compile(r"(?m)^[ \t]*\[?\((\d{1,2}[A-Z]?)\)")
_CLAUSE = re.compile(r"(?m)^[ \t]*\[?\(([a-z]{1,3})\)")
_ROMAN = re.compile(r"^[ivxl]{2,}$")
# "(1)" on the heading line: straight after the section number, or after the
# dash or colon that ends the heading.
_FIRST_ON_HEADING = re.compile(r"\A(\[?\d+[A-Z-]*\.\s*(?:\[?[^\n(]{0,200}?[—–⎯:-]\s*)?)(\[?\(1\))")
_CLAUSE_RUN_ON = re.compile(r"([;—–⎯]|\*\s*\*)[ \t]*(\[?\([a-z]{1,3}\)[ \t])")
# "(a)" run on after the words that introduce the clauses ("namely:—(a)").
_FIRST_CLAUSE_INLINE = re.compile(r"([—–⎯:,-]\s*)(\[?\(a\))")


def _sequence(text: str, pattern, first, follows) -> List[Tuple[int, str]]:
    starts = first if isinstance(first, (tuple, list, set)) else (first,)
    marks, prev = [], None
    for m in pattern.finditer(text):
        key = m.group(1)
        if (prev is None and key in starts) or (prev is not None and follows(prev, key)):
            marks.append((m.start(), key))
            prev = key
    return marks


def _next_subsection(prev: str, key: str) -> bool:
    p, k = int(re.match(r"\d+", prev).group()), int(re.match(r"\d+", key).group())
    return (k == p and key > prev) or p < k <= p + 3


def _next_clause(prev: str, key: str) -> bool:
    if _ROMAN.match(key):
        return False
    return key > prev and ord(key[0]) - ord(prev[0]) <= 3


def _cut(text: str, marks: List[Tuple[int, str]]) -> Tuple[str, List[Tuple[str, str]]]:
    intro = text[:marks[0][0]].strip()
    parts = []
    for i, (pos, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        parts.append((key, text[pos:end].strip()))
    return intro, parts


def _with_intro(intro: str, body: str) -> str:
    """The clause, preceded by the words that give it meaning, with the gap marked."""
    if not intro:
        return body
    if len(intro) > 400:
        intro = intro[:400].rsplit(" ", 1)[0]
    return f"{intro} … {body}"


def _hard_split(text: str, limit: int) -> List[str]:
    pieces, buf = [], ""
    for sentence in re.split(r"(?<=[.;:])\s+", text):
        if buf and len(buf) + len(sentence) + 1 > limit:
            pieces.append(buf)
            buf = sentence
        else:
            buf = f"{buf} {sentence}".strip()
    if buf:
        pieces.append(buf)
    return pieces


def split_long(section: Dict, limit: int = MAX_PASSAGE) -> List[Dict]:
    """A section as passages no longer than `limit`, each labelled with the provision it holds."""
    if len(section["content"]) <= limit:
        return [section]

    def passage(label, content):
        return {**section, "section_identifier": label, "content": content}

    def by_clause(label, text, intro_prefix=""):
        text = _FIRST_CLAUSE_INLINE.sub(r"\1\n\2", text, count=1)
        # Clauses often run on in one paragraph ("...; (c) “associate” means").
        # A marker after a semicolon, a dash or omission stars starts a clause
        # too; the sequence check still rejects references like "clause (b)".
        # Omitted opening clauses ("* * *" where (a) was) let a list start at (b) or (c).
        text = _CLAUSE_RUN_ON.sub(r"\1\n\2", text)
        marks = _sequence(text, _CLAUSE, ("a", "b", "c"), _next_clause)
        if len(marks) < 2:
            return [passage(label, p) for p in _hard_split(text, limit)]
        intro, parts = _cut(text, marks)
        intro = " … ".join(x for x in (intro_prefix, intro) if x)
        out = []
        for key, body in parts:
            content = _with_intro(intro, body)
            for piece in (_hard_split(content, limit) if len(content) > limit else [content]):
                out.append(passage(f"{label}({key})", piece))
        return out

    label, text = section["section_identifier"], section["content"]
    # The first sub-section usually shares a line with the heading ("25.
    # Opposition to the patent.—(1) Where...", "11. (1) Any person"). Missed, the
    # clauses under it came out as "Section 25(k)" instead of "Section 25(1)(k)".
    text = _FIRST_ON_HEADING.sub(r"\1\n\2", text, count=1)
    marks = _sequence(text, _SUBSECTION, "1", _next_subsection)
    if len(marks) < 2:
        return by_clause(label, text)

    heading, parts = _cut(text, marks)
    out = []
    for key, body in parts:
        sub_label = f"{label}({key})"
        full = f"{heading} {body}".strip() if key == "1" and heading else body
        if len(full) <= limit:
            out.append(passage(sub_label, full))
        else:
            out.extend(by_clause(sub_label, body, intro_prefix=heading if key != "1" else heading))
    return out


def parse_statute(path: str, unit: str = "Section", start: Optional[str] = None, end: Optional[str] = None,
                  first_page: int = 0, last_page: Optional[int] = None, first_number: int = 1,
                  last_number: Optional[int] = None, split: bool = True, keep_small: bool = False) -> List[Dict]:
    text, offsets = extract_body_text(path, first_page, last_page, keep_small=keep_small)
    sections = split_sections(text, offsets, unit=unit, start=start, end=end,
                              first_number=first_number, last_number=last_number)
    if not split:
        return sections
    return [p for s in sections for p in split_long(s)]


def extract_passage(path: str, label: str, start: str, end: Optional[str] = None, title: str = "",
                    keep_small: bool = False) -> List[Dict]:
    """
    One named passage, such as a Schedule, bounded by two patterns. A long one
    comes back in parts that all keep its label: a list has no sub-sections to
    split along, and numbered list items must not be taken for them.
    """
    text, offsets = extract_body_text(path, keep_small=keep_small)
    m = re.search(start, text)
    stop = len(text)
    if m and end:
        e = re.search(end, text[m.end():])
        if e:
            stop = m.end() + e.start()
    if not m:
        return []
    content = tidy(text[m.start():stop])
    return [{"section_identifier": label, "title": title, "content": piece, "page_number": _page(m.start(), offsets)}
            for piece in _hard_split(content, MAX_PASSAGE)]
