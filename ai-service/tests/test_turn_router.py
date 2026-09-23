"""
Talking freely without ever stating law that was not verified.

Covers the guard that removes legal statements from conversational replies, the
checks applied to the conversation model's decision, and the orchestrator paths
for chat, refusals and mixed messages. No test here calls a language model.
"""
import asyncio

import pytest

from app.agents import rag_orchestrator as orchestrator_module
from app.agents.intent_mapper import IntentMapper
from app.agents.rag_orchestrator import RAGOrchestrator
from app.agents.turn_router import TurnPlan, TurnRouter, canned_reply, parse_plan, plainly_legal_question
from app.evaluators.legal_claim_guard import legal_statements, remove_legal_statements, unsupported_numbers

FACTS = "- Latest saved team benchmark: 25 questions, 18 that should be answered."


# --------------------------------------------------------------------------
# The guard
# --------------------------------------------------------------------------

@pytest.mark.parametrize("sentence", [
    "Section 7 requires prior intimation to the State Biodiversity Board.",
    "Classical formulations can't be patented.",
    "You don't need NBA approval for that.",
    "Under the Patents Act, a mere admixture is not an invention.",
    "You must register with the authority before selling.",
    "Your product is exempt.",
    "You'll need a licence to sell it.",
    "Fill in Form I to apply.",
    # Seen live, as a chat reply to "summarise what you told":
    "Sure! I explained that a patent or proprietary medicine is a formulation that uses only ingredients listed "
    "in the First Schedule of the Drugs and Cosmetics Act and is covered by specific rules.",
    "A new drug is treated as a separate category for licensing.",
    "Under the Drugs and Cosmetics Act, the product needs a licence.",
])
def test_legal_statements_are_caught(sentence):
    assert legal_statements(sentence)


@pytest.mark.parametrize("sentence", [
    "Namaste! I can help with patents, trademarks and biodiversity approvals.",
    "You can ask me about licences for Ayurvedic medicines.",
    "My answers are legal information, not legal advice.",
    "Tell me about your product and I will find the rules that apply.",
    "Glad that helped!",
    "Every answer is checked against the official text of the law.",
    "My sources include the Patents Act, 1970 and the Biological Diversity Act, 2002.",
])
def test_ordinary_chat_is_left_alone(sentence):
    assert not legal_statements(sentence)


def test_only_the_legal_sentence_is_removed():
    cleaned, removed = remove_legal_statements(
        "Happy to help! You don't need any approval for turmeric. Tell me more about your product."
    )
    assert removed == ["You don't need any approval for turmeric."]
    assert cleaned == "Happy to help! Tell me more about your product."


def test_figures_must_come_from_the_facts():
    assert unsupported_numbers("It answered 18 questions correctly.", FACTS) == []
    assert unsupported_numbers("It is 99% accurate.", FACTS) == ["99%"]


# --------------------------------------------------------------------------
# Reading the model's decision
# --------------------------------------------------------------------------

def test_decision_is_read_through_code_fences():
    raw = '```json\n{"type": "chat", "reply": "Hello!", "question": ""}\n```'
    assert parse_plan(raw) == {"type": "chat", "reply": "Hello!", "question": ""}


def test_unusable_decisions_are_rejected():
    assert parse_plan("I think this is chat") is None
    assert parse_plan('{"type": "banter", "reply": "hi"}') is None
    assert parse_plan(None) is None


def test_fixed_replies_state_no_law():
    from app.agents.turn_router import FALLBACK_REPLIES, GRATITUDE_REPLY, GREETING_REPLY
    for reply in [GREETING_REPLY, GRATITUDE_REPLY, *FALLBACK_REPLIES.values()]:
        assert not legal_statements(reply), legal_statements(reply)


def test_exact_greetings_need_no_model():
    assert canned_reply("Hi!") and canned_reply("thank you")
    assert canned_reply("does it work well?") is None


def _finish(text, decision, conversation="", has_previous_answer=False):
    return TurnRouter.finish(text, decision, FACTS, conversation, has_previous_answer, decided_by="model:test")


def test_chat_reply_that_states_law_becomes_a_legal_question():
    plan = _finish(
        "do I need a licence to sell herbal tea?",
        {"type": "chat", "reply": "Yes, you need an FSSAI licence to sell it.", "question": ""},
    )
    assert plan.kind == "legal"
    assert plan.question == "do I need a licence to sell herbal tea?"


CHIP = "I synthesized an artificial quantum semiconductor computer chip in a cleanroom. Can I patent it under AYUSH rules?"


def test_a_patent_for_unrelated_technology_is_out_of_scope_whatever_the_model_says():
    """Benchmark case oos_06: the model called it legal and it was answered from the Patents Act."""
    plan = _finish(CHIP, {"type": "legal", "reply": "", "question": CHIP})
    assert plan.kind == "out_of_scope" and plan.question == ""
    assert "Ayush products" in plan.reply
    assert not legal_statements(plan.reply)


def test_a_patent_for_unrelated_technology_is_out_of_scope_without_the_model():
    assert TurnRouter.rules(CHIP).kind == "out_of_scope"
    assert TurnRouter.rules("Can I patent my Ayurvedic formulation?").kind == "legal"


def test_a_question_about_the_assistant_stays_chat():
    assert not plainly_legal_question("how reliable are your legal answers?")
    plan = _finish(
        "how reliable are your legal answers?",
        {"type": "chat", "reply": "Every legal point I give is checked against the official text.", "question": ""},
    )
    assert plan.kind == "chat" and plan.reply


def test_invented_figures_are_removed_from_a_chat_reply():
    plan = _finish(
        "does it work well?",
        {"type": "chat", "reply": "It works well. It is 99% accurate on every question.", "question": ""},
    )
    assert "99" not in plan.reply and plan.reply == "It works well."


def test_a_chat_reply_emptied_by_the_guard_gets_a_safe_reply():
    plan = _finish("hmm ok", {"type": "chat", "reply": "Section 7 applies to you.", "question": ""})
    assert plan.kind == "chat" and plan.reply and not legal_statements(plan.reply)


def test_plainly_legal_question_is_searched_even_if_called_chat():
    plan = _finish("Can I patent my herbal powder?", {"type": "chat", "reply": "Great question!", "question": ""})
    assert plan.kind == "legal" and plan.reply == ""


def test_follow_up_without_an_earlier_answer_is_a_new_question():
    plan = _finish("what does that mean?", {"type": "follow_up", "reply": "", "question": "what does prior intimation mean?"},
                   conversation="User: hi\nAssistant: Namaste!")
    assert plan.kind == "legal"


@pytest.mark.parametrize("text,model_said", [
    ("Well summarise what you told", "chat"),
    ("ELABORATE IT VERY MUCH", "legal"),
    ("ELABORATE WHAT YOU TOLD", "chat"),
    ("can you explain that simpler", "chat"),
])
def test_requests_about_the_last_answer_are_follow_ups(text, model_said):
    """The three turns from the live conversation that went wrong."""
    plan = _finish(text, {"type": model_said, "reply": "Sure!" if model_said == "chat" else "", "question": ""},
                   conversation="User: ...", has_previous_answer=True)
    assert plan.kind == "follow_up" and plan.reply == ""


def test_without_an_earlier_answer_elaborate_is_not_a_follow_up():
    plan = _finish("elaborate", {"type": "chat", "reply": "On what?", "question": ""})
    assert plan.kind == "chat"


def test_a_chat_reply_retelling_the_last_answer_becomes_a_follow_up():
    plan = _finish(
        "ok so what was that again",
        {"type": "chat", "question": "",
         "reply": "A proprietary medicine uses ingredients listed in the First Schedule."},
        conversation="User: ...", has_previous_answer=True,
    )
    assert plan.kind == "follow_up" and plan.reply == ""


def test_a_first_message_is_searched_in_the_users_own_words():
    plan = _finish("Can a classical formulation be patented?",
                   {"type": "legal", "reply": "", "question": "Is a classical Ayurvedic formulation patentable in India?"})
    assert plan.question == "Can a classical formulation be patented?"


def test_later_messages_use_the_restated_question():
    plan = _finish("what about for a foreign company?",
                   {"type": "legal", "reply": "", "question": "Does a foreign company need NBA approval to use Indian plants?"},
                   conversation="User: I use Indian plants in my business\nAssistant: ...")
    assert plan.question == "Does a foreign company need NBA approval to use Indian plants?"


# --------------------------------------------------------------------------
# Answers to our own follow-up questions skip the model
# --------------------------------------------------------------------------

def test_tapped_options_and_facts_are_recognised_as_answers():
    pending = {"kind": "slot", "intent": "plants_in_business", "slot": "who", "slots": {},
               "original_query": "I use Indian plants for my company, any rule?", "asked": 1}
    assert IntentMapper.consumes_reply("A foreign company or an NRI", pending)
    assert IntentMapper.consumes_reply("we are a small firm in Kerala", pending)
    assert IntentMapper.consumes_reply("not sure", pending)
    assert not IntentMapper.consumes_reply("why do you need to know that?", pending)
    assert not IntentMapper.consumes_reply("anything", None)


def test_open_question_options_can_be_shown_again():
    pending = {"kind": "slot", "intent": "plants_in_business", "slot": "who", "slots": {}, "asked": 1}
    clarification = IntentMapper.clarification_for(pending)
    assert clarification["slot"] == "who"
    assert "A foreign company or an NRI" in [o["label"] for o in clarification["options"]]


# --------------------------------------------------------------------------
# The orchestrator
# --------------------------------------------------------------------------

def _use_plan(monkeypatch, plan):
    async def fake_plan(cls, text, history, has_previous_answer=False):
        return plan
    monkeypatch.setattr(TurnRouter, "plan", classmethod(fake_plan))


def test_chat_is_answered_without_searching(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="chat", reply="It is a prototype; I'm happy to show you.",
                                    decided_by="model:test", detail="chat"))

    def no_search(*args, **kwargs):
        raise AssertionError("a chat message must not be searched")
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", no_search)

    result = asyncio.run(RAGOrchestrator.process_query("does it work well?", "t"))
    assert result["answer_kind"] == "conversation"
    assert result["confidence_level"] == "conversation"
    assert result["citations"] == []


def test_chat_during_an_open_question_keeps_its_options(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="chat", reply="It decides which rule applies.", decided_by="model:test"))
    pending = {"kind": "slot", "intent": "plants_in_business", "slot": "who", "slots": {},
               "original_query": "I use Indian plants for my company, any rule?", "asked": 1}
    result = asyncio.run(RAGOrchestrator.process_query(
        "why do you need to know that?", "t", formulation_state={"pending_intent": pending}))
    assert result["updated_formulation_state"]["pending_intent"] == pending
    assert result["clarification"]["slot"] == "who"


def test_asking_why_we_asked_explains_and_asks_again(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="about_question", reply="Because rules differ.", decided_by="model:test"))
    pending = {"kind": "slot", "intent": "plants_in_business", "slot": "who", "slots": {},
               "original_query": "I use Indian plants for my company, any rule?", "asked": 1}
    result = asyncio.run(RAGOrchestrator.process_query(
        "why do you need to know that?", "t", formulation_state={"pending_intent": pending}))
    assert result["answer_kind"] == "clarification"
    assert result["answer"].startswith("Good question.")
    assert result["clarification"]["slot"] == "who"
    assert result["updated_formulation_state"]["pending_intent"] == pending


def test_a_refusal_is_explained_and_marked(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="legal", question="Is there a rule about xyz widgets?",
                                    decided_by="model:test", detail="legal"))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [])
    result = asyncio.run(RAGOrchestrator.process_query("rule about xyz widgets?", "t", jurisdiction="international"))
    assert result["answer_kind"] == "refusal"
    assert result["confidence_level"] == "abstained"
    assert "won't guess" in result["answer"]


def test_a_refused_follow_up_does_not_offer_unrelated_situations(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="legal", question="Please elaborate on the licensing difference in detail.",
                                    decided_by="model:test"))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [])
    state = {"last_answer": {"question": "q", "answer": "a", "evidence": [{"id": "x"}]}}
    result = asyncio.run(RAGOrchestrator.process_query("ELABORATE IT VERY MUCH", "t", formulation_state=state))
    assert result["answer_kind"] == "refusal"
    assert not result.get("clarification")
    assert "Were you asking" not in result["answer"]


LABEL_RULE = {
    "id": "c1", "doc_title": "The Drugs and Cosmetics Rules, 1945", "section_identifier": "Rule 161(1)",
    "content": "The label of every container of an Ayurvedic medicine shall display the true list of all ingredients "
               "with their botanical names, the name of the medicine, the net content and the name and address "
               "of the manufacturer.",
    "rerank_score": 6.0, "similarity": 0.8, "jurisdiction": "international", "authority": "CDSCO",
}
GROUNDED = ("Under Rule 161(1), the label of every container of an Ayurvedic medicine shall display the true list "
            "of all ingredients with their botanical names, the name of the medicine, the net content and the "
            "name and address of the manufacturer. This is regulatory information, not legal advice.")


def _drafts(monkeypatch, *drafts):
    calls = []

    async def fake(cls, **kwargs):
        calls.append(kwargs.get("rejected"))
        return drafts[len(calls) - 1], "llm:test"
    monkeypatch.setattr(RAGOrchestrator, "_synthesize_grounded_answer", classmethod(fake))
    return calls


def test_a_draft_citing_beyond_its_sources_is_rewritten_once(monkeypatch):
    """Seen live: a Rule 161 answer named Rule 161B(1), which it had not been shown, and was refused whole."""
    _use_plan(monkeypatch, TurnPlan(kind="legal", question="What must an Ayurvedic label show?", decided_by="model:test"))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [dict(LABEL_RULE)])
    calls = _drafts(monkeypatch, GROUNDED + " The expiry date is required by Rule 161B(1).", GROUNDED)

    result = asyncio.run(RAGOrchestrator.process_query("What must an Ayurvedic label show?", "t",
                                                       jurisdiction="international"))
    assert calls == [None, ["Rule 161B(1)"]]
    assert result["answer_kind"] == "legal"
    assert "161B" not in result["answer"]
    assert result["fabricated_citations"] == [] and result["blocked_citations"] == ["Rule 161B(1)"]
    assert any(s["step"] == "Citation Repair" for s in result["thinking_trace"])


def test_a_rewrite_that_still_cites_beyond_its_sources_is_refused(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="legal", question="What must an Ayurvedic label show?", decided_by="model:test"))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [dict(LABEL_RULE)])
    bad = GROUNDED + " The expiry date is required by Rule 161B(1)."
    calls = _drafts(monkeypatch, bad, bad)

    result = asyncio.run(RAGOrchestrator.process_query("What must an Ayurvedic label show?", "t",
                                                       jurisdiction="international"))
    assert len(calls) == 2
    assert result["answer_kind"] == "refusal"
    assert result["abstention_reason"] == "fabricated_citation"


def test_a_mixed_message_keeps_its_chat_part_with_the_refusal(monkeypatch):
    _use_plan(monkeypatch, TurnPlan(kind="mixed", reply="Glad the last answer helped!",
                                    question="Is there a rule about xyz widgets?", decided_by="model:test"))
    monkeypatch.setattr(orchestrator_module, "hybrid_retrieve", lambda *a, **k: [])
    result = asyncio.run(RAGOrchestrator.process_query(
        "thanks! and is there a rule about xyz widgets?", "t", jurisdiction="international"))
    assert result["answer"].startswith("Glad the last answer helped!")
    assert result["answer_kind"] == "refusal"
