"""
The prior-art check reads demo reference data, not the official TKDL. Its
findings may be mentioned as a lead to check, but never cited as a source or
turned into a legal conclusion.
"""
import asyncio

from app.agents import rag_orchestrator as orchestrator_module
from app.agents.rag_orchestrator import RAGOrchestrator
from app.agents.turn_router import TurnPlan, TurnRouter

QUESTION = "I have a formulation with 10% ashwagandha and 90% turmeric. Can I patent it?"

SECTION_3P = {
    "id": "00000000-0000-0000-0000-000000000003",
    "doc_title": "The Patents Act, 1970",
    "section_identifier": "Section 3(p)",
    "jurisdiction": "india",
    "content": (
        "3. What are not inventions. The following are not inventions within the meaning of this Act, "
        "(p) an invention which, in effect, is traditional knowledge or which is an aggregation or duplication "
        "of known properties of traditionally known component or components."
    ),
    "rerank_score": 0.9,
    "similarity": 0.8,
    "bm25_score": 5.0,
}


def _run(monkeypatch):
    async def legal_plan(cls, text, history, has_previous_answer=False):
        return TurnPlan(kind="legal", question=text, decided_by="model:test")
    monkeypatch.setattr(TurnRouter, "plan", classmethod(legal_plan))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [dict(SECTION_3P)])

    shown = []

    async def fake_llm(system_prompt, user_prompt, *args, **kwargs):
        shown.append(user_prompt)
        return (
            "Under Section 3(p) of The Patents Act, 1970, traditional knowledge is not an invention. "
            "This is regulatory information, not legal advice.",
            "groq:primary:test",
        )
    monkeypatch.setattr(orchestrator_module, "call_llm", fake_llm)

    result = asyncio.run(RAGOrchestrator.process_query(QUESTION, "t"))
    return result, "\n".join(shown)


def test_demo_record_is_never_a_cited_source(monkeypatch):
    result, _ = _run(monkeypatch)
    cited = " ".join(str(c.get("section_reference")) for c in result.get("citations") or [])
    assert "TKDL" not in cited
    assert "Section 3(p)" in cited


def test_the_model_is_told_it_is_a_lead_not_a_finding(monkeypatch):
    _, prompt = _run(monkeypatch)
    assert "NOT evidence" in prompt
    assert "not the official Traditional Knowledge Digital" in prompt
    # The demo record's number and the forced conclusion are no longer handed over.
    assert "TKDL-AYU-2026-1090" not in prompt
    assert "Patent cannot be filed" not in prompt
    assert "Risk Score" not in prompt


def test_the_ratio_check_itself_still_runs(monkeypatch):
    result, _ = _run(monkeypatch)
    state = result["updated_formulation_state"]
    assert state.get("exact_match_found") is True
    assert "ashwagandha" in state.get("ingredients", [])
