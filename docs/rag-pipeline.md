# RAG Pipeline & Multi-Regime Retrieval Engineering

## 1. Pipeline Stages

```
User Query (e.g. Hindi / English)
    │
    ▼
[ Language Detection & Bhashini Translate ]
    │
    ▼
[ Conversational Contextual Query Rewriter ]
    │
    ▼
[ Formulation Classifier (6 Classes) & IP Router ]
    │
    ▼
[ Strict Jurisdiction Filter: (India vs International) ]
    │
    ├───► [ Dense Vector Search (pgvector Cosine Sim) ]
    │
    └───► [ Sparse Lexical Search (Postgres TSVector / BM25) ]
            │
            ▼
        [ Reciprocal Rank Fusion (RRF) ]
            │
            ▼
        [ Cross-Encoder Reranker (Top k Chunks) ]
            │
            ▼
        [ Relational Knowledge Graph Link Traversal ]
            │
            ▼
        [ ABS & TKDL Classical Prior-Art Pointer ]
            │
            ▼
        [ Grounded Answer Synthesis (Strict Citation Prompt) ]
            │
            ▼
        [ Claim-to-Evidence Entailment Verifier ]
            │
            ├── (Confidence < 0.50 or Empty Chunks) ──► [ SAFE ABSTENTION ]
            │
            └── (Grounding Verified) ──────────────────► [ CITED ANSWER + SOURCE DRAWER ]
```

## 2. Mathematical Formulations

### Reciprocal Rank Fusion (RRF)
$$\text{RRF Score}(d) = \sum_{m \in M} \frac{1}{60 + \text{rank}_m(d)}$$

### Composite Transparent Confidence Score
$$\text{Confidence} = 0.40 \times \text{Sim}_{\text{dense}} + 0.35 \times \text{Score}_{\text{rerank}} + 0.25 \times \text{Coverage}_{\text{citations}}$$
- **High**: $\ge 0.75$
- **Medium**: $0.50 - 0.74$
- **Abstained**: $< 0.50$ (Safe refusal to prevent legal hallucination).
