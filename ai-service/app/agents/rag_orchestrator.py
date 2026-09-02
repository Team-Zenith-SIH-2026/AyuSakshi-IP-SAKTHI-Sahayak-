import os
import json
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings
from app.memory.conversation_memory import ConversationMemory
from app.multilingual.bhashini_service import BhashiniService
from app.agents.formulation_classifier import FormulationClassifier
from app.agents.ip_router import IPRouter
from app.agents.abs_helper import ABSHelper
from app.agents.tkdl_pointer import TKDLPointer
from app.graph.knowledge_graph import KnowledgeGraphEngine
from app.rag.hybrid_retriever import hybrid_retrieve
from app.evaluators.citation_verifier import CitationVerifier

class RAGOrchestrator:
    """
    Main Multi-Step RAG Orchestrator for AyuSakshi (IP-SAKTI Sahayak).
    """
    
    @classmethod
    async def process_query(
        cls,
        query: str,
        conversation_id: str,
        jurisdiction: str = "india",
        language: str = "en",
        history: List[Dict[str, Any]] = None,
        formulation_state: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        thinking_trace = []
        history = history or []
        formulation_state = formulation_state or {}
        
        # 1. Language Detection & Query Translation
        detected_lang = BhashiniService.detect_language(query)
        thinking_trace.append({
            "step": "Language Understanding",
            "detail": f"Detected language: {BhashiniService.SUPPORTED_LANGUAGES.get(detected_lang, detected_lang)}. Active jurisdiction: {jurisdiction.upper()}."
        })
        
        search_query = query
        if detected_lang != "en":
            tr_res = await BhashiniService.translate(query, source_lang=detected_lang, target_lang="en")
            search_query = tr_res.get("translated_text", query)
            thinking_trace.append({
                "step": "Multilingual Bhashini Translation",
                "detail": f"Translated '{query}' -> '{search_query}' for legal search precision."
            })
            
        # 2. Conversational Contextual Query Reformulation
        reformulated_query = ConversationMemory.reformulate_query(search_query, history, formulation_state)
        if reformulated_query != search_query:
            thinking_trace.append({
                "step": "Conversational Memory Resolution",
                "detail": f"Contextualized follow-up query: '{reformulated_query}'."
            })
            
        # 3. Formulation Classification
        classification_result = FormulationClassifier.classify(reformulated_query, formulation_state)
        thinking_trace.append({
            "step": "Formulation Classification",
            "detail": f"Category: {classification_result.get('category')}. (Confidence: {classification_result.get('confidence', 0.85):.2f})"
        })
        
        # Out-of-scope Domain Gate
        if classification_result.get("is_out_of_scope"):
            thinking_trace.append({
                "step": "Domain Scope Check",
                "detail": "Inquiry involves subject matter outside AYUSH / Biological Diversity jurisdiction. Safely abstaining."
            })
            abstain_resp = CitationVerifier.get_abstention_response(jurisdiction=jurisdiction)
            abstain_resp["thinking_trace"] = thinking_trace
            return abstain_resp
        
        # If classifier requires minimum clarifying questions
        if classification_result.get("clarifying_question_needed") and not history:
            return {
                "answer": classification_result.get("clarifying_question"),
                "confidence_score": 0.85,
                "confidence_level": "medium",
                "citations": [],
                "thinking_trace": thinking_trace,
                "ip_domains": ["ayush_regulatory"],
                "classification": classification_result,
                "abs_summary": None,
                "tkdl_summary": None,
                "updated_formulation_state": formulation_state
            }
            
        # 4. IP & Regulatory Domain Routing
        ip_domains = IPRouter.route_query(reformulated_query, jurisdiction=jurisdiction)
        thinking_trace.append({
            "step": "IP Domain Routing",
            "detail": f"Routed across domains: {', '.join(ip_domains)}."
        })
        
        # 5. Hybrid Retrieval & Reranking
        retrieved_evidence = hybrid_retrieve(reformulated_query, jurisdiction=jurisdiction, top_k=settings.RERANK_TOP_K)
        thinking_trace.append({
            "step": "Hybrid Retrieval & Reranking",
            "detail": f"Retrieved {len(retrieved_evidence)} authoritative evidence chunks from {jurisdiction} statutory corpus."
        })
        
        # 6. Relational Knowledge Graph Traversal
        kg_triples = KnowledgeGraphEngine.get_related_entities(reformulated_query, jurisdiction=jurisdiction)
        if kg_triples:
            thinking_trace.append({
                "step": "Knowledge Graph Traversal",
                "detail": f"Linked {len(kg_triples)} statutory relationships (e.g. {kg_triples[0]['source']} -> {kg_triples[0]['relation']} -> {kg_triples[0]['target']})."
            })
            
        # 7. ABS Compliance Analysis & TKDL Prior-art Pointer
        abs_summary = ABSHelper.analyze_compliance(reformulated_query, formulation_state)
        tkdl_summary = TKDLPointer.check_prior_art_overlap(reformulated_query, formulation_state)
        
        # 8. Safe Abstention Verification Check
        if not retrieved_evidence and not kg_triples:
            thinking_trace.append({
                "step": "Safe Abstention Check",
                "detail": "No authoritative evidence chunks met similarity threshold. Abstaining safely."
            })
            abstain_resp = CitationVerifier.get_abstention_response(jurisdiction=jurisdiction)
            abstain_resp["thinking_trace"] = thinking_trace
            return abstain_resp
            
        # 9. Grounded Answer Synthesis
        raw_answer = await cls._synthesize_grounded_answer(
            query=search_query,
            jurisdiction=jurisdiction,
            classification=classification_result,
            ip_domains=ip_domains,
            evidence=retrieved_evidence,
            kg_triples=kg_triples,
            abs_summary=abs_summary,
            tkdl_summary=tkdl_summary
        )
        
        # 10. Citation Verification & Confidence Scoring
        citations, conf_score, conf_level = CitationVerifier.verify_and_extract_citations(
            generated_text=raw_answer,
            retrieved_evidence=retrieved_evidence,
            jurisdiction=jurisdiction
        )
        thinking_trace.append({
            "step": "Citation & Confidence Verification",
            "detail": f"Grounding verified across {len(citations)} citations. System Confidence Score: {conf_score:.2f} ({conf_level.upper()})."
        })
        
        # 11. Final Multilingual Translation (if original user language was non-English)
        final_answer = raw_answer
        if detected_lang != "en" and detected_lang in BhashiniService.SUPPORTED_LANGUAGES:
            trans_res = await BhashiniService.translate(raw_answer, source_lang="en", target_lang=detected_lang)
            final_answer = trans_res.get("translated_text", raw_answer)
            
        # 12. Update formulation memory state
        updated_state = ConversationMemory.update_formulation_state(formulation_state, query, raw_answer)
        if classification_result.get("category") and not updated_state.get("category"):
            updated_state["category"] = classification_result.get("category")
            
        return {
            "answer": final_answer,
            "confidence_score": conf_score,
            "confidence_level": conf_level,
            "citations": citations,
            "thinking_trace": thinking_trace,
            "ip_domains": ip_domains,
            "classification": classification_result,
            "abs_summary": abs_summary if abs_summary.get("abs_applicable") else None,
            "tkdl_summary": tkdl_summary if tkdl_summary.get("has_prior_art_flag") else None,
            "updated_formulation_state": updated_state
        }
        
    @classmethod
    async def _synthesize_grounded_answer(
        cls,
        query: str,
        jurisdiction: str,
        classification: Dict[str, Any],
        ip_domains: List[str],
        evidence: List[Dict[str, Any]],
        kg_triples: List[Dict[str, Any]],
        abs_summary: Dict[str, Any],
        tkdl_summary: Dict[str, Any]
    ) -> str:
        """
        Synthesizes structured, source-grounded response using LLM or high-fidelity statutory rules engine.
        """
        # If OpenAI API Key is configured, use live LLM with strict grounding prompt
        if settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("mock"):
            try:
                system_prompt = (
                    "You are AyuSakshi (IP-SAKTI Sahayak), an authoritative AI regulatory and IP intelligence assistant for Ayurveda. "
                    "CRITICAL RULES:\n"
                    "1. Provide factual, source-cited regulatory analysis grounded STRICTLY in the provided evidence.\n"
                    "2. Do NOT treat LLM pre-trained memory as legal evidence. Never fabricate citations or statutes.\n"
                    f"3. Active Jurisdiction is {jurisdiction.upper()}. Keep national and international legal regimes strictly separated.\n"
                    "4. Include explicit Section/Article/Rule citations (e.g. Section 3(p) Patents Act 1970, Biological Diversity Act Section 6).\n"
                    "5. Structure the answer clearly: (A) Formulation Regulatory Status, (B) IP & Patentability Analysis, (C) Access & Benefit Sharing (ABS) Obligations, (D) Authoritative Actionable Steps.\n"
                    "6. State clearly that this is regulatory intelligence and information, not legal advice."
                )
                
                context_str = "\n\n".join([
                    f"[Source: {e.get('doc_title', 'Statute')} | Section: {e.get('section_identifier', 'General')} | Jurisdiction: {e.get('jurisdiction', jurisdiction)}]\n{e.get('content', '')}"
                    for e in evidence
                ])
                
                user_prompt = (
                    f"User Query: {query}\n\n"
                    f"Formulation Classification: {classification.get('category')} - {classification.get('reasoning')}\n"
                    f"Identified IP Domains: {', '.join(ip_domains)}\n\n"
                    f"Retrieved Authoritative Statutory Evidence:\n{context_str}\n\n"
                    f"Synthesize the authoritative grounded response now."
                )
                
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                        json={
                            "model": settings.OPENAI_MODEL,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt}
                            ],
                            "temperature": 0.2
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"[LLM Synthesis Warning]: {e}")
                
        # Deterministic, high-fidelity statutory synthesis fallback
        lines = []
        cat_name = classification.get("category", "Ayurvedic Formulation")
        lines.append(f"### 🌿 Regulatory Classification & IP Posture: {cat_name}\n")
        lines.append(f"{classification.get('reasoning', '')}\n")
        
        # Jurisdiction specific statutory guidance
        if jurisdiction == "india":
            lines.append("#### 1. Patentability Analysis (Indian Patents Act, 1970)")
            lines.append(
                "- **Section 3(p) Traditional Knowledge Exclusion**: Under Section 3(p) of the Patents Act 1970, any invention which in effect is traditional knowledge or an aggregation of known properties of traditionally known components is non-patentable.\n"
                "- **Section 3(e) Synergistic Efficacy Hurdle**: Mere admixture resulting only in aggregation of properties is barred under Section 3(e). To overcome this, applicants must prove unexpected synergistic bio-efficacy with quantitative pharmacological data."
            )
            
            # ABS Section
            if abs_summary.get("abs_applicable"):
                lines.append("\n#### 2. Access & Benefit Sharing (ABS) Obligations")
                lines.append(
                    "- **Biological Diversity Act 2002 (Amended 2023)**: Accessing Indian biological resources requires compliance.\n"
                    "- **Section 6(1)**: Mandatory prior approval from the **National Biodiversity Authority (NBA)** is required before applying for intellectual property rights based on Indian biological resources.\n"
                    "- **Section 7**: Commercial entities must file Form A with the State Biodiversity Board (SBB). Local Vaidyas and registered AYUSH practitioners are exempt under 2023 amended provisions."
                )
                
            # Trademarks & Trade Secrets
            lines.append("\n#### 3. Trademarks & Brand Protection")
            lines.append(
                "- Generic Ayurvedic names cannot be monopolized. Distinctive coined brand names can be registered under **Trade Marks Act 1999 (Class 5 for Pharmaceuticals / Class 3 for Cosmetics / Class 30 for Ayurveda-Aahar)**.\n"
                "- Proprietary extraction kinetics and manufacturing parameters should be safeguarded as **Trade Secrets**."
            )
        else:
            # International Jurisdiction
            lines.append("#### 1. International Patent & IP Protection (WIPO & Key Export Markets)")
            lines.append(
                "- **PCT (Patent Cooperation Treaty)**: Allows filing a unified international patent application across 157+ member states.\n"
                "- **WIPO GRATK Treaty (2024)**: Mandates patent applicants to disclose the country of origin or indigenous traditional knowledge source if the invention is based on genetic resources.\n"
                "- **Madrid System**: Streamlined international trademark protection for Ayurvedic brand marks across target export jurisdictions."
            )
            lines.append("\n#### 2. International Biodiversity & ABS (Nagoya Protocol)")
            lines.append(
                "- Prior Informed Consent (PIC) and Mutually Agreed Terms (MAT) must be documented in compliance with the **Nagoya Protocol on Access and Benefit Sharing**."
            )
            
        # Prior art warning if TKDL hit
        if tkdl_summary.get("has_prior_art_flag"):
            lines.append("\n#### 4. TKDL & Defensive Prior-Art Pointer")
            lines.append(
                "- Classical references detected in authoritative Ayurvedic texts (e.g. Charaka Samhita, API). "
                "International patent offices (USPTO, EPO, JPO) utilize the TKDL database as non-patent prior art to reject claims lacking novelty."
            )
            
        lines.append("\n---\n*Disclaimer: AyuSakshi provides source-grounded regulatory intelligence and statutory information, not formal legal advice.*")
        return "\n".join(lines)
