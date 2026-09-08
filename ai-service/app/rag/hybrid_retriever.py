import os
import re
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None
import numpy as np
from typing import List, Dict, Any, Optional
from app.config import settings
from app.rag.embeddings import generate_embedding
from app.rag.reranker import rerank_documents
from app.rag.bm25_retriever import BM25Retriever

# In-memory fallback store for offline tests and fast startup
_in_memory_chunks = []

def register_in_memory_chunk(chunk: Dict[str, Any]):
    global _in_memory_chunks
    _in_memory_chunks.append(chunk)


def reset_in_memory_chunks():
    """Clear the in-memory store so re-seeding does not duplicate the corpus."""
    global _in_memory_chunks
    _in_memory_chunks = []

_TSQUERY_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
    "do", "does", "did", "can", "could", "shall", "should", "will", "would",
    "may", "might", "must", "have", "has", "had", "i", "we", "you", "he", "she",
    "it", "they", "my", "our", "your", "of", "for", "to", "in", "on", "at", "by",
    "with", "from", "as", "and", "or", "if", "that", "this", "these", "those",
    "what", "which", "who", "whom", "how", "when", "where", "why", "any", "all",
    "about", "into", "under", "over", "there", "their", "its", "me", "us",
}


def _build_or_tsquery(query: str) -> Optional[str]:
    """
    Build an OR tsquery from a natural-language question.

    PostgreSQL's plainto_tsquery ANDs every term, so a real question like
    "Can a classical formulation from the Charaka Samhita be patented in India?"
    only matches a chunk containing *all* of those words. No statute does, so
    sparse retrieval silently returned zero rows for essentially every query and
    the hybrid search was running on the dense half alone.

    ORing the terms lets ts_rank_cd score by how many matched, which is the
    behaviour the fusion step assumes.
    """
    terms = re.findall(r"[A-Za-z][A-Za-z0-9\-']{2,}", query.lower())
    terms = [t for t in terms if t not in _TSQUERY_STOPWORDS]
    # Deduplicate while preserving order.
    seen, kept = set(), []
    for t in terms:
        if t not in seen:
            seen.add(t)
            kept.append(t)
    if not kept:
        return None
    return " | ".join(kept[:30])


def get_db_connection():
    try:
        conn = psycopg2.connect(settings.DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        return None

def reciprocal_rank_fusion(dense_results: List[Dict[str, Any]], sparse_results: List[Dict[str, Any]], k: int = 60) -> List[Dict[str, Any]]:
    """
    Combines dense and sparse search rankings using Reciprocal Rank Fusion (RRF).
    RRF Score = sum(1 / (k + rank))
    """
    scores = {}
    doc_map = {}
    
    # Process dense results
    for rank, doc in enumerate(dense_results):
        doc_id = doc.get("id") or str(doc.get("chunk_index", rank)) + doc.get("section_identifier", "")
        doc_map[doc_id] = doc
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))
        
    # Process sparse results
    for rank, doc in enumerate(sparse_results):
        doc_id = doc.get("id") or str(doc.get("chunk_index", rank)) + doc.get("section_identifier", "")
        if doc_id not in doc_map:
            doc_map[doc_id] = doc
        else:
            # A chunk found by both halves previously kept only the dense row,
            # silently discarding its bm25_score. Downstream filtering and
            # confidence scoring both read those fields, so the strongest
            # evidence -- the chunk both retrievers agreed on -- was the one
            # arriving with half its signal missing.
            merged = doc_map[doc_id]
            if merged.get("bm25_score") is None and doc.get("bm25_score") is not None:
                merged["bm25_score"] = doc["bm25_score"]
            if merged.get("similarity") is None and doc.get("similarity") is not None:
                merged["similarity"] = doc["similarity"]
        scores[doc_id] = scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))
        
    # Sort by combined RRF score
    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    fused_results = []
    for doc_id, rrf_score in sorted_docs:
        doc = dict(doc_map[doc_id])
        doc["rrf_score"] = float(rrf_score)
        fused_results.append(doc)
        
    return fused_results

def hybrid_retrieve(query: str, jurisdiction: str = "india", category: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Execute Hybrid Retrieval (Dense Vector + BM25 Full-Text) filtered strictly by Jurisdiction.
    """
    query_vector = generate_embedding(query)
    conn = get_db_connection()
    
    dense_results = []
    sparse_results = []
    
    if conn is not None:
        try:
            with conn.cursor() as cur:
                # 1. Dense Vector Search with pgvector cosine distance
                dense_sql = """
                    SELECT c.id, c.chunk_index, c.section_identifier, c.title, c.content, c.metadata,
                           d.title as doc_title, d.authority, d.jurisdiction, d.category, d.document_type, d.source_url,
                           v.version_tag,
                           1 - (c.embedding <=> %s::vector) AS similarity
                    FROM document_chunks c
                    JOIN document_versions v ON c.document_version_id = v.id
                    JOIN documents d ON v.document_id = d.id
                    WHERE v.is_current = TRUE
                      AND d.jurisdiction = %s
                      AND d.status = 'active'
                """
                params = [str(query_vector), jurisdiction]
                if category:
                    dense_sql += " AND d.category = %s"
                    params.append(category)
                dense_sql += " ORDER BY c.embedding <=> %s::vector ASC LIMIT %s;"
                params.append(str(query_vector))
                params.append(settings.DENSE_TOP_K)
                
                cur.execute(dense_sql, params)
                dense_results = [dict(r) for r in cur.fetchall()]
                
                # 2. Sparse Lexical Search via TSVECTOR
                sparse_sql = """
                    SELECT c.id, c.chunk_index, c.section_identifier, c.title, c.content, c.metadata,
                           d.title as doc_title, d.authority, d.jurisdiction, d.category, d.document_type, d.source_url,
                           v.version_tag,
                           ts_rank_cd(c.tsv_content, to_tsquery('english', %s)) AS bm25_score
                    FROM document_chunks c
                    JOIN document_versions v ON c.document_version_id = v.id
                    JOIN documents d ON v.document_id = d.id
                    WHERE v.is_current = TRUE
                      AND d.jurisdiction = %s
                      AND d.status = 'active'
                      AND c.tsv_content @@ to_tsquery('english', %s)
                """
                ts_query = _build_or_tsquery(query)
                s_params = [ts_query, jurisdiction, ts_query]
                if category:
                    sparse_sql += " AND d.category = %s"
                    s_params.append(category)
                sparse_sql += " ORDER BY bm25_score DESC LIMIT %s;"
                s_params.append(settings.BM25_TOP_K)

                if ts_query:
                    cur.execute(sparse_sql, s_params)
                    sparse_results = [dict(r) for r in cur.fetchall()]
                
            conn.close()
        except Exception as e:
            print(f"[Hybrid Retriever Error - PostgreSQL]: {e}")
            if conn:
                conn.close()
                
    # Fallback to in-memory store if DB query returned nothing or DB unavailable
    if not dense_results and not sparse_results:
        filtered_mem = [c for c in _in_memory_chunks if c.get("jurisdiction", "india") == jurisdiction]
        if category:
            filtered_mem = [c for c in filtered_mem if c.get("category") == category]
            
        if filtered_mem:
            # BM25 on in-memory
            bm25_retriever = BM25Retriever(filtered_mem)
            sparse_results = bm25_retriever.search(query, top_k=settings.BM25_TOP_K)
            
            # Simulated dense similarity
            for c in filtered_mem:
                c_copy = dict(c)
                c_vec = c.get("embedding") or generate_embedding(c.get("content", ""))
                sim = float(np.dot(query_vector, c_vec) / (np.linalg.norm(query_vector) * np.linalg.norm(c_vec) + 1e-9))
                c_copy["similarity"] = sim
                dense_results.append(c_copy)
            dense_results = sorted(dense_results, key=lambda x: x.get("similarity", 0), reverse=True)[:settings.DENSE_TOP_K]

    # 3. Reciprocal Rank Fusion
    fused_candidates = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    
    # 4. Cross-Encoder Reranking
    reranked = rerank_documents(query, fused_candidates, top_k=top_k)
    
    # Drop candidates with no demonstrable relationship to the query, so a
    # question the corpus cannot speak to reaches the abstention gate with
    # nothing rather than with five plausible-looking irrelevant statutes.
    #
    # Two earlier bugs here were quietly discarding good evidence:
    #
    #   1. The dense similarity score was read into a variable and then never
    #      tested. Acceptance rested on lexical overlap alone, which throws away
    #      exactly the semantically-retrieved chunks that dense search exists to
    #      find. A query phrased in ordinary words ("classical formulation from
    #      the Charaka Samhita") shares almost no vocabulary with the verbatim
    #      provision that answers it.
    #   2. Tokens came from a bare .split(), so trailing punctuation stayed
    #      attached and "india?" could never match "india" in a statute.
    tokens = {t for t in re.findall(r"[a-z0-9\-']+", query.lower()) if len(t) > 3}

    valid_evidence = []
    for c in reranked:
        bm_score = c.get("bm25_score") or 0.0
        sim_score = c.get("similarity") or 0.0
        doc_text = (c.get("content", "") + " " + c.get("title", "")).lower()
        if (
            bm_score > 0.05
            or sim_score >= settings.SIMILARITY_THRESHOLD
            or any(t in doc_text for t in tokens)
        ):
            valid_evidence.append(c)

    if reranked and not valid_evidence:
        print(
            f"[Hybrid Retriever] All {len(reranked)} reranked candidates were filtered out for "
            f"query={query[:70]!r} (jurisdiction={jurisdiction}). Best similarity="
            f"{max((c.get('similarity') or 0.0) for c in reranked):.3f}, "
            f"best bm25={max((c.get('bm25_score') or 0.0) for c in reranked):.3f}. "
            f"The pipeline will abstain with no evidence."
        )

    return valid_evidence
