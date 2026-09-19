import pytest
from pathlib import Path
from app.memory.conversation_memory import ConversationMemory
from app.services.tkdl_service import TKDLService, lookup_tkdl_matches
from app.agents.tkdl_pointer import TKDLPointer

def test_patent_intent_detection():
    query = "I developed a project with 10% ashwaganda + 90% turmeric. Can I patent it?"
    state = ConversationMemory.update_formulation_state({}, query, "")
    assert state.get("patent_query") is True
    assert state.get("patent_intent") == "patentability"

    non_patent_queries = [
        "What is turmeric?",
        "How should I take this medicine?",
        "What licence is needed to manufacture this?",
        "Is this safe?",
        "What are the benefits of ashwagandha?",
    ]
    for q in non_patent_queries:
        st = ConversationMemory.update_formulation_state({}, q, "")
        assert st.get("patent_query") is False, f"Query '{q}' should not trigger patent_query"

def test_alias_normalization_and_ratio_extraction():
    st1 = ConversationMemory.update_formulation_state({}, "I developed a project with 10% ashwaganda + 90% turmeric. Can I patent it?", "")
    ratios1 = st1.get("ingredient_ratios", [])
    assert len(ratios1) == 2
    r_map1 = {r["name"]: r["percentage"] for r in ratios1}
    assert r_map1.get("ashwagandha") == 10.0
    assert r_map1.get("turmeric") == 90.0

    st2 = ConversationMemory.update_formulation_state({}, "10 percent ashwagandha and 90 percent turmeric", "")
    r_map2 = {r["name"]: r["percentage"] for r in st2.get("ingredient_ratios", [])}
    assert r_map2.get("ashwagandha") == 10.0
    assert r_map2.get("turmeric") == 90.0

    st3 = ConversationMemory.update_formulation_state({}, "ashwagandha 10%, turmeric 90%", "")
    r_map3 = {r["name"]: r["percentage"] for r in st3.get("ingredient_ratios", [])}
    assert r_map3.get("ashwagandha") == 10.0
    assert r_map3.get("turmeric") == 90.0

    st4 = ConversationMemory.update_formulation_state({}, "10:90 ashwagandha turmeric", "")
    r_map4 = {r["name"]: r["percentage"] for r in st4.get("ingredient_ratios", [])}
    assert r_map4.get("ashwagandha") == 10.0
    assert r_map4.get("turmeric") == 90.0

    st5 = ConversationMemory.update_formulation_state({}, "10% Ashwaganda + 90% Haldi", "")
    r_map5 = {r["name"]: r["percentage"] for r in st5.get("ingredient_ratios", [])}
    assert r_map5.get("ashwagandha") == 10.0
    assert r_map5.get("turmeric") == 90.0

def test_ratio_validation():
    st_valid = ConversationMemory.update_formulation_state({}, "10% ashwagandha + 90% turmeric", "")
    assert st_valid.get("ratio_total") == 100.0
    assert st_valid.get("ratio_valid") is True
    assert st_valid.get("ratio_warnings") == []

    st_invalid = ConversationMemory.update_formulation_state({}, "10% ashwagandha + 80% turmeric", "")
    assert st_invalid.get("ratio_total") == 90.0
    assert st_invalid.get("ratio_valid") is False
    assert len(st_invalid.get("ratio_warnings")) > 0
    assert "90" in st_invalid.get("ratio_warnings")[0]

    st_no_ratio = ConversationMemory.update_formulation_state({}, "I'm using ashwagandha and turmeric", "")
    assert st_no_ratio.get("ingredient_ratios") == []
    assert "ashwagandha" in st_no_ratio.get("ingredients", [])
    assert "turmeric" in st_no_ratio.get("ingredients", [])

def test_exact_formulation_match_and_document_citation():
    # 10% Ashwagandha + 90% Turmeric matches exact reference document TKDL-AYU-2026-1090
    exact_ratios = [
        {"name": "ashwagandha", "percentage": 10.0},
        {"name": "turmeric", "percentage": 90.0}
    ]
    res_exact = lookup_tkdl_matches(ingredient_ratios=exact_ratios)
    assert res_exact["exact_match_found"] is True
    assert res_exact["patentability_status"] == "unpatentable_exact_document_found"
    assert res_exact["patent_risk_score"] == 0.95
    assert "Patent cannot be filed" in res_exact["verdict"]
    assert "TKDL-AYU-2026-1090" in res_exact["verdict"]
    assert len(res_exact["tkdl_matches"]) == 1
    assert res_exact["tkdl_matches"][0]["document_number"] == "TKDL-AYU-2026-1090"

def test_non_matching_ratio_risk_score_evaluation():
    # 20% Ashwagandha + 80% Turmeric does not match 10:90 exact formulation, returns evaluated Risk Score
    diff_ratios = [
        {"name": "ashwagandha", "percentage": 20.0},
        {"name": "turmeric", "percentage": 80.0}
    ]
    res_diff = lookup_tkdl_matches(ingredient_ratios=diff_ratios)
    assert res_diff["exact_match_found"] is False
    assert res_diff["patentability_status"] == "risk_score_evaluated"
    assert res_diff["patent_risk_score"] == 0.70
    assert "Risk Score" in res_diff["verdict"]
    assert len(res_diff["tkdl_matches"]) == 2

def test_unknown_herb_and_missing_file_safety():
    res_unknown = lookup_tkdl_matches(ingredient_ratios=[{"name": "unknown_herb_xyz", "percentage": 100.0}])
    assert res_unknown["exact_match_found"] is False
    assert res_unknown["tkdl_status"] == "no_match"

    missing_path = Path("non_existent_file_path.json")
    res_missing = TKDLService.lookup_tkdl_matches(ingredient_ratios=[{"name": "ashwagandha", "percentage": 10.0}], file_path=missing_path)
    assert res_missing["patentability_status"] == "reference_unavailable"
    assert res_missing["tkdl_matches"] == []

def test_state_persistence():
    st1 = ConversationMemory.update_formulation_state({}, "I made 10% ashwagandha + 90% turmeric", "")
    assert "ashwagandha" in st1["ingredients"]
    assert "turmeric" in st1["ingredients"]
    assert st1.get("exact_match_found") is True
    assert st1.get("patent_risk_score") == 0.95

    st2 = ConversationMemory.update_formulation_state(st1, "Also adding 5% neem", "")
    assert "ashwagandha" in st2["ingredients"]
    assert "turmeric" in st2["ingredients"]
    assert "neem" in st2["ingredients"]
    r_map = {r["name"]: r["percentage"] for r in st2.get("ingredient_ratios", [])}
    assert r_map.get("neem") == 5.0
