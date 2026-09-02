import pytest
from app.evaluators.citation_verifier import CitationVerifier

def test_citation_verification_grounding():
    generated_text = (
        "Under Section 3(p) of the Patents Act, 1970, an invention based on traditional knowledge is not patentable. "
        "Furthermore, Section 6(1) of Biological Diversity Act mandates prior NBA approval via Form III."
    )
    evidence = [
        {
            "section_identifier": "Section 3(p)",
            "doc_title": "The Patents Act, 1970",
            "authority": "Indian Patent Office",
            "jurisdiction": "india",
            "content": "Section 3(p) of the Patents Act, 1970 excludes traditional knowledge from patentability.",
            "similarity": 0.92,
            "rerank_score": 0.89
        },
        {
            "section_identifier": "Section 6(1)",
            "doc_title": "Biological Diversity Act, 2002",
            "authority": "National Biodiversity Authority",
            "jurisdiction": "india",
            "content": "Section 6(1) of Biological Diversity Act requires NBA approval for filing IP rights.",
            "similarity": 0.88,
            "rerank_score": 0.85
        }
    ]
    citations, score, level = CitationVerifier.verify_and_extract_citations(generated_text, evidence, "india")
    assert len(citations) >= 2
    assert score >= 0.70
    assert level in ["high", "medium"]
    assert any("Section 3(p)" in c["section_reference"] for c in citations)
    assert any("Section 6(1)" in c["section_reference"] for c in citations)
