import re
from typing import List, Dict, Any

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None

class BM25Retriever:
    """
    BM25 lexical keyword retriever for statutory clauses and exact legal citations.
    """
    def __init__(self, corpus_chunks: List[Dict[str, Any]]):
        self.corpus = corpus_chunks
        self.tokenized_corpus = [self._tokenize(c.get("content", "") + " " + c.get("section_identifier", "")) for c in corpus_chunks]
        if BM25Okapi and self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
        else:
            self.bm25 = None
            
    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\b\w+\b', text.lower())
        
    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        if not self.corpus:
            return []
            
        tokenized_query = self._tokenize(query)
        if not tokenized_query:
            return []
            
        if self.bm25:
            scores = self.bm25.get_scores(tokenized_query)
            top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
            
            results = []
            for idx in top_indices:
                if scores[idx] > 0.05:
                    chunk = dict(self.corpus[idx])
                    chunk["bm25_score"] = float(scores[idx])
                    results.append(chunk)
            return results
        else:
            # Fallback keyword overlap score
            q_set = set(tokenized_query)
            scored = []
            for chunk in self.corpus:
                doc_tokens = set(self._tokenize(chunk.get("content", "") + " " + chunk.get("section_identifier", "")))
                overlap = len(q_set.intersection(doc_tokens))
                if overlap > 0:
                    c_copy = dict(chunk)
                    c_copy["bm25_score"] = float(overlap / len(q_set))
                    scored.append(c_copy)
            scored.sort(key=lambda x: x["bm25_score"], reverse=True)
            return scored[:top_k]
