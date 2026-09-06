import os
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
                dense_sql += " ORDER BY c.embedding <=> %s::vector ASC LIMIT 15;"
                params.append(str(query_vector))
                
                cur.execute(dense_sql, params)
                dense_results = [dict(r) for r in cur.fetchall()]
                
                # 2. Sparse Lexical Search via TSVECTOR
                sparse_sql = """
                    SELECT c.id, c.chunk_index, c.section_identifier, c.title, c.content, c.metadata,
                           d.title as doc_title, d.authority, d.jurisdiction, d.category, d.document_type, d.source_url,
                           v.version_tag,
                           ts_rank_cd(c.tsv_content, plainto_tsquery('english', %s)) AS bm25_score
                    FROM document_chunks c
                    JOIN document_versions v ON c.document_version_id = v.id
                    JOIN documents d ON v.document_id = d.id
                    WHERE v.is_current = TRUE
                      AND d.jurisdiction = %s
                      AND d.status = 'active'
                      AND c.tsv_content @@ plainto_tsquery('english', %s)
                """
                s_params = [query, jurisdiction, query]
                if category:
                    sparse_sql += " AND d.category = %s"
                    s_params.append(category)
                sparse_sql += " ORDER BY bm25_score DESC LIMIT 15;"
                
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
            sparse_results = bm25_retriever.search(query, top_k=15)
            
            # Simulated dense similarity
            for c in filtered_mem:
                c_copy = dict(c)
                c_vec = c.get("embedding") or generate_embedding(c.get("content", ""))
                sim = float(np.dot(query_vector, c_vec) / (np.linalg.norm(query_vector) * np.linalg.norm(c_vec) + 1e-9))
                c_copy["similarity"] = sim
                dense_results.append(c_copy)
            dense_results = sorted(dense_results, key=lambda x: x.get("similarity", 0), reverse=True)[:15]

    # 3. Reciprocal Rank Fusion
    fused_candidates = reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    
    # 4. Cross-Encoder Reranking
    reranked = rerank_documents(query, fused_candidates, top_k=top_k)
    
    # Filter candidates: If query has zero lexical relevance with corpus, do not return false positive chunks
    valid_evidence = []
    for c in reranked:
        bm_score = c.get("bm25_score", 0)
        sim_score = c.get("similarity", 0)
        # Check if query keywords appear in doc
        tokens = set(query.lower().split())
        doc_text = (c.get("content", "") + " " + c.get("title", "")).lower()
        if bm_score > 0.05 or any(t in doc_text for t in tokens if len(t) > 3):
            valid_evidence.append(c)
            
    return valid_evidence
