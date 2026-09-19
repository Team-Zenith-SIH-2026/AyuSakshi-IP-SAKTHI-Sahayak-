import re
from typing import Dict, Any, List
from app.services.tkdl_service import TKDLService

class TKDLPointer:
    """
    Traditional Knowledge Digital Library (TKDL) and Prior-Art Pointer.
    Maps ingredients and formulation concepts to classical texts and defensive prior art.
    Integrates with TKDLService reference database lookup.
    """
    
    CLASSICAL_REFERENCES = {
        "triphala": {
            "sanskrit": "त्रिफला (Haritaki, Bibhitaki, Amalaki)",
            "texts": ["Charaka Samhita Chikitsasthana 1:2", "Sushruta Samhita Sutrasthana 38", "Ashtanga Hridaya Uttaratantra 40"],
            "known_indications": ["Rasayana (rejuvenation)", "Digestive health", "Ophthalmic disorders", "Antioxidant"],
            "prior_art_status": "Documented classical formulation with widespread public prior art across Indian systems of medicine."
        },
        "ashwagandha": {
            "sanskrit": "अश्वगंधा (Withania somnifera)",
            "texts": ["Charaka Samhita Sutrasthana 4", "Bhavaprakasha Nighantu Guduchyadi Varga", "Ayurvedic Pharmacopoeia of India Vol I"],
            "known_indications": ["Balya (strength promoting)", "Rasayana", "Vata disorders", "Stress and adaptogenic support"],
            "prior_art_status": "Extensively cataloged in TKDL with over 200 codified formulation entries."
        },
        "turmeric": {
            "sanskrit": "हरिद्रा (Curcuma longa)",
            "texts": ["Charaka Samhita Sutrasthana 2", "Sushruta Samhita Sutrasthana 38", "API Part I Vol I"],
            "known_indications": ["Vranaropana (wound healing)", "Kushthaghna (skin diseases)", "Anti-inflammatory"],
            "prior_art_status": "Landmark USPTO patent cancellation case (Patent No. 5,401,504 revoked in 1997 due to CSIR Indian prior art evidence)."
        },
        "neem": {
            "sanskrit": "निम्ब (Azadirachta indica)",
            "texts": ["Charaka Samhita Sutrasthana 27", "Sushruta Samhita Sutrasthana 46", "API Part I Vol II"],
            "known_indications": ["Krimighna (antimicrobial)", "Kandughna (anti-pruritic)", "Pitta-Kapha pacifier"],
            "prior_art_status": "Landmark EPO patent revocation (EP 0436257 B1 revoked in 2000 based on Indian traditional knowledge prior art)."
        },
        "brahmi": {
            "sanskrit": "ब्राह्मी (Bacopa monnieri)",
            "texts": ["Charaka Samhita Sharirasthana 8", "Ashtanga Hridaya Uttaratantra 1", "API Part I Vol II"],
            "known_indications": ["Medhya (cognitive booster)", "Smritiprada (memory enhancement)", "Ayushya"],
            "prior_art_status": "Documented in TKDL across multiple nervous system classical recipes."
        }
    }
    
    @classmethod
    def check_prior_art_overlap(cls, query: str, formulation_state: Dict[str, Any] = None) -> Dict[str, Any]:
        q = query.lower()
        state = formulation_state or {}
        
        # 1. Run TKDLService reference lookup for structured formulation / herb matches
        ingredient_ratios = state.get("ingredient_ratios", [])
        ingredients = state.get("ingredients", [])
        
        lookup_res = TKDLService.lookup_tkdl_matches(ingredient_ratios=ingredient_ratios, ingredients=ingredients)

        matched_herbs = []
        for herb_key, details in cls.CLASSICAL_REFERENCES.items():
            if herb_key in q or any(herb_key in str(ing).lower() for ing in ingredients):
                matched_herbs.append({"herb": herb_key, "details": details})

        has_flag = bool(lookup_res.get("tkdl_matches")) or bool(matched_herbs)

        if not has_flag:
            return {
                "tkdl_checked": True,
                "has_prior_art_flag": False,
                "exact_match_found": False,
                "patentability_status": lookup_res.get("patentability_status", "no_match"),
                "patent_risk_score": lookup_res.get("patent_risk_score", 0.0),
                "verdict": lookup_res.get("verdict", ""),
                "tkdl_matches": lookup_res.get("tkdl_matches", []),
                "tkdl_status": lookup_res.get("tkdl_status", "no_match"),
                "tkdl_disclaimer": lookup_res.get("tkdl_disclaimer", ""),
                "message": "No direct matches found with high-frequency TKDL classical database entries. Formal prior-art search across Indian Patent Office databases and TKDL is advised."
            }

        return {
            "tkdl_checked": True,
            "has_prior_art_flag": True,
            "exact_match_found": lookup_res.get("exact_match_found", False),
            "patentability_status": lookup_res.get("patentability_status", "potential_matches_found"),
            "patent_risk_score": lookup_res.get("patent_risk_score", 0.70),
            "verdict": lookup_res.get("verdict", ""),
            "matched_classical_records": matched_herbs,
            "tkdl_matches": lookup_res.get("tkdl_matches", []),
            "tkdl_status": lookup_res.get("tkdl_status", "potential_matches_found"),
            "tkdl_disclaimer": lookup_res.get("tkdl_disclaimer", ""),
            "statutory_note": (
                "Under Section 3(p) of the Indian Patents Act 1970, inventions based on traditional knowledge or aggregation of known properties are non-patentable. "
                "TKDL access agreements exist with EPO, USPTO, JPO, and WIPO allowing international examiners to cite these classical texts as Section 102/103 prior art."
            )
        }
