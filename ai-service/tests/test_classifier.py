import pytest
from app.agents.formulation_classifier import FormulationClassifier

def test_classical_formulation_classification():
    text = "Our formulation is prepared strictly according to the classical text Charaka Samhita Chikitsasthana as a classical Triphala Churna generic medicine."
    res = FormulationClassifier.classify(text)
    assert res["category"] == "Classical / Generic Medicine"
    assert "Section 3(p)" in res["ip_posture"]["patentability"]
    assert res["abs_relevant"] is True

def test_phytopharmaceutical_classification():
    text = "We isolated and standardized a purified fraction containing four bioactive analytical markers from Withania somnifera."
    res = FormulationClassifier.classify(text)
    assert res["category"] == "Phytopharmaceutical"
    assert "Schedule Y" in res["regulatory_pathway"]
    assert res["confidence"] >= 0.85

def test_ayurveda_aahar_classification():
    text = "This is an Ayurveda Aahar food dietary supplement beverage complying with FSSAI regulations."
    res = FormulationClassifier.classify(text)
    assert res["category"] == "Ayurveda-Aahar / Nutraceutical"
    assert "FSSAI" in res["regulatory_pathway"]

def test_cosmetic_classification():
    text = "Herbal face cream and cleansing hair oil for external beauty application."
    res = FormulationClassifier.classify(text)
    assert res["category"] == "Cosmetic"
    assert "Class 3" in res["ip_posture"]["trademark"]

def test_minimal_clarifying_question():
    text = "I have a new formula."
    res = FormulationClassifier.classify(text)
    assert res["clarifying_question_needed"] is True
    assert "classical" in res["clarifying_question"].lower()
