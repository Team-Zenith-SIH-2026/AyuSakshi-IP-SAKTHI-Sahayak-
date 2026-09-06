import math
import re
from typing import List, Dict, Any, Tuple
from app.config import settings

# Matches statutory references the model may emit, e.g.
#   "Section 3(p)", "Sec. 33EEB", "Rule 158-B", "Article 27.3(b)", "Regulation 4"
CITATION_PATTERN = re.compile(
    r'\b(?:Section|Sec\.?|Rule|Article|Art\.?|Regulation|Reg\.?)\s*'
    r'([0-9]+[A-Za-z\-]*(?:\s*[\.\(][A-Za-z0-9]+\)?)*)',
    re.IGNORECASE
)


def _parse_ref(raw: str):
    """
    Parse a statutory reference into (number, subparts) so references can be
    compared structurally rather than as strings.

        '3(p)'    -> ('3',     ('p',))
        '6'       -> ('6',     ())
        '158-B'   -> ('158',   ('b',))
        '27.3(b)' -> ('27',    ('3', 'b'))
        '33EEB'   -> ('33eeb', ())

    Returns None if the text holds no recognisable reference.
    """
    if not raw:
        return None
    m = re.match(r'\s*([0-9]+[A-Za-z]*)', raw.strip())
    if not m:
        return None
    number = m.group(1).lower()
    subparts = tuple(s.lower() for s in re.findall(r'[A-Za-z0-9]+', raw.strip()[m.end():]))
    return (number, subparts)


def _is_grounded_ref(ref, evidence_refs) -> bool:
    """
    True if a reference in the answer corresponds to something in the evidence.

    A reference matches when the section numbers are equal and one side's
    subparts are a prefix of the other's. Citing "Section 6" against evidence
    for "Section 6(1)" is a legitimate parent reference, not a fabrication,
    whereas "Section 3(e)" against evidence for "Section 3(p)" is a different
    provision and must still be caught. Comparing whole strings treated the
    first case as fabricated; comparing raw string prefixes would wrongly treat
    "Section 1" as matching "Section 10(4)".
    """
    number, subs = ref
    for e_number, e_subs in evidence_refs:
        if e_number != number:
            continue
        if subs == e_subs[:len(subs)] or e_subs == subs[:len(e_subs)]:
            return True
    return False


def _squash(score: float) -> float:
    """
    Map a relevance score into [0, 1].

    Cross-encoder rerankers return raw logits (roughly -11 to +11), while pgvector
    cosine similarity is already bounded. Passing a logit straight into the
    confidence formula produces negative confidence and a nonsensical UI badge,
    so anything outside [0, 1] is squashed through a sigmoid first.
    """
    try:
        s = float(score)
    except (TypeError, ValueError):
        return 0.0
    if 0.0 <= s <= 1.0:
        return s
    return 1.0 / (1.0 + math.exp(-s))


class CitationVerifier:
    """
    Evaluates evidence grounding, verifies claims against retrieved statutory chunks,
    calculates transparent confidence scores, and enforces safe abstention.
    """

    @staticmethod
    def verify_and_extract_citations(
        generated_text: str,
        retrieved_evidence: List[Dict[str, Any]],
        jurisdiction: str = "india"
    ) -> Tuple[List[Dict[str, Any]], float, str, List[str]]:
        """
        Verify citations against retrieved evidence chunks and compute system confidence.

        Only chunks the generated answer actually drew on are returned as citations.
        Statutory references that appear in the answer but nowhere in the retrieved
        evidence are reported separately as fabricated.

        Returns: (verified_citations, confidence_score, confidence_level, fabricated_refs)
        """
        if not retrieved_evidence:
            return [], 0.0, "abstained", []

        gen_lower = (generated_text or "").lower()

        # Everything the model was actually shown, for fabrication checking.
        evidence_refs = set()
        for chunk in retrieved_evidence:
            sec = chunk.get("section_identifier", "") or ""
            content = chunk.get("content", "") or ""
            # A bare section identifier such as "Section 3(p)" plus any reference
            # quoted inside the statutory text itself, which is equally legitimate.
            parsed = _parse_ref(sec.split(None, 1)[-1] if sec else "")
            if parsed:
                evidence_refs.add(parsed)
            for m in CITATION_PATTERN.finditer(sec + " " + content):
                p = _parse_ref(m.group(1))
                if p:
                    evidence_refs.add(p)

        # Any reference the answer makes that was never in the evidence is fabricated.
        fabricated_refs = []
        cited_refs = set()
        seen_keys = set()
        for m in CITATION_PATTERN.finditer(generated_text or ""):
            parsed = _parse_ref(m.group(1))
            if not parsed or parsed in seen_keys:
                continue
            seen_keys.add(parsed)
            if _is_grounded_ref(parsed, evidence_refs):
                cited_refs.add(parsed)
            else:
                fabricated_refs.append(m.group(0).strip())

        verified_citations = []
        grounded_overlap_total = 0.0

        for chunk in retrieved_evidence:
            sec_id = chunk.get("section_identifier", "") or ""
            title = chunk.get("doc_title") or chunk.get("title", "Statutory Document")
            content = chunk.get("content", "") or ""

            # Content n-gram overlap between this chunk and the generated answer.
            content_words = set(re.findall(r'\b\w{4,}\b', content.lower()))
            gen_words = set(re.findall(r'\b\w{4,}\b', gen_lower))
            overlap = len(content_words & gen_words) / max(len(content_words), 1)

            # A chunk is cited if the answer names its provision, names its
            # document, or demonstrably reproduces its substance.
            is_cited = False
            chunk_ref = _parse_ref(sec_id.split(None, 1)[-1] if sec_id else "")
            if chunk_ref and any(_is_grounded_ref(r, {chunk_ref}) for r in cited_refs):
                is_cited = True
            if not is_cited and sec_id and sec_id.lower() in gen_lower:
                is_cited = True
            if not is_cited and title and title.lower()[:40] in gen_lower:
                is_cited = True
            if not is_cited and overlap >= 0.35:
                is_cited = True

            # Uncited chunks were retrieved but not used. They are not citations.
            if not is_cited:
                continue

            grounded_overlap_total += min(overlap * 2.0, 1.0)

            verified_citations.append({
                "source_title": title,
                "section_reference": sec_id or "General Provisions",
                "authority": chunk.get("authority", "Official Regulatory Authority"),
                "jurisdiction": chunk.get("jurisdiction", jurisdiction),
                "version_tag": chunk.get("version_tag", "Current Consolidated"),
                "source_url": chunk.get("source_url", ""),
                "claim_text": content.strip(),
                "verified_grounded": True,
                "similarity_score": round(
                    _squash(chunk.get("rerank_score", chunk.get("similarity", 0.0))), 3
                )
            })

        # Deduplicate citations by section and title
        seen = set()
        deduped_citations = []
        for c in verified_citations:
            key = f"{c['source_title']}-{c['section_reference']}"
            if key not in seen:
                seen.add(key)
                deduped_citations.append(c)

        if not deduped_citations:
            # Evidence was retrieved but the answer is not grounded in any of it.
            return [], 0.0, "abstained", fabricated_refs

        # Composite confidence, every input bounded to [0, 1].
        sims = [_squash(c.get("similarity", 0.0)) for c in retrieved_evidence]
        reranks = [_squash(c.get("rerank_score", c.get("similarity", 0.0))) for c in retrieved_evidence]
        avg_retrieval_sim = sum(sims) / max(len(sims), 1)
        avg_rerank = sum(reranks) / max(len(reranks), 1)
        avg_overlap = grounded_overlap_total / max(len(deduped_citations), 1)
        citation_factor = min(len(deduped_citations) / 3.0, 1.0)

        confidence_score = (
            0.30 * min(avg_retrieval_sim * 1.5, 1.0) +
            0.30 * min(avg_rerank * 1.5, 1.0) +
            0.20 * min(avg_overlap, 1.0) +
            0.20 * citation_factor
        )

        # A fabricated authority is the worst failure mode this system has.
        # Cap confidence hard so the abstention gate catches it downstream.
        if fabricated_refs:
            confidence_score = min(confidence_score, 0.25)

        confidence_score = round(max(0.0, min(1.0, confidence_score)), 4)

        if confidence_score >= 0.70:
            confidence_level = "high"
        elif confidence_score >= 0.45:
            confidence_level = "medium"
        else:
            confidence_level = "low"

        return deduped_citations[:5], confidence_score, confidence_level, fabricated_refs

    @staticmethod
    def should_abstain(retrieved_evidence: List[Dict[str, Any]], confidence_score: float) -> bool:
        """
        Safe abstention check. Returns True if evidence is insufficient or confidence is too low.
        """
        if not retrieved_evidence or len(retrieved_evidence) == 0:
            return True
        if confidence_score < settings.CONFIDENCE_ABSTAIN_THRESHOLD:
            return True
        return False

    @staticmethod
    def get_abstention_response(jurisdiction: str = "india", reason: str = "insufficient_evidence") -> Dict[str, Any]:
        """
        Standardized safe refusal response when authoritative statutory evidence is lacking.
        """
        return {
            "answer": (
                "I could not find sufficient authoritative evidence in the official knowledge base to answer this query reliably. "
                "In accordance with our regulatory safety principles, I abstain from providing ungrounded legal conclusions. "
                "You can request human escalation below to have an accredited AYUSH IP Facilitator examine your case."
            ),
            "confidence_score": 0.0,
            "confidence_level": "abstained",
            "citations": [],
            "thinking_trace": [
                {"step": "Evidence Retrieval", "detail": "Retrieved 0 authoritative chunks meeting relevance threshold."},
                {"step": "Safety Gate", "detail": f"Triggered safe abstention ({reason}) to prevent hallucination."}
            ],
            "ip_domains": [],
            "classification": None,
            "abs_summary": None,
            "tkdl_summary": None,
            "abstention_reason": reason,
            "fabricated_citations": []
        }
