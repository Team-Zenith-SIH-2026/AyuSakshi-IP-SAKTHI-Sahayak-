"""
What the assistant may say about itself.

People ask a chatbot about the chatbot: "does it work well?", "where do your
answers come from?", "who made you?". Those are not legal questions, so they are
answered conversationally, but the answer is still a factual claim someone may
rely on. A model left to itself answers them fluently and wrongly ("I am 99%
accurate", "I am an official Ministry service"). So the conversational reply is
written only from this fact sheet, and any figure in it that the sheet does not
contain is rejected (see legal_claim_guard.unsupported_numbers).

Two parts are read live rather than written down, so they cannot drift from the
truth: the documents actually indexed for search, and the latest saved
benchmark result.
"""

import json
import logging
import os
import time
from typing import Dict, List, Optional

from app.rag.hybrid_retriever import get_db_connection

log = logging.getLogger("ayusakshi.profile")

_EVALUATION_FILE = os.path.join(os.path.dirname(__file__), "..", "evaluators", "last_evaluation.json")
_CACHE_SECONDS = 600
_cache: Dict[str, object] = {"at": 0.0, "text": None}

STATIC_FACTS = """\
- Name: AyuSakshi (IP-SAKTI Sahayak).
- What it is: a prototype built by Team Zenith for Smart India Hackathon 2026, problem statement SIH26045, set by the Ministry of Ayush. It is not an official government service.
- What it helps with: questions about patents, trademarks, geographical indications, biodiversity approvals and benefit sharing, and licensing, labelling and advertising rules for Ayurvedic products. It covers Indian law, and a separate International mode covers a few international treaties.
- How it answers a legal question: it searches the official texts of the laws listed below, a language model writes the answer only from the passages found, and every provision the answer names is checked against those passages. If nothing can be checked, it says so instead of guessing.
- It does not answer legal questions from what a language model learned in training. Only passages retrieved from the official texts are used, and it shows which provisions an answer rests on.
- It is not a lawyer and does not give legal advice. Its answers are legal information, to be checked with a qualified professional before acting.
- It can ask follow-up questions when a detail changes which rule applies, and it lets people build a question by tapping options.
- A person can ask for their question to be reviewed by a human expert using the link under an answer.
- Limits: it gives legal information, not legal advice. It only knows the documents listed below, as downloaded in September 2026. The team is still hand-checking section numbers in the curated texts. It works in English for now; more Indian languages are planned.
- It cannot give medical or health advice, dosages or treatments, and it does not cover other countries' national laws."""


def _documents() -> Optional[Dict[str, List[str]]]:
    conn = get_db_connection()
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT d.jurisdiction, d.title
                FROM documents d
                JOIN document_versions v ON v.document_id = d.id AND v.is_current = TRUE
                WHERE d.status = 'active'
                  AND EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id = v.id)
                ORDER BY d.jurisdiction, d.title
                """
            )
            by_jurisdiction: Dict[str, List[str]] = {}
            for row in cur.fetchall():
                by_jurisdiction.setdefault(row["jurisdiction"], []).append(row["title"])
            return by_jurisdiction
    except Exception as e:
        log.warning("[Profile] could not list documents: %r", e)
        return None
    finally:
        conn.close()


def _benchmark() -> Optional[str]:
    try:
        with open(_EVALUATION_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    cases = data.get("cases") or []
    metrics = data.get("metrics") or {}
    if not cases:
        return None
    should_answer = [c for c in cases if not c.get("expected_abstain")]
    should_refuse = [c for c in cases if c.get("expected_abstain")]
    wrongly_refused = [c for c in should_answer if c.get("did_abstain")]
    unavailable = [c for c in wrongly_refused if c.get("actual_abstention_reason") == "llm_unavailable"]
    run_date = (data.get("run_at") or "")[:10] or "an unrecorded date"
    return (
        f"- Latest saved team benchmark (run on {run_date}): {len(cases)} questions, "
        f"{len(should_answer)} that should be answered and {len(should_refuse)} that should be refused. "
        f"It answered {len(should_answer) - len(wrongly_refused)} of the {len(should_answer)} it should have answered "
        f"and refused {len(wrongly_refused)} of them"
        + (f" ({len(unavailable)} of those because the language model could not be reached)" if unavailable else "")
        + f". It gave a legal answer to {metrics.get('false_answers', 0)} of the {len(should_refuse)} questions it should have refused. "
        f"Fabricated citations that reached a user: {metrics.get('fabricated_authority_delivered', 0)}. "
        f"This benchmark was run before later changes to the system, so it describes that version."
    )


def fact_sheet() -> str:
    now = time.time()
    if _cache["text"] and now - float(_cache["at"]) < _CACHE_SECONDS:
        return str(_cache["text"])

    lines = [STATIC_FACTS]
    docs = _documents()
    if docs:
        for jurisdiction, titles in docs.items():
            label = "Indian laws searched" if jurisdiction == "india" else f"{jurisdiction.title()} treaties searched"
            lines.append(f"- {label} ({len(titles)}): " + "; ".join(titles) + ".")
    else:
        lines.append("- The list of documents searched is not available right now.")
    bench = _benchmark()
    lines.append(bench or "- No saved benchmark result is available.")

    text = "\n".join(lines)
    _cache.update(at=now, text=text)
    return text
