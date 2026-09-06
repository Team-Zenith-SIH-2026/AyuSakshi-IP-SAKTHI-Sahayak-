# Database Architecture & pgvector Schema

## Database Design: PostgreSQL 16 + pgvector

### Primary Tables:
1. `users`: Stores user accounts, bcrypt hashed passwords, roles (`user`, `practitioner`, `researcher`, `msme`, `facilitator`, `admin`), and OAuth identifiers.
2. `conversations`: Manages user sessions, jurisdiction tags (`india` / `international`), and stateful formulation memory objects.
3. `messages`: Stores conversational dialogue turns, deep thinking process trace (`JSONB`), confidence score, citations array (`JSONB`), ABS summary (`JSONB`), and TKDL pointers (`JSONB`).
4. `documents`: Master register of statutory acts, rules, treaties, and pharmacopoeia references.
5. `document_versions`: Tracks version history, effective dates, file paths, and content hashes to ensure legal texts are never silently overwritten.
6. `document_chunks`: Stores legal-aware chunks with section identifiers (e.g. `Section 3(p)`, `Rule 157`), chapter titles, `TSVECTOR` generated columns for BM25 search, and 384-dimensional dense embeddings (`VECTOR(384)`).
7. `citations`: Granular audit log linking assistant message claims to exact document chunks.
8. `formulation_classifications`: Persistent records of classified Ayurvedic formulations.
9. `human_review_requests`: Escalation queue for accredited AYUSH IP Facilitators.
10. `knowledge_graph_nodes` & `knowledge_graph_edges`: Relational Knowledge Graph representing connections between statutes, traditional knowledge, ingredients, and regulatory forms.
11. `audit_logs`: Complete immutable audit trail of API actions for DPDP and regulatory compliance.

### Vector Search Index:
```sql
CREATE INDEX idx_chunks_embedding_cosine 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```
