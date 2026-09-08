import math
import re
import unicodedata
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


def _normalise_title(text: str) -> str:
    """
    Reduce a document title (or a whole answer) to a comparable form: lowercase,
    no leading article, punctuation collapsed to single spaces. Lets "The
    Patents Act, 1970" match an answer that says "the Patents Act 1970".
    """
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = re.sub(r'[^a-z0-9]+', ' ', t).strip()
    t = re.sub(r'^the\s+', '', t)
    return t


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

        generated_text = unicodedata.normalize("NFKC", generated_text or "")
        gen_lower = generated_text.lower()

        # Everything the model was actually shown, for fabrication checking.
        evidence_refs = set()
        for chunk in retrieved_evidence:
            sec = chunk.get("section_identifier", "") or ""
            content = chunk.get("content", "") or ""
            # A chunk is sometimes labelled with more than one provision, e.g.
            # "Section 3(a) & 33EEB" or "Section 7 & 2023 Proviso". Parsing the
            # whole label as a single reference made a correct citation of the
            # second provision look invented, so each component is registered
            # separately.
            for part in re.split(r'\s*(?:&|,|\band\b)\s*', sec):
                part = re.sub(
                    r'^\s*(?:Section|Sec\.?|Rule|Article|Art\.?|Regulation|Reg\.?)\s*',
                    '', part, flags=re.IGNORECASE
                )
                parsed = _parse_ref(part)
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
            chunk_refs = set()
            for part in re.split(r'\s*(?:&|,|\band\b)\s*', sec_id or ""):
                part = re.sub(
                    r'^\s*(?:Section|Sec\.?|Rule|Article|Art\.?|Regulation|Reg\.?)\s*',
                    '', part, flags=re.IGNORECASE
                )
                p = _parse_ref(part)
                if p:
                    chunk_refs.add(p)
            if chunk_refs and any(_is_grounded_ref(r, chunk_refs) for r in cited_refs):
                is_cited = True
            # Only match a whole label that is specific enough to mean something.
            # Some chunks are labelled just "4", and a bare "4" appears in almost
            # any prose, so this test used to mark arbitrary chunks as cited.
            if not is_cited and sec_id and len(sec_id) >= 6 and sec_id.lower() in gen_lower:
                is_cited = True
            # Corpus titles are registered with a leading article ("The Patents
            # Act, 1970") and an internal comma before the year. Models write
            # "Patents Act 1970". Comparing the first 40 raw characters
            # therefore almost never matched, so this test did nothing. Compare
            # on a normalised form instead: drop the leading article and reduce
            # punctuation and whitespace to single spaces on both sides.
            if not is_cited and title:
                norm_title = _normalise_title(title)
                if norm_title and norm_title in _normalise_title(generated_text):
                    is_cited = True
            if not is_cited and overlap >= 0.35:
                is_cited = True

            # Uncited chunks were retrieved but not used. They are not citations.
            if not is_cited:
                continue

            # The cross-encoder exists to judge whether a chunk answers this
            # query. When it says strongly no, that chunk is not evidence,
            # however the text happened to brush against it. Without this floor
            # a chunk scored -6.3 was being shown to the user as a supporting
            # citation and was dragging the confidence average down with it.
            chunk_rerank = _squash(chunk.get("rerank_score", chunk.get("similarity", 0.0)))
            if chunk_rerank < settings.CITATION_RELEVANCE_FLOOR:
                continue

            verified_citations.append({
                "_overlap": min(overlap * 2.0, 1.0),
                "_sim": _squash(chunk.get("similarity", 0.0)),
                "_rerank": _squash(chunk.get("rerank_score", chunk.get("similarity", 0.0))),
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
        #
        # These averages are taken over the chunks the answer actually cited,
        # not over everything retrieval returned. Retrieval deliberately fetches
        # a wide candidate set, so averaging across all of it charged a
        # perfectly grounded answer for the weak candidates it correctly ignored:
        # one exact hit among four near-misses scored the same as five
        # mediocre ones. That put well-grounded answers a hair under the
        # abstention threshold and refused them.
        # Dense and sparse retrieval return different chunks, so a chunk found
        # only by BM25 carries no cosine similarity at all. Treating that
        # absence as a similarity of 0.0 averaged real evidence down towards
        # zero and was the single largest drag on confidence. Only chunks that
        # actually have a dense score contribute to the dense term.
        reranks = [c["_rerank"] for c in deduped_citations]
        overlaps = [c["_overlap"] for c in deduped_citations]
        sims = [c["_sim"] for c in deduped_citations if c["_sim"] > 0.0]

        avg_rerank = sum(reranks) / max(len(reranks), 1)
        avg_overlap = sum(overlaps) / max(len(overlaps), 1)
        # No dense hit among the citations means the dense term has nothing to
        # say, so fall back to the reranker rather than asserting zero.
        avg_retrieval_sim = (sum(sims) / len(sims)) if sims else avg_rerank

        # An answer resting on one squarely on-point provision is well grounded.
        # A mean alone cannot express that, so the best cited chunk carries most
        # of the retrieval-quality weight and the mean tempers it.
        best_rerank = max(reranks) if reranks else 0.0
        retrieval_quality = 0.65 * best_rerank + 0.35 * avg_rerank

        citation_factor = min(len(deduped_citations) / 3.0, 1.0)

        confidence_score = (
            0.30 * min(avg_retrieval_sim * 1.5, 1.0) +
            0.30 * min(retrieval_quality, 1.0) +
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

        # Scratch fields used only for scoring; not part of the API surface.
        for c in deduped_citations:
            c.pop("_overlap", None)
            c.pop("_sim", None)
            c.pop("_rerank", None)

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
