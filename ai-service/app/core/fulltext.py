"""
Full text of the core laws, built from the official PDFs in knowledge-base/source.

The hand-checked corpus (knowledge-base/corpus/india.json) holds only the
provisions someone transcribed and labelled by hand: seven sections of the
Patents Act, one each of the Trade Marks and GI Acts. Anything else a person
asked about had nothing to be answered from, so it was refused. The full texts
were already in the database from an earlier bulk upload, but as older versions
of the same documents, which retrieval never reads.

Here each law listed in knowledge-base/fulltext.json is parsed into one passage
per provision (see core/statute_parser.py) and seeded as a document of its own,
current alongside the hand-checked extract rather than instead of it.
"""

import hashlib
import json
import os
from typing import Dict, List

from app.core.statute_parser import extract_passage, parse_statute

# Raising this re-parses every file on the next start: bump it whenever the
# parser changes what it produces.
PARSER_VERSION = "2026-09-21.1"

KB_DIR = os.getenv(
    "KNOWLEDGE_BASE_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "knowledge-base")),
)
if not os.path.isdir(KB_DIR):
    KB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "knowledge-base"))

MANIFEST = os.path.join(KB_DIR, "fulltext.json")
SOURCE_DIR = os.path.join(KB_DIR, "source")

FULL_TEXT_TAG = "full text"


def manifest_entries() -> List[Dict]:
    if not os.path.exists(MANIFEST):
        return []
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f).get("documents", [])


def fingerprint(entry: Dict) -> str:
    """Identifies one parse: the PDF's bytes, the manifest entry and the parser version."""
    h = hashlib.sha256()
    with open(os.path.join(SOURCE_DIR, entry["file"]), "rb") as f:
        h.update(f.read())
    h.update(json.dumps(entry, sort_keys=True).encode("utf-8"))
    h.update(PARSER_VERSION.encode("utf-8"))
    return h.hexdigest()


def build_passages(entry: Dict) -> List[Dict]:
    """The law's passages: its provisions in order, then any named passages such as a Schedule."""
    path = os.path.join(SOURCE_DIR, entry["file"])
    passages = parse_statute(
        path,
        unit=entry.get("unit", "Section"),
        start=entry.get("start"),
        end=entry.get("end"),
        first_number=entry.get("first_number", 1),
        last_number=entry.get("last_number"),
        keep_small=entry.get("keep_small_text", False),
    )
    for extra in entry.get("passages", []):
        # A Schedule can be a long list (Schedule A of the Aahara rules runs to
        # 16,000 characters); it comes back in parts that keep its label.
        passages.extend(extract_passage(path, extra["label"], extra["start"], extra.get("end"),
                                        extra.get("title", ""), keep_small=entry.get("keep_small_text", False)))
    return [p for p in passages if len(p["content"]) >= 40]
