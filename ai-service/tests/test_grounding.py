import pytest
from app.evaluators.citation_verifier import CitationVerifier


EVIDENCE = [
    {
        "section_identifier": "Section 3(p)",
        "doc_title": "The Patents Act, 1970",
        "authority": "Indian Patent Office",
        "jurisdiction": "india",
        "content": "Section 3(p) of the Patents Act, 1970 excludes traditional knowledge from patentability.",
        "similarity": 0.92,
        "rerank_score": 0.89,
    },
    {
        "section_identifier": "Section 6(1)",
        "doc_title": "Biological Diversity Act, 2002",
        "authority": "National Biodiversity Authority",
        "jurisdiction": "india",
        "content": "Section 6(1) of Biological Diversity Act requires NBA approval for filing IP rights.",
        "similarity": 0.88,
        "rerank_score": 0.85,
    },
]


def test_citation_verification_grounding():
    generated_text = (
        "Under Section 3(p) of the Patents Act, 1970, an invention based on traditional knowledge is not patentable. "
        "Furthermore, Section 6(1) of Biological Diversity Act mandates prior NBA approval via Form III."
    )
    citations, score, level, fabricated = CitationVerifier.verify_and_extract_citations(
        generated_text, EVIDENCE, "india"
    )
    assert len(citations) >= 2
    assert score >= 0.70
    assert level in ["high", "medium"]
    assert fabricated == []
    assert any("Section 3(p)" in c["section_reference"] for c in citations)
    assert any("Section 6(1)" in c["section_reference"] for c in citations)


def test_uncited_chunks_are_not_returned_as_citations():
    """
    Retrieval returning a chunk is not evidence the answer used it.
    Only chunks the answer actually drew on may be reported as citations.
    """
    generated_text = (
        "Under Section 3(p) of the Patents Act, 1970, an invention which is traditional knowledge "
        "is excluded from patentability."
    )
    citations, score, level, fabricated = CitationVerifier.verify_and_extract_citations(
        generated_text, EVIDENCE, "india"
    )
    refs = [c["section_reference"] for c in citations]
    assert "Section 3(p)" in refs
    assert "Section 6(1)" not in refs, "uncited chunk was reported as a verified citation"
    assert all(c["verified_grounded"] is True for c in citations)


def test_fabricated_section_is_detected_and_confidence_capped():
    """
    A section number the model invented must be reported and must collapse
    confidence below the abstention threshold.
    """
    generated_text = (
        "Under Section 3(p) of the Patents Act, 1970 this is not patentable, and Section 9(z) of the "
        "Ayurveda Protection Act 2019 additionally bars registration."
    )
    citations, score, level, fabricated = CitationVerifier.verify_and_extract_citations(
        generated_text, EVIDENCE, "india"
    )
    assert fabricated, "fabricated section reference was not detected"
    assert any("9(z)" in f.replace(" ", "") for f in fabricated)
    assert score <= 0.25
    assert CitationVerifier.should_abstain(EVIDENCE, score) is True


def test_reranker_logits_do_not_produce_negative_confidence():
    """
    Cross-encoders emit raw logits, not probabilities. Feeding one straight into
    the confidence formula previously produced a negative score.
    """
    evidence = [dict(EVIDENCE[0], rerank_score=-8.5, similarity=0.1)]
    generated_text = "Section 3(p) of the Patents Act, 1970 excludes traditional knowledge from patentability."
    citations, score, level, fabricated = CitationVerifier.verify_and_extract_citations(
        generated_text, evidence, "india"
    )
    assert 0.0 <= score <= 1.0
