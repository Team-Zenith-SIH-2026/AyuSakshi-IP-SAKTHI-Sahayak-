import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from app.config import settings
from app.llm.providers import call_llm
from app.memory.conversation_memory import ConversationMemory
from app.multilingual.bhashini_service import BhashiniService
from app.agents.formulation_classifier import FormulationClassifier
from app.agents.ip_router import IPRouter
from app.agents.abs_helper import ABSHelper
from app.agents.tkdl_pointer import TKDLPointer
from app.graph.knowledge_graph import KnowledgeGraphEngine
from app.rag.hybrid_retriever import hybrid_retrieve
from app.evaluators.citation_verifier import CitationVerifier

log = logging.getLogger("ayusakshi.rag")


class RAGOrchestrator:
    """
    Main Multi-Step RAG Orchestrator for AyuSakshi (IP-SAKTI Sahayak).
    """

    # Comprehensive legal and domain terms. If ANY of these appear in the prompt,
    # the query is strictly treated as a legal/regulatory inquiry and MUST query the database.
    LEGAL_KEYWORDS = {
        'patent', 'patenting', 'patentable', 'trademark', 'copyright', 'design', 'gi', 'geographical',
        'plant', 'variety', 'abs', 'biodiversity', 'nba', 'sbb', 'ayush', 'ayurved', 'ayurvedic', 'drug',
        'medicine', 'herb', 'herbs', 'herbal', 'formulation', 'classical', 'samhita', 'charaka', 'sushruta',
        'extract', 'phytopharmaceutical', 'fssai', 'aahara', 'nutraceutical', 'license', 'licensing',
        'section', 'rule', 'schedule', 'treaty', 'trips', 'wipo', 'nagoya', 'prior art', 'tkdl',
        'cure', 'treatment', 'dose', 'dosage', 'commercial', 'export', 'import', 'admixture', 'infring'
    }

    GREETING_PATTERNS = [
        r"^(hi|hello|hey|greetings|namaste|namaskar|pranam|good\s+(morning|afternoon|evening|day))$",
        r"^(who\s+are\s+you|what\s+are\s+you|what\s+is\s+ayusakshi|what\s+is\s+this\s+(app|tool|website|system|platform))$",
        r"^(what\s+(can\s+you|you\s+can)\s+do|how\s+can\s+you\s+help(\s+me)?|what\s+do\s+you\s+do|how\s+does\s+this\s+work|what\s+are\s+your\s+features)$",
        r"^(help|help\s+me|show\s+me\s+features|guide\s+me)$",
    ]

    GRATITUDE_PATTERNS = [
        r"^(thanks|thank\s+you|thank\s+you\s+so\s+much|thx|many\s+thanks)$",
        r"^(ok|okay|got\s+it|understood|noted|alright|fine)$",
        r"^(bye|goodbye|see\s+you)$",
    ]

    @classmethod
    def has_legal_domain_intent(cls, text: str) -> bool:
        t = text.lower()
        return any(re.search(rf'\b{re.escape(kw)}', t) for kw in cls.LEGAL_KEYWORDS)

    @classmethod
    def normalize_conversational_text(cls, text: str) -> str:
        cleaned = re.sub(r'[!?.,;:\'\"]+', '', text.strip().lower())
        cleaned = re.sub(r'^(so\s+|well\s+|please\s+|can\s+you\s+|tell\s+me\s+)+', '', cleaned).strip()
        return cleaned

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
                "step": "Multilingual Translation",
                "detail": f"Translated to English for statutory retrieval via {tr_res.get('provider')}."
            })

        # 1b. Conversational Intent Handling (Greetings, Capabilities, Gratitude)
        # CRITICAL SAFETY GUARD: If the query mentions ANY legal, statutory, patent,
        # regulatory, or herbal keyword, it MUST query the authoritative database.
        has_legal_content = cls.has_legal_domain_intent(search_query)

        if not has_legal_content:
            clean_q = cls.normalize_conversational_text(search_query)
            if any(re.match(p, clean_q) for p in cls.GREETING_PATTERNS):
                thinking_trace.append({
                    "step": "Conversational Intent",
                    "detail": "Recognized general greeting/orientation. Presenting AyuSakshi capability overview."
                })
                greeting_en = (
                    "Namaste! I am **AyuSakshi (IP-SAKTI Sahayak)**, an AI-powered regulatory and "
                    "intellectual property advisory assistant for Ayurveda, developed for the Ministry of Ayush.\n\n"
                    "I can help you navigate the three overlapping legal systems for Ayurvedic innovations:\n\n"
                    "1. **Regulatory Classification**: Determine whether your formulation qualifies as a Classical ASU Drug, "
                    "Patent or Proprietary (P or P) Medicine, Phytopharmaceutical, or Ayurveda Aahara (Food).\n"
                    "2. **Intellectual Property Protection**: Understand patentability barriers (Section 3(p) Traditional Knowledge exclusion, "
                    "Section 3(e) Admixture criteria), trademark brand registration, and TKDL prior-art defense.\n"
                    "3. **Biodiversity & ABS Compliance**: Identify National Biodiversity Authority (NBA) approval requirements under "
                    "Sections 3, 4, 6 & 7, and AYUSH exemptions under the Biological Diversity (Amendment) Act 2023 and 2024 Rules.\n"
                    "4. **Manufacturing & Licensing**: Review licensing evidence requirements under Drugs and Cosmetics Rule 158-B "
                    "and Good Manufacturing Practices (Schedule T).\n\n"
                    "How may I assist you with your formulation or regulatory question today?"
                )
                ans = greeting_en
                if detected_lang != "en" and detected_lang in BhashiniService.SUPPORTED_LANGUAGES:
                    tr = await BhashiniService.translate(greeting_en, source_lang="en", target_lang=detected_lang)
                    ans = tr.get("translated_text", greeting_en)

                return {
                    "answer": ans,
                    "confidence_score": 0.98,
                    "confidence_level": "high",
                    "citations": [],
                    "thinking_trace": thinking_trace,
                    "ip_domains": ["patents", "biodiversity_abs", "ayush_regulatory", "trademarks"],
                    "classification": {"category": "System Orientation", "confidence": 1.0, "reasoning": "Conversational greeting / orientation"},
                    "abs_summary": None,
                    "tkdl_summary": None,
                    "updated_formulation_state": formulation_state,
                    "synthesis_path": "conversational_greeting",
                    "fabricated_citations": []
                }

            if any(re.match(p, clean_q) for p in cls.GRATITUDE_PATTERNS):
                thinking_trace.append({
                    "step": "Conversational Intent",
                    "detail": "Recognized conversational courtesy / closing. Providing courteous response."
                })
                reply_en = (
                    "You are very welcome! If you have any further questions regarding Ayurvedic product classification, "
                    "patentability under Section 3(p), or biodiversity approvals, feel free to ask anytime. Wishing you success with your innovation!"
                )
                ans = reply_en
                if detected_lang != "en" and detected_lang in BhashiniService.SUPPORTED_LANGUAGES:
                    tr = await BhashiniService.translate(reply_en, source_lang="en", target_lang=detected_lang)
                    ans = tr.get("translated_text", reply_en)

                return {
                    "answer": ans,
                    "confidence_score": 0.98,
                    "confidence_level": "high",
                    "citations": [],
                    "thinking_trace": thinking_trace,
                    "ip_domains": [],
                    "classification": {"category": "Conversational Acknowledgement", "confidence": 1.0, "reasoning": "User courtesy / acknowledgement"},
                    "abs_summary": None,
                    "tkdl_summary": None,
                    "updated_formulation_state": formulation_state,
                    "synthesis_path": "conversational_gratitude",
                    "fabricated_citations": []
                }

        # 2. Conversational Contextual Query Reformulation
        reformulated_query = ConversationMemory.reformulate_query(search_query, history, formulation_state)
        if reformulated_query != search_query:
            thinking_trace.append({
                "step": "Conversational Memory Resolution",
                "detail": f"Contextualized follow-up query: '{reformulated_query}'."
            })

        # 3. Formulation Classification
        #
        # Classification informs the answer, it does not gate it. Previously an
        # undetermined classification returned a canned clarifying question at a
        # hardcoded 0.85 confidence, bypassing retrieval, citation verification and
        # the abstention gate entirely. Scope is now decided by retrieval evidence.
        classification_result = FormulationClassifier.classify(reformulated_query, formulation_state)
        thinking_trace.append({
            "step": "Formulation Classification",
            "detail": f"Category: {classification_result.get('category')}. (Confidence: {classification_result.get('confidence', 0.85):.2f})"
        })

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

        # 8. Pre-synthesis abstention: nothing authoritative was retrieved.
        if not retrieved_evidence:
            log.warning("[ABSTAIN] no evidence retrieved for query=%r jurisdiction=%s", reformulated_query[:80], jurisdiction)
            thinking_trace.append({
                "step": "Safe Abstention Check",
                "detail": "No authoritative evidence chunks met the relevance threshold. Abstaining safely."
            })
            abstain_resp = CitationVerifier.get_abstention_response(jurisdiction=jurisdiction, reason="no_evidence_retrieved")
            abstain_resp["thinking_trace"] = thinking_trace
            abstain_resp["classification"] = classification_result
            abstain_resp["synthesis_path"] = "abstained:no_evidence"
            abstain_resp["evidence_count"] = 0
            return abstain_resp

        # 9. Grounded Answer Synthesis
        raw_answer, synthesis_path = await cls._synthesize_grounded_answer(
            query=search_query,
            jurisdiction=jurisdiction,
            classification=classification_result,
            ip_domains=ip_domains,
            evidence=retrieved_evidence,
            kg_triples=kg_triples,
            abs_summary=abs_summary,
            tkdl_summary=tkdl_summary
        )
        thinking_trace.append({
            "step": "Grounded Answer Synthesis",
            "detail": f"Answer synthesised via: {synthesis_path}."
        })

        # 9b. The static template is not grounded in the retrieved evidence. It is
        # orientation text for offline development, and it must never be returned
        # as though it were an answer.
        #
        # Marking it loudly was not enough. Benchmarking caught the template
        # answering an out-of-scope question at exactly the abstention threshold:
        # its boilerplate section references happened to match retrieved chunks,
        # so citation verification passed it and it was delivered as a grounded
        # answer. Abstain instead, and carry the template separately.
        if not synthesis_path.startswith("llm:"):
            log.error(
                "[ABSTAIN] reason=llm_unavailable path=%s query=%r "
                "(no provider responded; refusing to return template text as an answer)",
                synthesis_path, reformulated_query[:80]
            )
            thinking_trace.append({
                "step": "Safe Abstention Gate",
                "detail": (
                    "No language model provider was reachable, so no answer could be generated from the "
                    "retrieved evidence. Withholding rather than returning ungrounded template text."
                )
            })
            abstain_resp = CitationVerifier.get_abstention_response(
                jurisdiction=jurisdiction, reason="llm_unavailable"
            )
            abstain_resp["thinking_trace"] = thinking_trace
            abstain_resp["classification"] = classification_result
            abstain_resp["synthesis_path"] = synthesis_path
            abstain_resp["evidence_count"] = len(retrieved_evidence)
            abstain_resp["template_orientation"] = raw_answer
            return abstain_resp

        # 10. Citation Verification & Confidence Scoring
        citations, conf_score, conf_level, fabricated = CitationVerifier.verify_and_extract_citations(
            generated_text=raw_answer,
            retrieved_evidence=retrieved_evidence,
            jurisdiction=jurisdiction
        )
        thinking_trace.append({
            "step": "Citation & Confidence Verification",
            "detail": (
                f"{len(citations)} of {len(retrieved_evidence)} retrieved chunks verified as actually cited. "
                f"Fabricated references rejected: {len(fabricated)}. "
                f"System Confidence Score: {conf_score:.2f} ({conf_level.upper()})."
            )
        })
        if fabricated:
            log.error("[FABRICATED CITATION] rejected %s for query=%r", fabricated, reformulated_query[:80])

        # 10b. Confidence-based safe abstention.
        if CitationVerifier.should_abstain(retrieved_evidence, conf_score):
            # Three genuinely different failures used to be reported as one.
            # "no_grounded_citations" means evidence was retrieved and an answer
            # was generated, but citation verification matched none of it, which
            # returns confidence 0.0. No threshold change can rescue that case,
            # so it must not be filed under low_confidence.
            if fabricated:
                reason = "fabricated_citation"
            elif not citations:
                reason = "no_grounded_citations"
            else:
                reason = "low_confidence"
            log.warning(
                "[ABSTAIN] reason=%s confidence=%.3f threshold=%.2f query=%r",
                reason, conf_score, settings.CONFIDENCE_ABSTAIN_THRESHOLD, reformulated_query[:80]
            )
            thinking_trace.append({
                "step": "Safe Abstention Gate",
                "detail": (
                    f"Confidence {conf_score:.2f} is below the abstention threshold "
                    f"{settings.CONFIDENCE_ABSTAIN_THRESHOLD:.2f} ({reason}). Withholding an ungrounded legal conclusion."
                )
            })
            abstain_resp = CitationVerifier.get_abstention_response(jurisdiction=jurisdiction, reason=reason)
            abstain_resp["thinking_trace"] = thinking_trace
            abstain_resp["classification"] = classification_result
            abstain_resp["fabricated_citations"] = fabricated
            abstain_resp["synthesis_path"] = synthesis_path
            abstain_resp["evidence_count"] = len(retrieved_evidence)
            return abstain_resp

        # If the classifier could not pin the product down, ask for the missing
        # detail alongside the grounded answer rather than instead of it.
        if classification_result.get("clarifying_question_needed") and classification_result.get("clarifying_question"):
            raw_answer = (
                f"{raw_answer}\n\n---\n\n**To sharpen this guidance:** "
                f"{classification_result['clarifying_question']}"
            )

        # 11. Final Multilingual Translation (if original user language was non-English)
        final_answer = raw_answer
        if detected_lang != "en" and detected_lang in BhashiniService.SUPPORTED_LANGUAGES:
            trans_res = await BhashiniService.translate(raw_answer, source_lang="en", target_lang=detected_lang)
            final_answer = trans_res.get("translated_text", raw_answer)
            thinking_trace.append({
                "step": "Response Localisation",
                "detail": f"Answer returned in {BhashiniService.SUPPORTED_LANGUAGES.get(detected_lang)} via {trans_res.get('provider')}. Statutory citations preserved in official English form."
            })

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
            "updated_formulation_state": updated_state,
            "synthesis_path": synthesis_path,
            "evidence_count": len(retrieved_evidence),
            "fabricated_citations": fabricated
        }

    # ---------------------------------------------------------------------
    # Answer synthesis
    #
    # The LLM provider chain lives in app.llm.providers so that the RAG
    # pipeline and the translation service share one implementation rather
    # than each carrying its own copy of the Groq/OpenAI/Ollama logic.
    # ---------------------------------------------------------------------

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
    ) -> Tuple[str, str]:
        """
        Synthesise a source-grounded response.

        Returns (answer_text, synthesis_path) where synthesis_path names the code
        path that actually produced the text, so nobody has to guess from output
        alone whether a real grounded generation occurred.
        """
        system_prompt = (
            "You are AyuSakshi (IP-SAKTI Sahayak), a regulatory and IP intelligence assistant for Ayurveda.\n"
            "CRITICAL RULES:\n"
            "1. Answer ONLY from the numbered evidence provided. Your own pre-trained knowledge is NOT evidence.\n"
            "2. Never invent a section, rule, article or case. If the evidence does not cover a point, say so explicitly.\n"
            "3. Cite the exact provision inline, e.g. 'Section 3(p), Patents Act 1970', and only ones that appear in the evidence.\n"
            "3a. You MUST name, inline, at least one provision drawn from the evidence below, written exactly as that\n"
            "    evidence item labels it. Citing the provisions you were given is the point of the exercise; an answer that\n"
            "    discusses the law without naming any provision from the evidence cannot be verified and is discarded.\n"
            "3b. Equally, do NOT name any section, rule or article number that is absent from the evidence below, not even\n"
            "    one you believe is correct and relevant. If a relevant provision is missing from the evidence, describe the\n"
            "    obligation in words and say the specific provision is outside the retrieved sources.\n"
            "    Rules 3a and 3b work together: cite freely from what you were shown, and never beyond it.\n"
            "3d. When referencing sub-rules or sub-clauses, always connect them with their parent rule or section (e.g. 'Rule 19(5)' or 'Section 7(2)'), NEVER shorten sub-rule (5) to 'Rule 5'.\n"
            f"4. Active jurisdiction is {jurisdiction.upper()}. Do not mix Indian and international regimes.\n"
            "5. Structure: (A) Direct answer, (B) Plain-language explanation, (C) ABS obligations if relevant, (D) Next steps.\n"
            "6. Close by stating this is regulatory information, not legal advice."
        )

        context_str = "\n\n".join([
            f"[E{i + 1}] Source: {e.get('doc_title', 'Statute')} | Provision: {e.get('section_identifier', 'General')} "
            f"| Jurisdiction: {e.get('jurisdiction', jurisdiction)}\n{e.get('content', '')}"
            for i, e in enumerate(evidence)
        ])

        abs_block = ""
        if abs_summary.get("abs_applicable"):
            provisions = "; ".join(p.get("section", "") for p in abs_summary.get("statutory_provisions", []))
            abs_block = (
                f"\nABS analysis (rule-based): applicable=yes. Provisions engaged: {provisions or 'n/a'}. "
                f"Forms: {', '.join(abs_summary.get('required_forms', [])) or 'n/a'}. "
                f"Exemptions detected: {len(abs_summary.get('exemptions_detected', []))}."
            )

        tkdl_block = ""
        if tkdl_summary.get("has_prior_art_flag"):
            herbs = ", ".join(m["herb"] for m in tkdl_summary.get("matched_classical_records", []))
            tkdl_block = f"\nTKDL prior-art flag: classical documentation exists for {herbs}."

        user_prompt = (
            f"User Query: {query}\n\n"
            f"Formulation Classification: {classification.get('category')} - {classification.get('reasoning')}\n"
            f"Identified IP Domains: {', '.join(ip_domains)}"
            f"{abs_block}{tkdl_block}\n\n"
            f"Retrieved Authoritative Statutory Evidence:\n{context_str}\n\n"
            f"Answer the query using only the evidence above."
        )

        text, provider = await call_llm(system_prompt, user_prompt)
        if text:
            return text, f"llm:{provider}"

        # ------------------------------------------------------------------
        # No LLM reachable. Emit the deterministic template, but label it, so a
        # template can never be mistaken for a grounded generation in a demo.
        # ------------------------------------------------------------------
        log.error(
            "[DETERMINISTIC FALLBACK ACTIVE] No LLM provider responded. "
            "The text below is a static template and is NOT grounded in retrieved evidence."
        )
        lines = []
        lines.append(
            "> **Notice: template response.** No language model provider was reachable, so this answer "
            "was assembled from a static regulatory template rather than generated from the retrieved "
            "statutory evidence. Treat it as orientation only.\n"
        )
        cat_name = classification.get("category", "Ayurvedic Formulation")
        lines.append(f"### Regulatory Classification & IP Posture: {cat_name}\n")
        lines.append(f"{classification.get('reasoning', '')}\n")

        if jurisdiction == "india":
            lines.append("#### 1. Patentability Analysis (Indian Patents Act, 1970)")
            lines.append(
                "- **Section 3(p) Traditional Knowledge Exclusion**: an invention which in effect is traditional knowledge, "
                "or an aggregation or duplication of known properties of traditionally known components, is not an invention.\n"
                "- **Section 3(e) Mere Admixture**: a substance obtained by mere admixture resulting only in the aggregation "
                "of the properties of its components is not patentable."
            )
            if abs_summary.get("abs_applicable"):
                lines.append("\n#### 2. Access & Benefit Sharing (ABS) Obligations")
                lines.append(
                    "- **Biological Diversity Act 2002 (Amended 2023)**: accessing Indian biological resources triggers compliance.\n"
                    "- **Section 6**: approval of the National Biodiversity Authority is required in connection with intellectual "
                    "property rights based on Indian biological resources.\n"
                    "- **Section 7**: Indian entities must give prior intimation to the State Biodiversity Board."
                )
            lines.append("\n#### 3. Trademarks & Brand Protection")
            lines.append(
                "- Generic Ayurvedic names cannot be monopolised. Distinctive coined brand names may be registered under the "
                "Trade Marks Act 1999.\n"
                "- Proprietary process parameters can be held as trade secrets."
            )
        else:
            lines.append("#### 1. International Patent & IP Protection")
            lines.append(
                "- **PCT**: a unified international patent application route.\n"
                "- **WIPO GRATK Treaty (2024)**: disclosure of the country of origin or source of genetic resources and "
                "associated traditional knowledge in patent applications.\n"
                "- **Madrid System**: international trademark registration."
            )
            lines.append("\n#### 2. International Biodiversity & ABS (Nagoya Protocol)")
            lines.append(
                "- Prior Informed Consent (PIC) and Mutually Agreed Terms (MAT) must be documented."
            )

        if tkdl_summary.get("has_prior_art_flag"):
            lines.append("\n#### 4. TKDL & Defensive Prior-Art Pointer")
            lines.append(
                "- Classical references exist in authoritative Ayurvedic texts. International patent offices use the TKDL "
                "database as non-patent prior art against claims lacking novelty."
            )

        lines.append("\n---\n*AyuSakshi provides source-grounded regulatory information, not legal advice.*")
        return "\n".join(lines), "deterministic_template_fallback"
