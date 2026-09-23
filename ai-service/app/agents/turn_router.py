"""
Deciding what each message in a conversation is, before anything is searched.

People talk to AyuSakshi the way they talk to any chatbot: "hi", "does it work
well?", "explain that more simply", "thanks! and do I need a licence?". Before
this step every message that was not an exact greeting was treated as a legal
question, searched against the statutes, and refused when the answer named no
provision, which a reply to "does it work well?" never can.

The rule this module enforces is narrower and is the one that matters: the
assistant may talk freely, but anything it says about the law must come from
the verified-source pipeline. So one quick model call, which sees the recent
conversation, sorts each message into:

  chat          greetings, thanks, small talk, questions about AyuSakshi itself
  legal         a question about what the law requires, allows or forbids
  follow_up     a question about the previous answer
  out_of_scope  medical advice, other countries' law, writing tasks, and so on
  mixed         a chat part and a legal question together

and, in the same call, writes the reply to any non-legal part and restates any
legal part as a self-contained question. The reply is then passed through
legal_claim_guard, which removes any sentence that states law, and through a
check that it quotes no figure the fact sheet does not contain. A legal question
is never answered here: it goes on to retrieval and citation verification.

If the model cannot be reached quickly, the decision falls back to rules that
reproduce the earlier behaviour, so an outage makes the assistant less chatty,
never less safe.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.agents.assistant_profile import fact_sheet
from app.agents.intent_mapper import about_unrelated_technology, asks_about_law
from app.evaluators.legal_claim_guard import remove_legal_statements, unsupported_numbers
from app.llm.providers import call_llm

log = logging.getLogger("ayusakshi.turn")

KINDS = ("chat", "legal", "follow_up", "about_question", "out_of_scope", "mixed")

ROUTER_BUDGET_SECONDS = 12
ROUTER_MAX_TOKENS = 900

GREETING_PATTERNS = [
    r"^(hi|hello|hey|greetings|namaste|namaskar|pranam|good\s+(morning|afternoon|evening|day))$",
    r"^(who\s+are\s+you|what\s+are\s+you|what\s+is\s+ayusakshi|what\s+is\s+this\s+(app|tool|website|system|platform))$",
    r"^(what\s+(can\s+you|you\s+can)\s+do|how\s+can\s+you\s+help(\s+me)?|what\s+do\s+you\s+do|how\s+does\s+this\s+work|what\s+are\s+your\s+features)$",
    r"^(help|help\s+me|show\s+me\s+features|guide\s+me)$",
]
GRATITUDE_PATTERNS = [
    r"^(thanks|thank\s+you|thank\s+you\s+so\s+much|thx|many\s+thanks)$",
    r"^(ok|okay|got\s+it|understood|noted|alright|fine)$",
    r"^(bye|goodbye|see\s+you)$",
]

GREETING_REPLY = (
    "Namaste! I am **AyuSakshi (IP-SAKTI Sahayak)**, an assistant for intellectual property and regulatory "
    "questions about Ayurvedic products, built for the Ministry of Ayush's Smart India Hackathon problem "
    "statement SIH26045.\n\n"
    "I can help you understand:\n\n"
    "1. **Product classification and licensing**: whether a product is a classical medicine, a proprietary "
    "medicine, a phytopharmaceutical or an Ayurveda Aahara food, and what that means for licensing.\n"
    "2. **Protecting what you made**: patents, trademarks, geographical indications, and traditional knowledge.\n"
    "3. **Using Indian plants**: biodiversity approvals, prior intimation and benefit sharing.\n"
    "4. **Advertising and labelling**: the rules on what a label or advertisement says.\n\n"
    "Every legal point I give you comes from the official text of the law, and I show you where. "
    "What would you like to know? You can also tap what fits your situation and I will write the question."
)
GRATITUDE_REPLY = (
    "You're welcome! If anything else comes up about your product, protecting it, or using Indian plants, "
    "just ask."
)

_QUESTION_START = re.compile(
    r"^\s*(can|could|do|does|did|is|are|was|were|should|shall|must|will|would|what|which|who|how|when|where|"
    r"why|may|might|need|am)\b",
    re.IGNORECASE,
)

SYSTEM_PROMPT = """You manage the conversation for AyuSakshi, an assistant for intellectual property and regulatory questions about Ayurvedic products in India.

For the user's newest message, decide how it should be handled and answer with one JSON object only.

"type" is one of:
- "chat": greetings, thanks, small talk, feedback, reactions, questions about AyuSakshi itself (what it is, how it works, how reliable it is, what it covers, who made it), or an opener with no specific legal question yet.
- "legal": a question about what the law requires, allows, forbids or exempts, or how to get a patent, trademark, GI, licence, approval or registration, or how a product is classified or may be advertised. Vague ones count ("any rule for my herbal business?").
- "follow_up": anything about your previous legal answer: summarise it, repeat it, elaborate or expand on it, give more detail, say it more simply, explain a term it used, give an example, are you sure, what should I do first. Even a short "elaborate" or "summarise what you told" is follow_up, never chat.
- "about_question": your last message asked the user a question, and they ask why you need to know, what an option means, or which option fits them, instead of answering it.
- "out_of_scope": medical or health advice, dosages, treatments, other countries' national laws, writing marketing or other content, or general knowledge unrelated to the above.
- "mixed": the message has a chat part and a legal question.

"reply": for chat, about_question, out_of_scope and mixed, a short, warm, natural reply to the non-legal part, one to four sentences, in plain English. For legal and follow_up, "".

"question": for legal, follow_up and mixed, the legal question restated as one self-contained question, using the conversation to resolve words like "it", "this" or "that". Keep the user's own facts and add none. For follow_up, name what it refers to. Otherwise "".

Rules for "reply":
1. Never state what any law requires, allows, forbids, defines or exempts. Never name a section, rule, article, schedule or form. Never say whether something is patentable, legal, required, allowed or exempt. Never repeat or summarise an earlier legal answer: that is follow_up. Legal information is given only by a separate step that checks it against the official text.
2. About AyuSakshi itself, use only the facts below. If something is not in the facts, say you are not sure. Never make up a number.
3. Actually answer what was asked. If asked whether it works well, how accurate or reliable it is, or whether to trust it, answer honestly from the facts: how answers are checked, what the latest benchmark found in plain words, and its limits. Do not dodge with a generic offer of help.
4. For out_of_scope, say kindly what you cannot help with, and what you can.
5. For a vague opener, invite the person to describe their product and what they want to do.
6. Sound like a helpful person, not a brochure: no marketing language, and no more than one question back to the user.

Facts about AyuSakshi:
{facts}

Answer with JSON only, for example: {{"type": "chat", "reply": "...", "question": ""}}"""


@dataclass
class TurnPlan:
    kind: str
    question: str = ""
    reply: str = ""
    decided_by: str = "rules"
    detail: str = ""


def _normalise(text: str) -> str:
    cleaned = re.sub(r"[!?.,;:'\"]+", "", (text or "").strip().lower())
    return re.sub(r"^(so\s+|well\s+|please\s+|can\s+you\s+|tell\s+me\s+)+", "", cleaned).strip()


def canned_reply(text: str) -> Optional[str]:
    """The fixed reply for an exact greeting or thank-you. No model call needed."""
    clean = _normalise(text)
    if any(re.match(p, clean) for p in GREETING_PATTERNS):
        return GREETING_REPLY
    if any(re.match(p, clean) for p in GRATITUDE_PATTERNS):
        return GRATITUDE_REPLY
    return None


_LEGAL_ACTION = re.compile(
    r"\b(patent\w*|licen[cs]\w*|approv\w*|permission|permit|regist\w*|trade ?mark\w*|intimation|exempt\w*|"
    r"allowed|prohibited|nba|gi tag|benefit[- ]sharing)\b",
    re.IGNORECASE,
)
_ABOUT_THE_ASSISTANT = re.compile(r"\b(you|your|ayusakshi|this (app|tool|bot|chatbot|system|site|website))\b", re.IGNORECASE)


# "summarise what you told", "ELABORATE IT VERY MUCH", "explain that simpler".
# Once there is an answer on screen these can only be about it, whatever the
# model decides: answered as chat they restate law unchecked, answered as a new
# question they lose the sources the answer came from.
_ABOUT_PREVIOUS_ANSWER = re.compile(
    r"\b(summari[sz]\w*|sum (it|that|this) up|recap|tl;?dr|elaborat\w*|expand\w*|more detail\w*|in detail|"
    r"detailed|explain (it|that|this|more)|simpl(er|ify|y)|repeat|rephrase|say (it|that) again|"
    r"what (you|u) (told|said|wrote|mentioned|explained)|you (told|said|mentioned)|go deeper|tell me more|"
    r"more about (it|that|this)|example)\b",
    re.IGNORECASE,
)


def refers_to_previous_answer(text: str) -> bool:
    """A short request about the last answer, not a new question of its own."""
    words = len((text or "").split())
    return words <= 12 and bool(_ABOUT_PREVIOUS_ANSWER.search(text or "")) and not _LEGAL_ACTION.search(text or "")


def looks_like_legal_question(text: str) -> bool:
    """A question, and one about what the law requires or allows."""
    return asks_about_law(text) and ("?" in (text or "") or bool(_QUESTION_START.match(text or "")))


def plainly_legal_question(text: str) -> bool:
    """
    A question naming a concrete legal act and not addressed to the assistant:
    "do I need a licence to sell herbal tea?", but not "how reliable are your
    legal answers?".
    """
    return (
        looks_like_legal_question(text)
        and bool(_LEGAL_ACTION.search(text or ""))
        and not _ABOUT_THE_ASSISTANT.search(text or "")
    )


def parse_plan(raw: Optional[str]) -> Optional[Dict[str, str]]:
    """The model's JSON decision, tolerating code fences or text around it."""
    if not raw:
        return None
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("type") not in KINDS:
        return None
    return {
        "type": data["type"],
        "reply": str(data.get("reply") or "").strip(),
        "question": str(data.get("question") or "").strip(),
    }


def _history_text(history: List[Dict[str, Any]]) -> str:
    lines = []
    for msg in (history or [])[-6:]:
        who = "User" if msg.get("sender") == "user" else "Assistant"
        limit = 400 if who == "User" else 600
        content = re.sub(r"\s+", " ", msg.get("content") or "").strip()
        if len(content) > limit:
            content = content[:limit].rstrip() + " ..."
        lines.append(f"{who}: {content}")
    return "\n".join(lines)


FALLBACK_REPLIES = {
    "chat": "Happy to help. Tell me about your product and what you would like to do with it, and I will find the rules that apply.",
    "out_of_scope": (
        "I'm not able to help with that. I can help with patents, trademarks, biodiversity approvals, and "
        "licensing or advertising rules for Ayurvedic products."
    ),
    "mixed": "",
}

UNRELATED_TECHNOLOGY_REPLY = (
    "That's outside what I can help with. I answer intellectual property and regulatory questions about "
    "Ayurvedic and other Ayush products, such as medicines, herbal formulations and Ayurveda foods, not about "
    "other kinds of technology. A registered patent agent can advise on an invention like this one."
)


class TurnRouter:

    @staticmethod
    def rules(text: str, has_previous_answer: bool = False) -> TurnPlan:
        """The earlier behaviour: a fixed reply for exact greetings, everything else searched."""
        reply = canned_reply(text)
        if reply:
            return TurnPlan(kind="chat", reply=reply, decided_by="rules", detail="Recognised a greeting or thanks.")
        if about_unrelated_technology(text):
            return TurnPlan(kind="out_of_scope", reply=UNRELATED_TECHNOLOGY_REPLY, decided_by="rules",
                            detail="About a kind of invention AyuSakshi does not cover (conversation model not used).")
        return TurnPlan(kind="legal", question=text, decided_by="rules",
                        detail="Treated as a legal question (conversation model not used).")

    @classmethod
    async def plan(cls, text: str, history: List[Dict[str, Any]], has_previous_answer: bool = False) -> TurnPlan:
        reply = canned_reply(text)
        if reply:
            return TurnPlan(kind="chat", reply=reply, decided_by="rules", detail="Recognised a greeting or thanks.")

        facts = fact_sheet()
        conversation = _history_text(history)
        user_prompt = (
            (f"Conversation so far:\n{conversation}\n\n" if conversation else "This is the first message.\n\n")
            + f"Newest message: {text}"
        )
        raw, provider = await call_llm(
            SYSTEM_PROMPT.format(facts=facts), user_prompt,
            providers=("groq",), max_tokens=ROUTER_MAX_TOKENS,
            budget_seconds=ROUTER_BUDGET_SECONDS, reasoning_effort="low",
        )
        decision = parse_plan(raw)
        if decision is None:
            log.warning("[Turn] no usable decision (provider=%s, raw=%r); using rules.", provider, (raw or "")[:200])
            plan = cls.rules(text, has_previous_answer)
            plan.detail = "The conversation model was unavailable, so this was " + plan.detail[0].lower() + plan.detail[1:]
            return plan

        return cls.finish(text, decision, facts, conversation, has_previous_answer, decided_by=f"model:{provider}")

    @staticmethod
    def finish(
        text: str,
        decision: Dict[str, str],
        facts: str,
        conversation: str,
        has_previous_answer: bool,
        decided_by: str,
    ) -> TurnPlan:
        """
        Apply the safety checks to the model's decision. Kept separate from the
        model call so every check can be tested without one.
        """
        kind, reply, question = decision["type"], decision["reply"], decision["question"]
        notes = []

        if has_previous_answer and kind in ("chat", "legal", "out_of_scope") and refers_to_previous_answer(text):
            notes.append(f"asks about the previous answer, so it is answered from its sources rather than as {kind}")
            kind, reply = "follow_up", ""

        if kind in ("chat", "about_question", "out_of_scope", "mixed") and reply:
            reply, removed = remove_legal_statements(reply)
            if removed:
                notes.append(f"removed {len(removed)} legal statement(s) from the conversational reply")
                log.warning("[Turn] removed legal statements from a chat reply: %s", removed)
                # A reply that tried to state law was answering a legal question,
                # or retelling the last answer without its sources.
                if kind == "chat" and looks_like_legal_question(text):
                    kind, question = "legal", question or text
                elif kind == "chat" and has_previous_answer:
                    kind, question, reply = "follow_up", question or text, ""
            numbers = unsupported_numbers(reply, facts, text, conversation)
            if numbers:
                kept = [s for s in re.split(r"(?<=[.!?])\s+", reply) if not unsupported_numbers(s, facts, text, conversation)]
                reply = " ".join(kept).strip()
                notes.append(f"removed figures not in the fact sheet: {', '.join(numbers)}")

        # The model's call is not the last word on something that is plainly a
        # legal question: searching costs time, answering one from chat costs trust.
        if kind in ("chat", "out_of_scope") and plainly_legal_question(text):
            kind, question = "legal", question or text
            notes.append("reads as a legal question, so it is searched")
            reply = ""

        # "Can I patent this semiconductor chip under AYUSH rules?" reads as a
        # legal question to the model, and the full Patents Act can answer it.
        # It is still not about an Ayush product (benchmark case oos_06).
        if kind in ("legal", "mixed") and about_unrelated_technology(text):
            kind, question, reply = "out_of_scope", "", UNRELATED_TECHNOLOGY_REPLY
            notes.append("about a kind of invention AyuSakshi does not cover, so it is not searched")

        if kind == "follow_up" and not has_previous_answer:
            kind = "legal"
            notes.append("no earlier answer to follow up on, so handled as a new question")
        if kind in ("legal", "follow_up", "mixed") and not question:
            question = text
        # Nothing to resolve in a first message; restating it could only drift from the user's words.
        if kind == "legal" and not conversation:
            question = text
        if kind == "about_question" and not reply:
            reply = FALLBACK_REPLIES["chat"]
        if kind in ("chat", "out_of_scope") and not reply:
            reply = FALLBACK_REPLIES[kind]
        if kind == "mixed" and not reply:
            kind = "legal"

        labels = {
            "chat": "Conversation, answered directly. No legal information is given in it.",
            "about_question": "A question about the question we asked, so it is explained and asked again.",
            "out_of_scope": "Outside what AyuSakshi covers, answered directly without legal information.",
            "legal": f"A legal question, to be answered from the official texts: '{question}'.",
            "follow_up": f"A follow-up on the previous answer, answered from the same sources: '{question}'.",
            "mixed": f"Conversation plus a legal question, which is answered from the official texts: '{question}'.",
        }
        detail = labels[kind] + (f" ({'; '.join(notes)})" if notes else "")
        return TurnPlan(kind=kind, question=question, reply=reply, decided_by=decided_by, detail=detail)
