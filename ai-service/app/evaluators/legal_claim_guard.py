"""
Catches legal statements in text that is not allowed to contain any.

The assistant may chat freely, but legal information must come only from the
verified-source pipeline, where every provision is checked against retrieved
statutory text. A conversational reply is written by a model that was shown no
statute, so any legal statement in it would be unverified. This guard runs over
every such reply and removes the sentences that make one.

It is a second line of defence, not the first: the model writing the reply is
already told never to state law. So it leans towards flagging. Removing a
harmless sentence costs a little fluency; letting through "you don't need NBA
approval" costs the whole point of the system.

What counts as a legal statement:
  - a provision reference: "Section 7", "Rule 158-B", "Article 6", "Form I"
  - a legal status: "is patentable", "can't be patented", "is exempt", "is illegal"
  - an obligation or permission about a legal act: "you must register",
    "you need NBA approval", "you don't need a licence", "you're allowed to sell"
  - a statement framed in a named law: "under the Patents Act", "in the First Schedule"
  - what something legally is: "is covered by the licensing rules", "is defined as"
Naming a topic ("I can help with patents and biodiversity approvals") is not one.
"""

import re
from typing import List, Tuple

from app.evaluators.citation_verifier import CITATION_PATTERN

_FORM_REFERENCE = re.compile(r"\bForm\s+[0-9IVX]+[A-Z]?\b")

_LEGAL_STATUS = re.compile(
    r"\b(is|are|isn't|aren't|is not|are not|cannot be|can't be|can not be|can be|could be|would be|will be|"
    r"won't be|may be|might be|would not be|wouldn't be|becomes?|remains?)\s+(not\s+)?"
    r"(patentable|patented|exempt(ed)?|illegal|unlawful|lawful|legal|prohibited|banned|allowed|permitted|"
    r"required|mandatory|compulsory|registrable|trademarkable|protectable|infringing|an infringement|"
    r"an invention|traditional knowledge|a mere admixture)\b"
    # "Answers are not legal advice" describes the answer, not the law.
    r"(?!\s+(advice|information|text|texts|sources?|questions?|documents?|help|guidance|matters?|topics?|"
    r"experts?|professionals?|opinions?))",
    re.IGNORECASE,
)

_OBLIGATION = re.compile(
    r"\b(you|you'll|you'd|they|one|we|companies|a company|businesses|a business|applicants?|manufacturers?|"
    r"sellers?|practitioners?|vaids?|growers?|farmers?|everyone|nobody|no one)\s+"
    r"(must|must not|need to|needs to|need|needs|have to|has to|had to|are required to|is required to|"
    r"should|shall|will need|would need|are obliged to|are allowed to|is allowed to|are not allowed to|"
    r"cannot|can't|can not|may not|may|can|do not need|don't need|does not need|doesn't need|"
    r"do not have to|don't have to|are exempt|is exempt|are free to|are entitled to)\b"
    # "You can ask me about patents" is an invitation, not a permission.
    r"(?!\s+(ask|tell|type|choose|pick|tap|try|share|describe|say|write|send|reply|see|find|talk|contact|"
    r"request|use|explore|learn|read|start|continue|click|select|want|wish|like|consult|speak|reach|"
    r"rephrase|give me|let me)\b)",
    re.IGNORECASE,
)

_LEGAL_ACT_WORDS = re.compile(
    r"\b(approv\w*|permission|permit|licen[cs]\w*|regist\w*|intimat\w*|patent\w*|trade ?mark\w*|copyright\w*|"
    r"nba|sbb|biodiversity board|biodiversity authority|authority|benefit[- ]sharing|royalt\w*|fee|"
    r"certificate|exempt\w*|compl(y|iance)|legal(ly)?|illegal\w*|law|laws|prohibit\w*|penalt\w*|fine[ds]?|"
    r"offen[cs]e|disclos\w*|advertis\w*|claim that|geographical indication|gi tag|fssai|clearance|consent)\b",
    re.IGNORECASE,
)

# The law's name must be capitalised ("the Patents Act", "the Drugs and Cosmetics
# Act"), the words before it need not be.
_LAW_NAME = (
    r"(?:(?:[A-Z][\w'(),]*|and|of|&)\s){0,8}"
    r"(?:Act|Rules|Regulations|Protocol|Treaty|Convention|Agreement|Amendment)\b"
)
_UNDER_A_LAW = re.compile(r"\b(?i:under|according to|as per|per|by)\s(?i:the\s)?" + _LAW_NAME)

_SCHEDULE_REFERENCE = re.compile(
    r"\b(First|Second|Third|Fourth|Fifth|Sixth|[IVX]+)\s+Schedule\b|\bSchedule\s+([A-Z0-9]{1,3}|[IVX]+)\b"
)

# What something legally is or which rules cover it: "is defined as", "is covered
# by specific rules", "is treated as a separate category for licensing". Seen when
# a chat reply retold an earlier cited answer without its citations.
_LEGAL_DESCRIPTION = re.compile(
    r"\b(defined (as|in|under|by)|means any|covered by|governed by|regulated by|listed in|classified as|"
    r"treated as|falls? (under|into|within)|comes? under|categori[sz]ed as)\b",
    re.IGNORECASE,
)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def _sentences(text: str) -> List[str]:
    return [s for s in _SENTENCE_SPLIT.split(text or "") if s.strip()]


def legal_statements(text: str) -> List[str]:
    """The sentences in `text` that state something legal."""
    flagged = []
    for sentence in _sentences(text):
        if (
            CITATION_PATTERN.search(sentence)
            or _FORM_REFERENCE.search(sentence)
            or _LEGAL_STATUS.search(sentence)
            or _UNDER_A_LAW.search(sentence)
            or _SCHEDULE_REFERENCE.search(sentence)
            or (_OBLIGATION.search(sentence) and _LEGAL_ACT_WORDS.search(sentence))
            or (_LEGAL_DESCRIPTION.search(sentence) and (_LEGAL_ACT_WORDS.search(sentence) or re.search(_LAW_NAME, sentence)))
        ):
            flagged.append(sentence.strip())
    return flagged


def remove_legal_statements(text: str) -> Tuple[str, List[str]]:
    """
    `text` without its legal statements, and the statements removed.

    Sentences are dropped whole. Line structure is kept where nothing was
    removed from a line, so a short list still reads as a list.
    """
    removed: List[str] = []
    kept_lines = []
    for line in (text or "").split("\n"):
        kept = []
        for sentence in re.split(r"(?<=[.!?])\s+", line):
            if not sentence.strip():
                continue
            if legal_statements(sentence):
                removed.append(sentence.strip())
            else:
                kept.append(sentence)
        if kept:
            kept_lines.append(" ".join(kept))
        elif not line.strip():
            kept_lines.append("")
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(kept_lines)).strip()
    return cleaned, removed


_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?%?")


def unsupported_numbers(text: str, *sources: str) -> List[str]:
    """
    Numbers in `text` that appear in none of `sources`.

    A reply about the assistant itself may only quote figures from its fact
    sheet (or ones the person used). "It is 99% accurate" is exactly the kind of
    claim a model produces fluently and nobody can check afterwards.
    """
    allowed = set()
    for source in sources:
        allowed.update(n.rstrip("%") for n in _NUMBER.findall(source or ""))
    return [n for n in _NUMBER.findall(text or "") if n.rstrip("%") not in allowed]
