"""
Bhashini translation. Two things went wrong with the live service:

- The key we were given is a Dhruva inference key. The ULCA config endpoint
  rejects it ("Error in fetching ulcaApiKey"), and every translation fell back
  to the LLM, although Dhruva itself accepts the key.
- IndicTrans2 translates citations: "Section 3(p)" came back as "धारा 3 (पी)",
  which can no longer be checked against the Act.
"""
import asyncio
import json
import re

import httpx
import pytest

from app.multilingual import bhashini_service as module
from app.multilingual.bhashini_service import BhashiniService


def masked(text):
    lines, sources = BhashiniService._prepare(text)
    return " ".join(sources)


# --------------------------------------------------------------------------
# What is kept out of translation
# --------------------------------------------------------------------------

@pytest.mark.parametrize("text,kept", [
    ("Under Section 3(p) of the Patents Act, 1970, it is not an invention.", ["Section 3(p)", "Patents Act, 1970"]),
    ("See Sections 3(d) and 3(p).", ["Sections 3(d)", "3(p)"]),
    ("Apply to the National Biodiversity Authority in Form A.", ["National Biodiversity Authority", "Form A"]),
    ("Rule 161 of the Drugs and Cosmetics Rules, 1945 applies.", ["Rule 161", "Drugs and Cosmetics Rules, 1945"]),
    ("It is listed in the First Schedule.", ["First Schedule"]),
    ("The Food Safety and Standards (Ayurveda Aahara) Regulations, 2022 apply.",
     ["Food Safety and Standards (Ayurveda Aahara) Regulations, 2022"]),
])
def test_citations_are_swapped_for_markers(text, kept):
    lines, sources = BhashiniService._prepare(text)
    saved = lines[0]["saved"]
    assert saved == kept
    for value in kept:
        assert value not in " ".join(sources)


def test_the_word_that_introduces_a_law_is_still_translated():
    assert masked("Under the Patents Act, 1970 you cannot.").startswith("Under the {0}")
    assert masked("Under Biological Diversity Act, 2002 you must apply.").startswith("Under {0}")


def test_a_bare_mention_of_the_act_is_translated():
    assert masked("The Act requires approval.") == "The Act requires approval."


# --------------------------------------------------------------------------
# Putting the translation back together
# --------------------------------------------------------------------------

def fake_translate(sources):
    """Stands in for NMT: changes the words, keeps the markers where they are."""
    return [re.sub(r"[A-Za-z]+", "अ", s) for s in sources]


def test_citations_and_markdown_come_back_exactly():
    text = ("**Short answer**\n\n"
            "- Under **Section 3(p)** of the Patents Act, 1970, this is not an invention.\n"
            "- You must apply in Form A. Approval takes time.\n"
            "2. Ask a patent agent.")
    lines, sources = BhashiniService._prepare(text)
    out = BhashiniService._reassemble(lines, fake_translate(sources))
    rows = out.split("\n")
    assert rows[0].startswith("**") and rows[0].endswith("**")
    assert rows[1] == ""
    assert rows[2].startswith("- ") and "**Section 3(p)**" in rows[2] and "Patents Act, 1970" in rows[2]
    assert rows[3].startswith("- ") and "Form A" in rows[3]
    assert rows[4].startswith("2. ")


def test_a_lost_marker_rejects_the_translation():
    lines, sources = BhashiniService._prepare("Under Section 3(p) this is not an invention.")
    assert BhashiniService._reassemble(lines, [s.replace("{0}", "धारा 3 (पी)") for s in sources]) is None


def test_text_that_already_has_markers_is_not_sent():
    assert BhashiniService._prepare("Fill in {0} on the form.") is None


# --------------------------------------------------------------------------
# Which language the question is in
# --------------------------------------------------------------------------

@pytest.mark.parametrize("text,preferred,expected", [
    ("आयुर्वेदिक औषधाचे पेटंट मिळू शकते का?", "mr", "mr"),
    ("आयुर्वेदिक औषधाचे पेटंट मिळू शकते का?", "ta", "hi"),
    ("क्या मैं पेटेंट करा सकता हूँ?", None, "hi"),
    ("کیا میں پیٹنٹ کروا سکتا ہوں؟", None, "ur"),
    ("کیا میں پیٹنٹ کروا سکتا ہوں؟", "sd", "sd"),
    ("ଆୟୁର୍ବେଦିକ ଔଷଧର ପେଟେଣ୍ଟ ମିଳିପାରିବ କି?", None, "or"),
    ("Can I patent this?", "hi", "en"),
])
def test_language_of_the_question(text, preferred, expected):
    assert BhashiniService.detect_language(text, preferred=preferred) == expected


# --------------------------------------------------------------------------
# The live flow, against a stand-in server
# --------------------------------------------------------------------------

@pytest.fixture
def fresh_state(monkeypatch):
    monkeypatch.setattr(BhashiniService, "_pipeline_cache", {})
    monkeypatch.setattr(BhashiniService, "_translation_cache", {})
    monkeypatch.setattr(BhashiniService, "_throttle_until", 0.0)
    monkeypatch.setattr(BhashiniService, "_direct_until", 0.0)
    monkeypatch.setattr(module.settings, "BHASHINI_ENABLED", True)
    monkeypatch.setattr(module.settings, "BHASHINI_API_KEY", "inference-key")
    monkeypatch.setattr(module.settings, "BHASHINI_USER_ID", "user")


def serve(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(module.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


def test_an_inference_key_is_used_directly_when_the_config_endpoint_rejects_it(fresh_state, monkeypatch):
    seen = []

    def handler(request):
        seen.append(request)
        if "getModelsPipeline" in str(request.url):
            return httpx.Response(400, json={"message": "Error in fetching ulcaApiKey. Please check if it exists."})
        body = json.loads(request.content)
        sources = [i["source"] for i in body["inputData"]["input"]]
        return httpx.Response(200, json={"pipelineResponse": [{"output": [{"target": t} for t in fake_translate(sources)]}]})

    serve(monkeypatch, handler)

    async def no_llm(*a, **k):
        raise AssertionError("the LLM should not be needed")
    monkeypatch.setattr(module, "call_llm", no_llm)

    result = asyncio.run(BhashiniService.translate("Under Section 3(p) it is not an invention.", "en", "kok"))
    assert result["provider"] == "bhashini_live"
    assert "Section 3(p)" in result["translated_text"]
    inference = seen[-1]
    assert inference.headers["Authorization"] == "inference-key"
    task = json.loads(inference.content)["pipelineTasks"][0]["config"]
    assert task["language"]["targetLanguage"] == "gom"
    assert task["serviceId"] == BhashiniService.DEFAULT_SERVICE_ID


def test_a_translation_that_mangles_a_citation_goes_to_the_llm(fresh_state, monkeypatch):
    def handler(request):
        if "getModelsPipeline" in str(request.url):
            return httpx.Response(400, json={"message": "Error in fetching ulcaApiKey."})
        return httpx.Response(200, json={"pipelineResponse": [{"output": [{"target": "धारा 3 (पी) के तहत"}]}]})

    serve(monkeypatch, handler)

    async def llm(system, text):
        return "Section 3(p) के तहत", "stub"
    monkeypatch.setattr(module, "call_llm", llm)

    result = asyncio.run(BhashiniService.translate("Under Section 3(p).", "en", "hi"))
    assert result["provider"] == "llm:stub"
    assert "Section 3(p)" in result["translated_text"]
