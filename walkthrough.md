# AyuSakshi (IP-SAKTI Sahayak) — Walkthrough & Verification Report

**Project**: AyuSakshi (IP-SAKTI Sahayak)  
**Problem Statement**: SIH26045 — Multilingual, RAG-based (source-cited) AI assistant for Intellectual Property and regulatory guidance in Ayurveda, across national and international regimes.

---

## 1. System Topology & Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND: React + Tailwind CSS + Lucide                     │
│  - Dark & Light Theme with Instant Theme Toggler                                │
│  - Auth Modal: Email/Password + Google & Facebook Social Login                  │
│  - Jurisdiction Switcher ([ India 🇮🇳 ] | [ International 🌍 ])                 │
│  - Conversational Chatbot UI with Stateful Memory & Context Continuity          │
│  - Deep Thinking / RAG Trace, Source Drawer Modal, ABS & TKDL Navigators        │
│  - Human IP Facilitator Escalation Modal & Admin Knowledge Corpus Manager       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST / SSE Stream (JWT Auth)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     APPLICATION BACKEND: Node.js + Express                      │
│  - Authentication & OAuth (Local JWT + Google & Facebook OAuth strategies)       │
│  - Role-Based Access Control (Practitioner, Researcher, MSME, IP Facilitator)   │
│  - Conversational Session & Context Memory Store                                │
│  - Document Ingestion API & BullMQ Job Queue Producer                          │
│  - Rate Limiting, Audit Logging & Human Escalation Management                   │
│  - Reverse Proxy / Secure Internal AI Bridge                                    │
└───────────────┬────────────────────────┬────────────────────────┬───────────────┘
                │                        │                        │
       PostgreSQL Queries         Redis Cache & Queue      Internal AI HTTP API
                │                        │ (BullMQ)               │
                ▼                        ▼                        ▼
┌─────────────────────────┐   ┌────────────────────┐   ┌──────────────────────────┐
│   POSTGRESQL + PGVECTOR │   │    REDIS ENGINE    │   │    AI SERVICE: Python    │
│ - Users, Roles, Audits  │   │ - Job Queue        │   │    (FastAPI + LangGraph) │
│ - Conversations & Chats │   │ - Response Caching │   │ - Structure-Aware Chunking│
│ - Documents & Versions  │   │ - Rate Limit Store │   │ - Multilingual Embedding │
│ - Relational KG Entities│   │ - Ephemeral State  │   │ - Hybrid (Dense + BM25)  │
│ - Chunks & Vectors (1536│   │ - Session Memory   │   │ - Cross-Encoder Reranker │
│   / 384 dimensions)     │   └────────────────────┘   │ - Conversational Memory  │
└─────────────────────────┘                            │ - Bhashini API Translate │
                                                       │ - Agentic Routing Graph  │
                                                       │ - Citation Verifier & KG │
                                                       │ - Abstention & Confidence│
                                                       └──────────────────────────┘
```

---

## 2. Implemented Features & Core Modules

### A. Strict Jurisdiction Isolation
- Explicit toggle between **India 🇮🇳** and **International 🌍** in the navbar.
- Hard metadata filtering on vector and BM25 queries ensures no cross-contamination between legal regimes.

### B. Stateful 6-Category Formulation Classifier
1. **Classical / Generic Medicine** (First Schedule DCA 1940: Charaka, Sushruta, AFI $\rightarrow$ Section 3(p) non-patentable).
2. **Patent or Proprietary Medicine (P or P)** (Section 33EEB $\rightarrow$ proof of synergistic efficacy required).
3. **New / Non-Classical Drug** (Novel botanical entity / modified ratio $\rightarrow$ CDSCO clinical approval).
4. **Phytopharmaceutical** (Purified fraction with $\ge 4$ markers $\rightarrow$ Rule 122E, Schedule Y).
5. **Ayurveda-Aahar / Nutraceutical** (FSSAI 2022 Regulations $\rightarrow$ Mandatory logo & 'Not for Medicinal Use' disclaimer).
6. **Cosmetic** (Topical preparations for beauty/cleansing $\rightarrow$ Nice Class 3, Form 32-A license).
- Asks minimal clarifying questions if formulation inputs are ambiguous.

### C. Access & Benefit Sharing (ABS) Navigator
- Biological Diversity Act 2002 (Amended 2023) & Biological Diversity Rules 2024.
- Identifies **Section 6(1)** mandatory National Biodiversity Authority (NBA) prior approval for IP applications via **Form III**.
- Identifies **Section 7** State Biodiversity Board (SBB) prior intimation for commercial entities via **Form A**.
- Highlights **2023 Statutory Exemptions** for registered AYUSH practitioners (Vaidyas and Hakims) and local growers.

### D. TKDL & Defensive Prior-Art Pointer
- Codifies classical texts (Charaka, Sushruta, Ashtanga Hridaya, API) for major medicinal herbs (*Triphala, Ashwagandha, Turmeric, Neem, Brahmi*).
- Explains international patent examination access under WIPO, USPTO, EPO, and JPO TKDL access agreements.

### E. Source Citations & Transparent Confidence
- Every factual answer is linked to statutory chunks with section numbers (`Section 3(p)`, `Rule 157`, `Article 27(3)(b)`).
- Clickable citation chips open the **Interactive Source Drawer Modal** displaying authority, effective version, and official registry link.
- Transparent composite confidence score:
  $$\text{Confidence} = 0.30 \times \text{Sim}_{\text{dense}} + 0.30 \times \text{Score}_{\text{rerank}} + 0.20 \times \text{Coverage}_{\text{citations}} + 0.20 \times \text{CitationCount}$$
- **Safe Abstention**: Refuses to hallucinate on out-of-scope or ungrounded queries and offers human IP facilitator review.

### F. Human IP Facilitator Escalation Workspace
- One-click escalation captures conversation context, retrieved evidence, and uncertainty notes into a facilitator review ticket.
- Facilitator workspace provides ticket status management (`PENDING`, `IN_REVIEW`, `RESOLVED`, `CLOSED`) and guidance recording.

### G. UI/UX & Dark/Light Themes
- Styled with Tailwind CSS matching reference images: dark luminous emerald glows, clean typography, thinking trace accordions, and instant Light/Dark theme toggle.
- Authentication modal supporting local JWT + **Google and Facebook Social Login**.

---

## 3. Test & Verification Results

### 1. Python AI Service Unit Tests (Pytest)
```
platform win32 -- Python 3.14.6, pytest-9.1.1
collected 12 items

tests\test_abstention.py ..                                              [ 16%]
tests\test_classifier.py .....                                           [ 58%]
tests\test_grounding.py .                                                [ 66%]
tests\test_rag.py ....                                                   [100%]

============================= 12 passed in 0.18s ==============================
```

### 2. Golden Evaluation Benchmark (`run_evaluation.py`)
```
==========================================================================
  [*] Running AyuSakshi RAG Golden Benchmark (5 Test Cases)
==========================================================================
[PASS] eval_001 | Jur: india | Citations: 4 | Conf: 0.48
[PASS] eval_002 | Jur: india | Citations: 3 | Conf: 0.50
[PASS] eval_003 | Jur: international | Citations: 2 | Conf: 0.48
[PASS] eval_004 | Jur: india | Citations: 0 | Conf: 0.00 (Safe Abstention Triggered)
[PASS] eval_005 | Jur: india | Citations: 4 | Conf: 0.45
--------------------------------------------------------------------------
  [RESULT] Overall Golden Benchmark Accuracy: 100.0% (5/5 PASS)
==========================================================================
```

### 3. Node.js Backend Tests
```
✔ Password Hashing and JWT verification (127.6423ms)
✔ Jurisdiction separation verification (0.5927ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
```

### 4. React + Tailwind CSS Production Build
```
vite v6.4.3 building for production...
✓ 1651 modules transformed.
dist/index.html                   1.07 kB │ gzip:  0.63 kB
dist/assets/index-DLOscs2s.css   38.91 kB │ gzip:  6.82 kB
dist/assets/index-3T_pvUZp.js   299.35 kB │ gzip: 87.20 kB
✓ built in 2.14s
```

---

## 4. Multi-Container Orchestration Runbook

```bash
# Start all 5 Docker services
docker-compose up -d --build

# Inspect service logs
docker-compose logs -f

# Verify cluster status
docker-compose ps
```

All 5 services are configured with health checks:
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:5000` (Health: `http://localhost:5000/health`)
- **AI Service**: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)
- **PostgreSQL 16 + pgvector**: `localhost:5432`
- **Redis 7**: `localhost:6379`
