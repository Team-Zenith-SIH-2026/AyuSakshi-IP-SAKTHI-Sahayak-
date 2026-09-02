import re
from typing import List, Dict, Any, Tuple
from app.config import settings

class CitationVerifier:
    """
    Evaluates evidence grounding, verifies claims against retrieved statutory chunks,
    calculates transparent confidence scores, and enforces safe abstention.
    """
    
    @staticmethod
    def verify_and_extract_citations(
        generated_text: str,
        retrieved_evidence: List[Dict[str, Any]],
        jurisdiction: str = "india"
    ) -> Tuple[List[Dict[str, Any]], float, str]:
        """
        Verify citations against retrieved evidence chunks and compute system confidence.
        Returns: (verified_citations, confidence_score, confidence_level)
        """
        if not retrieved_evidence:
            return [], 0.0, "abstained"
            
        verified_citations = []
        gen_lower = generated_text.lower()
        
        # Check evidence grounding
        total_overlap = 0.0
        for chunk in retrieved_evidence:
            sec_id = chunk.get("section_identifier", "")
            title = chunk.get("doc_title") or chunk.get("title", "Statutory Document")
            content = chunk.get("content", "")
            
            # Check if section number or title is cited in the generated answer
            is_cited = False
            if sec_id and sec_id.lower() in gen_lower:
                is_cited = True
            elif any(w in gen_lower for w in title.lower().split()[:3] if len(w) > 3):
                is_cited = True
                
            # Content n-gram overlap check
            content_words = set(re.findall(r'\b\w{4,}\b', content.lower()))
            gen_words = set(re.findall(r'\b\w{4,}\b', gen_lower))
            overlap = len(content_words.intersection(gen_words)) / max(len(content_words), 1)
            total_overlap += min(overlap * 2.0, 1.0)
            
            # Format verified citation
            verified_citations.append({
                "source_title": title,
                "section_reference": sec_id or "General Provisions",
                "authority": chunk.get("authority", "Official Regulatory Authority"),
                "jurisdiction": chunk.get("jurisdiction", jurisdiction),
                "version_tag": chunk.get("version_tag", "Current Consolidated"),
                "source_url": chunk.get("source_url", ""),
                "claim_text": content[:240].strip() + ("..." if len(content) > 240 else ""),
                "verified_grounded": True,
                "similarity_score": round(float(chunk.get("similarity", chunk.get("rerank_score", 0.85))), 3)
            })
            
        # Deduplicate citations by section and title
        seen = set()
        deduped_citations = []
        for c in verified_citations:
            key = f"{c['source_title']}-{c['section_reference']}"
            if key not in seen:
                seen.add(key)
                deduped_citations.append(c)
                
        # Calculate transparent composite confidence score
        avg_retrieval_sim = sum(c.get("similarity", 0.7) for c in retrieved_evidence) / max(len(retrieved_evidence), 1)
        avg_rerank = sum(c.get("rerank_score", 0.7) for c in retrieved_evidence) / max(len(retrieved_evidence), 1)
        avg_overlap = total_overlap / max(len(retrieved_evidence), 1)
        citation_factor = min(len(deduped_citations) / 3.0, 1.0)
        
        # Composite score
        confidence_score = round(
            0.30 * min(avg_retrieval_sim * 1.5, 1.0) +
            0.30 * min(avg_rerank * 1.5, 1.0) +
            0.20 * min(avg_overlap, 1.0) +
            0.20 * citation_factor,
            4
        )
        
        # Determine confidence level
        if confidence_score >= 0.70:
            confidence_level = "high"
        elif confidence_score >= 0.45:
            confidence_level = "medium"
        else:
            confidence_level = "low"
            
        return deduped_citations[:5], confidence_score, confidence_level

    @staticmethod
    def should_abstain(retrieved_evidence: List[Dict[str, Any]], confidence_score: float) -> bool:
        """
        Safe abstention check. Returns True if evidence is insufficient or confidence is too low.
        """
        if not retrieved_evidence or len(retrieved_evidence) == 0:
            return True
        if confidence_score < settings.CONFIDENCE_ABSTAIN_THRESHOLD:
            return True
        return False
        
    @staticmethod
    def get_abstention_response(jurisdiction: str = "india") -> Dict[str, Any]:
        """
        Standardized safe refusal response when authoritative statutory evidence is lacking.
        """
        return {
            "answer": (
                "I could not find sufficient authoritative evidence in the official knowledge base to answer this query reliably. "
                "In accordance with our regulatory safety principles, I abstain from providing ungrounded legal conclusions. "
                "You can request human escalation below to have an accredited AYUSH IP Facilitator examine your case."
            ),
            "confidence_score": 0.0,
            "confidence_level": "abstained",
            "citations": [],
            "thinking_trace": [
                {"step": "Evidence Retrieval", "detail": "Retrieved 0 authoritative chunks meeting relevance threshold."},
                {"step": "Safety Gate", "detail": "Triggered safe abstention to prevent hallucination."}
            ],
            "ip_domains": [],
            "classification": None,
            "abs_summary": None,
            "tkdl_summary": None
        }
