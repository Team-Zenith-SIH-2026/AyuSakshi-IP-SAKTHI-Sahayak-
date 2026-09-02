# AyuSakshi (IP-SAKTI Sahayak)
### SIH26045 — Multilingual, RAG-Based AI Assistant for Intellectual Property & Regulatory Guidance in Ayurveda Across National & International Regimes

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![SIH26045](https://img.shields.io/badge/SIH26045-Ayurveda%20IP-emerald)](https://www.sih.gov.in/)
[![Architecture](https://img.shields.io/badge/Architecture-React%20%7C%20Node%20%7C%20FastAPI%20%7C%20pgvector-teal)](docs/architecture.md)

---

## 🌿 Overview

**AyuSakshi (IP-SAKTI Sahayak)** is a source-cited, multilingual regulatory intelligence platform designed for Ayurveda practitioners, researchers, AYUSH startups, MSMEs, and cultivators navigating complex, overlapping IP and regulatory frameworks.

### Core Capabilities:
1. **Strict Jurisdiction Isolation**: Dual-mode engine separating **India 🇮🇳** (Patents Act 1970 § 3(p), Biological Diversity Act 2023 Rules, AYUSH DCA 1940, FSSAI Ayurveda Aahara 2022) and **International 🌍** (WIPO GRATK Treaty 2024, Nagoya Protocol, TRIPS Art 27.3(b), PCT, Madrid System).
2. **Stateful Formulation Classification**: Automated 6-category regulatory classification (*Classical Medicine, Patent or Proprietary, New Drug, Phytopharmaceutical, Ayurveda-Aahar, Cosmetic*) with minimal dynamic clarifying questions.
3. **Hybrid RAG Retrieval**: Dense Vector search (`pgvector` cosine similarity) + Lexical BM25 (`tsvector`), fused with Reciprocal Rank Fusion (RRF) and reranked using a Cross-Encoder.
4. **Defensive TKDL & Classical Prior-Art Pointer**: Identifies overlaps with Charaka Samhita, Sushruta Samhita, and API to prevent biopiracy and anticipate patent examiner rejections.
5. **ABS Compliance Navigator**: Guides compliance with National Biodiversity Authority (NBA) & State Biodiversity Boards (SBB), identifying Form I/Form III requirements and 2023 AYUSH practitioner exemptions.
6. **Transparent Confidence & Safe Abstention**: Grounding entailment verification with measurable confidence scores; refuses to hallucinate on uncertain queries and offers human facilitator escalation.
7. **Bhashini Multilingual Pipeline**: Multilingual query handling supporting Hindi, Sanskrit, Tamil, Telugu, Marathi, and other Indian languages.
8. **Dark & Light Mode Glassmorphism UI**: High-contrast light and dark luminous teal themes matching modern workstation standards.
9. **Social & Local Authentication**: Secure JWT local auth + Google and Facebook Social Login.
10. **Human IP Facilitator Workspace**: Escalation audit trail, ticket resolution notes, and role-based permissions.

---

## 🏛️ System Architecture

```
                                  [ REACT + TAILWIND CSS FRONTEND ]
                              (Dark/Light UI, Jurisdiction Toggle, Chat)
                                                 │
                                                 │ REST / SSE
                                                 ▼
                                [ NODE.JS + EXPRESS APPLICATION BACKEND ]
                             (JWT / OAuth, BullMQ Queue, Rate Limiting, Audit)
                                    │                   │
                     Postgres Pool  │                   │ HTTP Internal API
                                    ▼                   ▼
                      [ POSTGRESQL + PGVECTOR ]   [ PYTHON FASTAPI AI SERVICE ]
                      (Docs, Versions, Chunks,     (PyMuPDF, Chunking, Bhashini,
                       KG Graph, Users, Audits)    Hybrid Retrieval, LangGraph)
```

---

## 📁 Repository Structure

```
AyuSakshi/
├── docker-compose.yml              # Multi-container orchestration (5 services)
├── .env.example                    # Environment template
├── knowledge-base/                 # Curated statutory legal PDFs
│   ├── india/                      # Patents, Trademarks, GI, Biodiversity, AYUSH, FSSAI
│   ├── international/              # WIPO GRATK, Nagoya, TRIPS, PCT, Madrid, Budapest
│   └── case-law/                   # Landmark IP & Traditional Knowledge judgments
├── server/                         # Node.js + Express Application Backend
│   ├── src/controllers/            # Auth, Chat, Documents, Escalations, Classify
│   ├── src/middlewares/            # JWT Auth, RateLimiter, AuditLog
│   └── src/queues/                 # BullMQ Ingestion worker
├── ai-service/                     # Python + FastAPI AI & RAG Engine
│   ├── app/core/                   # PyMuPDF parser, Legal-Aware Chunker
│   ├── app/rag/                    # pgvector Hybrid search, BM25, Cross-Encoder Reranker
│   ├── app/agents/                 # LangGraph workflow, Classifier, ABS, TKDL
│   ├── app/multilingual/           # Bhashini NMT & Language detection
│   └── app/seed_knowledge.py       # Master Authoritative Corpus Seeder
├── client/                         # React + Tailwind CSS Web Application
│   ├── src/components/layout/      # Header (Jurisdiction & Theme Toggle), Sidebar
│   ├── src/components/chat/        # ChatArea, ThinkingTrace, SourceDrawer Modal
│   ├── src/components/auth/        # Login/Register Modal with Google & Facebook
│   └── src/components/tools/       # Classifier, ABS Navigator, TKDL Checker, Facilitator
└── docs/                           # Full technical specifications & architecture
```

---

## 🚀 Quick Start with Docker Compose

### Prerequisites
- Docker & Docker Compose
- Node.js >= 20 (for local development)
- Python >= 3.11 (for local development)

### 1. Clone & Configure
```bash
git clone https://github.com/Team-Zenith-SIH-2026/AyuSakshi-IP-SAKTHI-Sahayak-.git
cd AyuSakshi-IP-SAKTHI-Sahayak-
cp .env.example .env
```

### 2. Launch Multi-Container Cluster
```bash
docker-compose up --build
```

The system will initialize all 5 containers:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000` (Health: `http://localhost:5000/health`)
- **Python AI Engine**: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)
- **PostgreSQL (pgvector)**: `localhost:5432`
- **Redis Engine**: `localhost:6379`

---

## 🧪 Testing & Verification

### Run AI Service Pytest Suite
```bash
cd ai-service
pytest tests/
```

### Run Node.js Backend Tests
```bash
cd server
npm test
```

### Run Golden Benchmark Evaluation
```bash
cd ai-service
python -m app.evaluators.run_evaluation
```

---

## ⚖️ Legal Disclaimer
*AyuSakshi (IP-SAKTI Sahayak) provides source-grounded regulatory intelligence, statutory citations, and formulation analysis for informational and educational purposes. It does not constitute formal legal advice or substitute for consultation with accredited legal counsel or patent attorneys.*
