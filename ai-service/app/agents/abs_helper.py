import re
from typing import Dict, Any

class ABSHelper:
    """
    ABS (Access and Benefit Sharing) Compliance Navigator under:
    - Biological Diversity Act, 2002 (as amended in 2023)
    - Biological Diversity Rules, 2004 & 2024
    - Nagoya Protocol on Access and Benefit Sharing
    """
    
    @classmethod
    def analyze_compliance(cls, query: str, formulation_state: Dict[str, Any] = None, user_type: str = "general") -> Dict[str, Any]:
        q = query.lower()
        state = formulation_state or {}
        
        has_bio_resource = any(k in q for k in ["plant", "herb", "extract", "seed", "root", "ashwagandha", "neem", "turmeric", "microbial", "animal source", "biological resource"]) or bool(state.get("ingredients"))
        is_patent_intent = any(k in q for k in ["patent", "commercialize", "commercial use", "ip application", "export", "file ip"])
        is_foreign = any(k in q for k in ["foreign", "nri", "multinational", "abroad", "export", "international company"])
        is_local_cultivator_or_vaidya = any(k in q for k in ["local cultivator", "farmer", "ayush practitioner", "vaidya", "hakim", "grower"])
        
        result = {
            "abs_applicable": False,
            "relevant_statutes": [
                "Biological Diversity Act 2002 (Amended 2023)",
                "Biological Diversity Rules 2024",
                "Nagoya Protocol on Access and Benefit Sharing"
            ],
            "statutory_provisions": [],
            "approval_body": "National Biodiversity Authority (NBA) / State Biodiversity Boards (SBB)",
            "required_forms": [],
            "exemptions_detected": [],
            "benefit_sharing_percentage": "0.1% to 0.5% of ex-factory annual gross sale for commercial utilization, or negotiated lump-sum upfront.",
            "guidance_summary": ""
        }
        
        if not has_bio_resource:
            result["guidance_summary"] = "No biological resources or traditional knowledge identified. ABS obligations under Biological Diversity Act are likely not triggered."
            return result
            
        result["abs_applicable"] = True
        
        # Check Section 6: IP Application with Indian Biological Resources
        if is_patent_intent:
            result["statutory_provisions"].append({
                "section": "Section 6(1) of Biological Diversity Act",
                "rule": "Prior approval of the National Biodiversity Authority (NBA) is mandatory before obtaining any intellectual property right inside or outside India based on biological resources or associated traditional knowledge obtained from India."
            })
            result["required_forms"].append("Form III (Application for obtaining IP Rights under BDA)")
            
        # Check Section 3 vs Section 7
        if is_foreign:
            result["statutory_provisions"].append({
                "section": "Section 3(1) & 3(2) of Biological Diversity Act",
                "rule": "Non-Indian citizens, non-residents, and foreign-controlled entities must obtain prior approval from the National Biodiversity Authority (NBA) via Form I before accessing any biological resource in India for research or commercial utilization."
            })
            result["required_forms"].append("Form I (Access for Foreign Entities / Research)")
        else:
            result["statutory_provisions"].append({
                "section": "Section 7 of Biological Diversity Act",
                "rule": "Indian entities and citizens utilizing biological resources for commercial utilization must give prior intimation to the concerned State Biodiversity Board (SBB) via Form A."
            })
            result["required_forms"].append("Form A (Prior Intimation to State Biodiversity Board)")
            
        # Check Exemptions (2023 Amendment)
        if is_local_cultivator_or_vaidya or state.get("is_classical_text_referenced"):
            result["exemptions_detected"].append("Under the 2023 Amendment to the Biological Diversity Act, registered AYUSH practitioners and codified traditional knowledge users are exempted from paying ABS fees, provided intimation requirements are adhered to.")
            result["exemptions_detected"].append("Local people and communities of the area, including growers and cultivators of biological resources, and vaids and hakims practicing indigenous medicine, are exempt from prior NBA/SBB approval under Section 7 proviso.")
            
        result["guidance_summary"] = (
            "Access to Indian biological resources triggers compliance under the Biological Diversity Act 2002/2023. "
            f"If applying for a patent, Section 6 requires mandatory prior approval from NBA ({', '.join(result['required_forms'])}). "
            + ("Exemptions may apply for registered local AYUSH practitioners under the 2023 amended provisions." if result["exemptions_detected"] else "")
        )
        
        return result
