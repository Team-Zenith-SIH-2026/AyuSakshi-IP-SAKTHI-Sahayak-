import numpy as np
from typing import List
from app.config import settings

_model = None

def get_embedding_model():
    """
    Lazy load SentenceTransformer model for fast startup.
    """
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            print(f"[Embeddings] Loading embedding model: {settings.EMBEDDING_MODEL_NAME}...")
            _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            print(f"[Embeddings] REAL MODEL LOADED. Semantic search is active.")
        except Exception as e:
            print("=" * 78)
            print(f"[Embeddings] *** SENTENCE-TRANSFORMERS UNAVAILABLE: {e}")
            print("[Embeddings] *** FALLING BACK TO HASH PROJECTION.")
            print("[Embeddings] *** SEMANTIC SEARCH IS DISABLED. Similarity scores are meaningless.")
            print("=" * 78)
            _model = "fallback"
    return _model

def generate_embedding(text: str) -> List[float]:
    """
    Generate 384-dimensional vector embedding for a given text.
    """
    model = get_embedding_model()
    if model != "fallback" and hasattr(model, "encode"):
        vec = model.encode(text, normalize_embeddings=True)
        return vec.tolist()
    
    # Deterministic 384-dim hash projection fallback for offline/test environments
    vec = np.zeros(settings.EMBEDDING_DIMENSION, dtype=np.float32)
    for i, word in enumerate(text.lower().split()[:100]):
        idx = hash(word) % settings.EMBEDDING_DIMENSION
        vec[idx] += 1.0 / (i + 1)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()

def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for multiple texts.
    """
    model = get_embedding_model()
    if model != "fallback" and hasattr(model, "encode"):
        vecs = model.encode(texts, normalize_embeddings=True, batch_size=32)
        return vecs.tolist()
    return [generate_embedding(t) for t in texts]
