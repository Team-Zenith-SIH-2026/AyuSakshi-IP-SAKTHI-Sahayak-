import re
from typing import List, Dict, Any, Tuple, Optional

HERB_ALIASES: Dict[str, str] = {
    "ashwaganda": "ashwagandha",
    "ashwagandha": "ashwagandha",
    "ahwagandha": "ashwagandha",
    "ahwaganda": "ashwagandha",
    "asvagandha": "ashwagandha",
    "withania somnifera": "ashwagandha",
    "haldi": "turmeric",
    "turmeric": "turmeric",
    "curcuma longa": "turmeric",
    "curcumin": "curcumin",
    "neem": "neem",
    "azadirachta indica": "neem",
    "nimba": "neem",
    "tulsi": "tulsi",
    "holy basil": "tulsi",
    "ocimum sanctum": "tulsi",
    "triphala": "triphala",
    "brahmi": "brahmi",
    "bacopa monnieri": "brahmi",
    "guggulu": "guggulu",
    "guggul": "guggulu",
    "commiphora mukul": "guggulu",
    "shatavari": "shatavari",
    "asparagus racemosus": "shatavari",
    "amla": "amla",
    "amalaki": "amla",
    "emblica officinalis": "amla",
    "haritaki": "haritaki",
    "terminalia chebula": "haritaki",
}

PATENT_KEYWORDS = [
    r"\bpatent\b",
    r"\bpatented\b",
    r"\bpatentability\b",
    r"\bcan i patent\b",
    r"\binvention\b",
    r"\binventive step\b",
    r"\bnovelty\b",
    r"\bprior art\b",
    r"\bprotect my formula\b",
    r"\bprotect my product\b",
    r"\bprotect my invention\b",
    r"\bintellectual property\b",
]

class ConversationMemory:
    """
    Tracks multi-turn dialogue context, maintains stateful formulation properties,
    extracts ingredient ratios, validates totals, and reformulates follow-up queries.
    """

    @staticmethod
    def normalize_herb_name(raw_name: str) -> Optional[str]:
        cleaned = raw_name.strip().lower()
        if cleaned in HERB_ALIASES:
            return HERB_ALIASES[cleaned]
        for alias, canonical in HERB_ALIASES.items():
            if alias in cleaned:
                return canonical
        return None

    @classmethod
    def extract_ingredient_ratios(cls, text: str) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Extracts canonical herb names and structured ratios from various text formats:
        - "10% ashwaganda + 90% turmeric"
        - "10 percent ashwagandha and 90 percent turmeric"
        - "ashwagandha 10%, turmeric 90%"
        - "10:90 ashwagandha turmeric"
        - "10% Ashwaganda + 90% Haldi"
        """
        t = text.lower()
        found_ratios: List[Dict[str, Any]] = []
        found_herbs_set = set()

        # 1. Ratio notation e.g., "10:90 ashwagandha turmeric" or "10 : 90 ashwaganda haldi"
        ratio_colon_pattern = re.finditer(
            r'(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s+([a-z\s]+?)\s+([a-z\s]+?)(?=[.,;!?]|$)',
            t
        )
        for match in ratio_colon_pattern:
            pct1 = float(match.group(1))
            pct2 = float(match.group(2))
            h1_raw = match.group(3).strip()
            h2_raw = match.group(4).strip()
            c1 = cls.normalize_herb_name(h1_raw)
            c2 = cls.normalize_herb_name(h2_raw)
            if c1:
                found_ratios.append({"name": c1, "percentage": pct1})
                found_herbs_set.add(c1)
            if c2:
                found_ratios.append({"name": c2, "percentage": pct2})
                found_herbs_set.add(c2)

        if not found_ratios:
            # 2. Percentage before herb e.g. "10% ashwaganda", "90 percent turmeric", "12.5% neem"
            pct_before_pattern = re.finditer(
                r'(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:of\s+)?([a-z\s]+?)(?=[+,;.]|\s+and\s+|\s+\d+|$)',
                t
            )
            for match in pct_before_pattern:
                pct = float(match.group(1))
                h_raw = match.group(2).strip()
                c = cls.normalize_herb_name(h_raw)
                if c and not any(r["name"] == c for r in found_ratios):
                    found_ratios.append({"name": c, "percentage": pct})
                    found_herbs_set.add(c)

        if not found_ratios:
            # 3. Herb before percentage e.g. "ashwagandha 10%", "turmeric 90%"
            herb_before_pattern = re.finditer(
                r'([a-z\s]+?)\s*(?:at\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)',
                t
            )
            for match in herb_before_pattern:
                h_raw = match.group(1).strip()
                pct = float(match.group(2))
                c = cls.normalize_herb_name(h_raw)
                if c and not any(r["name"] == c for r in found_ratios):
                    found_ratios.append({"name": c, "percentage": pct})
                    found_herbs_set.add(c)

        # Extract plain herb mentions even if no percentages provided
        for alias, canonical in HERB_ALIASES.items():
            if re.search(rf'\b{re.escape(alias)}\b', t):
                found_herbs_set.add(canonical)

        return list(found_herbs_set), found_ratios

    @classmethod
    def detect_patent_intent(cls, text: str) -> Tuple[bool, Optional[str]]:
        t = text.lower()
        if any(re.search(kw, t) for kw in PATENT_KEYWORDS):
            return True, "patentability"
        return False, None

    @staticmethod
    def reformulate_query(query: str, history: List[Dict[str, Any]], formulation_state: Dict[str, Any]) -> str:
        """
        Reformulates pronouns ('it', 'this formulation', 'that drug') into a self-contained search query.
        """
        query_lower = query.lower().strip()
        
        # Check if formulation context is present
        form_category = formulation_state.get("category", "")
        form_name = formulation_state.get("name", "")
        form_ingredients = formulation_state.get("ingredients", [])
        
        # Pronouns and references that indicate contextual dependency
        pronoun_triggers = ["it", "this", "these", "that", "the formulation", "the drug", "can i patent", "what about abs", "its ip"]
        has_pronoun = any(re.search(rf'\b{p}\b', query_lower) for p in pronoun_triggers)
        
        reformulated = query
        
        # If query is very short or contains pronouns, contextualize with history
        if has_pronoun or len(query.split()) < 4:
            context_additions = []
            if form_name:
                context_additions.append(form_name)
            elif form_category:
                context_additions.append(f"{form_category} Ayurvedic formulation")
            elif form_ingredients:
                context_additions.append(", ".join(form_ingredients[:3]))
                
            # If no direct formulation state, pull from the last user message in history
            if not context_additions and history:
                for msg in reversed(history):
                    if msg.get("sender") == "user":
                        prev_text = msg.get("content", "")
                        # Extract potential nouns
                        nouns = re.findall(r'\b(?:[A-Z][a-z]+|[a-z]+(?:ghrita|taila|churna|rasa|vati|bhasma|extract|herbal))\b', prev_text, re.IGNORECASE)
                        if nouns:
                            context_additions.extend(nouns[:2])
                            break
                            
            if context_additions:
                reformulated = f"{query} (Context: {' '.join(context_additions)})"
                
        return reformulated

    @classmethod
    def update_formulation_state(cls, current_state: Dict[str, Any], query: str, assistant_response: str) -> Dict[str, Any]:
        """
        Incrementally updates formulation properties discovered in the ongoing conversation.
        """
        state = dict(current_state or {})
        text = f"{query} {assistant_response}".lower()
        
        # 1. Patent Intent Detection
        is_patent, patent_intent_name = cls.detect_patent_intent(query)
        if is_patent:
            state["patent_query"] = True
            state["patent_intent"] = patent_intent_name
        elif "patent_query" not in state:
            state["patent_query"] = False

        # 2. Extract herbs and ingredient ratios
        found_herbs, ingredient_ratios = cls.extract_ingredient_ratios(query)
        
        if found_herbs:
            existing_herbs = list(state.get("ingredients", []))
            for herb in found_herbs:
                if herb not in existing_herbs:
                    existing_herbs.append(herb)
            state["ingredients"] = existing_herbs

        if ingredient_ratios:
            existing_ratios = list(state.get("ingredient_ratios", []))
            # Merge or update existing ratios
            ratio_map = {r["name"]: r["percentage"] for r in existing_ratios if isinstance(r, dict)}
            for r in ingredient_ratios:
                ratio_map[r["name"]] = r["percentage"]
            
            updated_ratios = [{"name": name, "percentage": pct} for name, pct in ratio_map.items()]
            state["ingredient_ratios"] = updated_ratios

            total = round(sum(r["percentage"] for r in updated_ratios), 2)
            state["ratio_total"] = total
            is_valid = abs(total - 100.0) < 1e-3
            state["ratio_valid"] = is_valid
            
            if not is_valid:
                state["ratio_warnings"] = [f"The listed ingredient percentages total {total:g}%, not 100%."]
            else:
                state["ratio_warnings"] = []
        else:
            if "ingredient_ratios" not in state:
                state["ingredient_ratios"] = []

        if state.get("ingredients") or state.get("ingredient_ratios"):
            state["tkdl_check_required"] = True
            from app.services.tkdl_service import lookup_tkdl_matches
            tk_res = lookup_tkdl_matches(ingredient_ratios=state.get("ingredient_ratios"), ingredients=state.get("ingredients"))
            state["tkdl_matches"] = tk_res.get("tkdl_matches", [])
            state["exact_match_found"] = tk_res.get("exact_match_found", False)
            state["patentability_status"] = tk_res.get("patentability_status", "")
            state["patent_risk_score"] = tk_res.get("patent_risk_score", 0.0)
            state["patentability_verdict"] = tk_res.get("verdict", "")

        # 3. Detect classical references
        if "charaka" in text or "sushruta" in text or "ashtanga" in text or "bhavaprakasha" in text or "classical text" in text or "first schedule" in text:
            state["is_classical_text_referenced"] = True
            
        # 4. Detect novel/proprietary indicators
        if "modified" in text or "novel extract" in text or "synergistic combination" in text or "new excipient" in text:
            state["has_novel_modification"] = True
            
        # 5. Detect intended purpose / category
        if "food" in text or "dietary" in text or "aahar" in text:
            state["intended_use"] = "food_or_nutraceutical"
        elif "cosmetic" in text or "skin" in text or "cleansing" in text or "hair oil" in text:
            state["intended_use"] = "cosmetic"
        elif "medicine" in text or "therapeutic" in text or "disease" in text or "cure" in text:
            state["intended_use"] = "therapeutic"
            
        return state
