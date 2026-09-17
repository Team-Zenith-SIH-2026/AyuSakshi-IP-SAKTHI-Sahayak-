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


def test_every_wizard_category_has_topic_searches():
    from app.agents.classification_tree import CATEGORY_PROFILES
    for key, profile in CATEGORY_PROFILES.items():
        assert profile.get("retrieval_queries"), f"{key} has no retrieval_queries"


def test_category_routed_retrieval_finds_the_provision_the_category_turns_on():
    """
    The wizard hand-off for a classical medicine must put Section 3(p) in front
    of the model. One search over the whole four-part question returned the
    licensing rules and missed it.
    """
    from app.agents.classification_tree import CATEGORY_PROFILES
    from app.agents.rag_orchestrator import RAGOrchestrator

    profile = CATEGORY_PROFILES["classical"]
    question = (
        f"My product is classified as {profile['category']}. {profile['summary']} "
        "Can it be patented, what other intellectual property protection can I get, "
        "and what licensing and biodiversity obligations apply?"
    )
    evidence = RAGOrchestrator._routed_evidence(question, profile["retrieval_queries"], "india")
    assert any("3(p)" in e.get("section_identifier", "") for e in evidence)
    assert len(evidence) <= 6
