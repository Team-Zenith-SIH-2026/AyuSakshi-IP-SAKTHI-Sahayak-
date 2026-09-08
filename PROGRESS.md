# AyuSakshi (IP-SAKTI Sahayak) — Master Project Progress & Architecture Guide

> **Project Reference Guide**  
> This document records system architecture, verified capabilities, remaining tasks, and operational guidelines.  
> **SIH 2026 Problem Statement:** SIH26045 — Ministry of Ayush & AIIA | **Team:** Team Zenith  
> **Contributor:** `anudeepdevineni10`  

---

## 1. Executive Summary & Core Mission

### The Core Problem
Anyone creating or commercializing an Ayurvedic formulation (innovators, startups, Vaidyas, cultivators) must navigate three complex, overlapping legal frameworks:
1. **Intellectual Property Law**: Patents (Patents Act 1970 § 3(p) TK bar), Trademarks, Geographical Indications, Designs, Plant Varieties.
2. **Access & Benefit Sharing (ABS)**: Biological Diversity Act 2002 & 2023 Amendment (NBA/SBB approvals, traditional knowledge exemptions).
3. **Drug Regulatory Law**: Drugs & Cosmetics Act 1940 (Classical vs. Patent/Proprietary vs. New Drug vs. Phytopharmaceutical), FSSAI Ayurveda Aahara 2022.

**Key Architectural Insight**: Regulatory classification determines everything downstream. Classifying a product incorrectly invalidates all subsequent legal advice.

### The Solution: AyuSakshi
A dual-stage AI assistant:
1. **Classify First**: Deterministic 6-category decision tree (1–5 questions, explainable audit trail).
2. **Advise with Verbatim Legal Citations**: Hybrid RAG (dense + BM25 + Cross-Encoder) retrieving verbatim statutory text, verifying citations against evidence to eliminate hallucinations, and abstaining safely when uncertain.

---

## 2. System Architecture & Topology

The platform runs as a coordinated 5-container microservice stack:

```
[ FRONTEND: React 18 + Vite + Tailwind ] (Port 5173, Nginx)
          │ REST / SSE
          ▼
[ APPLICATION BACKEND: Node.js + Express + BullMQ ] (Port 5000)
    │                  │                      │
    ▼ Postgres (5432)  ▼ Redis (6379)         ▼ Internal HTTP API
[ POSTGRESQL + PGVECTOR ]            [ AI SERVICE: Python FastAPI + LangGraph ] (Port 8000)
- Relational tables & users          - Hybrid RAG (Dense MiniLM-multilingual + BM25 + RRF)
- pgvector 384-dim embeddings        - Citation regex validation & anti-hallucination
- Document versioning (SHA-256)      - Multi-provider LLM chain (Groq / OpenAI / Ollama)
```

### Access Ports & Default Credentials
- **Frontend Portal**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000` (Health check: `/health`)
- **AI Service API**: `http://localhost:8000` (Docs: `/docs`)
- **Database**: PostgreSQL 16 on `localhost:5432` (`database/init.sql`)
- **Cache / Job Queue**: Redis 7 on `localhost:6379`

**Default Demonstration Accounts** (Password: `Ayurveda@2026`):
- `admin@ayusakshi.gov.in` (Admin: Document upload & corpus management)
- `facilitator@ayusakshi.gov.in` (IP Facilitator: User inquiry escalation review)

---

## 3. Current State: What is DONE & VERIFIED (as of 7 Sept 2026)

### 3.1 Verbatim Legal Knowledge Base (`knowledge-base/`)
- **13 Official Statutory Gazette PDFs** stored in `knowledge-base/source/`, held as the provenance record behind the curated corpus:
  - Patents Act 1970 (Consolidated)
  - Biological Diversity Act 2002 & BD (Amendment) Act 2023
  - **Biological Diversity Rules, 2024** (Notification G.S.R. 665(E), 22 Oct 2024 — Forms 1–16, ABS fee schedules, BMC certificates)
  - Drugs and Cosmetics Act 1940 (with First Schedule authoritative texts list & Rule 158-B)
  - Drugs and Magic Remedies (Objectionable Advertisements) Act 1954
  - Geographical Indications of Goods Act 1999
  - New Drugs and Clinical Trials Rules 2019
  - FSSAI (Ayurveda Aahara) Regulations 2022
  - Trade Marks Act 1999, Designs Act 2000, Copyright Act 1957, PPVFR Act 2001
- **100% Verbatim JSON Corpora** (`knowledge-base/corpus/`):
  - `india.json`: 22 verbatim chunks across 9 Indian statutes.
  - `international.json`: 16 verbatim chunks across Nagoya Protocol, CBD, TRIPS, and WIPO GRATK Treaty 2024.
  - All paraphrased summaries replaced with authentic legal text.

**What retrieval actually searches (state the real number, do not round it up):**

| Layer | Chunks | Provenance |
|---|---|---|
| Curated verbatim corpus (13 documents) | 38 | Hand-transcribed, per-chunk source URL, retrieval date, plain-language `retrieval_context` |
| Bulk PDF extraction, 4 documents with no curated equivalent (BD Rules 2024, Copyright, Designs, PPVFR) | 325 | Auto-extracted by the section-aware chunker, section labels not hand-verified |
| **Total live (`is_current = TRUE`)** | **363** | |

Superseded bulk-extraction versions of the 13 curated documents remain in
`document_versions` with `is_current = FALSE`. They are retained as an audit
trail and are deliberately not retrieved: their section labels are machine-
guessed, which is incompatible with the citation guarantee.

> **Corpus caveat to state honestly if asked.** Every document in
> `knowledge-base/corpus/*.json` still carries
> `"verification_status": "pending_human_check"`. The text was transcribed from
> official sources, but the manual section-number spot-check required by the
> project's own corpus rules has not been signed off. Until it is, describe the
> corpus as verbatim and source-linked, not as human-verified.

### 3.2 AI RAG Engine & Anti-Hallucination (`ai-service/`)
- **Dense + Sparse Hybrid Retrieval**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` embeddings (384-dim) + PostgreSQL `tsvector` BM25, combined via Reciprocal Rank Fusion (RRF). The multilingual model is deliberate: it lets a Hindi or Tamil query embed into the same space as English statutory text.
- **Cross-Encoder Reranking**: `cross-encoder/ms-marco-MiniLM-L-6-v2` reranks top candidates.
- **Strict Citation Verification**: `citation_verifier.py` scans LLM output with regex against retrieved provision IDs. If an invented section is detected, confidence is capped at 0.25 and safe abstention is triggered.
- **Safe Abstention**: `should_abstain()` evaluates retrieval score thresholds instead of hardcoded keyword lists.
- **Multi-Provider LLM Chain**: `providers.py` supports Groq (`openai/gpt-oss-20b`), OpenAI (`gpt-4o-mini`), and local Ollama (`qwen2.5`) with automatic 429 rate-limit backoff.
- **Section-Aware PDF Chunker**: `chunker.py` stitches page breaks before splitting sections to avoid severed clauses.
- **Idempotent DB Seeder**: `seed_knowledge.py` loads corpus JSON into pgvector using SHA-256 content hashing.

### 3.3 Regulatory Classification Decision Tree (`classification_tree.py`)
- Deterministic 6-category formulation classification:
  1. Classical / Generic Medicine (First Schedule DCA 1940 -> § 3(p) non-patentable)
  2. Patent or Proprietary Medicine (P or P) (§ 33EEB synergistic efficacy)
  3. New Drug (Rule 122E DCA / NDCT Rules 2019)
  4. Phytopharmaceutical Drug (Rule 2(aa) NDCT Rules 2019)
  5. Ayurveda Aahara (FSSAI Regulations 2022)
  6. Ayurvedic Cosmetic
- Reached in 1–5 structured questions; returns full explainable decision path for regulators.

### 3.4 Frontend UI & Design System (`client/`)
- **Conversational Intent Engine**: Detects greetings (*"Hi"*, *"Hello"*, *"Namaste"*), system orientation (*"Who are you?"*), and gratitude (*"Thank you"*) to return warm, authoritative system capability overviews rather than falsely abstaining against legal statutes.
- **Botanical Redesign**: High-contrast light and dark themes with `BotanicalBackdrop.jsx` and `LeafMark.jsx`.
- **Word-by-Word Streaming Animation**: `FormattedAnswer.jsx` renders AI responses progressively with a smooth typewriter cadence and pulsing emerald cursor. Users can click any message to instantly reveal full text.
- **Persistent Disclaimer Bar**: Statutory non-dismissible advisory banner across all pages.
- **Markdown Answer Rendering**: Headings, lists, bold definitions, code tokens, and citation popovers.
- **Double-Submission Prevention**: Synchronous `isSendingRef` in `ChatContext.jsx`.
- **OAuth Callback Handler**: Preserved teammate Pavan's `OAuthCallbackPage.jsx` and route in `App.jsx`.

### 3.5 Database & Backend Services (`server/`, `database/`)
- **Bcrypt Hash Fix**: `init.sql` updated with working bcrypt hashes so admin and facilitator accounts log in reliably.
- **Node Backend Integration**: Clean proxying to AI service, BullMQ document ingestion queue, JWT auth, and password reset service.

---

## 4. What is STILL LEFT TO DO (Prioritized Roadmap)

### 🔴 Phase 1: High Priority (Immediate / Demo Preparation)
1. **Run 25-Case Golden Evaluation Benchmark**:
   - Execute: `python ai-service/app/evaluators/run_evaluation.py`
   - Capture live metrics for presentation slides: Answer Grounding (Target: 100%), Citation Correctness (>85%), Abstention Accuracy (>95%), Fabricated Authority Delivered (Target: 0).
2. ~~**Abstention Threshold Calibration**~~ — **superseded. Do not do this.**
   - The plan was to lower `CONFIDENCE_ABSTAIN_THRESHOLD` from `0.50` to `0.40–0.45`
     to stop valid queries being refused. That could never have worked: every
     false refusal was arriving at confidence exactly `0.0`, and no positive
     threshold rescues a zero. The threshold was not the problem and remains 0.50.
   - The actual causes are recorded in section 6 below and are fixed.
3. ~~**Dynamic API Wiring for ABS Navigator & TKDL Modals**~~ — **done.**
   - Both modals asserted statute directly in JSX, which meant the one surface
     showing statutory authority did so without passing through retrieval or
     citation verification. The ABS Navigator now describes each scenario in
     plain language and puts the question to the live pipeline; the TKDL Checker
     gained the herb input its unused `queryHerb` state had always implied. In
     both, provisions reach the user only with verified citations attached.
4. **Slide Presentation Alignment (8 Sept PPT)**:
   - Structure pitch around the 4 pillars:
     * 100% Verbatim Statutory Grounding (No hallucinated sections).
     * Explainable Decision Tree Classification (not a black-box prompt).
     * Dual-Regime Isolation (India vs. International WIPO/Nagoya).
     * Complete Enterprise Architecture (Admin Document Ingestion + Facilitator Review Queue).

### 🟡 Phase 2: Medium Priority (Before Sept 13–14 Hackathon Demo)
5. **Cold-Start Rehearsal on Demo Laptop**:
   - Run `docker compose up -d` on the actual presentation machine. Verify memory allocations in Docker Desktop.
6. **Ollama On-Premise Demonstration**:
   - Install Ollama (`ollama pull qwen2.5:7b`) to showcase offline/air-gapped ministry deployment capability.
7. **Mobile Viewport Polish**:
   - Verify layout responsiveness on mobile screens in case judges test on phones.

### 🟢 Phase 3: Long-Term (National Portal Submission — 30 Sept)
8. **Corpus Expansion**:
   - [x] **Biological Diversity Rules 2024** (Notification G.S.R. 665(E), 22 Oct 2024 — ingested 86 pages/chunks).
   - [ ] Ingest Drugs and Cosmetics Rules 1945 (specifically Rule 158-B licensing evidence requirements & Schedule T GMP).
   - [ ] Ingest DMR Act disease schedules & Patents Rules 2024.
9. **Automated End-to-End Test Suite**:
   - Wire GitHub Actions CI pipeline to run Node backend and Python unit tests automatically on PRs.

---

## 5. Developer & AI Operational Rules

1. **Docker Hot-Reloading Rules**:
   - **`ai-service`**: `app/` is volume-mounted. Python changes only require:
     ```bash
     docker restart ayusakshi_ai_service
     ```
     (Rebuild required only when `requirements.txt` changes).
   - **`backend`**: NOT volume-mounted. Any Node.js change requires:
     ```bash
     docker compose build backend && docker compose up -d backend
     ```
   - **`frontend`**: NOT volume-mounted. Any React change requires:
     ```bash
     docker compose build frontend && docker compose up -d frontend
     ```

2. **LLM Provider Governance**:
   - **Groq Token Limits**: 200,000 tokens/day per model on free tier.
   - Recommended default model in `.env`: `GROQ_MODEL=openai/gpt-oss-20b`. Note that
     `config.py` and `docker-compose.yml` both fall back to `openai/gpt-oss-120b`
     when the variable is unset, so leave it set explicitly in `.env`.
   - Fallbacks if rate-limited: `qwen/qwen3.8-27b` or local Ollama.

3. **Statutory Search Requirement**:
   - When adding chunks to `knowledge-base/corpus/*.json`, **always include a `retrieval_context`**. Statutes rarely use colloquial search keywords (e.g. § 3(p) does not contain the word "patent" or "Ayurvedic"); the plain-language retrieval context is essential for dense vector retrieval.

4. **Git Hygiene & Privacy**:
   - Ensure author is set to `anudeepdevineni10 <anudeepdevineni10@gmail.com>`.
   - Never commit `.env` or personal file paths. Keep private tools in `.git/info/exclude`.

---

## 6. Defect Investigation, 8 September 2026

The 7 September benchmark reported 50% citation correctness, 56% abstention
accuracy and nine false refusals out of 25, including `brief_01`, the Charaka
Samhita question used as the primary demo. Root causes, in the order they
mattered:

### 6.1 The verbatim corpus was in the database but unreachable

`document_versions` allows one current version per document. Bulk PDF ingestion
wrote a second version of each statute under the same deterministic document id
and set `is_current = TRUE` on itself, demoting the hand-transcribed version.
Retrieval filters on `is_current`, so **nine of the thirteen curated documents
were invisible to search**, including the entire Patents Act corpus containing
Section 3(p).

The seeder could not heal this because its idempotency check asked "does this
version row exist" rather than "is this version the one retrieval will read". The
row existed, so it skipped, every time, permanently.

Every query was therefore being answered from auto-extracted PDF text whose
section labels were machine-guessed, which is precisely what the citation
guarantee is supposed to exclude. `seed_knowledge.py` now re-asserts the verbatim
version as current and logs loudly whenever it has to.

### 6.2 Dense retrieval results were being discarded

The final filter in `hybrid_retrieve` read the dense similarity score into a
variable and then never tested it. Acceptance rested on lexical overlap alone,
which discards exactly the semantically-retrieved chunks dense search exists to
find. Query tokens also came from a bare `.split()`, so `"india?"` could never
match `india`. `SIMILARITY_THRESHOLD` was defined in config and read by nothing.

### 6.3 Confidence was computed against evidence the answer never used

Confidence averaged similarity and rerank scores across *all* retrieved chunks.
Retrieval deliberately fetches a wide candidate set, so one exact hit among four
near-misses scored no better than five mediocre chunks. Worse, chunks found only
by BM25 carry no cosine similarity at all, and the missing value was being
averaged in as `0.0`.

Post-fix, `brief_01` retrieves Section 3(p) at rerank 6.27 and scores 0.699
where it previously scored 0.488 and was refused two hundredths below the
threshold. **The threshold was never the problem.**

### 6.4 Irrelevant chunks were being presented as citations

A chunk labelled just `"4"` matched the substring test against any answer
containing the digit 4. Chunks the cross-encoder scored at -6.3 were being shown
to users as supporting authority. There is now a minimum label specificity and a
cross-encoder relevance floor (`CITATION_RELEVANCE_FLOOR`).

### 6.5 The anti-fabrication prompt was suppressing citation

The system prompt told the model that naming an unlisted provision would cause
the whole answer to be discarded, without ever telling it to cite the provisions
it *was* given. A cautious model answers without naming anything, which the
verifier then scores as ungrounded. The rule is now two-sided.

### 6.6 The benchmark could not distinguish its own failure modes

`abstention_reason` was returned by the pipeline and dropped by the harness, so
"retrieved nothing" and "retrieved but verified nothing" both surfaced as
confidence 0.0. Four `expected_statutes` strings could never match any corpus
label regardless of behaviour, and expectations were matched against all
citations joined into one blob, so an Act from one citation could satisfy an
expectation paired with a section from another.

### 6.7 Compose could not start in this directory

The folder name contains `--_`, which yields adjacent separators in the derived
image reference and Docker rejects it: `invalid reference format`. Fixed by
pinning `name: ayusakshi` in `docker-compose.yml`. `docker-compose.yml` also
never forwarded `EMBEDDING_MODEL`, so `.env` edits to it silently did nothing.
