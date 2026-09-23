"""
The full text of the core laws is split into one passage per provision. A
wrong label is the worst failure here: citation verification checks labels, so
a passage filed under the wrong section would let a wrong citation through.
These tests pin the cases that went wrong while the parser was built.
"""
import os
import re

import pytest

from app.core.fulltext import SOURCE_DIR, build_passages, manifest_entries
from app.core.statute_parser import split_long

ENTRIES = {e["title"]: e for e in manifest_entries()}
have_sources = pytest.mark.skipif(
    not ENTRIES or not all(os.path.exists(os.path.join(SOURCE_DIR, e["file"])) for e in ENTRIES.values()),
    reason="source PDFs not available",
)

_cache = {}


def passages(title):
    if title not in _cache:
        _cache[title] = build_passages(ENTRIES[title])
    return _cache[title]


def text_of(title, label):
    found = [p["content"] for p in passages(title)
             if p["section_identifier"] == label or p["section_identifier"].startswith(label + "(")]
    return re.sub(r"\s+", " ", " ".join(found)).lower()


def numbers(title):
    return [int(re.match(r"\w+ (\d+)", p["section_identifier"]).group(1))
            for p in passages(title) if re.match(r"\w+ \d+", p["section_identifier"])]


# --------------------------------------------------------------------------
# Real files
# --------------------------------------------------------------------------

@have_sources
@pytest.mark.parametrize("title,label,words", [
    ("The Patents Act, 1970", "Section 3(p)", "traditional knowledge"),
    ("The Patents Act, 1970", "Section 3(e)", "mere admixture"),
    ("The Patents Act, 1970", "Section 25(1)(k)", "anticipated"),
    ("The Patents Act, 1970", "Section 39", "outside india"),
    ("The Patents Act, 1970", "Section 64(1)(q)", "knowledge"),
    ("The Trade Marks Act, 1999", "Section 2(1)(zb)", "graphically"),
    ("The Trade Marks Act, 1999", "Section 9", "designate the kind"),
    ("The Geographical Indications of Goods (Registration and Protection) Act, 1999", "Section 9", "shall not be registered"),
    ("The Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954", "Schedule", "diabetes"),
    ("The Drugs and Cosmetics Act, 1940", "Section 33E", "misbranded"),
    ("The Drugs and Cosmetics Act, 1940", "First Schedule", "charaka"),
    ("The Drugs and Cosmetics Rules, 1945", "Rule 161", "label"),
    ("Food Safety and Standards (Ayurveda Aahara) Regulations, 2022", "Regulation 8", "claim"),
    ("Food Safety and Standards (Ayurveda Aahara) Regulations, 2022", "Schedule A", "charak samhita"),
])
def test_provision_text_is_filed_under_its_own_label(title, label, words):
    assert words in text_of(title, label)


@have_sources
@pytest.mark.parametrize("title", list(ENTRIES))
def test_section_numbers_only_go_forward(title):
    """An amendment footnote numbered "1." after section 23 would show up as a step back."""
    nums = numbers(title)
    assert nums, title
    assert all(b >= a for a, b in zip(nums, nums[1:])), title


@have_sources
def test_every_passage_fits_a_prompt():
    for title in ENTRIES:
        assert max(len(p["content"]) for p in passages(title)) <= 2400, title


@have_sources
def test_the_ayurveda_chapter_set_in_smaller_type_is_kept():
    labels = {p["section_identifier"].split("(")[0] for p in passages("The Drugs and Cosmetics Act, 1940")}
    assert {"Section 33D", "Section 33E", "Section 33EEC"} <= labels


@have_sources
def test_schedules_do_not_leak_into_the_last_section():
    assert "pharmacopoeia" not in text_of("The Drugs and Cosmetics Act, 1940", "Section 38")
    dmr = set(numbers("The Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954"))
    assert dmr == set(range(1, 17))


@have_sources
def test_repealed_sections_are_not_invented():
    assert not {95, 96, 97, 98} & set(numbers("The Patents Act, 1970"))


@have_sources
def test_a_regulation_number_repeated_across_pages_is_not_taken_for_a_header():
    regs = set(numbers("Food Safety and Standards (Ayurveda Aahara) Regulations, 2022"))
    assert {4, 5} <= regs and max(regs) == 14


# --------------------------------------------------------------------------
# Splitting long sections, on made-up text
# --------------------------------------------------------------------------

def _section(content, label="Section 7"):
    return {"section_identifier": label, "title": "", "content": content, "page_number": 1}


def test_a_first_sub_section_on_the_heading_line_is_found():
    body = "7. Opposition.—(1) Where a thing happens,—\n(a) " + "x " * 700 + "\n(b) " + "y " * 700 + "\n(2) The rest " + "z " * 300
    labels = [p["section_identifier"] for p in split_long(_section(body))]
    assert labels[:2] == ["Section 7(1)(a)", "Section 7(1)(b)"] and "Section 7(2)" in labels


def test_a_roman_sub_item_is_not_taken_for_a_clause():
    body = ("7. Things.—The following are things,—\n(a) first " + "x " * 600 +
            "\n(b) second, namely:—\n(i) " + "i " * 300 + "\n(ii) " + "j " * 300 + "\n(c) third " + "y " * 600)
    labels = [p["section_identifier"] for p in split_long(_section(body))]
    assert "Section 7(ii)" not in labels and "Section 7(i)" not in labels
    assert "Section 7(c)" in labels


def test_a_clause_keeps_the_words_that_give_it_meaning():
    body = "3. What are not inventions.—The following are not inventions,—\n(a) " + "x " * 800 + "\n(b) an invention which is traditional knowledge " + "y " * 800
    parts = {p["section_identifier"]: p["content"] for p in split_long(_section(body, "Section 3"))}
    assert parts["Section 3(b)"].startswith("3. What are not inventions")
    assert "… (b) an invention which is traditional knowledge" in parts["Section 3(b)"]
