import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

log = logging.getLogger("ayusakshi.tkdl")

DEFAULT_REFERENCE_PATH = Path(__file__).parent.parent / "data" / "tkdl_reference.json"

class TKDLService:
    """
    Lookup service for TKDL demo reference data.
    Evaluates exact formulation ratio matches against classical reference documents
    and computes dynamic Patent Prior-Art & Admixture Risk Scores.
    """

    @classmethod
    def load_reference_data(cls, file_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
        target_path = file_path or DEFAULT_REFERENCE_PATH
        try:
            if not target_path.exists():
                log.warning("[TKDL] Reference file does not exist at %s", target_path)
                return None
            with open(target_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            log.warning("[TKDL] Failed to load reference data from %s: %s", target_path, e)
            return None

    @classmethod
    def lookup_tkdl_matches(
        cls,
        ingredient_ratios: Optional[List[Dict[str, Any]]] = None,
        ingredients: Optional[List[str]] = None,
        file_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates exact formulation ratio matches and individual herb matches.
        Returns:
        - exact_match_found (bool)
        - patentability_status (str)
        - patent_risk_score (float, 0.0 to 1.0)
        - verdict (str)
        - tkdl_matches (list)
        - tkdl_status (str)
        - tkdl_disclaimer (str)
        """
        ref_data = cls.load_reference_data(file_path)
        if ref_data is None or not isinstance(ref_data.get("records"), list):
            return {
                "exact_match_found": False,
                "patentability_status": "reference_unavailable",
                "patent_risk_score": 0.0,
                "verdict": "Reference data unavailable.",
                "tkdl_matches": [],
                "tkdl_status": "reference_unavailable",
                "tkdl_disclaimer": "This is a development/demo reference lookup, not an official TKDL determination."
            }

        records = ref_data.get("records", [])

        # Build user target herbs map with percentage if present
        target_herbs: Dict[str, Optional[float]] = {}

        if ingredient_ratios:
            for item in ingredient_ratios:
                if isinstance(item, dict) and "name" in item:
                    name = str(item["name"]).strip().lower()
                    pct = item.get("percentage")
                    target_herbs[name] = float(pct) if pct is not None else None

        if ingredients:
            for ing in ingredients:
                name = str(ing).strip().lower()
                if name not in target_herbs:
                    target_herbs[name] = None

        if not target_herbs:
            return {
                "exact_match_found": False,
                "patentability_status": "not_checked",
                "patent_risk_score": 0.0,
                "verdict": "No formulation ingredients supplied for check.",
                "tkdl_matches": [],
                "tkdl_status": "not_checked",
                "tkdl_disclaimer": "This is a development/demo reference lookup, not an official TKDL determination."
            }

        # 1. Check for exact formulation ratio matches across formulation records
        exact_formulation_record = None
        for rec in records:
            if rec.get("is_formulation") and isinstance(rec.get("ingredients"), list):
                rec_ing_map = {
                    str(item["name"]).strip().lower(): float(item["percentage"])
                    for item in rec["ingredients"]
                    if isinstance(item, dict) and "name" in item and "percentage" in item
                }
                
                # Check if set of ingredients and their percentages match
                if set(target_herbs.keys()) == set(rec_ing_map.keys()):
                    all_ratios_match = True
                    for h_name, h_pct in target_herbs.items():
                        ref_pct = rec_ing_map[h_name]
                        if h_pct is None or abs(h_pct - ref_pct) > 0.5:
                            all_ratios_match = False
                            break
                    if all_ratios_match:
                        exact_formulation_record = rec
                        break

        if exact_formulation_record:
            doc_num = exact_formulation_record.get("document_number", "TKDL-AYU-2026-1090")
            title = exact_formulation_record.get("title", "10% Ashwagandha + 90% Turmeric")
            match_entry = {
                "ingredient": title,
                "document_number": doc_num,
                "record_id": exact_formulation_record.get("id"),
                "match_type": "exact_formulation_ratio_match",
                "traditional_knowledge_status": "exact_formulation_match",
                "source_type": exact_formulation_record.get("source_type", "demo"),
                "notes": exact_formulation_record.get("notes", ""),
                "citation_label": f"TKDL Reference Document #{doc_num}"
            }
            return {
                "exact_match_found": True,
                "patentability_status": "unpatentable_exact_document_found",
                "patent_risk_score": 0.95,
                "verdict": f"Patent cannot be filed as an existing formulation reference document (#{doc_num}) containing {title} was found in TKDL reference data.",
                "tkdl_matches": [match_entry],
                "tkdl_status": "exact_match_found",
                "tkdl_disclaimer": "This is a development/demo reference lookup, not an official TKDL determination."
            }

        # 2. If no exact formulation ratio match found, check individual herb matches & compute Risk Score
        matches = []
        matched_herb_count = 0
        for herb_name, percentage in target_herbs.items():
            for rec in records:
                if rec.get("is_formulation"):
                    continue
                canonical = str(rec.get("canonical_name", "")).strip().lower()
                aliases = [str(a).strip().lower() for a in rec.get("aliases", [])]

                match_type = None
                if herb_name == canonical:
                    match_type = "canonical_name"
                elif herb_name in aliases:
                    match_type = "alias"

                if match_type:
                    matched_herb_count += 1
                    match_entry = {
                        "ingredient": canonical or herb_name,
                        "query_ingredient": herb_name,
                        "percentage": percentage,
                        "record_id": rec.get("id"),
                        "match_type": match_type,
                        "traditional_knowledge_status": rec.get("traditional_knowledge_status", "potential_match"),
                        "source_type": rec.get("source_type", "demo"),
                        "notes": rec.get("notes", "")
                    }
                    matches.append(match_entry)

        # Risk Score Calculation:
        # Base risk: 0.30
        # +0.20 for each matched herb in TKDL
        # +0.20 if multiple herbs combined (Section 3(e) mere admixture risk)
        base_score = 0.30
        herb_score = min(matched_herb_count * 0.10, 0.20)
        admixture_score = 0.20 if len(target_herbs) > 1 else 0.0
        risk_score = min(round(base_score + herb_score + admixture_score, 2), 0.85)

        status = "potential_matches_found" if matches else "no_match"
        verdict = f"No exact formulation document match found in TKDL. Evaluated Patent Prior-Art & Admixture Risk Score at {int(risk_score * 100)}%."

        return {
            "exact_match_found": False,
            "patentability_status": "risk_score_evaluated",
            "patent_risk_score": risk_score,
            "verdict": verdict,
            "tkdl_matches": matches,
            "tkdl_status": status,
            "tkdl_disclaimer": "This is a development/demo reference lookup, not an official TKDL determination."
        }

def lookup_tkdl_matches(
    ingredient_ratios: Optional[List[Dict[str, Any]]] = None,
    ingredients: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Convenience functional wrapper for TKDL lookup."""
    return TKDLService.lookup_tkdl_matches(ingredient_ratios, ingredients)
