try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None
from typing import List, Dict, Any
from app.config import settings

# In-memory graph nodes and edges for instant retrieval & offline tests
_IN_MEMORY_KG_NODES = [
    {"identifier": "section_3p", "entity_type": "section", "name": "Section 3(p) Patents Act", "properties": {"act": "Patents Act 1970", "rule": "Traditional Knowledge Exclusion"}},
    {"identifier": "bda_2002", "entity_type": "statute", "name": "Biological Diversity Act, 2002", "properties": {"amendment": "2023", "rules": "2024"}},
    {"identifier": "form_a_abs", "entity_type": "regulatory_form", "name": "ABS Form A / Form I", "properties": {"authority": "NBA / SBB", "purpose": "Access to Biological Resources"}},
    {"identifier": "first_schedule_dca", "entity_type": "statute", "name": "First Schedule Drugs & Cosmetics Act", "properties": {"texts": ["Charaka Samhita", "Sushruta Samhita", "Ashtanga Hridaya", "Ayurvedic Formulary of India"]}},
    {"identifier": "ayurveda_aahara", "entity_type": "regulation", "name": "FSSAI Ayurveda Aahara Regulations 2022", "properties": {"scope": "Food products prepared in accordance with classical Ayurveda texts"}},
    {"identifier": "wipo_gratk", "entity_type": "treaty", "name": "WIPO GRATK Treaty 2024", "properties": {"scope": "Mandatory patent disclosure of genetic resources and associated traditional knowledge"}},
    {"identifier": "trips_art_27", "entity_type": "treaty_article", "name": "TRIPS Article 27.3(b)", "properties": {"scope": "Patentability of plants, animals, and biological processes"}}
]

_IN_MEMORY_KG_EDGES = [
    {"source": "section_3p", "target": "first_schedule_dca", "relation": "cites_traditional_prior_art"},
    {"source": "bda_2002", "target": "form_a_abs", "relation": "mandates"},
    {"source": "first_schedule_dca", "target": "ayurveda_aahara", "relation": "defines_authoritative_texts"},
    {"source": "wipo_gratk", "target": "section_3p", "relation": "harmonizes_disclosure"},
    {"source": "trips_art_27", "target": "bda_2002", "relation": "complements_abs"}
]

class KnowledgeGraphEngine:
    """
    Relational Knowledge Graph Engine to traverse links between formulations, ingredients,
    statutes, ABS requirements, and treaties.
    """
    
    @staticmethod
    def get_related_entities(query: str, jurisdiction: str = "india") -> List[Dict[str, Any]]:
        """
        Traverse knowledge graph to find entities and connecting edges related to query terms.
        """
        query_lower = query.lower()
        matched_triples = []
        
        # 1. Match from in-memory KG
        for node in _IN_MEMORY_KG_NODES:
            node_name = node["name"].lower()
            ident = node["identifier"]
            if any(k in query_lower for k in [ident.replace("_", " "), node_name, node.get("properties", {}).get("act", "").lower()]):
                # Find edges connected to this node
                for edge in _IN_MEMORY_KG_EDGES:
                    if edge["source"] == ident or edge["target"] == ident:
                        other_id = edge["target"] if edge["source"] == ident else edge["source"]
                        other_node = next((n for n in _IN_MEMORY_KG_NODES if n["identifier"] == other_id), None)
                        if other_node:
                            matched_triples.append({
                                "source": node["name"],
                                "relation": edge["relation"],
                                "target": other_node["name"],
                                "properties": node.get("properties", {})
                            })
                            
        # 2. Match from PostgreSQL Knowledge Graph if available
        try:
            conn = psycopg2.connect(settings.DATABASE_URL, cursor_factory=RealDictCursor)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT s.name as source, e.relation_type as relation, t.name as target, s.properties
                    FROM knowledge_graph_edges e
                    JOIN knowledge_graph_nodes s ON e.source_node_id = s.id
                    JOIN knowledge_graph_nodes t ON e.target_node_id = t.id
                    LIMIT 20
                """)
                db_rows = cur.fetchall()
                for r in db_rows:
                    if r["source"].lower() in query_lower or r["target"].lower() in query_lower:
                        matched_triples.append(dict(r))
            conn.close()
        except Exception:
            pass
            
        return matched_triples[:6]
