# AyuSakshi (IP-SAKTI Sahayak) — System Status & Architectural Runbook

**SIH 2026 — Problem Statement SIH26045**  
**Ministry of Ayush / All India Institute of Ayurveda (AIIA) | Team Zenith**  
**Branch / Contributor:** `anudeepdevineni10`  
**Last Updated:** 7 September 2026  

---

## 1. Project Roadmap & Delivery Milestones

| Target Date | Milestone Stage | Operational Focus |
|---|---|---|
| **8 September 2026** | Solution Presentation & Architecture Brief | Core RAG pipeline demonstration & regulatory framework alignment |
| **~13–14 September 2026** | Internal Evaluation & Live Working Demo | End-to-end containerized deployment verification |
| **30 September 2026** | National Portal Final Submission | Complete corpus indexing and benchmark suite results |
| **December 2026** | Grand Finale Presentation | Full multi-jurisdictional compliance and scaling |

---

## 2. Multi-Container Deployment Runbook

The platform runs as a coordinated 5-service stack orchestrated via Docker Compose:

```bash
# Launch all microservices in detached mode
docker compose up -d
```

Access the web portal at **`http://localhost:5173`**

### Service Registry

| Microservice | Port | Technology Stack | Functionality |
|---|---|---|---|
| **Frontend** | `5173` | React 18, Vite, Tailwind CSS, Nginx | Responsive UI, Jurisdiction Switcher, Citation Modals, Escalation Workflow |
| **Backend** | `5000` | Node.js, Express, BullMQ, Redis | Session authentication, RBAC, audit logging, document ingestion queue |
| **AI Engine** | `8000` | Python, FastAPI, LangGraph, PyMuPDF | 12-step RAG pipeline, dense+sparse hybrid retrieval, citation validation |
| **Database** | `5432` | PostgreSQL 16 + pgvector | Relational entities, vector embeddings, versioned statutory corpora |
| **Cache & Queue** | `6379` | Redis 7 | BullMQ background jobs, rate-limiting, and ephemeral state |

### Seeded Demonstration Accounts
Seeded in `database/init.sql` (Default credential: `Ayurveda@2026`):
- **Administrator**: `admin@ayusakshi.gov.in` (Full corpus management, manual document ingestion)
- **IP Facilitator**: `facilitator@ayusakshi.gov.in` (Review queue, user inquiry escalation)

### Build & Hot-Reload Guidelines
- **AI Service**: `ai-service/app/` is volume-mounted for rapid iteration. Python updates apply via `docker restart ayusakshi_ai_service`. Rebuild required only when `requirements.txt` changes.
- **Backend**: Containerized build. Apply Node.js changes via `docker compose build backend`.
- **Frontend**: Production Nginx container. Apply React/Tailwind changes via `docker compose build frontend`.

---

## 3. Verified System Capabilities

### 3.1 Core Pipeline Validation
| Capability | Status | Verification Details |
|---|---|---|
| **Statutory Grounding** | Active & Verified | Queries generate answers derived strictly from retrieved statutory evidence (tested with live LLM generation). |
| **Verbatim Legal Citations** | Active & Verified | Citation drawer displays exact verbatim legal provisions directly transcribed from official Gazette notifications and acts. |
| **Hallucination Prevention** | Active & Verified | Citation verification inspects referenced section numbers against the retrieved evidence pool, capping confidence and enforcing abstention if unauthorized sections appear. |
| **Safe Abstention Gate** | Active & Verified | Intelligently abstains with clear reasoning on out-of-scope queries rather than fabricating legal answers. |
| **Jurisdiction Isolation** | Active & Verified | Strict metadata separation between **India (National)** and **International** regulatory corpora. |
| **Statute Versioning** | Active & Verified | Document updates automatically deprecate preceding revisions (`is_current=false`) while maintaining an immutable audit trail. |

### 3.2 Statutory Corpus Composition (100% Verbatim Source Data)
All corpus chunks are transcribed directly from official Gazette notifications and legal texts in `knowledge-base/source/`:

- **India Legal Regime (9 Instruments, 22 Chunks)**:
  - *Patents Act, 1970*: Sections 2(1)(j), 3(d), 3(e), 3(p), 10(4), 25(1)(j), 64(1)(p)
  - *Biological Diversity Act, 2002*: Sections 3, 4, 6, 7
  - *Biological Diversity (Amendment) Act, 2023*: Section 6, Section 7 Proviso (codified traditional knowledge exemptions)
  - *Drugs & Cosmetics Act, 1940*: Sections 3(a), 3(h), First Schedule authoritative texts list, Rule 158-B
  - *Drugs & Magic Remedies (Objectionable Advertisements) Act, 1954*: Section 3
  - *Geographical Indications of Goods Act, 1999*: Section 2(1)(e)
  - *New Drugs and Clinical Trials Rules, 2019*: Section 2(aa) phytopharmaceuticals
  - *FSSAI (Ayurveda Aahara) Regulations, 2022*: Section 2(b)
  - *Trade Marks Act, 1999*: Section 9

- **International Legal Regime (4 Instruments, 16 Chunks)**:
  - *Nagoya Protocol on Access and Benefit-Sharing*: Articles 5, 6, 7, 15, 16, 17
  - *Convention on Biological Diversity (CBD)*: Articles 8(j), 15
  - *WTO TRIPS Agreement*: Articles 22, 27
  - *WIPO GRATK Treaty (2024)*: Articles 1 through 6

### 3.3 Verified Functional Modules
- **Interactive Conversational AI**: 12-step LangGraph orchestration with citation verification and confidence estimation.
- **Formulation Classification Engine**: Deterministic, 6-category regulatory decision tree (1–5 structured questions) providing a regulator-ready audit trail.
- **Multilingual Pipeline**: Query translation and cross-lingual retrieval with official English statutory citations preserved intact.
- **Facilitator Escalation Workflow**: End-to-end routing of flagged or low-confidence queries to registered IP specialists.
- **Document Ingestion Engine**: Automated multi-page PDF extraction, structure-aware chunking, and idempotent pgvector upserts.
- **Role-Based Access Control**: Secure JWT issuance and endpoint-level authorization checks.
- **Regulatory Legal Disclaimer**: Persistent, non-dismissible advisory banner.

---

## 4. Architectural Hardening & Enhancements

Key architectural upgrades implemented in the core platform:

| Component | Technical Enhancement | Impact |
|---|---|---|
| **Retrieval Engine** | Hybrid Dense (`bge-small-en-v1.5`) + Sparse BM25 fused via Reciprocal Rank Fusion (RRF) | Eliminates semantic disconnect between natural language questions and formal legal phrasing. |
| **Citation Verifier** | Structural regex pattern matching against cited provisions | Guarantees that only statutory provisions actually leveraged in the synthesis are presented as authoritative citations. |
| **Abstention Logic** | Dynamic evidence-based abstention scoring | Replaced rigid keyword matching with semantic sufficiency thresholds. |
| **Data Ingestion** | Full-document buffer stitching before section splitting | Prevents provisions from being fractured across arbitrary PDF page boundaries. |
| **Storage Idempotence** | Cryptographic SHA-256 content hashing on document versions | Guarantees idempotent corpus seeding and version tracking. |
| **Entailment Metrics** | Live entailment calculation bound to citation verification | Dynamically reflects authentic grounding confidence scores in the user interface. |

---

## 5. Development Roadmap & Staged Enhancements

### Phase 1 Priority Items
1. **Dynamic RAG Binding for Specialized Modals**: Connect the ABS Navigator and TKDL Checker interactive UI workflows directly to the live RAG query service for dynamic, context-specific citations.
2. **Abstention Threshold Fine-Tuning**: Optimize the confidence threshold (`CONFIDENCE_ABSTAIN_THRESHOLD`) specifically against verbatim statutory text to minimize false refusals on complex technical queries.
3. **Automated Benchmark Execution**: Re-run the automated 25-case evaluation harness (`run_evaluation.py`) across all evaluation axes (Answer Grounding, Citation Correctness, Abstention Accuracy, Fabricated Authority).

### Phase 2 Roadmap
- **Offline / Edge Deployment**: Validate local on-premise execution using containerized Ollama models (`qwen/qwen2.5` / `llama3`) for air-gapped ministry server installations.
- **Corpus Expansion**: Ingest remaining supplementary regulatory texts (Biological Diversity Rules 2024, Full DMR Act schedules, and PPVFR Act).
- **Responsive Layout Optimization**: Further refine mobile viewing viewports for handheld inspection during live demonstration sessions.

---

## 6. Operational Considerations & Best Practices

- **LLM Rate-Limiting & Governance**: When utilizing external inference APIs (Groq/OpenAI), adhere to per-model token quotas. Recommended default for testing: `openai/gpt-oss-20b` or local Ollama instances.
- **Retrieval Context Indexing**: Ensure all statutory entries maintain high-quality `retrieval_context` descriptors in their metadata to bridge colloquial user inquiries with statutory definitions.
- **Daemon Pre-flight Check**: Verify the Docker daemon is fully initialized prior to launching microservice orchestration.

---

## 7. Primary Architectural References

| Path | Description |
|---|---|
| `knowledge-base/corpus/*.json` | Source-of-truth verbatim legal corpora |
| `knowledge-base/source/*.pdf` | Official statutory publications and Gazette extracts |
| `ai-service/app/agents/rag_orchestrator.py` | 12-step legal RAG pipeline |
| `ai-service/app/evaluators/citation_verifier.py` | Statutory validation and citation enforcement |
| `ai-service/app/agents/classification_tree.py` | Deterministic regulatory classification wizard |
| `ai-service/app/rag/hybrid_retriever.py` | Dense vector + lexical BM25 retrieval |
| `ai-service/app/llm/providers.py` | Multi-provider LLM failover abstraction |
| `ai-service/app/seed_knowledge.py` | Idempotent pgvector database loader |
| `database/init.sql` | Relational and vector schema definition |
