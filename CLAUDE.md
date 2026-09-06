# AyuSakshi (IP-SAKTI Sahayak) - Project Context for Claude Code

> This file is the single source of truth for what this project is, what state it is in,
> and what needs doing. Read it fully before making changes.
> Last updated: 5 September 2026.

---

# 1. WHAT THIS PROJECT IS

**Smart India Hackathon 2026, Problem Statement SIH26045**
Organisation: Ministry of Ayush, All India Institute of Ayurveda (AIIA)
Category: Software | Theme: MedTech / BioTech / HealthTech
Team: Team Zenith (SIH-2026) | Project name: AyuSakshi

## The problem

Someone with an Ayurvedic product (a startup, practitioner, small manufacturer, or medicinal-plant cultivator) who wants to protect and legally sell it must satisfy three separate legal systems simultaneously:

1. **Intellectual property law** - patents, geographical indications, trademarks, designs, copyright, trade secrets, plant variety rights. Different rules, offices, forms for each.
2. **Biodiversity / Access-and-Benefit-Sharing (ABS) law** - India asserts sovereignty over its biological resources. Using Indian plant or microbial material can trigger National Biodiversity Authority approvals and benefit-sharing obligations. Most people discover this only after violating it.
3. **Drug regulatory law** - the same product can legally be a classical medicine, a patent/proprietary medicine, a new drug, a phytopharmaceutical, an Ayurveda-Aahar (food), or a cosmetic.

**The key insight the whole architecture rests on: regulatory classification determines everything downstream.**

A classical formulation from a First Schedule authoritative text (Charaka Samhita etc.) is traditional knowledge. It cannot be patented (Patents Act Section 3(p)) and is defended through the Traditional Knowledge Digital Library. A new drug can be patented but requires clinical evidence first. Classify wrong and every subsequent answer is wrong.

Consequence: legitimate Ayurvedic innovation goes under-protected and under-commercialised, while India's traditional knowledge stays exposed to misappropriation abroad. No tool currently gives plain-language, authoritative, citable guidance across all of this.

## What we are building

An AI assistant that answers IP and regulatory questions for Ayurvedic products where **every answer cites the exact law it came from**.

Two-stage flow:
1. **Classify first** - determine the product's legal category (rule-based, deterministic, auditable).
2. **Then advise, with sources** - answer what is protectable, what approvals are needed, what ABS obligations apply, with every claim pointing to a specific statutory section and the actual source text shown.

Two things distinguish it from a generic chatbot, and both are the core technical claims:
- **It cannot fabricate a law.** Every citation returned by the LLM is programmatically checked against the retrieved evidence. Invented ones are rejected before the user sees them.
- **It refuses when it does not know.** If retrieval confidence is below threshold, it abstains rather than guessing. In a legal domain a confident wrong answer is worse than no answer.

## Required features (from the problem statement)

| Feature | Meaning |
|---|---|
| RAG-grounded | Answers generated from a curated corpus of real legal documents, not model memory |
| Source-cited | Every answer cites the specific statute, section, rule, or treaty article |
| Never fabricate authority | Must not invent a section number or case. The most important quality bar |
| Jurisdiction toggle | India vs International, kept visibly separate, never conflated |
| Formulation classification | Minimum clarifying questions to determine legal category, then state its requirements |
| ABS compliance helper | Flag biodiversity and benefit-sharing obligations |
| TKDL / prior-art pointer | Point to defensive protection resources |
| Confidence indicator | Show how strongly grounded each answer is |
| Safe abstention | Refuse out-of-scope or low-confidence queries |
| Escalation path | Route to a human IP facilitator |
| Multilingual | Regional language delivery, ideally via Bhashini |
| Version-tracked corpus | Law changes; corpus must be updatable and answers traceable to a version |
| Standing disclaimer | "Information, not legal advice", always visible |
| DPDP-aligned privacy | Audit logs, access control |

## How the problem statement says it will be evaluated

These four are the scoring axes. Optimise for them:

1. **Answer accuracy**
2. **Citation correctness**
3. **Safe abstention** on out-of-scope or uncertain queries
4. **Multilingual quality**

## Staging the problem statement itself permits

The PS explicitly says the build can be staged: "a citation-grounded retrieval MVP first, then the graph and agentic layers, then paid-source connectors and the full multilingual and voice experience."

**We build the MVP well and present the rest as roadmap.** Do not build knowledge graph or agentic orchestration layers before the internal hackathon.

---

# 2. DEADLINES

| Date | Milestone |
|---|---|
| **8 September 2026** | PPT / solution presentation submission. Concept and plan document, not a finished product |
| **~13-14 September 2026** | College internal hackathon. Live working demo required. EXACT DATE STILL TO BE CONFIRMED WITH SPOC |
| **30 September 2026** | National portal submission deadline if we clear internal |
| December 2026 | SIH Grand Finale |

Today is 5 September. Three days to the PPT.

---

# 3. CURRENT STATE OF THE CODEBASE

Roughly 107 files, ~8,700 lines. Built fast, likely AI-scaffolded. **Breadth is well ahead of depth: many features exist as files that do not do what their filename says.** Do not assume a feature works because the file exists.

## Stack as built

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind (`client/`) |
| Application backend | Node.js + Express (`server/`) - auth, sessions, queues, audit |
| AI service | Python + FastAPI (`ai-service/`) - the RAG pipeline |
| Database | PostgreSQL + pgvector |
| Cache / queue | Redis + BullMQ |
| Orchestration | docker-compose, 5 services |
| LLM | OpenAI gpt-4o-mini |
| Embeddings | sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2) |
| Reranker | cross-encoder/ms-marco-MiniLM-L-6-v2 |

## What genuinely works

- **Hybrid retrieval**: dense (pgvector cosine) + sparse (tsvector/BM25), fused with Reciprocal Rank Fusion, then cross-encoder reranking. Properly implemented in `ai-service/app/rag/hybrid_retriever.py`.
- **Jurisdiction filtering** applied at the SQL level in retrieval.
- **Multilingual pipeline**: detect language, translate to English, retrieve, generate, translate back. Statutes correctly kept in English. `ai-service/app/multilingual/bhashini_service.py`.
- **Six classification categories** defined with per-category IP posture, regulatory pathway, ABS flag.
- **ABS helper** and **TKDL pointer** with real case references (turmeric USPTO patent revocation 1997, neem EPO revocation 2000). These are accurate and are excellent demo material.
- **Database schema** with proper document versioning: `documents -> document_versions -> document_chunks` with an `is_current` flag. This is a genuinely good answer to the "version-tracked corpus" requirement.
- Full auth (JWT + Google/Facebook OAuth), escalation queue, facilitator workspace, audit middleware, admin knowledge-base manager.
- **"Thinking trace"** in the UI showing each pipeline step. Good demo device.

## CRITICAL DEFECTS (fix these first)

### Defect 1: `requirements.txt` is missing every ML dependency

`ai-service/requirements.txt` does not include `sentence-transformers`, `torch`, `psycopg2-binary`, or `PyMuPDF`. Every one of those is wrapped in a try/except that silently falls back.

Consequences, all silent:
- **Embeddings**: falls back to a hash-projection function in `ai-service/app/rag/embeddings.py`. Vectors are word hashes. **Semantic search does nothing.** Similarity scores are meaningless.
- **Reranker**: CrossEncoder import fails, falls back to similarity ordering over meaningless scores.
- **Database**: psycopg2 import fails, `get_db_connection()` returns None, **Postgres is never touched**. pgvector, versioning, the whole schema goes unused. Falls back to an in-memory list.
- **PDF ingestion**: `fitz` is None, so admin document upload cannot extract text.

**Fix:** add to `ai-service/requirements.txt`:
```
sentence-transformers>=3.0.0
torch>=2.0.0
psycopg2-binary>=2.9.9
PyMuPDF>=1.24.0
numpy>=1.26.0
```
Then `docker compose build ai-service && docker compose up`. First build pulls ~2GB (torch).

### Defect 2: Citation validation does not validate

`ai-service/app/evaluators/citation_verifier.py`, in `verify_and_extract_citations()`:

The code computes `is_cited` (whether a chunk was actually referenced in the generated answer) and then **never uses it**. Every retrieved chunk is appended with `"verified_grounded": True` hardcoded.

So: retrieve 5 chunks, the LLM cites 1 and invents another, and the system reports 5 "verified" citations and zero hallucinations. This is citation *extraction* labelled as verification. **This is the project's headline claim and it is currently decorative.**

**Fix:** use `is_cited` to gate the append (skip uncited chunks), and add fabricated-citation detection: regex out section references from the generated text, compare against section identifiers in the retrieved set, flag anything not present, and cap confidence when fabrication is detected. Return the fabricated list up through the orchestrator so the API response carries it and the eval script can count it.

### Defect 3: Confidence-based abstention is never called

`CitationVerifier.should_abstain()` exists, is correctly written, respects `settings.CONFIDENCE_ABSTAIN_THRESHOLD`, and appears **only in `ai-service/tests/test_abstention.py`**. It is never invoked in `ai-service/app/agents/rag_orchestrator.py`.

Actual abstention today has only two paths:
1. A hardcoded keyword list in `formulation_classifier.py`: `["quantum", "semiconductor", "microprocessor", "cryptocurrency", ...]`
2. `if not retrieved_evidence and not kg_triples` - literally zero results

Ask "what is the best Ayurvedic treatment for knee pain" and it will NOT abstain. No keyword match, retrieval returns something, it answers.

Worse: `golden_dataset.json` entry `eval_004` is *"I synthesized an artificial quantum semiconductor computer chip..."*, written to match that keyword list. **That test passes by construction, not by capability.**

**Fix:** call `should_abstain(retrieved_evidence, conf_score)` in `rag_orchestrator.process_query()` after confidence scoring (step 10) and before the final return. Delete the `out_of_scope_keywords` list entirely and let retrieval scores do the work. Tune `CONFIDENCE_ABSTAIN_THRESHOLD` (currently 0.50) until in-scope questions pass and out-of-scope ones do not.

### Defect 4: There is no real corpus

`knowledge-base/` contains only a README describing a rich directory tree of statutes. **The directory is otherwise empty.** No PDFs, no source documents.

Everything is hardcoded in `ai-service/app/seed_knowledge.py`: about 10 documents, 22 chunks, and the text is **paraphrased summaries of statutes, not verbatim statutory text**.

Example. Actual Section 3(p):
> "an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components"

What is in the seed:
> "...Ayurvedic classical medicines, home remedies, and known multi-herbal combinations documented in classical texts (such as Charaka Samhita or Ayurvedic Formulary) fall strictly under Section 3(p) and cannot be patented in India."

The second sentence is commentary, not statute. When a judge clicks a citation expecting source text they get someone's interpretation. For a system whose entire pitch is "traceable to the source", this is the weak point.

**Fix:** replace with verbatim text pulled from official sources, with real source URLs. This is research work, not engineering, and runs in parallel with coding. See section 5.

### Defect 5: Fallbacks make broken pipelines look fine

Two fallbacks quietly fake success:

- **`_synthesize_grounded_answer()`** in `rag_orchestrator.py`: with no OpenAI key it emits hardcoded legal prose with section numbers and headings, ignoring retrieved evidence entirely. Looks exactly like a grounded RAG answer. Is not one.
- **`generate_embedding()`**: hash-projection fallback returns confident-looking similarity scores from meaningless vectors.

Together these mean **the demo can look perfect while the RAG pipeline does nothing.**

**Fix:** add loud, unambiguous logging that states which path executed. Before trusting any demo output, verify from logs that the real embedding model loaded and the real LLM call succeeded.

### Defect 6: Golden dataset is too small

`ai-service/app/evaluators/golden_dataset.json` has 5 entries. Need 20-25 for meaningful numbers.

## Lesser divergences (accept, do not fix)

These differ from the original plan but are working and should NOT be rewritten. Rewriting would waste the remaining week.

| Original plan | As built | Verdict |
|---|---|---|
| FastAPI only | Node/Express + FastAPI | Fine. Lets JS and Python people work in parallel |
| ChromaDB | Postgres + pgvector + Redis | Better on substance (real versioning), worse on fragility (5 services) |
| Groq free tier | OpenAI gpt-4o-mini | Add Groq as an alternate provider, do not remove OpenAI |
| Ollama fallback | Not implemented | Worth adding back, see section 6 |
| Rule-based wizard | Keyword matching | Worth fixing, see section 6 |
| No Docker | 5-service compose | Fine, but rehearse cold-start before demo day |

One note: the knowledge graph (`ai-service/app/graph/knowledge_graph.py`, 7 hardcoded nodes, 5 edges) is a Phase 2 item per the PS that got built as a stub while Phase 1's core claim sat broken. Leave it, it is harmless and demos fine. Do not invest more time in it.

---

# 4. REPOSITORY MAP

```
AyuSakshi-IP-SAKTHI-Sahayak-/
├── docker-compose.yml           5 services: postgres, redis, ai-service, backend, frontend
├── .env.example                 copy to .env
├── database/init.sql            schema: documents, document_versions, document_chunks, users, audits
│
├── ai-service/                  PYTHON FASTAPI - the RAG pipeline. Most important directory.
│   ├── requirements.txt         *** MISSING ML DEPS, see Defect 1 ***
│   ├── app/
│   │   ├── main.py              FastAPI routes, seeds corpus at startup
│   │   ├── config.py            settings, thresholds, model names
│   │   ├── seed_knowledge.py    *** the entire corpus lives here, hardcoded, see Defect 4 ***
│   │   ├── agents/
│   │   │   ├── rag_orchestrator.py      *** main 12-step pipeline, see Defects 3 and 5 ***
│   │   │   ├── formulation_classifier.py *** keyword matching, see Defect 3 keyword list ***
│   │   │   ├── ip_router.py
│   │   │   ├── abs_helper.py
│   │   │   └── tkdl_pointer.py
│   │   ├── rag/
│   │   │   ├── embeddings.py            *** hash fallback, see Defect 1 ***
│   │   │   ├── hybrid_retriever.py      dense + BM25 + RRF. Works well
│   │   │   ├── bm25_retriever.py
│   │   │   └── reranker.py
│   │   ├── evaluators/
│   │   │   ├── citation_verifier.py     *** is_cited unused, see Defect 2 ***
│   │   │   ├── golden_dataset.json      *** only 5 entries, see Defect 6 ***
│   │   │   └── run_evaluation.py
│   │   ├── graph/knowledge_graph.py     Phase 2 stub, leave alone
│   │   ├── multilingual/bhashini_service.py
│   │   ├── memory/conversation_memory.py
│   │   └── core/{chunker.py, pdf_extractor.py}
│   └── tests/                   test_abstention, test_classifier, test_grounding, test_rag
│
├── server/                      NODE EXPRESS - auth, sessions, proxying to ai-service
│   └── src/{controllers, routes, middlewares, services, config, queues}
│
├── client/                      REACT FRONTEND
│   └── src/components/
│       ├── chat/{ChatArea, MessageItem, SourceDrawer, ThinkingTrace, QuickActionBar}
│       ├── classification/ClassificationWizard.jsx   *** check if wired to backend ***
│       ├── abs/ABSNavigator.jsx
│       ├── tkdl/TKDLChecker.jsx
│       ├── escalation/EscalationModal.jsx
│       ├── facilitator/FacilitatorQueue.jsx
│       └── admin/KnowledgeBaseManager.jsx
│
├── knowledge-base/              *** EMPTY except README, see Defect 4 ***
└── docs/                        architecture, api, rag-pipeline, database, evaluation, security, deployment
```

## The query pipeline (rag_orchestrator.process_query)

12 steps. Know this flow before changing anything:

1. Language detection and translation to English
2. Conversational query reformulation from history
3. Formulation classification (and out-of-scope gate)
4. IP domain routing
5. Hybrid retrieval and reranking, filtered by jurisdiction
6. Knowledge graph traversal
7. ABS compliance analysis and TKDL prior-art check
8. Abstention check (currently only if zero results)
9. Grounded answer synthesis via LLM (or the hardcoded fallback)
10. Citation verification and confidence scoring
11. Translation back to user's language
12. Update conversation state

---

# 5. THE CORPUS

Target: **30 to 50 verbatim sections** from official sources. Quality and correct citation metadata matter far more than volume.

## Sources (all free and official)

| Source | URL | Use for |
|---|---|---|
| India Code | indiacode.nic.in | All Indian statutes and rules |
| IP India | ipindia.gov.in | Patent manual, GI registry, trademark/design guidance |
| National Biodiversity Authority | nbaindia.org | ABS guidelines, 2024 Rules |
| FSSAI | fssai.gov.in | Ayurveda Aahar Regulations 2022 |
| CDSCO | cdsco.gov.in | NDCT Rules 2019, phytopharmaceutical requirements |
| WIPO | wipo.int | TRIPS, Nagoya, GRATK, PCT, Madrid, Hague, Budapest |
| TKDL | tkdl.res.in | Scope and access material |

## Priority collection order

1. **Patents Act 1970**: Sections 3(p), 3(e), 3(d), 10(4), plus opposition/revocation grounds in 25 and 64
2. **Biological Diversity Act 2002 (as amended 2023)**: Sections 3, 4, 6, 7, 19-21, plus the 2023 amendment exemptions for codified traditional knowledge and registered AYUSH practitioners
3. **Drugs and Cosmetics Act 1940**: Chapter IVA, First Schedule reference, Schedule T
4. **NDCT Rules 2019**: new drug and phytopharmaceutical definitions and data requirements
5. **Drugs and Magic Remedies (Objectionable Advertisements) Act 1954**: Section 3 and its Schedule
6. **FSSAI Ayurveda Aahar Regulations 2022**: definition, claims restrictions
7. **Geographical Indications Act 1999**: key sections
8. **International**: TRIPS Art 27 and 22-24, Nagoya Arts 5-7 and 15-17, WIPO GRATK disclosure article

## Corpus rules (non-negotiable)

1. **Official sources only.** No blogs, no summaries, no AI-generated explainers.
2. **Verbatim text.** Copy the actual statutory language. Do not paraphrase or mix in commentary.
3. **Record for every chunk**: full act/treaty title, section or article number, year, amendment status, exact source URL, date retrieved.
4. **Verify section numbers manually.** Someone must spot-check that each chunk's recorded section number matches the text in that chunk. A wrong section number produces a confidently wrong citation, the worst possible failure for this project.
5. **Chunk along legal structure**, one section or rule at a time, not by character count. Splitting mid-section produces citations pointing at the wrong provision.

---

# 6. WHAT TO DO, IN PRIORITY ORDER

## Immediately (blocking everything else)

1. **Add the missing ML dependencies** to `ai-service/requirements.txt`, rebuild, and confirm from logs that the real embedding model loaded and Postgres connected. Until this is done, nothing downstream is real.
2. **Fix `is_cited`** in `citation_verifier.py`. Roughly 30 minutes. Restores the project's headline claim.
3. **Wire `should_abstain()`** into `rag_orchestrator.py` and delete the out-of-scope keyword list. Roughly 1 hour.
4. **Add logging** that states unambiguously which code path produced each answer (real LLM vs hardcoded fallback, real embeddings vs hash fallback).

## Next

5. **Trace one query end to end** through all 12 pipeline steps and confirm each does what its name says. Suggested query: "Can I patent a classical formulation from Charaka Samhita?"
6. **Check whether `ClassificationWizard.jsx` is actually wired** to the backend. If the wizard collects structured answers, have `/api/classify` consume those instead of keyword-matching free text. This restores the auditability argument (a decision tree is defensible to a regulator, keyword matching is not) and is a real scoring point.
7. **Replace paraphrased seed text with verbatim statutory text** for the top 10-15 sections. Highest-value work available.
8. **Expand `golden_dataset.json` to 20-25 entries.** Include out-of-scope questions that do NOT match any keyword list, e.g. "what is the best Ayurvedic treatment for knee pain", "what are Japan's import requirements for Ayurvedic products".
9. **Run `run_evaluation.py` and record the numbers**, whatever they are. Measured results are the single cheapest differentiator; almost no hackathon team has them.
10. **Add Groq as an alternate LLM provider.** `config.py` already has an `LLM_PROVIDER` field. Roughly 1 hour. Faster than OpenAI and removes the demo-day dependency on a paid key.

## Before the internal hackathon

11. **Add Ollama as a provider.** Gives an offline safety net AND the on-premise sovereignty answer ("runs entirely on government infrastructure, no data leaves the machine"), which a Ministry of Ayush panel is likely to ask about given the DPDP requirement in the PS.
12. **Deploy** and test the URL from a phone on mobile data.
13. **Grow the corpus** toward 30-40 verbatim sections.
14. **Get all 5 Docker services running cold on the actual demo laptop** by 11 September. Not on the day.
15. **Re-run eval**, update numbers.
16. **Feature freeze 12 September.** Rehearse the demo three times, timed. Record a backup video.

## Priority if falling behind

Cut multilingual first, then polish features. **Never cut citations, abstention, or the classification flow.** Those are the core of the problem statement and the differentiators.

---

# 7. DEMO NOTES

## What the answer output should look like

Six parts, always: direct answer first, plain-language explanation, citations with act + section + real source text, confidence badge, next steps, permanent disclaimer.

## The strongest demo moments

1. **Classification into Section 3(p)**: user describes a classical formulation, wizard classifies it, system explains it cannot be patented, points to TKDL as the defensive route, cites the actual section text. A complete, legally correct, well-cited narrative in 30 seconds.
2. **Clicking a citation and showing the real statutory text.** This is the moment a judge sees the answer is verifiable rather than generated. It is the single most important thing to demo, and it is why Defect 4 matters.
3. **Jurisdiction toggle**: same question, India vs International, showing the answer set and sources change.
4. **Deliberate abstention**: ask something out of scope and show it refusing. Say out loud that this is a feature, and why it matters in a legal domain.

## Questions to prepare for

- Why RAG instead of fine-tuning? Citation traceability and updatability. A fine-tuned model cannot cite and cannot be updated when the law changes.
- How do you know it will not hallucinate a fake section? Programmatic citation validation against the retrieved set, plus abstention below a score threshold. Show the measured number.
- What happens when the law is amended? Re-run ingestion, corpus version increments, answers carry the version.
- Is this legal advice? No. Standing non-dismissible disclaimer, plus escalation to a human IP facilitator.
- How does it run inside a ministry with data restrictions? Ollama on-premise mode, no data leaves the machine.
- How big is your corpus and is it authoritative? Answer honestly with the real number and named official sources.
- What did you not build? Answer honestly and point to the staged roadmap. Do not oversell.

## Honesty rule

Do not fake screenshots or claim features that are not wired. Faked demos get found in Q&A. If something is roadmap, label it roadmap. The staged framing is explicitly invited by the problem statement, so saying "this is Phase 1, here is Phase 2" is a strength, not an admission.

---

# 8. WORKING NOTES FOR CLAUDE CODE

- **Do not rewrite the stack.** Node+FastAPI+Postgres is heavier than ideal but it works and there is no time. Fix wiring, not architecture.
- **Do not trust a filename.** Several modules do not do what they are named. Read the implementation before assuming behaviour.
- **Do not build Phase 2 features** (knowledge graph expansion, agentic orchestration, paid connectors, voice). The PS explicitly stages them later.
- **Preserve the fallbacks but make them loud.** They are useful for offline development; they are dangerous when silent.
- **When editing the corpus**, verbatim statutory text only, with source URL and retrieval date in metadata.
- **Team writing preference: avoid em dashes** in any generated documentation, README text, or user-facing copy.
