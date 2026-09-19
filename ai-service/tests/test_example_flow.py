import asyncio
import json
import pytest
from app.agents.rag_orchestrator import RAGOrchestrator
from app.memory.conversation_memory import ConversationMemory
from app.services.tkdl_service import lookup_tkdl_matches

@pytest.mark.asyncio
async def test_primary_example_flow():
    query = "I developed a project with 10% ashwaganda + 90% turmeric. Can I patent it?"
    
    # 1. State update test
    state = ConversationMemory.update_formulation_state({}, query, "")
    
    assert state.get("patent_query") is True
    assert state.get("patent_intent") == "patentability"
    assert "ashwagandha" in state.get("ingredients", [])
    assert "turmeric" in state.get("ingredients", [])
    
    ratios = state.get("ingredient_ratios", [])
    r_map = {r["name"]: r["percentage"] for r in ratios}
    assert r_map.get("ashwagandha") == 10.0
    assert r_map.get("turmeric") == 90.0
    assert state.get("ratio_total") == 100.0
    assert state.get("ratio_valid") is True
    assert state.get("ratio_warnings") == []
    assert state.get("tkdl_check_required") is True
    assert state.get("exact_match_found") is True
    assert state.get("patent_risk_score") == 0.95
    assert "Patent cannot be filed" in state.get("patentability_verdict", "")

    # 2. TKDL lookup test
    tkdl_res = lookup_tkdl_matches(ingredient_ratios=ratios)
    assert tkdl_res.get("exact_match_found") is True
    assert tkdl_res.get("patentability_status") == "unpatentable_exact_document_found"
    assert tkdl_res.get("patent_risk_score") == 0.95
    assert len(tkdl_res.get("tkdl_matches", [])) == 1
    assert tkdl_res.get("tkdl_matches")[0].get("document_number") == "TKDL-AYU-2026-1090"

    # 3. Full process_query test
    response = await RAGOrchestrator.process_query(
        query=query,
        conversation_id="test_conv_001",
        jurisdiction="india",
        language="en"
    )

    assert response is not None
    assert "answer" in response
    updated_state = response.get("updated_formulation_state", {})
    assert updated_state.get("patent_query") is True
    assert updated_state.get("exact_match_found") is True
    assert updated_state.get("patent_risk_score") == 0.95

    def _safe(s: str) -> str:
        """Strip characters not printable on Windows cp1252 console."""
        return s.encode("ascii", errors="replace").decode("ascii")

    print("--- Flow Verification Output ---")
    answer_text = (response.get("answer") or "")[:300]
    print("Answer:", _safe(answer_text))
    print("Updated State:", _safe(json.dumps(updated_state, indent=2, ensure_ascii=True)))
    print("TKDL Matches:", _safe(json.dumps(response.get("tkdl_summary"), indent=2, ensure_ascii=True)))

if __name__ == "__main__":
    asyncio.run(test_primary_example_flow())
