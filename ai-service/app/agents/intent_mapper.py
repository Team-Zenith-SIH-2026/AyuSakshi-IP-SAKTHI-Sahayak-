"""
From the words a practitioner uses to the question the law answers.

Three steps, all deterministic:

1. Recognise the situation. The question is embedded with the same
   multilingual model retrieval uses and compared with every phrasing in
   intent_catalogue. A situation's score is its closest phrasing. Out-of-scope
   phrasings are scored as a class of their own, so "what dose of tulsi should I
   take" is not mistaken for a business question about tulsi.

2. Find the missing facts. Each situation lists the facts that change which
   provision applies (an Indian business or a foreign one; cultivated plants or
   wild ones). Facts already present in the wording are read from it; a missing
   one is asked for as a single question with fixed options. A person who writes
   in the statute's own terms is not questioned: their question is answered
   across every branch instead.

3. Restate. Once the facts are known, the question is rewritten in the statute's
   terms, and each provision it raises is searched on its own.

Nothing here decides a legal outcome or produces a citation. It only chooses
what to search for and what to ask. The answer is still generated from
retrieved evidence and verified exactly as before.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.agents.intent_catalogue import BUILDER_FACTS, BUILDER_GOALS, INTENTS, OUT_OF_SCOPE_EXAMPLES, intent_by_id
from app.rag.embeddings import generate_batch_embeddings, generate_embedding, get_embedding_model

log = logging.getLogger("ayusakshi.intent")

OUT_OF_SCOPE = "_out_of_scope"
NONE_OF_THESE_LABEL = "None of these"

# Thresholds on cosine similarity with paraphrase-multilingual-MiniLM-L12-v2.
# Set from evaluators/run_intent_eval.py over the held-out phrasings; change
# them only with a fresh run of that script.
MATCH_THRESHOLD = 0.55     # a situation this close is taken as recognised...
MATCH_MARGIN = 0.06        # ...if the next closest is at least this far behind
CHOICE_FLOOR = 0.45        # closer than this, but ambiguous: ask which situation
CHOICE_BAND = 0.08         # situations within this of the best are offered
MAX_QUESTIONS = 3          # never ask more than this many follow-ups in a row
CUE_BOOST = 0.05           # added to a situation whose cue words appear
# "Which of these do you mean?" is asked before searching only for a short
# question. A longer one says enough to be searched as written; the situations
# are offered only if that search is refused.
CHOICE_MAX_WORDS = 12

# A question with none of these is not asking what the law allows or requires
# ("ashwagandha benefits", "which medicine is best for diabetes"), so it is never
# mapped to a situation, however similar its words.
LEGAL_SIGNALS = [
    r"\brules?\b", r"\blaws?\b", r"\blegal(ly)?\b(?!\s+(advice|information|answers?|questions?))",
    r"\bpermi(ssion|t|tted|ssible)\b", r"\ballowed\b",
    r"\bapprov", r"\blicen[cs]", r"\bregist", r"\bpatent", r"\btrade ?mark", r"\bbrand\b", r"\bcopy(ing|right)?\b",
    r"\bcopied\b", r"\bprotect", r"\brights?\b", r"\bclaims?\b", r"\badverti", r"\bads?\b", r"\bsell(ing|ers?)?\b",
    r"\bsold\b", r"\bbusiness\b", r"\bcompan(y|ies)\b", r"\bcommercial", r"\bfirm\b", r"\bgi\b", r"\bgeographical\b",
    r"\bchallenge\b", r"\boppos", r"\brevok", r"\bcategory\b", r"\bclassif", r"\bcompliance\b", r"\bobligations?\b",
    r"\bexempt", r"\bshar(e|ing)\b", r"\btransfer\b", r"\bgovernment\b", r"\bauthority\b", r"\bboard\b",
    r"\bstop (others|other|people|anyone|someone|them|companies)\b",
    r"\bcan (i|we) (legally )?(give|send|share|transfer|sell|say|claim|call|label|register|manufacture)\b",
]

# Outside what this system covers even when a legal word is present: patenting
# unrelated technology, writing tasks, and another country's import or export rules.
OFF_TOPIC = [
    r"\bsemiconductor", r"\bcomputer\b", r"\bsoftware\b", r"\bmobile app\b", r"\bdrones?\b", r"\bbatter(y|ies)\b",
    r"\belectronic", r"\brobot",
    r"^\s*(please\s+)?(write|draft|compose|generate|create)\b",
    r"\b(import|export)\w*\b.*\b(japan|usa|us|america|uk|europe|eu|germany|canada|china|australia|uae|dubai|france|singapore)\b",
    r"\b(japan|usa|us|america|uk|europe|eu|germany|canada|china|australia|uae|dubai|france|singapore)\w*\b.*\b(import|export)\w*\b",
]

# Terms a layperson does not use. A question containing them was written by
# someone who knows the regime, so it is answered for every branch rather than
# interrupted with follow-up questions.
STATUTORY_TERMS = [
    r"\bprior intimation\b", r"\bstate biodiversity board\b", r"\bnational biodiversity authority\b",
    r"\bnba\b", r"\bsbb\b", r"\bbiological (resource|material)", r"\bbenefit[- ]sharing\b", r"\babs\b",
    r"\bsection \d", r"\brule \d", r"\bspecification\b", r"\bgeographical indication\b",
    r"\bfirst schedule\b", r"\bproprietary medicine\b", r"\bphytopharmaceutical\b", r"\bmere admixture\b",
    r"\bcommercial utili[sz]ation\b", r"\bpatents act\b", r"\bbiological diversity act\b",
    r"\bdrugs and cosmetics\b", r"\bcharaka samhita\b", r"\bayush practitioner\b",
]


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split())


def _any(patterns: List[str], text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t) for p in patterns)


def uses_statutory_terms(text: str) -> bool:
    return _any(STATUTORY_TERMS, text)


def asks_about_law(text: str) -> bool:
    return (_any(LEGAL_SIGNALS, text) or uses_statutory_terms(text)) and not _any(OFF_TOPIC, text)


@dataclass
class Recognition:
    """
    decision: "mapped" (one situation, confidently), "choice" (several equally
    close, offered to the person), or "none".
    """
    decision: str
    offered: List[str]
    ranked: List[Tuple[str, float]]
    reason: str


@dataclass
class IntentOutcome:
    """
    action is one of:
      "mapped"  the situation and its facts are known; search `retrieval_queries`
                and answer `question`.
      "ask"     a follow-up is needed; return `clarification` and store `pending`.
      "none"    no situation applies; carry on with `query` as before.
      "decline" none of the offered situations fitted a question that was
                already refused; return `answer_text` without searching again.
    """
    action: str
    query: str
    original_query: str = ""
    intent: Optional[Dict[str, Any]] = None
    slots: Dict[str, str] = field(default_factory=dict)
    question: str = ""
    retrieval_queries: List[str] = field(default_factory=list)
    clarification: Optional[Dict[str, Any]] = None
    answer_text: str = ""
    pending: Optional[Dict[str, Any]] = None
    trace: str = ""
    # Situations close enough to offer if the normal pipeline then abstains.
    suggestions: List[Tuple[str, float]] = field(default_factory=list)
    restated: bool = False


class IntentMapper:
    _matrix: Optional[np.ndarray] = None
    _labels: List[str] = []

    # ------------------------------------------------------------------
    # Recognition
    # ------------------------------------------------------------------

    @classmethod
    def available(cls) -> bool:
        """Only with the real embedding model. Hash-projection scores mean nothing."""
        return get_embedding_model() != "fallback"

    @classmethod
    def _index(cls) -> None:
        if cls._matrix is not None:
            return
        texts, labels = [], []
        for intent in INTENTS:
            for text in intent["examples"] + [intent["title"], intent["ask"]]:
                texts.append(text)
                labels.append(intent["id"])
        for text in OUT_OF_SCOPE_EXAMPLES:
            texts.append(text)
            labels.append(OUT_OF_SCOPE)
        cls._matrix = np.asarray(generate_batch_embeddings(texts), dtype=np.float32)
        cls._labels = labels
        log.info("[Intent] indexed %d phrasings across %d situations", len(texts), len(INTENTS))

    @classmethod
    def rank(cls, text: str) -> List[Tuple[str, float]]:
        """
        Every situation (and the out-of-scope class) scored by its closest
        phrasing's similarity, plus CUE_BOOST where its cue words appear.
        """
        cls._index()
        sims = cls._matrix @ np.asarray(generate_embedding(text), dtype=np.float32)
        best: Dict[str, float] = {}
        for label, sim in zip(cls._labels, sims):
            if sim > best.get(label, -1.0):
                best[label] = float(sim)
        for intent in INTENTS:
            if _any(intent.get("cues", []), text):
                best[intent["id"]] += CUE_BOOST
        return sorted(best.items(), key=lambda kv: kv[1], reverse=True)

    @classmethod
    def recognise(cls, text: str) -> Recognition:
        ranked = cls.rank(text)
        summary = ", ".join(f"{i}={s:.2f}" for i, s in ranked[:3])
        if not asks_about_law(text):
            return Recognition("none", [], ranked, f"Not a question about what the law requires or allows ({summary}).")

        top_id, top = ranked[0]
        if top_id == OUT_OF_SCOPE:
            return Recognition("none", [], ranked, f"Closest match is out of scope ({summary}).")

        runner_up = ranked[1][1] if len(ranked) > 1 else 0.0
        if top >= MATCH_THRESHOLD and top - runner_up >= MATCH_MARGIN:
            return Recognition(
                "mapped", [top_id], ranked,
                f"Recognised '{intent_by_id(top_id)['title']}' (score {top:.2f}; next closest {runner_up:.2f}).",
            )

        close = [i for i, s in ranked if i != OUT_OF_SCOPE and s >= top - CHOICE_BAND][:3]

        # The words someone uses settle a near-tie that similarity cannot. "Can
        # generic Sanskrit herb names be trademarked?" sits about as close to
        # using plants in a business as to protecting a brand name, but only one
        # of those situations is about a trademark. When exactly one of the close
        # situations has its cue words in the question, the person has named it.
        cued = [i for i in close if _any(intent_by_id(i).get("cues", []), text)]
        if top >= CHOICE_FLOOR and len(close) >= 2 and len(cued) == 1:
            chosen = cued[0]
            score = dict(ranked)[chosen]
            return Recognition(
                "mapped", [chosen], ranked,
                f"Recognised '{intent_by_id(chosen)['title']}' from the words used (score {score:.2f}; "
                f"close alternatives: {summary}).",
            )

        if top >= CHOICE_FLOOR and len(close) >= 2:
            return Recognition("choice", close, ranked, f"Several situations are about equally close ({summary}).")

        return Recognition("none", [], ranked, f"No situation matched closely enough ({summary}).")

    # ------------------------------------------------------------------
    # Facts
    # ------------------------------------------------------------------

    @staticmethod
    def parse_slots(intent: Dict[str, Any], text: str) -> Dict[str, str]:
        """
        Facts stated in the text. An option's exact label always counts (that is
        what a tapped option sends). Otherwise a fact is read only when exactly
        one option's keywords match: "Indian company with farmers" is left
        unread, and asked for, rather than guessed. "Not sure" is never read
        here; it is only accepted as the reply to the question it answers.
        """
        lowered, normed = (text or "").lower(), _norm(text)
        found: Dict[str, str] = {}
        for slot in intent["slots"]:
            by_label = [o["value"] for o in slot["options"] if _norm(o["label"]) == normed]
            if by_label:
                found[slot["name"]] = by_label[0]
                continue
            hits = {
                o["value"] for o in slot["options"]
                if o["value"] != "not_sure" and any(re.search(k, lowered) for k in o["keywords"])
            }
            if len(hits) == 1:
                found[slot["name"]] = hits.pop()
        return found

    @staticmethod
    def _answers_not_sure(slot: Dict[str, Any], text: str) -> bool:
        option = next((o for o in slot["options"] if o["value"] == "not_sure"), None)
        if option is None:
            return False
        lowered = (text or "").lower()
        return _norm(option["label"]) == _norm(text) or any(re.search(k, lowered) for k in option["keywords"])

    @staticmethod
    def missing_slots(intent: Dict[str, Any], slots: Dict[str, str]) -> List[Dict[str, Any]]:
        missing = []
        for slot in intent["slots"]:
            if slot["name"] in slots:
                continue
            condition = slot.get("required_if")
            if condition and not all(slots.get(k) in allowed for k, allowed in condition.items()):
                continue
            missing.append(slot)
        return missing

    @staticmethod
    def _chosen_options(intent: Dict[str, Any], slots: Dict[str, str]) -> List[Dict[str, Any]]:
        chosen = []
        for slot in intent["slots"]:
            option = next((o for o in slot["options"] if o["value"] == slots.get(slot["name"])), None)
            if option:
                chosen.append(option)
        return chosen

    @classmethod
    def restate(cls, intent: Dict[str, Any], slots: Dict[str, str]) -> str:
        facts = [o["fact"] for o in cls._chosen_options(intent, slots) if o.get("fact")]
        return " ".join(facts + [intent["ask"]])

    @classmethod
    def retrieval_queries(cls, intent: Dict[str, Any], slots: Dict[str, str]) -> List[str]:
        queries = list(intent.get("retrieval_queries", []))
        for option in cls._chosen_options(intent, slots):
            queries.extend(option.get("retrieval_queries", []))
        return list(dict.fromkeys(queries))

    @staticmethod
    def describe_slots(intent: Dict[str, Any], slots: Dict[str, str]) -> str:
        parts = []
        for slot in intent["slots"]:
            option = next((o for o in slot["options"] if o["value"] == slots.get(slot["name"])), None)
            if option:
                parts.append(f"{slot['name']} = {option['label']}")
        return "; ".join(parts) or "none needed"

    # ------------------------------------------------------------------
    # The conversation
    # ------------------------------------------------------------------

    @classmethod
    def resolve(
        cls, text: str, pending: Optional[Dict[str, Any]] = None, picked: Optional[Dict[str, Any]] = None
    ) -> IntentOutcome:
        """
        `picked` is the situation picker's selection ({"goal", "who", "uses"}).
        It is structured input and is mapped directly, with no recognition.
        """
        from_picker = cls._from_picker(text, picked)
        if from_picker is not None:
            return from_picker

        if not cls.available():
            return IntentOutcome(action="none", query=text)

        if pending:
            outcome = cls._continue(text, pending)
            if outcome is not None:
                return outcome
            # The reply was a new question rather than an answer. Start over.

        return cls._fresh(text)

    @classmethod
    def consumes_reply(cls, text: str, pending: Optional[Dict[str, Any]]) -> bool:
        """
        Whether `text` is plainly the answer to the follow-up question we asked:
        a tapped option, "none of these", a fact the question was after, or "not
        sure". Anything else ("what does prior intimation mean?", "hmm, why do
        you ask?") is left to the conversation step to understand.
        """
        if not pending:
            return False
        normed = _norm(text)
        if pending.get("kind") == "choose_intent":
            titles = [_norm(intent_by_id(i)["title"]) for i in pending.get("candidates", []) if intent_by_id(i)]
            return normed in titles or normed == _norm(NONE_OF_THESE_LABEL)
        intent = intent_by_id(pending.get("intent", ""))
        if intent is None:
            return False
        if cls.parse_slots(intent, text):
            return True
        asked = next((s for s in intent["slots"] if s["name"] == pending.get("slot")), None)
        return bool(asked and cls._answers_not_sure(asked, text))

    @staticmethod
    def clarification_for(pending: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        The options of the question still open, to show again after a reply
        that did not answer it ("hmm, why do you ask?"), so it can still be
        answered with a tap.
        """
        if not pending:
            return None
        if pending.get("kind") == "choose_intent":
            ids = [i for i in pending.get("candidates", []) if intent_by_id(i)]
            if not ids:
                return None
            return {
                "kind": "choose_intent",
                "question": "Which of these is closest to what you want to know?",
                "options": [{"value": i, "label": intent_by_id(i)["title"]} for i in ids]
                + [{"value": "none", "label": NONE_OF_THESE_LABEL}],
            }
        intent = intent_by_id(pending.get("intent", ""))
        slot = next((s for s in (intent or {}).get("slots", []) if s["name"] == pending.get("slot")), None)
        if not intent or not slot:
            return None
        return {
            "kind": "slot",
            "intent": intent["id"],
            "intent_title": intent["title"],
            "slot": slot["name"],
            "question": slot["question"],
            "options": [{"value": o["value"], "label": o["label"]} for o in slot["options"]],
        }

    @classmethod
    def reask(cls, pending: Optional[Dict[str, Any]]) -> Optional[IntentOutcome]:
        """
        The open question asked again, for a person who asked why we want to
        know. The reason given is the question's own reviewed "why" text, not
        something a model composed, because the reason is itself about the law.
        """
        clarification = cls.clarification_for(pending)
        if clarification is None:
            return None
        if clarification["kind"] == "choose_intent":
            why = "Each of these is covered by different rules, so the answer depends on which one you mean."
            fallback = f'If none of them fits, choose "{NONE_OF_THESE_LABEL}".'
        else:
            intent = intent_by_id(pending["intent"])
            slot = next(s for s in intent["slots"] if s["name"] == pending.get("slot"))
            why = slot["why"]
            fallback = "If you're not sure, choose \"I'm not sure\" and I'll cover each case."
        return IntentOutcome(
            action="ask",
            query=pending.get("original_query", ""),
            original_query=pending.get("original_query", ""),
            answer_text=f"Good question. {why}\n\n**{clarification['question']}**\n\n{fallback}",
            clarification=clarification,
            pending=pending,
            trace="Explained why we asked, and asked again.",
        )

    @classmethod
    def _from_picker(cls, text: str, picked: Optional[Dict[str, Any]]) -> Optional[IntentOutcome]:
        intent = intent_by_id(BUILDER_GOALS.get((picked or {}).get("goal"), ""))
        if intent is None:
            return None
        valid = {s["name"]: {o["value"] for o in s["options"]} for s in intent["slots"]}
        slots: Dict[str, str] = {}
        for group, choices in BUILDER_FACTS.items():
            for name, value in choices.get(picked.get(group), {}).items():
                if value in valid.get(name, ()):
                    slots[name] = value
        return cls._advance(
            intent, slots, original_query=text, asked=0, expert=False,
            trace=f"You described your situation with the picker: '{intent['title']}'.",
        )

    @classmethod
    def _fresh(cls, text: str) -> IntentOutcome:
        found = cls.recognise(text)

        if found.decision == "mapped":
            intent = intent_by_id(found.offered[0])
            return cls._advance(
                intent, cls.parse_slots(intent, text), original_query=text, asked=0,
                expert=uses_statutory_terms(text), trace=found.reason,
            )

        if found.decision == "choice":
            if len(text.split()) <= CHOICE_MAX_WORDS and not uses_statutory_terms(text):
                return cls._ask_which(text, found.offered, found.reason)
            scores = dict(found.ranked)
            return IntentOutcome(
                action="none", query=text, suggestions=[(i, scores[i]) for i in found.offered],
                trace=f"{found.reason} The question is detailed enough to search as written.",
            )

        # Kept in reserve: offered only if the ordinary pipeline then refuses.
        suggestions = []
        if asks_about_law(text):
            suggestions = [(i, s) for i, s in found.ranked if i != OUT_OF_SCOPE and s >= CHOICE_FLOOR][:3]
        return IntentOutcome(action="none", query=text, suggestions=suggestions, trace=found.reason)

    @classmethod
    def _continue(cls, text: str, pending: Dict[str, Any]) -> Optional[IntentOutcome]:
        original = pending.get("original_query") or text
        asked = int(pending.get("asked", 0))

        if pending.get("kind") == "choose_intent":
            if _norm(text) == _norm(NONE_OF_THESE_LABEL):
                if pending.get("after_refusal"):
                    # The question as asked has already been searched and refused;
                    # searching it again would only refuse it again.
                    return IntentOutcome(
                        action="decline", query=original, original_query=original,
                        answer_text=(
                            "Understood. It may help to describe your situation in a sentence or two: who you are "
                            "(for example a vaid, a farmer or a company), what you make or use, and what you want to "
                            "do with it (sell it, patent it, advertise it). You can also ask a human expert to review "
                            "your question."
                        ),
                        trace="None of the suggested situations fitted, and the question as asked was already refused.",
                    )
                return IntentOutcome(
                    action="none", query=original, original_query=original,
                    trace="None of the suggested situations fitted. Answering the question as asked.",
                )
            chosen = next(
                (intent_by_id(i) for i in pending.get("candidates", []) if _norm(intent_by_id(i)["title"]) == _norm(text)),
                None,
            )
            if chosen is None:
                return None
            return cls._advance(
                chosen, cls.parse_slots(chosen, original), original_query=original, asked=asked,
                expert=uses_statutory_terms(original), trace=f"You chose '{chosen['title']}'.",
            )

        intent = intent_by_id(pending.get("intent", ""))
        if intent is None:
            return None
        slots = dict(pending.get("slots") or {})
        asked_slot = next((s for s in intent["slots"] if s["name"] == pending.get("slot")), None)

        stated = cls.parse_slots(intent, text)
        if asked_slot and asked_slot["name"] not in stated and cls._answers_not_sure(asked_slot, text):
            stated[asked_slot["name"]] = "not_sure"

        if not stated:
            # Neither an option nor a recognisable fact. A reply that is plainly a
            # question of its own is treated as one; anything else is read as
            # "not sure", so the person is never stuck answering the same question.
            ranked = cls.rank(text)
            if ranked[0][0] != intent["id"] and ranked[0][1] >= MATCH_THRESHOLD and len(text.split()) >= 5:
                return None
            if asked_slot:
                stated[asked_slot["name"]] = "not_sure"

        slots.update(stated)
        return cls._advance(
            intent, slots, original_query=original, asked=asked, expert=False,
            trace=f"Your reply gave: {cls.describe_slots(intent, stated)}.",
        )

    @classmethod
    def _advance(cls, intent, slots, original_query, asked, expert, trace) -> IntentOutcome:
        missing = cls.missing_slots(intent, slots)
        if missing and not expert and asked < MAX_QUESTIONS:
            return cls._ask_slot(intent, slots, missing[0], original_query, asked, trace)

        # Answer every remaining branch rather than ask again.
        while missing:
            for slot in missing:
                slots[slot["name"]] = "not_sure"
            missing = cls.missing_slots(intent, slots)

        question = cls.restate(intent, slots)
        return IntentOutcome(
            action="mapped",
            query=question,
            original_query=original_query,
            intent=intent,
            slots=slots,
            question=question,
            retrieval_queries=cls.retrieval_queries(intent, slots),
            # A question already in the statute's terms is answered in its own words.
            restated=not expert,
            trace=f"{trace} Facts: {cls.describe_slots(intent, slots)}.",
        )

    @staticmethod
    def _ask_slot(intent, slots, slot, original_query, asked, trace) -> IntentOutcome:
        lines = []
        if asked == 0:
            lines.append(f"**It sounds like you are asking about: {intent['title']}.**\n")
            lines.append(f"{intent['explain']}\n")
        lines.append(f"**{slot['question']}**")
        lines.append(f"{slot['why']}\n")
        lines.append("Choose an option below, or reply in your own words.")

        options = [{"value": o["value"], "label": o["label"]} for o in slot["options"]]
        return IntentOutcome(
            action="ask",
            query=original_query,
            original_query=original_query,
            intent=intent,
            slots=slots,
            answer_text="\n".join(lines),
            clarification={
                "kind": "slot",
                "intent": intent["id"],
                "intent_title": intent["title"],
                "slot": slot["name"],
                "question": slot["question"],
                "options": options,
            },
            pending={
                "kind": "slot",
                "intent": intent["id"],
                "slot": slot["name"],
                "slots": slots,
                "original_query": original_query,
                "asked": asked + 1,
            },
            trace=f"{trace} Asking: {slot['question']}",
        )

    @staticmethod
    def _ask_which(text: str, close: List[str], reason: str) -> IntentOutcome:
        titles = [intent_by_id(i)["title"] for i in close]
        lines = [
            "Your question could be about more than one set of rules. **Which of these is closest to what you want to know?**\n",
            *[f"- {t}" for t in titles],
            "\nChoose one below, or ask again in your own words.",
        ]
        return IntentOutcome(
            action="ask",
            query=text,
            original_query=text,
            answer_text="\n".join(lines),
            clarification={
                "kind": "choose_intent",
                "question": "Which of these is closest to what you want to know?",
                "options": [{"value": i, "label": t} for i, t in zip(close, titles)]
                + [{"value": "none", "label": NONE_OF_THESE_LABEL}],
            },
            pending={"kind": "choose_intent", "candidates": close, "original_query": text, "asked": 1},
            trace=f"{reason} Asking which one is meant.",
        )

    @staticmethod
    def suggestion_prompt(original_query: str, suggestions: List[Tuple[str, float]]) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        """Offered with a refusal, so a question the system could not match is not a dead end."""
        titles = [intent_by_id(i)["title"] for i, _ in suggestions]
        text = (
            "\n\n**Were you asking about one of these?** Choosing one lets me ask the right follow-up questions."
        )
        clarification = {
            "kind": "choose_intent",
            "question": "Were you asking about one of these?",
            "options": [{"value": i, "label": t} for (i, _), t in zip(suggestions, titles)]
            + [{"value": "none", "label": NONE_OF_THESE_LABEL}],
        }
        pending = {
            "kind": "choose_intent",
            "candidates": [i for i, _ in suggestions],
            "original_query": original_query,
            "asked": 1,
            "after_refusal": True,
        }
        return text, clarification, pending
