import re
from typing import Dict, Any, List

class TKDLPointer:
    """
    Traditional Knowledge Digital Library (TKDL) and Prior-Art Pointer.
    Maps ingredients and formulation concepts to classical texts and defensive prior art.
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
        
        matched_herbs = []
        for herb_key, details in cls.CLASSICAL_REFERENCES.items():
            if herb_key in q or any(herb_key in ing.lower() for ing in state.get("ingredients", [])):
                matched_herbs.append({"herb": herb_key, "details": details})
                
        if not matched_herbs:
            return {
                "tkdl_checked": True,
                "has_prior_art_flag": False,
                "message": "No direct matches found with high-frequency TKDL classical database entries. Formal prior-art search across Indian Patent Office databases and TKDL is advised."
            }
            
        return {
            "tkdl_checked": True,
            "has_prior_art_flag": True,
            "matched_classical_records": matched_herbs,
            "statutory_note": (
                "Under Section 3(p) of the Indian Patents Act 1970, inventions based on traditional knowledge or aggregation of known properties are non-patentable. "
                "TKDL access agreements exist with EPO, USPTO, JPO, and WIPO allowing international examiners to cite these classical texts as Section 102/103 prior art."
            )
        }
