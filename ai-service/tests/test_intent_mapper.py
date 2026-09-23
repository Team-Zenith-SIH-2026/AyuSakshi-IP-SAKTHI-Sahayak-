"""
Recognising a practitioner's situation from their own words, and the follow-up
questions that fill in what the law needs to know.

Most of these use the real embedding model and are skipped without it.
"""
import json
import os
import re

import pytest

from app.agents.intent_catalogue import INTENTS, OUT_OF_SCOPE_EXAMPLES, intent_by_id
from app.agents.intent_mapper import (
    IntentMapper, NONE_OF_THESE_LABEL, about_unrelated_technology, asks_about_law, is_general_question,
)

APP = os.path.join(os.path.dirname(__file__), "..", "app")
KB = os.path.join(os.path.dirname(__file__), "..", "knowledge-base")

needs_model = pytest.mark.skipif(not IntentMapper.available(), reason="real embedding model not available")


def _norm(text):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


# --------------------------------------------------------------------------
# The catalogue itself
# --------------------------------------------------------------------------

def test_no_test_question_is_copied_into_the_catalogue():
    """Recognition is measured on phrasings the catalogue has never seen."""
    with open(os.path.join(APP, "evaluators", "golden_dataset.json"), encoding="utf-8") as f:
        tests = [c["query"] for c in json.load(f)]
    with open(os.path.join(APP, "evaluators", "layman_intents.json"), encoding="utf-8") as f:
        tests += [c["text"] for c in json.load(f)["cases"]]
    known = {_norm(t) for i in INTENTS for t in i["examples"] + [i["title"], i["ask"]]}
    known |= {_norm(t) for t in OUT_OF_SCOPE_EXAMPLES}
    leaked = [t for t in tests if _norm(t) in known]
    assert not leaked, f"test phrasings copied into the catalogue: {leaked}"


def test_every_routed_search_targets_a_curated_provision():
    """Each retrieval query is a curated chunk's retrieval_context, so it finds that chunk."""
    path = os.path.join(KB, "corpus", "india.json")
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge-base", "corpus", "india.json")
    with open(path, encoding="utf-8") as f:
        contexts = {c["retrieval_context"] for d in json.load(f)["documents"] for c in d["chunks"]}
    for intent in INTENTS:
        queries = list(intent["retrieval_queries"])
        for slot in intent["slots"]:
            for option in slot["options"]:
                queries += option["retrieval_queries"]
        for q in queries:
            assert q in contexts, f"{intent['id']}: no curated provision has retrieval_context {q[:60]!r}"


def test_option_labels_are_unique_within_a_question():
    for intent in INTENTS:
        for slot in intent["slots"]:
            labels = [_norm(o["label"]) for o in slot["options"]]
            assert len(labels) == len(set(labels)), f"{intent['id']}.{slot['name']}"


# --------------------------------------------------------------------------
# Reading facts from wording
# --------------------------------------------------------------------------

def test_facts_are_read_from_plain_wording():
    plants = intent_by_id("plants_in_business")
    assert IntentMapper.parse_slots(plants, "we are a small firm in Kerala") == {"who": "indian_business"}
    assert IntentMapper.parse_slots(plants, "our company is from Germany")["who"] == "foreign"
    assert IntentMapper.parse_slots(plants, "I am a vaid")["who"] == "practitioner"


def test_where_the_plant_came_from_is_not_who_the_buyer_is():
    plants = intent_by_id("plants_in_business")
    assert "who" not in IntentMapper.parse_slots(plants, "I buy turmeric from Nepal for my company")


def test_where_the_plants_are_used_is_not_where_the_company_is():
    plants = intent_by_id("plants_in_business")
    text = ("What are the requirements for a foreign company using cultivated medicinal plants for commercial "
            "purposes in India?")
    assert IntentMapper.parse_slots(plants, text)["who"] == "foreign"


def test_conflicting_facts_are_asked_for_not_guessed():
    plants = intent_by_id("plants_in_business")
    assert "who" not in IntentMapper.parse_slots(plants, "an Indian company working with farmers")


def test_a_tapped_option_is_read_exactly():
    plants = intent_by_id("plants_in_business")
    assert IntentMapper.parse_slots(plants, "A foreign company or an NRI") == {"who": "foreign"}


def test_questions_without_a_legal_ask_are_not_routed():
    assert not asks_about_law("ashwagandha benefits")
    assert not asks_about_law("which ayurvedic medicine is best for diabetes")
    assert not asks_about_law("I synthesized a semiconductor chip. Can I patent it under AYUSH rules?")
    assert asks_about_law("I use Indian plants for my company, any rule?")


# --------------------------------------------------------------------------
# The conversation
# --------------------------------------------------------------------------

@needs_model
def test_mentor_question_is_recognised_and_asks_who():
    out = IntentMapper.resolve("I use Indian plants for my company, any rule?")
    assert out.action == "ask"
    assert out.intent["id"] == "plants_in_business"
    assert out.clarification["slot"] == "who"
    assert "biological resources" in out.answer_text


@needs_model
def test_tapped_answers_complete_the_question():
    first = IntentMapper.resolve("I use Indian plants for my company, any rule?")
    second = IntentMapper.resolve("An Indian company, firm or shop", first.pending)
    assert second.action == "ask" and second.clarification["slot"] == "source"
    third = IntentMapper.resolve("Grown on farms (cultivated)", second.pending)
    assert third.action == "mapped"
    assert third.slots == {"who": "indian_business", "source": "cultivated"}
    assert "registered in India" in third.question and "cultivated" in third.question
    assert third.restated


@needs_model
def test_foreign_business_is_not_asked_where_plants_come_from():
    first = IntentMapper.resolve("I use Indian plants for my company, any rule?")
    out = IntentMapper.resolve("A foreign company or an NRI", first.pending)
    assert out.action == "mapped"
    assert out.slots == {"who": "foreign"}


@needs_model
def test_an_unreadable_reply_is_taken_as_not_sure_rather_than_asked_again():
    first = IntentMapper.resolve("I want to file a patent for the commercial product for Ayurvedic discovery.")
    out = IntentMapper.resolve("hmm", first.pending)
    assert out.action == "mapped"
    assert out.slots == {"basis": "not_sure"}


@needs_model
def test_a_new_question_mid_conversation_starts_over():
    first = IntentMapper.resolve("I use Indian plants for my company, any rule?")
    out = IntentMapper.resolve("Can I register my herbal product's brand name as a trademark?", first.pending)
    assert out.intent is not None and out.intent["id"] == "brand_name"


@needs_model
def test_expert_wording_is_answered_without_questions():
    out = IntentMapper.resolve(
        "Is prior intimation to the State Biodiversity Board required for an Indian company using turmeric commercially?"
    )
    assert out.action == "mapped"
    assert not out.restated
    assert out.slots["who"] == "indian_business"


@needs_model
def test_no_benchmark_question_is_answered_with_a_follow_up_question():
    """
    The benchmark (evaluators/golden_dataset.json) asks each question once. A
    question from it that the system met with a follow-up question would score
    as unanswered, so none of them may be interrupted.
    """
    with open(os.path.join(APP, "evaluators", "golden_dataset.json"), encoding="utf-8") as f:
        cases = [c for c in json.load(f) if c.get("jurisdiction", "india") == "india"]
    interrupted = [c["id"] for c in cases if IntentMapper.resolve(c["query"]).action == "ask"]
    assert not interrupted, f"benchmark questions met with a follow-up question: {interrupted}"


@needs_model
def test_a_short_ambiguous_question_asks_which_situation():
    # Both close situations are named ("brand", "selling"), so only the person can say.
    out = IntentMapper.resolve("herbal brand for selling, rules?")
    assert out.action == "ask" and out.clarification["kind"] == "choose_intent"
    assert {"plants_in_business", "brand_name"} <= {o["value"] for o in out.clarification["options"]}


@needs_model
@pytest.mark.parametrize("text,expected", [
    ("Can generic Sanskrit herb names be trademarked?", "brand_name"),
    ("Can I advertise an Ayurvedic cure for diabetes?", "advertising_claims"),
    ("plants for selling, permission?", "plants_in_business"),
])
def test_a_near_tie_goes_to_the_situation_the_person_named(text, expected):
    """Similarity alone could not separate these; the one situation whose words were used can."""
    out = IntentMapper.resolve(text)
    assert out.intent is not None and out.intent["id"] == expected
    assert not (out.clarification and out.clarification["kind"] == "choose_intent")


def test_an_indian_startup_is_read_as_an_indian_business():
    plants = intent_by_id("plants_in_business")
    assert IntentMapper.parse_slots(plants, "Do Indian ASU startups need NBA ABS approval?")["who"] == "indian_business"


@needs_model
def test_a_detailed_ambiguous_question_is_searched_first():
    out = IntentMapper.resolve(
        "My product combines three classical herbs in a new ratio. What protection can I get?"
    )
    assert out.action == "none"
    assert "patent_my_product" in [i for i, _ in out.suggestions]


@needs_model
def test_out_of_scope_questions_pass_through_untouched():
    for text in ("What dosage of ashwagandha should I take daily for stress?",
                 "Write me a marketing email promoting my new ashwagandha supplement to retailers."):
        out = IntentMapper.resolve(text)
        assert out.action == "none" and out.query == text


def test_none_of_these_answers_the_question_as_asked():
    pending = {"kind": "choose_intent", "candidates": ["brand_name", "patent_my_product"],
               "original_query": "how to protect my product", "asked": 1}
    out = IntentMapper._continue(NONE_OF_THESE_LABEL, pending)
    assert out.action == "none" and out.query == "how to protect my product"


def test_none_of_these_after_a_refusal_does_not_search_again():
    pending = {"kind": "choose_intent", "candidates": ["brand_name"], "original_query": "x",
               "asked": 1, "after_refusal": True}
    assert IntentMapper._continue(NONE_OF_THESE_LABEL, pending).action == "decline"


def test_choosing_a_situation_asks_its_first_question():
    pending = {"kind": "choose_intent", "candidates": ["brand_name", "patent_my_product"],
               "original_query": "how do I protect my herbal product", "asked": 1}
    out = IntentMapper._continue("Getting a patent on my Ayurvedic product", pending)
    assert out.action == "ask" and out.intent["id"] == "patent_my_product"


def test_picker_selection_is_mapped_without_recognition():
    out = IntentMapper.resolve(
        "I run a company or shop in India. I use Indian plants or herbs. I want to sell it.",
        picked={"goal": "sell", "who": "india_business", "uses": "plants"},
    )
    assert out.action == "ask"
    assert out.intent["id"] == "plants_in_business"
    assert out.slots == {"who": "indian_business"} and out.clarification["slot"] == "source"


def test_picker_facts_only_fill_questions_the_situation_asks():
    out = IntentMapper.resolve(
        "I am a foreign company. My product is my own mix of herbs. I want to get a patent.",
        picked={"goal": "patent", "who": "foreign", "uses": "own_mix"},
    )
    assert out.action == "mapped"
    assert out.slots == {"basis": "combination"}


def test_picker_with_an_unknown_goal_falls_back_to_the_words():
    assert IntentMapper._from_picker("anything", {"goal": "nonsense"}) is None
    assert IntentMapper._from_picker("anything", None) is None


# --------------------------------------------------------------------------
# General questions and unrelated inventions
# --------------------------------------------------------------------------

@pytest.mark.parametrize("text,general", [
    ("How long does a patent last in India?", True),
    ("What must be printed on the label of an Ayurvedic medicine?", True),
    ("Can a US company patent turmeric in India?", True),
    ("What are the labelling requirements for Ayurvedic medicines?", True),
    ("Can I patent my Ayurvedic product?", False),
    ("Our company uses tulsi, do we need approval?", False),
    ("rules for ayurvedic products?", False),
    ("What are the rules for Ayurvedic companies?", False),
    ("any rules for herbal business?", False),
    ("herbal brand for selling, rules?", False),
    ("patent rules?", False),
])
def test_what_counts_as_a_general_question(text, general):
    assert is_general_question(text) is general


@pytest.mark.parametrize("text,unrelated", [
    ("I synthesized an artificial quantum semiconductor computer chip in a cleanroom. Can I patent it under AYUSH rules?", True),
    ("Can I patent my new smartphone battery design?", True),
    ("Can I patent software that recommends Ayurvedic herbs?", False),
    ("Can I patent my Ayurvedic formulation?", False),
])
def test_an_unrelated_invention_is_recognised(text, unrelated):
    assert about_unrelated_technology(text) is unrelated


@needs_model
@pytest.mark.parametrize("text", [
    "How long does a patent last in India?",
    "On what grounds can a granted patent be revoked in India?",
    "Can an Ayurveda Aahara product claim to cure a disease?",
    "What is the penalty for publishing an objectionable advertisement for a drug?",
])
def test_a_general_question_is_answered_as_asked(text):
    """Not interrupted with a question about the asker, and not rewritten as their situation."""
    out = IntentMapper.resolve(text)
    assert out.action in ("mapped", "none")
    if out.action == "mapped":
        assert out.restated is False
    else:
        assert out.query == text


@needs_model
def test_the_same_question_about_ones_own_product_still_asks():
    out = IntentMapper.resolve("Can I get a patent on my Ayurvedic product?")
    assert out.action == "ask"


def test_never_more_than_the_maximum_follow_ups():
    intent = intent_by_id("plants_in_business")
    out = IntentMapper._advance(intent, {}, original_query="q", asked=3, expert=False, trace="")
    assert out.action == "mapped"
    assert out.slots == {"who": "not_sure", "source": "not_sure"}
