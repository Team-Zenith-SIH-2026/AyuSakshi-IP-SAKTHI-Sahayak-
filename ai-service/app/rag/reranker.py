from typing import List, Dict, Any, Tuple
from app.config import settings

_reranker_model = None

def get_reranker():
    global _reranker_model
    if _reranker_model is None:
        try:
            from sentence_transformers import CrossEncoder
            print(f"[Reranker] Loading Cross-Encoder: {settings.RERANKER_MODEL_NAME}...")
            _reranker_model = CrossEncoder(settings.RERANKER_MODEL_NAME)
        except Exception as e:
            print(f"[Reranker Warning] Could not load CrossEncoder ({e}). Using similarity-based reranker fallback.")
            _reranker_model = "fallback"
    return _reranker_model

def rerank_documents(query: str, candidates: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Reranks candidate evidence chunks using a Cross-Encoder model.
    """
    if not candidates:
        return []
        
    model = get_reranker()
    if model != "fallback" and hasattr(model, "predict"):
        pairs = [[query, f"{c.get('section_identifier', '')}: {c.get('content', '')}"] for c in candidates]
        scores = model.predict(pairs)
        
        for c, s in zip(candidates, scores):
            c["rerank_score"] = float(s)
            
        ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return ranked[:top_k]
    
    # Fallback score combining dense and sparse
    for c in candidates:
        c["rerank_score"] = float(c.get("similarity", 0.5) * 0.6 + c.get("bm25_score", 0.5) * 0.4)
    ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
    return ranked[:top_k]
