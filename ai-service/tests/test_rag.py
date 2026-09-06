import pytest
from app.seed_knowledge import seed_database
from app.rag.hybrid_retriever import hybrid_retrieve
from app.agents.ip_router import IPRouter
from app.agents.abs_helper import ABSHelper

@pytest.fixture(scope="module", autouse=True)
def init_seed():
    seed_database()

def test_ip_router():
    domains = IPRouter.route_query("Can I file a patent for my herbal extract and what are the ABS fees under NBA?")
    assert "patents" in domains
    assert "biodiversity_abs" in domains

def test_abs_helper():
    res = ABSHelper.analyze_compliance("I want to commercialize and patent an Ashwagandha formulation extracted from Indian roots.")
    assert res["abs_applicable"] is True
    assert any("Section 6(1)" in p["section"] for p in res["statutory_provisions"])
    assert any("Form III" in f for f in res["required_forms"])

def test_hybrid_retriever_india():
    results = hybrid_retrieve("Section 3(p) traditional knowledge patentability", jurisdiction="india", top_k=3)
    assert len(results) > 0
    assert any("3(p)" in r.get("section_identifier", "") for r in results)

def test_hybrid_retriever_international():
    results = hybrid_retrieve("WIPO GRATK Treaty genetic resources mandatory disclosure", jurisdiction="international", top_k=3)
    assert len(results) > 0
    assert any("GRATK" in r.get("section_identifier", "") or "international" in r.get("jurisdiction", "") for r in results)
