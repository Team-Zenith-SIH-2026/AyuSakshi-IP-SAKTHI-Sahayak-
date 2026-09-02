# Architecture Overview — AyuSakshi (IP-SAKTI Sahayak)
SIH26045: Multilingual RAG Platform for Ayurveda IP & Regulations

## 1. Architectural Philosophy
AyuSakshi is built around **Source-Grounded Intelligence**:
- The Large Language Model (LLM) is treated as a reasoning and synthesizing engine, **never** as an unverified legal authority.
- Every factual claim, statutory reference, and regulatory recommendation must be anchored to an ingested, version-controlled legal chunk.
- If no authoritative evidence exists in the active jurisdiction corpus, the system executes **Safe Abstention** rather than hallucinating legal provisions.

## 2. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND: React + Tailwind CSS + Lucide                     │
│  - Dark & Light Theme with smooth Theme Toggler                                 │
│  - Auth Modal / Page: Email/Password + Google & Facebook Social Login           │
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

## 3. Boundary Definitions
- **Core (MVP)**: Hybrid RAG, 6-Category Formulation Classifier, Section 3(p) analysis, Biological Diversity Act ABS helper, TKDL prior art pointer, Citation drawer, Safe abstention, Human review tickets, Dark/Light theme, Google/FB login.
- **Advanced / Staged**: LangGraph multi-agent orchestration, Relational Knowledge Graph triple expansion, Bhashini Neural Machine Translation integration.
- **Future Milestone**: Live Voice STT/TTS pipeline and live paid registry database connectors with logged user consent.
