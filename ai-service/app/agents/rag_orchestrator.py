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
from app.agents.classification_tree import CATEGORY_PROFILES
from app.agents.intent_mapper import IntentMapper, IntentOutcome, is_general_question
from app.agents.turn_router import TurnPlan, TurnRouter
from app.graph.knowledge_graph import KnowledgeGraphEngine
from app.rag.hybrid_retriever import fetch_chunks_by_ids, hybrid_retrieve
from app.evaluators.citation_verifier import CitationVerifier, _squash

log = logging.getLogger("ayusakshi.rag")


class RAGOrchestrator:
    """
    Main Multi-Step RAG Orchestrator for AyuSakshi (IP-SAKTI Sahayak).
    """

    # The three options offered by FormulationClassifier's clarifying question,
    # spelled out so a bare "A" can be read as the answer it stands for.
    CLARIFICATION_OPTIONS = {
        "a": "It is based directly on a recipe in classical texts like Charaka Samhita",
        "b": "It is a proprietary herbal blend with unique ratios",
        "c": "It is an Ayurveda-Aahar food product or a cosmetic",
    }

    @classmethod
    def interpret_clarification_reply(cls, reply: str) -> Optional[str]:
        """
        Decide whether a message answers the follow-up we just asked.

        Returns the product description it supplies, or None when the message is
        something else (a new question, "thanks"), which is then handled
        normally. A reply counts if it is one of the offered letters, or if on
        its own it names a definite product category.
        """
        m = re.fullmatch(r"\s*(?:option\s*)?\(?([abc])\)?[\s.!]*", (reply or "").lower())
        if m:
            return cls.CLARIFICATION_OPTIONS[m.group(1)]
        category = FormulationClassifier.classify(reply or "").get("category")
        if category in FormulationClassifier.CATEGORIES.values():
            return (reply or "").strip().rstrip(".")
        return None

    @classmethod
    async def process_query(
        cls,
        query: str,
        conversation_id: str,
        jurisdiction: str = "india",
        language: str = "en",
        history: List[Dict[str, Any]] = None,
        formulation_state: Dict[str, Any] = None,
        situation: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        thinking_trace = []
        history = history or []
        formulation_state = ConversationMemory.update_formulation_state(formulation_state or {}, query, "")

        # 1. Language Detection & Query Translation
        detected_lang = BhashiniService.detect_language(query, preferred=language)
        target_lang = language if (language and language != "en" and language in BhashiniService.SUPPORTED_LANGUAGES) else (
            detected_lang if detected_lang in BhashiniService.SUPPORTED_LANGUAGES else "en"
        )
        thinking_trace.append({
            "step": "Language Understanding",
            "detail": f"Input: {BhashiniService.SUPPORTED_LANGUAGES.get(detected_lang, detected_lang)} | Target: {BhashiniService.SUPPORTED_LANGUAGES.get(target_lang, target_lang)}. Active jurisdiction: {jurisdiction.upper()}."
        })

        search_query = query
        if detected_lang != "en":
            tr_res = await BhashiniService.translate(query, source_lang=detected_lang, target_lang="en")
            search_query = tr_res.get("translated_text", query)
            thinking_trace.append({
                "step": "Multilingual Translation",
                "detail": f"Translated to English for statutory retrieval via {tr_res.get('provider')}."
            })

        # 1a. The reply to our own follow-up question.
        #
        # When the previous answer ended by asking what kind of product this is,
        # the user's reply is the missing detail of that earlier question, not a
        # question of its own. Treating it as new threw the original question
        # away: "It is a proprietary blend with a unique ratio" was searched and
        # answered on its own, found almost nothing to cite, and was refused.
        clarification_applied = False
        pending = formulation_state.get("pending_clarification")
        if pending:
            formulation_state = {k: v for k, v in formulation_state.items() if k != "pending_clarification"}
            product = cls.interpret_clarification_reply(search_query)
            if product and pending.get("question"):
                search_query = f"{pending['question']} My product: {product}."
                clarification_applied = True
                thinking_trace.append({
                    "step": "Follow-up Answer Applied",
                    "detail": f"Read your reply as the answer to our question and combined it with your original question: '{search_query}'."
                })

        # 1b. What kind of message is this?
        #
        # People chat with the assistant as they would with any chatbot. This
        # step used to answer only an exact greeting directly; everything else
        # was searched as a legal question and refused when its answer named no
        # provision, which a reply to "does it work well?" never can. Each
        # message is now understood with the conversation around it (see
        # agents/turn_router.py). Chat is answered directly and may contain no
        # legal statement. Anything legal still goes through retrieval and
        # citation verification below.
        wizard = formulation_state.get("wizard_classification") or {}
        pending_intent = formulation_state.get("pending_intent")
        formulation_state = {k: v for k, v in formulation_state.items() if k != "pending_intent"}
        last_answer = formulation_state.get("last_answer") or {}

        answers_our_question = False
        if clarification_applied:
            plan = TurnPlan(kind="legal", question=search_query,
                            detail="Your reply, combined with the question it answers.")
        elif situation:
            plan = TurnPlan(kind="legal", question=search_query, detail="A question built with the situation picker.")
        elif IntentMapper.consumes_reply(search_query, pending_intent):
            answers_our_question = True
            plan = TurnPlan(kind="legal", question=search_query, detail="Your answer to the question we just asked.")
        else:
            plan = await TurnRouter.plan(search_query, history, has_previous_answer=bool(last_answer.get("evidence")))
        thinking_trace.append({"step": "Conversation Understanding", "detail": plan.detail})

        if plan.kind == "about_question" and pending_intent:
            reasked = IntentMapper.reask(pending_intent)
            if reasked is not None:
                return await cls._clarification_response(reasked, thinking_trace, formulation_state, target_lang=target_lang)

        if plan.kind in ("chat", "about_question", "out_of_scope"):
            # A chatty aside while one of our questions is open keeps that
            # question open, with its options, rather than losing the thread.
            keep = pending_intent if plan.kind != "out_of_scope" else None
            return await cls._conversation_response(plan, thinking_trace, formulation_state, target_lang, keep)

        if not answers_our_question:
            pending_intent = None  # a new message, not an answer to our question
        follow_up = plan.kind == "follow_up"
        chat_prefix = plan.reply if plan.kind == "mixed" else ""
        restated_by_model = plan.decided_by.startswith("model:")
        # Situations are offered after a refusal only for a question the person
        # asked in their own words. Offering "Getting a patent on my product?"
        # in reply to "elaborate it" makes no sense.
        offer_situations = not last_answer.get("evidence")
        user_words = search_query
        search_query = plan.question or search_query
        if follow_up and search_query.strip() == user_words.strip() and last_answer.get("question"):
            # "ELABORATE IT VERY MUCH" searched on its own finds nothing; say what it is about.
            search_query = f"{user_words} (about the previous question: {last_answer['question']})"

        # 1c. Understanding what is being asked.
        #
        # A practitioner writes "I use Indian plants for my company, any rule?";
        # the statute speaks of a body corporate obtaining a biological resource
        # for commercial utilisation. Retrieval cannot bridge those words, so the
        # question is first matched to a known situation, any fact that changes
        # which provision applies is asked for, and the question is restated in
        # the statute's terms (see agents/intent_mapper.py). A conversation the
        # classification wizard has already settled keeps its own routing, and a
        # follow-up is answered from the sources of the answer it follows.
        intent_outcome: Optional[IntentOutcome] = None
        answer_query = search_query
        if jurisdiction == "india" and not wizard.get("category") and not clarification_applied and not follow_up:
            intent_outcome = IntentMapper.resolve(search_query, pending_intent, picked=situation)
            if intent_outcome and intent_outcome.action == "ask":
                # If formulation details, ingredient ratios, or patent query are detected, do not block with follow-up questions
                if formulation_state.get("ingredient_ratios") or formulation_state.get("exact_match_found") or formulation_state.get("patent_query"):
                    if intent_outcome.intent and intent_outcome.intent.get("id") == "patent_my_product":
                        intent_outcome.slots["basis"] = "combination"
                        intent_outcome = IntentMapper._advance(
                            intent_outcome.intent, intent_outcome.slots, original_query=search_query,
                            asked=0, expert=True, trace="Formulation ratios provided directly; answered without follow-up questions."
                        )
            # Only for a formulation the person described. `patent_query` is set
            # by the word "patent" anywhere in the conversation, and routing on it
            # answered "Can I patent this semiconductor chip?" and "On what
            # grounds can a patent be revoked?" as "Can my product be patented?".
            elif (intent_outcome and intent_outcome.action == "none"
                  and (formulation_state.get("ingredient_ratios") or formulation_state.get("exact_match_found"))
                  and formulation_state.get("patent_query") and not is_general_question(search_query)):
                from app.agents.intent_catalogue import intent_by_id, R_PAT_3P, R_PAT_3E
                patent_intent = intent_by_id("patent_my_product")
                if patent_intent:
                    intent_outcome.action = "mapped"
                    intent_outcome.intent = patent_intent
                    intent_outcome.slots = {"basis": "combination"}
                    intent_outcome.retrieval_queries = [R_PAT_3P, R_PAT_3E]
                    intent_outcome.question = patent_intent["ask"]
                    intent_outcome.restated = True
            if intent_outcome.trace:
                thinking_trace.append({"step": "Question Understanding", "detail": intent_outcome.trace})
            if intent_outcome.action in ("ask", "decline"):
                return await cls._clarification_response(intent_outcome, thinking_trace, formulation_state, chat_prefix, target_lang=target_lang)
            if intent_outcome.action == "mapped":
                # A question already in the statute's terms keeps its own words:
                # only the topic routing is taken from the situation. Replacing it
                # with the situation's generic question dropped facts the person
                # had stated ("what if we were a foreign company?") and the answer
                # was written for an Indian company instead.
                if intent_outcome.restated:
                    search_query = intent_outcome.question
                    answer_query = f'{intent_outcome.question}\n(In the person\'s own words: "{intent_outcome.original_query}")'
                    thinking_trace.append({
                        "step": "Question Restated",
                        "detail": f"Searching the law for: '{intent_outcome.question}'."
                    })
            else:
                # "None of these" hands back the original question to answer as asked.
                search_query = intent_outcome.query
                answer_query = search_query
        intent_mapped = bool(intent_outcome and intent_outcome.action == "mapped")

        # 2. Conversational Contextual Query Reformulation
        # A question the conversation step has already restated, a follow-up
        # answer, or a question restated from a recognised situation carries its
        # full context, so it skips the pronoun heuristic, which would otherwise
        # bolt stray words onto it ("does it work well? (Context: hi)"). The
        # heuristic remains for when the conversation model is unavailable.
        if clarification_applied or intent_mapped or restated_by_model or follow_up:
            reformulated_query = search_query
        else:
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
        #
        # A category settled by the rule-based wizard is authoritative for its
        # conversation. The keyword classifier re-reading the wizard's own
        # question text ("Is the product a purified extract or fraction...?",
        # answered No) labelled a classical medicine a phytopharmaceutical and
        # handed the model the wrong category.
        if wizard.get("category"):
            classification_result = {
                "category": wizard["category"],
                "confidence": 1.0,
                "reasoning": f"Determined by the rule-based classification wizard. {wizard.get('summary', '')}".strip(),
                "clarifying_question_needed": False,
                "method": "rule_based_decision_tree",
            }
        else:
            classification_result = FormulationClassifier.classify(reformulated_query, formulation_state)
        thinking_trace.append({
            "step": "Formulation Classification",
            "detail": (
                f"Category: {classification_result.get('category')}. (Confidence: {classification_result.get('confidence', 0.85):.2f})"
                + (" Source: classification wizard." if wizard.get("category") else "")
            )
        })

        # 4. IP & Regulatory Domain Routing
        ip_domains = IPRouter.route_query(reformulated_query, jurisdiction=jurisdiction)
        thinking_trace.append({
            "step": "IP Domain Routing",
            "detail": f"Routed across domains: {', '.join(ip_domains)}."
        })

        # 5. Hybrid Retrieval & Reranking
        topic_queries = CATEGORY_PROFILES.get(wizard.get("category_key"), {}).get("retrieval_queries", [])
        routed_by = wizard.get("category")
        if intent_mapped and intent_outcome.retrieval_queries:
            topic_queries = intent_outcome.retrieval_queries
            routed_by = intent_outcome.intent["title"].lower()
        if follow_up:
            retrieved_evidence, reused = cls._follow_up_evidence(last_answer, reformulated_query, jurisdiction)
            retrieval_detail = (
                f"Answering from the {reused} source(s) behind the previous answer, plus "
                f"{len(retrieved_evidence) - reused} found for this question."
            )
        elif topic_queries:
            own_words = intent_mapped and not intent_outcome.restated
            retrieved_evidence = cls._routed_evidence(reformulated_query, topic_queries, jurisdiction,
                                                      question_first=own_words)
            retrieval_detail = (
                f"Retrieved {len(retrieved_evidence)} authoritative evidence chunks from {jurisdiction} statutory corpus, "
                f"routed by topic: {len(topic_queries)} topic searches for {routed_by} plus the question itself."
            )
        else:
            retrieved_evidence = hybrid_retrieve(reformulated_query, jurisdiction=jurisdiction, top_k=settings.RERANK_TOP_K)
            retrieval_detail = f"Retrieved {len(retrieved_evidence)} authoritative evidence chunks from {jurisdiction} statutory corpus."
        thinking_trace.append({"step": "Hybrid Retrieval & Reranking", "detail": retrieval_detail})

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
        if tkdl_summary.get("tkdl_matches"):
            formulation_state["tkdl_matches"] = tkdl_summary["tkdl_matches"]
            formulation_state["exact_match_found"] = tkdl_summary.get("exact_match_found", False)
            formulation_state["patentability_status"] = tkdl_summary.get("patentability_status", "")
            formulation_state["patent_risk_score"] = tkdl_summary.get("patent_risk_score", 0.0)
            formulation_state["patentability_verdict"] = tkdl_summary.get("verdict", "")

        # The prior-art check reads a demo reference file (data/tkdl_reference.json
        # says so itself), not the official TKDL, which only patent offices can
        # search. Its findings therefore go to the answer as a lead to mention,
        # never as evidence. They used to be inserted here as an "official"
        # retrieved source, which the citation check then accepted, so a demo
        # record was cited to the user as the reason a patent cannot be filed.

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
            return await cls._refusal(abstain_resp, intent_outcome, formulation_state, chat_prefix,
                                      offer_situations, target_lang=target_lang)

        # 9. Grounded Answer Synthesis
        raw_answer, synthesis_path = await cls._synthesize_grounded_answer(
            query=answer_query,
            jurisdiction=jurisdiction,
            classification=classification_result,
            ip_domains=ip_domains,
            evidence=retrieved_evidence,
            kg_triples=kg_triples,
            abs_summary=abs_summary,
            tkdl_summary=tkdl_summary,
            previous_answer=last_answer.get("answer") if follow_up else None,
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
            return await cls._refusal(abstain_resp, intent_outcome, formulation_state, chat_prefix,
                                      offer_situations, target_lang=target_lang)

        # 10. Citation Verification & Confidence Scoring
        #
        # A local-model answer was written from the lean prompt, so it is checked
        # against only the sources that model was shown. Checking it against all
        # of them would let it "cite", from memory, a provision it never saw.
        verify_evidence = (
            retrieved_evidence[:settings.LOCAL_EVIDENCE_TOP_K]
            if synthesis_path.startswith("llm:ollama") else retrieved_evidence
        )
        citations, conf_score, conf_level, fabricated = CitationVerifier.verify_and_extract_citations(
            generated_text=raw_answer,
            retrieved_evidence=verify_evidence,
            jurisdiction=jurisdiction
        )
        thinking_trace.append({
            "step": "Citation & Confidence Verification",
            "detail": (
                f"{len(citations)} of {len(verify_evidence)} sources the model was shown verified as actually cited. "
                f"Fabricated references rejected: {len(fabricated)}. "
                f"System Confidence Score: {conf_score:.2f} ({conf_level.upper()})."
            )
        })
        if fabricated:
            log.error("[FABRICATED CITATION] rejected %s for query=%r", fabricated, reformulated_query[:80])

        # 10a. One rewrite for a draft that cites what it was not shown.
        #
        # Seen live: a labelling answer was grounded in Rule 161 throughout but
        # named "Rule 161B(1)" for the expiry date, a real rule it had not been
        # shown. Refusing the whole answer for that one reference left the person
        # with nothing. The draft is written again, told which reference to leave
        # out, and the rewrite is verified from scratch. If it still cites beyond
        # its sources, the answer is refused as before.
        blocked: List[str] = []
        if fabricated and synthesis_path.startswith("llm:"):
            retry, retry_path = await cls._synthesize_grounded_answer(
                query=answer_query,
                jurisdiction=jurisdiction,
                classification=classification_result,
                ip_domains=ip_domains,
                evidence=retrieved_evidence,
                kg_triples=kg_triples,
                abs_summary=abs_summary,
                tkdl_summary=tkdl_summary,
                previous_answer=last_answer.get("answer") if follow_up else None,
                rejected=fabricated,
            )
            if retry_path.startswith("llm:"):
                retry_evidence = (
                    retrieved_evidence[:settings.LOCAL_EVIDENCE_TOP_K]
                    if retry_path.startswith("llm:ollama") else retrieved_evidence
                )
                checked = CitationVerifier.verify_and_extract_citations(
                    generated_text=retry, retrieved_evidence=retry_evidence, jurisdiction=jurisdiction
                )
                named = ", ".join(fabricated)
                one = len(fabricated) == 1
                if not checked[3]:
                    thinking_trace.append({
                        "step": "Citation Repair",
                        "detail": (
                            f"The first draft named {named}, which {'is' if one else 'are'} not in the sources it "
                            f"was shown. It was written again without {'it' if one else 'them'}, and the rewrite "
                            f"cites only its sources ({len(checked[0])} verified, confidence {checked[1]:.2f})."
                        )
                    })
                    blocked = fabricated
                    raw_answer, synthesis_path, verify_evidence = retry, retry_path, retry_evidence
                    citations, conf_score, conf_level, fabricated = checked
                else:
                    thinking_trace.append({
                        "step": "Citation Repair",
                        "detail": (
                            f"The first draft named {named}, which {'is' if one else 'are'} not in the sources it "
                            f"was shown. The rewrite still named {', '.join(checked[3])}, so the answer is withheld."
                        )
                    })

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
            abstain_resp["blocked_citations"] = blocked
            abstain_resp["synthesis_path"] = synthesis_path
            abstain_resp["evidence_count"] = len(retrieved_evidence)
            return await cls._refusal(abstain_resp, intent_outcome, formulation_state, chat_prefix, offer_situations, target_lang=target_lang)

        # If the classifier could not pin the product down, ask for the missing
        # detail alongside the grounded answer rather than instead of it. Never
        # re-ask on the turn that is itself the answer to that question, after a
        # recognised situation has already asked what it needed, or in answer to
        # a follow-up on an earlier answer.
        grounded_answer = raw_answer
        asked_followup = False
        if (classification_result.get("clarifying_question_needed")
                and classification_result.get("clarifying_question")
                and not clarification_applied
                and not intent_mapped
                and not follow_up):
            asked_followup = True
            raw_answer = (
                f"{raw_answer}\n\n---\n\n**To sharpen this guidance:** "
                f"{classification_result['clarifying_question']}"
            )

        # A message with a chat part and a legal question gets both: the chat
        # reply (already checked to contain no legal statement), then the
        # verified answer.
        if chat_prefix:
            raw_answer = f"{chat_prefix}\n\n{raw_answer}"

        # 11. Final Multilingual Translation (if target language was non-English)
        final_answer = raw_answer
        if target_lang != "en" and target_lang in BhashiniService.SUPPORTED_LANGUAGES:
            trans_res = await BhashiniService.translate(raw_answer, source_lang="en", target_lang=target_lang)
            final_answer = trans_res.get("translated_text", raw_answer)
            thinking_trace.append({
                "step": "Response Localisation",
                "detail": f"Answer returned in {BhashiniService.SUPPORTED_LANGUAGES.get(target_lang)} via {trans_res.get('provider')}. Statutory citations preserved in official English form."
            })

        # 12. Update formulation memory state
        #
        # Built from the grounded answer only. The follow-up question names
        # "Charaka Samhita" and "food", and scanning it recorded the product as
        # both classical and a food before the user had said anything.
        updated_state = ConversationMemory.update_formulation_state(formulation_state, query, grounded_answer)
        category = classification_result.get("category") or ""
        # "Undetermined" is the absence of a category. Storing it made every later
        # turn search for the literal words "Undetermined / Clarification Needed".
        if category and not category.startswith("Undetermined") and not updated_state.get("category"):
            updated_state["category"] = category
        if asked_followup:
            # Remember what we were answering, so the reply is read as the missing
            # detail of that question rather than as a new question.
            updated_state["pending_clarification"] = {"question": search_query}
        # What this answer rested on, so a follow-up ("explain that more simply",
        # "are you sure?") is answered from the same verified sources.
        updated_state["last_answer"] = {
            "question": reformulated_query,
            "answer": grounded_answer[:2000],
            "evidence": [
                {
                    "id": str(e["id"]),
                    **{k: float(e[k]) for k in ("rerank_score", "similarity", "bm25_score") if e.get(k) is not None},
                }
                for e in verify_evidence if e.get("id")
            ],
        }

        return {
            "answer": final_answer,
            "answer_kind": "legal",
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
            "fabricated_citations": fabricated,
            # Cited by a first draft and removed before the answer was returned.
            "blocked_citations": blocked,
        }

    # ---------------------------------------------------------------------
    # Follow-up questions
    # ---------------------------------------------------------------------

    @staticmethod
    async def _conversation_response(
        plan: TurnPlan,
        thinking_trace: List[Dict[str, Any]],
        formulation_state: Dict[str, Any],
        target_lang: str = "en",
        keep_pending: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        A direct reply to a message that asks nothing legal: small talk, a
        question about AyuSakshi, or a request it cannot help with. The reply has
        already been stripped of any legal statement (turn_router), nothing was
        searched, and there is no confidence to report; "conversation" says so
        rather than borrowing a confidence label.
        """
        reply = plan.reply
        if target_lang != "en" and target_lang in BhashiniService.SUPPORTED_LANGUAGES:
            tr = await BhashiniService.translate(reply, source_lang="en", target_lang=target_lang)
            reply = tr.get("translated_text", reply)
        state = dict(formulation_state)
        clarification = None
        if keep_pending:
            state["pending_intent"] = keep_pending
            clarification = IntentMapper.clarification_for(keep_pending)
        return {
            "answer": reply,
            "answer_kind": "conversation",
            "confidence_score": 0.0,
            "confidence_level": "conversation",
            "citations": [],
            "thinking_trace": thinking_trace,
            "ip_domains": [],
            "classification": None,
            "abs_summary": None,
            "tkdl_summary": None,
            "updated_formulation_state": state,
            "synthesis_path": f"conversation:{plan.kind}:{plan.decided_by}",
            "evidence_count": 0,
            "fabricated_citations": [],
            "clarification": clarification,
        }

    @staticmethod
    async def _clarification_response(
        outcome: IntentOutcome,
        thinking_trace: List[Dict[str, Any]],
        formulation_state: Dict[str, Any],
        chat_prefix: str = "",
        target_lang: str = "en",
    ) -> Dict[str, Any]:
        """
        A follow-up question instead of an answer. Nothing is retrieved and no
        model is called, so there is nothing to cite and no confidence to report;
        "clarifying" says so rather than borrowing the abstention label.
        """
        state = dict(formulation_state)
        if outcome.pending:
            state["pending_intent"] = outcome.pending
        kind = outcome.clarification["kind"] if outcome.clarification else "declined"
        text = f"{chat_prefix}\n\n{outcome.answer_text}" if chat_prefix else outcome.answer_text
        if target_lang != "en" and target_lang in BhashiniService.SUPPORTED_LANGUAGES:
            tr = await BhashiniService.translate(text, source_lang="en", target_lang=target_lang)
            text = tr.get("translated_text", text)
        return {
            "answer": text,
            "answer_kind": "clarification",
            "confidence_score": 0.0,
            "confidence_level": "clarifying",
            "citations": [],
            "thinking_trace": thinking_trace,
            "ip_domains": [],
            "classification": None,
            "abs_summary": None,
            "tkdl_summary": None,
            "updated_formulation_state": state,
            "synthesis_path": f"clarification:{kind}",
            "evidence_count": 0,
            "fabricated_citations": [],
            "clarification": outcome.clarification,
        }

    @staticmethod
    async def _refusal(
        abstain_resp: Dict[str, Any],
        outcome: Optional[IntentOutcome],
        formulation_state: Dict[str, Any],
        chat_prefix: str = "",
        offer_situations: bool = True,
        target_lang: str = "en",
    ) -> Dict[str, Any]:
        """
        Declining to answer a legal question, said the way a person would say it.

        Still a refusal: nothing ungrounded is said and the abstention reason is
        kept. But it says why in plain words, and it gives the person somewhere to
        go: the closest situations when there are some, otherwise an invitation
        to say more. A model outage is not reported as missing evidence.
        """
        state = dict(formulation_state)
        reason = abstain_resp.get("abstention_reason")
        if reason == "llm_unavailable":
            text = (
                "I found parts of the law that may cover this, but I couldn't reach the language model that "
                "writes the answer just now, and I won't answer a legal question without it. "
                "Please try again in a minute."
            )
        else:
            text = (
                "I searched the official legal texts I have, but couldn't find a provision that clearly answers "
                "this, so I won't guess."
            )
            if offer_situations and outcome and outcome.action == "none" and outcome.suggestions:
                suffix, clarification, pending = IntentMapper.suggestion_prompt(outcome.query, outcome.suggestions)
                text += suffix
                abstain_resp["clarification"] = clarification
                state["pending_intent"] = pending
            else:
                text += (
                    " It may help to tell me a bit more, for example what your product is and what you want to "
                    "do with it. You can also ask a human expert to review your question."
                )
        full_text = f"{chat_prefix}\n\n{text}" if chat_prefix else text
        if target_lang != "en" and target_lang in BhashiniService.SUPPORTED_LANGUAGES:
            tr = await BhashiniService.translate(full_text, source_lang="en", target_lang=target_lang)
            full_text = tr.get("translated_text", full_text)
        abstain_resp["answer"] = full_text
        abstain_resp["answer_kind"] = "refusal"
        abstain_resp["updated_formulation_state"] = state
        return abstain_resp

    @staticmethod
    def _follow_up_evidence(
        last_answer: Dict[str, Any], question: str, jurisdiction: str
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Sources for a follow-up: the ones the previous answer was verified
        against, reloaded with the scores they had then, followed by up to three
        more found for the follow-up itself, in case it reaches past them.
        Returns (evidence, how many were reused).
        """
        stored = {e["id"]: e for e in last_answer.get("evidence", []) if e.get("id")}
        previous = []
        for chunk in fetch_chunks_by_ids(list(stored)):
            if chunk.get("jurisdiction") != jurisdiction:
                continue  # the jurisdiction was switched since that answer
            for key in ("rerank_score", "similarity", "bm25_score"):
                if stored[str(chunk["id"])].get(key) is not None:
                    chunk[key] = stored[str(chunk["id"])][key]
            previous.append(chunk)
        seen = {str(c["id"]) for c in previous}
        fresh = [
            c for c in hybrid_retrieve(question, jurisdiction=jurisdiction, top_k=settings.RERANK_TOP_K)
            if str(c.get("id")) not in seen
        ]
        evidence = (previous + fresh[:3])[:6]
        return evidence, min(len(previous), len(evidence))

    # ---------------------------------------------------------------------
    # Answer synthesis
    #
    # The LLM provider chain lives in app.llm.providers so that the RAG
    # pipeline and the translation service share one implementation rather
    # than each carrying its own copy of the Groq/OpenAI/Ollama logic.
    # ---------------------------------------------------------------------

    @staticmethod
    def _routed_evidence(
        query: str, topic_queries: List[str], jurisdiction: str, question_first: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Evidence for a question whose product category the wizard has settled.

        The wizard's hand-off asks four things at once: patentability, other IP,
        licensing and biodiversity. One search over that whole question returned
        the licensing rules and missed Section 3(p) for a classical medicine, and
        the cross-encoder, scoring every chunk against the whole question, pushed
        a relevant biodiversity provision below the citation floor. Each topic
        the category raises is therefore searched on its own and its best chunk
        kept, scored against that topic; the question itself fills the remaining
        places. Chunks below the citation relevance floor are left out rather
        than handed to the model.

        A question answered in its own words ("How long does a patent last?")
        is searched first instead: the situation's topics only add context, and
        the passage that answers it must not be the one cut to make room.
        """
        seen, merged = set(), []

        def take(chunks, limit):
            taken = 0
            for c in chunks:
                key = c.get("id") or (c.get("doc_title"), c.get("section_identifier"))
                relevance = _squash(c.get("rerank_score", c.get("similarity", 0.0)))
                if key in seen or relevance < settings.CITATION_RELEVANCE_FLOOR:
                    continue
                seen.add(key)
                merged.append(c)
                taken += 1
                if taken >= limit:
                    break

        if question_first:
            take(hybrid_retrieve(query, jurisdiction=jurisdiction, top_k=settings.RERANK_TOP_K), 3)
        for topic in topic_queries:
            take(hybrid_retrieve(topic, jurisdiction=jurisdiction, top_k=2), 1)
        if not question_first:
            take(hybrid_retrieve(query, jurisdiction=jurisdiction, top_k=settings.RERANK_TOP_K), 3)
        return merged[:6]

    @staticmethod
    def _local_evidence(evidence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        The sources as the local model is shown them: the top few only, each
        trimmed. The citation panel still shows the full, untrimmed statute.
        """
        cap = settings.LOCAL_EVIDENCE_CHAR_CAP
        trimmed = []
        for e in evidence[:settings.LOCAL_EVIDENCE_TOP_K]:
            e = dict(e)
            body = e.get("content") or ""
            if len(body) > cap:
                e["content"] = body[:cap].rstrip() + " [...]"
            trimmed.append(e)
        return trimmed

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
        tkdl_summary: Dict[str, Any],
        previous_answer: Optional[str] = None,
        rejected: Optional[List[str]] = None,
    ) -> Tuple[str, str]:
        """
        Synthesise a source-grounded response.

        Returns (answer_text, synthesis_path) where synthesis_path names the code
        path that actually produced the text, so nobody has to guess from output
        alone whether a real grounded generation occurred.

        `rejected` names provisions an earlier draft cited without having been
        shown them; the model is told to write the answer again without them.
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
            # Seen in testing: an exemption from Section 7 (prior intimation, for
            # Indian entities) was presented as a way for a foreign company to
            # avoid Section 3 approval. Both provisions were in the evidence, so
            # citation checks passed; the application was still wrong.
            "3e. An exemption, proviso or exception applies only to the provision it belongs to. 'This section' in an\n"
            "    evidence item means the section of that item. Never apply it to a different provision or a different\n"
            "    kind of person unless the evidence says so.\n"
            f"4. Active jurisdiction is {jurisdiction.upper()}. Do not mix Indian and international regimes.\n"
            # Written to be read by the person who asked, not filed: the lettered
            # (A)-(D) headings this used to require made every reply read like a form.
            "5. Write as a knowledgeable person talking to the one who asked. Open with the direct answer in one or two\n"
            "   sentences, then explain in plain language, then give practical next steps. Mention access and benefit\n"
            "   sharing only if it is relevant. Use short lists only where they help; no tables, no horizontal rules\n"
            "   and no headings of any kind (not 'Direct answer', 'Plain-language explanation' or 'Next steps').\n"
            "   If a previous answer is shown, do not copy its layout.\n"
            # Seen live: "A 'new drug' is not defined in the evidence you provided".
            # The person provided nothing; the evidence is ours.
            "5b. The person cannot see the evidence and did not provide it. Never write 'the evidence', 'the evidence\n"
            "    you provided' or 'E1'. When something is not covered, say 'the legal texts I have don't cover this'.\n"
            "5a. Apply the law to the facts the person gave. If they describe a hypothetical ('what if we were a\n"
            "    foreign company'), answer for that case, not for their earlier situation.\n"
            "6. Close by stating this is regulatory information, not legal advice."
        )

        # A passage from a law's full text carries its edition ("as amended to 31
        # Dec 2016"), so the answer can say when later amendments may be missing.
        def edition(e):
            tag = str(e.get("version_tag") or "")
            return f" ({tag})" if tag.startswith("full text") else ""

        context_str = "\n\n".join([
            f"[E{i + 1}] Source: {e.get('doc_title', 'Statute')}{edition(e)} | Provision: {e.get('section_identifier', 'General')} "
            f"| Jurisdiction: {e.get('jurisdiction', jurisdiction)}\n{e.get('content', '')}"
            for i, e in enumerate(evidence)
        ])

        # The rule-based ABS hint describes obligations in words only. It used to
        # name "Section 6(1) of Biological Diversity Act" in the prompt; when
        # retrieval had not supplied that section, the model repeated the number
        # it had just been handed and the verifier rejected the whole answer as
        # fabricated. Provision numbers must come from the evidence alone.
        abs_block = ""
        if abs_summary.get("abs_applicable"):
            obligations = " ".join(p.get("rule", "") for p in abs_summary.get("statutory_provisions", []))
            abs_block = (
                f"\nABS analysis (rule-based, orientation only): access and benefit sharing obligations likely apply. "
                f"{obligations} Forms: {', '.join(abs_summary.get('required_forms', [])) or 'n/a'}. "
                f"Exemptions detected: {len(abs_summary.get('exemptions_detected', []))}. "
                f"Name a provision for these obligations only if it appears in the evidence below."
            )

        # A prior-art lead, never evidence (see step 7). The patentability point has
        # to rest on the statute in the evidence; the lead only tells the person
        # what to check and where. No risk percentage is passed on: it comes from
        # a fixed heuristic, and a number reads as a finding.
        tkdl_block = ""
        matches = [m for m in (tkdl_summary.get("tkdl_matches") or []) if isinstance(m, dict)]
        herbs = {m.get("ingredient") for m in matches if m.get("ingredient")}
        herbs |= {m["herb"] for m in tkdl_summary.get("matched_classical_records", []) if m.get("herb")}
        if tkdl_summary.get("exact_match_found"):
            tkdl_block = (
                "\nPrior-art lead, NOT evidence: the same composition the person described appears in our demo "
                "reference data. That data is for testing and is not the official Traditional Knowledge Digital "
                "Library (TKDL), which only patent offices can search.\n"
                "INSTRUCTION: Say this plainly, and say the composition should be checked against the official TKDL "
                "and through a proper prior-art search before relying on it. Then explain what the numbered evidence "
                "says about patenting traditional knowledge or a mixture of known ingredients. Do not cite the demo "
                "record, give it a document number, or conclude that a patent cannot be filed."
            )
        elif herbs:
            tkdl_block = (
                f"\nPrior-art lead, NOT evidence: traditional uses are recorded for {', '.join(sorted(herbs))}. "
                "You may say classical documentation exists for these ingredients and suggest a prior-art search. "
                "Do not give a risk score or percentage, and do not cite this lead as a source."
            )

        # A follow-up ("explain that more simply", "are you sure?") needs the
        # answer it follows. It is shown as context only: anything it says must
        # still be cited from the evidence, which is checked as usual.
        previous_block = ""
        if previous_answer:
            previous_block = (
                "This question follows up on your previous answer, shown here for context only. It is NOT evidence: "
                "cite only the numbered evidence below.\n"
                f"Previous answer:\n{previous_answer}\n\n"
            )

        correction = ""
        if rejected:
            names = ", ".join(rejected)
            one = len(rejected) == 1
            correction = (
                f"\n\nCORRECTION: an earlier draft of this answer named {names}, which {'is' if one else 'are'} not "
                f"in the evidence above, so that draft was rejected. Write the answer again without naming {names} "
                f"and without relying on anything {'it says' if one else 'they say'}. If a point needs "
                f"{'it' if one else 'them'}, say that the legal texts I have don't cover that point."
            )

        user_prompt = (
            f"{previous_block}"
            f"User Query: {query}\n\n"
            f"Formulation Classification: {classification.get('category')} - {classification.get('reasoning')}\n"
            f"Identified IP Domains: {', '.join(ip_domains)}"
            f"{abs_block}{tkdl_block}\n\n"
            f"Retrieved Authoritative Statutory Evidence:\n{context_str}\n\n"
            f"Answer the query using only the evidence above.{correction}"
        )

        # The local model reads prompts at about 28 tokens a second on a laptop
        # CPU. Given all five sources it could not answer inside its timeout, so
        # it gets a lean prompt: the top sources, each trimmed. Step 10 narrows
        # verification to the same sources.
        local_items = cls._local_evidence(evidence)
        local_context = "\n\n".join([
            f"[E{i + 1}] Provision: {e.get('section_identifier', 'General')} | Source: {e.get('doc_title', 'Statute')}\n"
            f"{e.get('content', '')}"
            for i, e in enumerate(local_items)
        ])
        # A 7B model does not reliably follow a long rule list. Given the full
        # system prompt, DeepSeek reached the right conclusion but named no
        # provision at all, so verification had nothing to check and refused it.
        # A short prompt with one concrete, correctly formatted opening, built
        # from the top source's real label, is followed far more reliably and is
        # quicker to read on CPU. Verification is unchanged: whatever it cites
        # must still match a source it was shown.
        top = local_items[0] if local_items else {}
        example = f"Under {top.get('section_identifier', 'Section 3(p)')} of {top.get('doc_title', 'The Patents Act, 1970')}, ..."
        local_system_prompt = (
            "You are AyuSakshi, a legal information assistant for Ayurveda. "
            f"Active jurisdiction: {jurisdiction.upper()}.\n"
            "Use ONLY the evidence items below.\n"
            "If the evidence answers the question, begin your answer with the word 'Under' followed by the "
            "provision and source of the most relevant evidence item, copied exactly as written after "
            f"'Provision:' and 'Source:'. For example: '{example}'\n"
            "Never write any section, rule or article number that does not appear after 'Provision:' below.\n"
            "Then explain in three to five plain sentences.\n"
            "If the evidence does not answer the question, reply only: "
            "'The retrieved sources do not cover this question.'\n"
            "End with: 'This is regulatory information, not legal advice.'"
        )
        local_user_prompt = f"Question: {query}\n\nEvidence:\n{local_context}{correction}"

        text, provider = await call_llm(
            system_prompt, user_prompt,
            local_user_prompt=local_user_prompt, local_system_prompt=local_system_prompt,
        )
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
