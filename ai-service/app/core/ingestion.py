"""
Document ingestion into the versioned PostgreSQL corpus.

Previously `/api/document/ingest` only appended chunks to an in-process list.
Uploaded documents never reached PostgreSQL, so they vanished on restart, never
appeared in the `document_versions` table, and were invisible to the admin
knowledge base view. Retrieval also could not see them once the service scaled
past a single process.

Ingestion is idempotent on content: the version id is derived from the document,
its version tag and a hash of its chunk text. Re-ingesting identical text is a
no-op; ingesting changed text retires the previous version and creates a new one.
"""

import hashlib
import uuid
from typing import Any, Dict, List, Optional

try:
    import psycopg2
except ImportError:  # pragma: no cover - exercised only when the driver is absent
    psycopg2 = None

from app.config import settings
from app.rag.embeddings import generate_embedding
from app.rag.hybrid_retriever import register_in_memory_chunk


def content_hash(chunks: List[Dict[str, Any]]) -> str:
    h = hashlib.sha256()
    for c in chunks:
        h.update((c.get("section_identifier") or "").encode("utf-8"))
        h.update((c.get("content") or "").encode("utf-8"))
    return h.hexdigest()


def ingest_document_version(
    *,
    title: str,
    authority: str,
    document_type: str,
    jurisdiction: str,
    category: str,
    source_url: str,
    version_tag: str,
    chunks: List[Dict[str, Any]],
    document_id: Optional[str] = None,
    raw_text_length: int = 0,
) -> Dict[str, Any]:
    """
    Write one document version and its chunks into PostgreSQL, and register the
    chunks in the in-memory retriever so they are searchable immediately.

    Returns a summary describing what actually happened, including whether
    PostgreSQL was reached, so a caller is never told "success" when the data
    only landed in memory.
    """
    if not chunks:
        return {
            "status": "error",
            "message": "No chunks were produced from this document.",
            "persisted_to_postgres": False,
            "chunks_count": 0,
        }

    doc_id = document_id or str(
        uuid.uuid5(uuid.NAMESPACE_URL, f"ayusakshi:{jurisdiction}:{title}")
    )
    c_hash = content_hash(chunks)
    version_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}:{version_tag}:{c_hash}"))

    # Always make the chunks searchable in-process.
    for idx, chunk in enumerate(chunks):
        register_in_memory_chunk({
            "id": f"{version_id}-{idx}",
            "chunk_index": chunk.get("chunk_index", idx),
            "section_identifier": chunk.get("section_identifier", "General"),
            "title": chunk.get("title", ""),
            "doc_title": title,
            "authority": authority,
            "jurisdiction": jurisdiction,
            "category": category,
            "document_type": document_type,
            "source_url": source_url,
            "version_tag": version_tag,
            "text_provenance": "ingested_source_document",
            "content": chunk.get("content", ""),
            "embedding": generate_embedding(chunk.get("content", "")),
        })

    if psycopg2 is None:
        print("[Ingestion] *** psycopg2 NOT INSTALLED. Chunks are in memory only and will be lost on restart.")
        return {
            "status": "partial",
            "message": "PostgreSQL driver unavailable. Chunks registered in memory only.",
            "persisted_to_postgres": False,
            "document_id": doc_id,
            "version_id": version_id,
            "content_hash": c_hash,
            "chunks_count": len(chunks),
        }

    conn = None
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO documents (id, title, authority, document_type, jurisdiction, category, source_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                authority = EXCLUDED.authority,
                source_url = EXCLUDED.source_url,
                updated_at = CURRENT_TIMESTAMP;
            """,
            (doc_id, title, authority, document_type, jurisdiction, category, source_url),
        )

        cur.execute("SELECT 1 FROM document_versions WHERE id = %s;", (version_id,))
        if cur.fetchone():
            conn.commit()
            cur.close()
            conn.close()
            print(f"[Ingestion] '{title}' {version_tag} is already current, nothing to do.")
            return {
                "status": "unchanged",
                "message": "This exact text is already the current version.",
                "persisted_to_postgres": True,
                "document_id": doc_id,
                "version_id": version_id,
                "content_hash": c_hash,
                "chunks_count": len(chunks),
            }

        # New text supersedes whatever was current for this document.
        cur.execute(
            "UPDATE document_versions SET is_current = FALSE WHERE document_id = %s;",
            (doc_id,),
        )
        cur.execute(
            """
            INSERT INTO document_versions
                (id, document_id, version_tag, content_hash, is_current, chunk_count, raw_text_length)
            VALUES (%s, %s, %s, %s, TRUE, %s, %s);
            """,
            (version_id, doc_id, version_tag, c_hash, len(chunks), raw_text_length),
        )

        for idx, chunk in enumerate(chunks):
            emb = generate_embedding(chunk.get("content", ""))
            cur.execute(
                """
                INSERT INTO document_chunks
                    (document_version_id, chunk_index, section_identifier, title, content, metadata, embedding)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::vector);
                """,
                (
                    version_id,
                    chunk.get("chunk_index", idx),
                    chunk.get("section_identifier", "General"),
                    chunk.get("title", ""),
                    chunk.get("content", ""),
                    _json(chunk.get("metadata") or {}),
                    str(emb),
                ),
            )

        conn.commit()
        cur.close()
        conn.close()
        print(f"[Ingestion] '{title}' {version_tag}: {len(chunks)} chunks written to PostgreSQL as a new current version.")
        return {
            "status": "success",
            "message": f"Ingested {len(chunks)} chunks as a new current version.",
            "persisted_to_postgres": True,
            "document_id": doc_id,
            "version_id": version_id,
            "content_hash": c_hash,
            "chunks_count": len(chunks),
        }

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"[Ingestion] *** PostgreSQL write FAILED for '{title}': {e}")
        return {
            "status": "partial",
            "message": f"PostgreSQL write failed ({e}). Chunks registered in memory only.",
            "persisted_to_postgres": False,
            "document_id": doc_id,
            "version_id": version_id,
            "content_hash": c_hash,
            "chunks_count": len(chunks),
        }


def _json(obj: Dict[str, Any]) -> str:
    import json
    return json.dumps(obj)
