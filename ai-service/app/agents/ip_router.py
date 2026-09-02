import re
from typing import List, Dict, Any

class IPRouter:
    """
    Determines relevant IP and regulatory domains based on query semantics and statutory terminology.
    """
    
    IP_DOMAINS = {
        "patents": ["patent", "patentable", "patentability", "section 3(p)", "section 3(d)", "section 3(e)", "novelty", "prior art", "inventive step", "pct", "wipo", "specification", "claims"],
        "biodiversity_abs": ["abs", "biodiversity", "biological resource", "national biodiversity authority", "nba", "sbb", "state biodiversity board", "benefit sharing", "nagoya", "form a", "form i", "bda 2002", "bda 2023", "exemption"],
        "trademarks": ["trademark", "trade mark", "brand name", "logo", "class 5", "class 3", "class 30", "brand registration", "infringement", "madrid system", "deceptive similarity"],
        "geographical_indications": ["gi", "geographical indication", "terroir", "origin", "darjeeling", "kashmiri saffron", "malabar pepper", "gi registry"],
        "plant_variety": ["ppvfr", "plant variety", "farmer right", "breeder", "dus test", "seed", "cultivar", "botanical variety"],
        "designs": ["design", "bottle", "packaging", "applicator", "aesthetic shape", "industrial design", "hague agreement", "ornamental"],
        "trade_secrets": ["trade secret", "confidential formula", "undisclosed information", "nda", "proprietary method", "know-how"],
        "copyright": ["copyright", "manuscript", "database", "classical compilation", "software", "literary work"],
        "ayush_regulatory": ["ayush", "drugs and cosmetics", "classical text", "license", "form 25d", "form 32a", "first schedule", "phytopharmaceutical", "schedule y", "cdsco", "adulteration"],
        "fssai_aahar": ["fssai", "ayurveda aahar", "nutraceutical", "food safety", "dietary supplement", "food license"]
    }
    
    @classmethod
    def route_query(cls, query: str, jurisdiction: str = "india") -> List[str]:
        query_lower = query.lower()
        matched_domains = []
        
        for domain, keywords in cls.IP_DOMAINS.items():
            if any(re.search(rf'\b{re.escape(kw)}\b', query_lower) for kw in keywords):
                matched_domains.append(domain)
                
        # Defaults if general IP question
        if not matched_domains:
            if "protect" in query_lower or "ip" in query_lower or "formulation" in query_lower:
                matched_domains = ["patents", "trademarks", "biodiversity_abs", "ayush_regulatory"]
            else:
                matched_domains = ["patents", "ayush_regulatory"]
                
        return matched_domains
