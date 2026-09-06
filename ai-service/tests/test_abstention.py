import pytest
from app.evaluators.citation_verifier import CitationVerifier

def test_safe_abstention_on_empty_evidence():
    should_abstain = CitationVerifier.should_abstain([], 0.0)
    assert should_abstain is True
    
    resp = CitationVerifier.get_abstention_response()
    assert resp["confidence_level"] == "abstained"
    assert "could not find sufficient authoritative evidence" in resp["answer"]
    assert len(resp["citations"]) == 0

def test_safe_abstention_on_low_confidence():
    mock_chunks = [{"similarity": 0.2, "content": "irrelevant chunk"}]
    should_abstain = CitationVerifier.should_abstain(mock_chunks, 0.35)
    assert should_abstain is True
