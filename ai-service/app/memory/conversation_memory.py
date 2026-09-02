import re
from typing import List, Dict, Any

class ConversationMemory:
    """
    Tracks multi-turn dialogue context, maintains stateful formulation properties,
    and reformulates follow-up queries for high-recall RAG retrieval.
    """
    
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
        
    @staticmethod
    def update_formulation_state(current_state: Dict[str, Any], query: str, assistant_response: str) -> Dict[str, Any]:
        """
        Incrementally updates formulation properties discovered in the ongoing conversation.
        """
        state = dict(current_state or {})
        text = f"{query} {assistant_response}".lower()
        
        # Detect classical references
        if "charaka" in text or "sushruta" in text or "ashtanga" in text or "bhavaprakasha" in text or "classical text" in text or "first schedule" in text:
            state["is_classical_text_referenced"] = True
            
        # Detect novel/proprietary indicators
        if "modified" in text or "novel extract" in text or "synergistic combination" in text or "new excipient" in text:
            state["has_novel_modification"] = True
            
        # Detect herbal ingredients
        herbs = ["ashwagandha", "turmeric", "curcumin", "neem", "tulsi", "triphala", "brahmi", "guggulu", "shatavari", "amla", "haritaki"]
        found_herbs = [h for h in herbs if h in text]
        if found_herbs:
            existing_herbs = set(state.get("ingredients", []))
            existing_herbs.update(found_herbs)
            state["ingredients"] = list(existing_herbs)
            
        # Detect intended purpose / category
        if "food" in text or "dietary" in text or "aahar" in text:
            state["intended_use"] = "food_or_nutraceutical"
        elif "cosmetic" in text or "skin" in text or "cleansing" in text or "hair oil" in text:
            state["intended_use"] = "cosmetic"
        elif "medicine" in text or "therapeutic" in text or "disease" in text or "cure" in text:
            state["intended_use"] = "therapeutic"
            
        return state
