"""
Rule-based formulation classification decision tree.

The team brief is explicit that this is deliberately NOT an AI classifier:
"a decision tree is deterministic, auditable, and explainable to a regulator.
An LLM guessing legal categories is none of those things."

The user answers a short sequence of questions and lands in exactly one of the
six regulatory categories. Every classification returns the full decision path
that produced it, so the reasoning can be audited step by step rather than
taken on trust.

The tree encodes the tests stated in brief section 4.1:

  Classical            both the formulation AND the method of preparation are
                       drawn from a text listed in the First Schedule
  Patent or Proprietary ingredients are from ASU texts, but the formulation as a
                       whole is not classical
  New / non-classical  makes a new therapeutic claim requiring proof of safety
                       and efficacy
  Phytopharmaceutical  a purified extract or fraction with defined marker
                       compounds and standardised composition
  Ayurveda-Aahar       sold as a food or supplement, recipe from recognised
                       authoritative books, no therapeutic claim
  Cosmetic             external application, no therapeutic claim

Statutory references named below are routing hints for retrieval and for the
user's orientation. They are NOT citations. Citations only ever come from the
RAG pipeline's verified evidence.
"""

from typing import Any, Dict, List, Optional, Tuple

# --------------------------------------------------------------------------
# Terminal categories
# --------------------------------------------------------------------------

CATEGORY_PROFILES: Dict[str, Dict[str, Any]] = {
    "classical": {
        "category": "Classical / Generic Medicine",
        "summary": (
            "Both the formulation and its method of preparation are drawn from a text listed in the "
            "First Schedule to the Drugs and Cosmetics Act, 1940. In law this is codified traditional knowledge."
        ),
        "regulatory": [
            "ASU manufacturing licence from the State AYUSH Licensing Authority.",
            "Schedule T Good Manufacturing Practice compliance.",
            "Exempt from fresh clinical trial data, because the classical text is the evidence base.",
        ],
        "ip_posture": {
            "patentability": (
                "Not patentable. The Section 3(p) traditional knowledge bar applies, and Section 3(e) "
                "additionally bars a mere admixture. The formulation itself is unprotectable."
            ),
            "trademark": (
                "Available for a distinctive brand name. The generic Sanskrit formulation name cannot be "
                "monopolised."
            ),
            "primary_route": "Trademark on the brand, plus trade secret on process parameters.",
        },
        "abs_posture": (
            "Codified traditional knowledge exemptions introduced by the 2023 amendment to the Biological "
            "Diversity Act may apply, and materially change the answer for registered AYUSH practitioners, "
            "growers and cultivators."
        ),
        "defensive_route": (
            "TKDL documentation is the defensive strategy. It is what patent examiners abroad search to "
            "refuse claims over Indian traditional knowledge."
        ),
        "retrieval_hints": ["Section 3(p)", "Section 3(e)", "First Schedule", "Schedule T"],
    },
    "proprietary": {
        "category": "Patent or Proprietary Medicine (P or P)",
        "summary": (
            "The ingredients come from ASU texts listed in the First Schedule, but the formulation as a "
            "whole, its ratio or its dosage form is not itself found in those texts."
        ),
        "regulatory": [
            "ASU licence with proof of safety, a higher bar than for a classical drug.",
            "Published literature or textual evidence for the traditional indication.",
        ],
        "ip_posture": {
            "patentability": (
                "Limited. Section 3(e) mere admixture is the main obstacle, and Section 3(p) may still bite. "
                "Overcoming them needs comparative data showing unexpected synergistic efficacy, not just a "
                "new ratio."
            ),
            "trademark": "Strong. A coined brand name is registrable.",
            "primary_route": "Trademark is usually the real protection, with trade secret on the process.",
        },
        "abs_posture": (
            "Obligations likely apply, depending on the source of the biological material and the status of "
            "the applicant."
        ),
        "defensive_route": (
            "Check TKDL and prior art before filing. If the combination is already documented, a patent "
            "application is likely to be refused and the filing cost wasted."
        ),
        "retrieval_hints": ["Section 3(e)", "Section 3(p)", "proprietary medicine licence"],
    },
    "new_drug": {
        "category": "New / Non-Classical Drug",
        "summary": (
            "The product makes a new therapeutic claim that the classical texts do not support, so it must "
            "prove safety and efficacy on its own evidence."
        ),
        "regulatory": [
            "New Drugs and Clinical Trials Rules, 2019 pathway.",
            "Clinical evidence required. This is the expensive and slow route.",
        ],
        "ip_posture": {
            "patentability": (
                "Genuine patent potential if the invention is novel and involves an inventive step, since the "
                "claim is not traditional knowledge."
            ),
            "trademark": "Available, and worth filing early alongside the patent.",
            "primary_route": "Patent is realistically available here, unlike the classical route.",
        },
        "abs_posture": (
            "National Biodiversity Authority approval is likely required in connection with an IP application "
            "where Indian biological resources were used. The 2023 amendment changed the timing so approval "
            "is required before grant rather than before filing."
        ),
        "defensive_route": "Freedom-to-operate and prior art search before committing to trial spend.",
        "retrieval_hints": ["new drug", "clinical trial", "Section 6", "Section 10(4)"],
    },
    "phytopharmaceutical": {
        "category": "Phytopharmaceutical",
        "summary": (
            "A purified extract or fraction of a medicinal plant with defined marker compounds and a "
            "standardised composition."
        ),
        "regulatory": [
            "Phytopharmaceutical pathway under the New Drugs and Clinical Trials Rules, 2019.",
            "A specific data package applies, including characterisation of the markers.",
        ],
        "ip_posture": {
            "patentability": (
                "Strong potential. Standardisation and characterisation can supply the novelty and inventive "
                "step that a whole-herb preparation cannot."
            ),
            "trademark": "Available under the pharmaceutical class.",
            "primary_route": "Patent on the composition or the process, with trade secret on extraction.",
        },
        "abs_posture": (
            "National Biodiversity Authority approval and benefit sharing are very likely engaged, because "
            "the product depends on the specific properties of an Indian biological resource."
        ),
        "defensive_route": "Document the extraction process and marker data from the start.",
        "retrieval_hints": ["phytopharmaceutical", "purified fraction", "marker", "Section 6"],
    },
    "ayurveda_aahar": {
        "category": "Ayurveda-Aahar / Nutraceutical",
        "summary": (
            "Sold as a food or supplement rather than a medicine, with the recipe drawn from recognised "
            "authoritative books, and making no therapeutic claim."
        ),
        "regulatory": [
            "FSSAI licence under the Ayurveda Aahara Regulations, 2022, not a drug licence.",
            "Strict claim restrictions. A therapeutic claim moves the product into the drug regime entirely.",
        ],
        "ip_posture": {
            "patentability": "Unlikely. Section 3(p) and Section 3(e) apply as they do to classical preparations.",
            "trademark": "The primary protection, alongside trade dress and packaging.",
            "primary_route": "Trademark and trade secret.",
        },
        "abs_posture": "Depends on the biological resource used and the status of the applicant.",
        "defensive_route": "Keep marketing copy audited. Claim drift is the most common enforcement trigger.",
        "retrieval_hints": ["Ayurveda Aahara", "FSSAI", "food", "claim restriction"],
    },
    "cosmetic": {
        "category": "Cosmetic",
        "summary": "Applied externally to the body for cleansing or beautifying, making no therapeutic claim.",
        "regulatory": [
            "Cosmetics Rules, 2020.",
            "A therapeutic claim would reclassify the product as a drug and change the entire pathway.",
        ],
        "ip_posture": {
            "patentability": (
                "Possible for a genuinely novel delivery base or stabilisation system, but not for the herbal "
                "combination itself."
            ),
            "trademark": "Primary protection, with design registration for the packaging.",
            "primary_route": "Trademark, design registration, and trade secret on the formulation.",
        },
        "abs_posture": "Applies where Indian biological resources are used.",
        "defensive_route": "Design registration on container and packaging shape.",
        "retrieval_hints": ["cosmetic", "external application", "Cosmetics Rules 2020"],
    },
}

# --------------------------------------------------------------------------
# The decision tree
# --------------------------------------------------------------------------
# Each node: question, help text, and options. An option either names the next
# node ("next") or a terminal category ("category"), never both.

TREE: Dict[str, Dict[str, Any]] = {
    "q_intended_use": {
        "id": "q_intended_use",
        "question": "How is the product presented to the buyer?",
        "help": (
            "This is the first fork because it decides which regulator you answer to. The same physical "
            "bottle can be a drug, a food or a cosmetic depending on how it is sold and what it claims."
        ),
        "options": [
            {
                "value": "therapeutic",
                "label": "As a medicine, to treat, prevent or manage a condition",
                "next": "q_purified_fraction",
            },
            {
                "value": "food",
                "label": "As a food, drink or dietary supplement, with no therapeutic claim",
                "next": "q_aahar_recipe_source",
            },
            {
                "value": "cosmetic",
                "label": "For external application to the body, for cleansing or beautifying only",
                "category": "cosmetic",
                "rule": "Cosmetics Rules, 2020 apply to products for external application making no therapeutic claim.",
            },
        ],
    },
    "q_aahar_recipe_source": {
        "id": "q_aahar_recipe_source",
        "question": "Is the recipe drawn from a recognised authoritative Ayurvedic book?",
        "help": (
            "The Ayurveda Aahara Regulations, 2022 require the recipe or its ingredients and processes to "
            "come from the authoritative books listed in the regulation's schedule. Without that, the product "
            "is an ordinary food or supplement and cannot use the Ayurveda Aahara category or its logo."
        ),
        "options": [
            {
                "value": "yes",
                "label": "Yes, from a recognised authoritative book",
                "category": "ayurveda_aahar",
                "rule": "Food prepared per a recognised authoritative Ayurvedic book, with no therapeutic claim, falls under the Ayurveda Aahara Regulations, 2022.",
            },
            {
                "value": "no",
                "label": "No, it is our own formulation",
                "category": "ayurveda_aahar",
                "rule": "Sold as a food with no therapeutic claim, so the FSSAI regime applies, but the Ayurveda Aahara category and logo require a recognised authoritative source. Verify eligibility before labelling.",
                "caveat": (
                    "Your product is regulated as a food, but it may not qualify for the Ayurveda Aahara "
                    "category specifically. Confirm this before using the Ayurveda Aahara logo."
                ),
            },
        ],
    },
    "q_purified_fraction": {
        "id": "q_purified_fraction",
        "question": "Is the product a purified extract or fraction with defined marker compounds and a standardised composition?",
        "help": (
            "This asks whether you have characterised and standardised the material, not merely whether you "
            "extracted it. A whole-herb powder or a simple decoction is not a purified fraction. This is the "
            "single question that most changes your patent prospects."
        ),
        "options": [
            {
                "value": "yes",
                "label": "Yes, a purified or standardised fraction with defined markers",
                "category": "phytopharmaceutical",
                "rule": "A purified and standardised fraction with defined marker compounds meets the phytopharmaceutical definition under the New Drugs and Clinical Trials Rules, 2019.",
            },
            {
                "value": "no",
                "label": "No, it is a whole-herb or multi-herb preparation",
                "next": "q_classical_source",
            },
        ],
    },
    "q_classical_source": {
        "id": "q_classical_source",
        "question": "Are BOTH the formulation and the method of preparation drawn from a text listed in the First Schedule?",
        "help": (
            "Both halves must be true. A classical recipe made by a modern process, or a modern recipe made "
            "by a classical process, is not a classical drug. This is the test the brief calls the entry "
            "point to the whole classification tree. First Schedule texts include the Charaka Samhita, "
            "Sushruta Samhita, Ashtanga Hridaya, Bhavaprakasha and Sharangadhara Samhita, among others."
        ),
        "options": [
            {
                "value": "both",
                "label": "Yes, both the formulation and the method are from a listed text",
                "category": "classical",
                "rule": "Formulation and method both drawn from a First Schedule text, so the product is a classical ASU medicine and is codified traditional knowledge.",
            },
            {
                "value": "partial_or_no",
                "label": "No. One of them differs, or the combination is our own",
                "next": "q_ingredients_source",
            },
        ],
    },
    "q_ingredients_source": {
        "id": "q_ingredients_source",
        "question": "Are all the individual ingredients drawn from ASU texts, even though the combination is not?",
        "help": (
            "This separates a proprietary medicine built from known ASU ingredients from a genuinely new "
            "drug. If you have introduced a plant or substance that is not recognised in the ASU texts, you "
            "are on the new drug route regardless of how the rest is composed."
        ),
        "options": [
            {
                "value": "yes",
                "label": "Yes, every ingredient is recognised in ASU texts",
                "next": "q_new_therapeutic_claim",
            },
            {
                "value": "no",
                "label": "No, it contains a plant or substance not recognised in ASU texts",
                "category": "new_drug",
                "rule": "An ingredient outside the ASU texts places the product on the new drug pathway, requiring its own safety and efficacy evidence.",
            },
        ],
    },
    "q_new_therapeutic_claim": {
        "id": "q_new_therapeutic_claim",
        "question": "Does the product make a therapeutic claim that the classical texts do not support?",
        "help": (
            "A claim the texts already support for those ingredients keeps you on the proprietary medicine "
            "route. A new indication requires proof on its own evidence, which is the new drug route. Claim "
            "wording alone can move a product between these two categories."
        ),
        "options": [
            {
                "value": "no",
                "label": "No, the indication is one the texts already support",
                "category": "proprietary",
                "rule": "ASU ingredients in a non-classical combination, claimed for a traditionally supported indication, is a patent or proprietary ASU medicine.",
            },
            {
                "value": "yes",
                "label": "Yes, we claim a new indication",
                "category": "new_drug",
                "rule": "A therapeutic claim beyond what the classical texts support requires proof of safety and efficacy under the New Drugs and Clinical Trials Rules, 2019.",
            },
        ],
    },
}

ROOT_NODE = "q_intended_use"


def get_tree() -> Dict[str, Any]:
    """The whole tree, for a client that wants to render it."""
    return {"root": ROOT_NODE, "nodes": TREE, "categories": CATEGORY_PROFILES}


def next_question(answers: List[Dict[str, str]]) -> Tuple[Optional[Dict[str, Any]], Optional[str], List[Dict[str, Any]]]:
    """
    Walk the tree with the answers given so far.

    Returns (next_question_or_None, terminal_category_key_or_None, decision_path).
    The decision path is the audit trail: which question was asked, which option
    was chosen, and which rule that choice applied.
    """
    path: List[Dict[str, Any]] = []
    node_id = ROOT_NODE
    answer_map = {a["node"]: a["value"] for a in answers if "node" in a and "value" in a}

    while True:
        node = TREE.get(node_id)
        if node is None:
            raise ValueError(f"Unknown decision node: {node_id}")

        chosen = answer_map.get(node_id)
        if chosen is None:
            # Nothing answered for this node yet, so this is the next question.
            return node, None, path

        option = next((o for o in node["options"] if o["value"] == chosen), None)
        if option is None:
            raise ValueError(f"Option '{chosen}' is not valid for node '{node_id}'")

        path.append({
            "node": node_id,
            "question": node["question"],
            "answer_value": option["value"],
            "answer_label": option["label"],
            "rule_applied": option.get("rule"),
            "caveat": option.get("caveat"),
        })

        if "category" in option:
            return None, option["category"], path
        node_id = option["next"]


def classify(answers: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Deterministically classify from a set of wizard answers.

    While the tree is incomplete this returns the next question. Once a terminal
    category is reached it returns the full profile plus the decision path.
    """
    question, category_key, path = next_question(answers)

    if question is not None:
        return {
            "complete": False,
            "next_question": question,
            "decision_path": path,
            "questions_answered": len(path),
        }

    profile = CATEGORY_PROFILES[category_key]
    caveats = [step["caveat"] for step in path if step.get("caveat")]

    return {
        "complete": True,
        "category_key": category_key,
        "category": profile["category"],
        "summary": profile["summary"],
        "regulatory_pathway": profile["regulatory"],
        "ip_posture": profile["ip_posture"],
        "abs_posture": profile["abs_posture"],
        "defensive_route": profile["defensive_route"],
        "retrieval_hints": profile["retrieval_hints"],
        "decision_path": path,
        "questions_answered": len(path),
        "caveats": caveats,
        "method": "rule_based_decision_tree",
        "disclaimer": (
            "This classification is produced by a deterministic decision tree, not by a language model. "
            "It is regulatory information, not legal advice. Statutory references shown here orient you to "
            "the applicable regime; verified citations come from the source-grounded answer."
        ),
    }
