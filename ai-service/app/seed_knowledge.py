import glob
import hashlib
import json
import os
import uuid
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None
from app.config import settings
from app.rag.embeddings import generate_embedding
from app.rag.hybrid_retriever import register_in_memory_chunk, reset_in_memory_chunks

# Curated Official Authoritative Corpus Data (SIH26045 Official Register)
# ---------------------------------------------------------------------------
# The corpus now lives in knowledge-base/corpus/*.json as verbatim statutory
# text with source URLs and retrieval dates.
#
# The paraphrased summaries that used to sit here were the project's weakest
# point: the citation panel promised "exact statutory provision" and showed
# someone's interpretation instead. They have been replaced by india.json and
# international.json and are deliberately not kept as a fallback, because a
# silent fallback to paraphrase is exactly the failure mode being removed.
# ---------------------------------------------------------------------------
AUTHORITATIVE_CORPUS = []

CORPUS_DIR = os.getenv(
    "CORPUS_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "knowledge-base", "corpus"))
)


def load_corpus_files():
    """
    Load verbatim corpus documents from knowledge-base/corpus/*.json.

    These files are the source of truth. Each chunk carries `verbatim_text`
    transcribed exactly from an official source, with its own source URL and
    retrieval date. Nothing here is paraphrased, which is what makes the
    "click a citation and read the actual statute" claim true.
    """
    loaded = []
    if not os.path.isdir(CORPUS_DIR):
        print(f"[Seed Knowledge] *** NO CORPUS DIRECTORY at {CORPUS_DIR}. The system has no evidence to retrieve.")
        return loaded

    for path in sorted(glob.glob(os.path.join(CORPUS_DIR, "*.json"))):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[Seed Knowledge] *** FAILED to parse corpus file {path}: {e}")
            continue

        for doc in data.get("documents", []):
            chunks = []
            for c in doc.get("chunks", []):
                text = c.get("verbatim_text") or c.get("content") or ""
                if not text.strip():
                    print(f"[Seed Knowledge] *** SKIPPING empty chunk {c.get('section_identifier')} in {doc.get('title')}")
                    continue
                # Statutes are not written in the words people search with.
                # Section 3(p) of the Patents Act never says "patent",
                # "Ayurvedic", "formulation" or "Charaka Samhita" -- it says
                # "are not inventions ... traditional knowledge". The old
                # paraphrased seed text happened to contain all those words,
                # so it was quietly doing the work of bridging that vocabulary
                # gap. Replacing it with verbatim law removed the bridge and
                # retrieval stopped finding the right provisions.
                #
                # retrieval_context restores the bridge honestly: it is indexed
                # for search but is NEVER part of `content`, so the citation a
                # user reads stays purely verbatim.
                chunks.append({
                    "section_identifier": c["section_identifier"],
                    "title": c.get("title", ""),
                    "retrieval_context": c.get("retrieval_context", ""),
                    "content": text,
                    "chunk_source_url": c.get("source_url", doc.get("source_url", "")),
                })
            if not chunks:
                continue
            loaded.append({
                "title": doc["title"],
                "authority": doc["authority"],
                "document_type": doc["document_type"],
                "jurisdiction": doc["jurisdiction"],
                "category": doc["category"],
                "source_url": doc.get("source_url", ""),
                "version_tag": doc.get("version_tag", "unversioned"),
                "text_provenance": "verbatim",
                "chunks": chunks,
            })
        print(f"[Seed Knowledge] Loaded {len(data.get('documents', []))} document(s) from {os.path.basename(path)} "
              f"(corpus_version {data.get('corpus_version', 'unknown')}).")

    return loaded


def build_corpus():
    """Verbatim corpus files, plus any hardcoded document they do not supersede."""
    verbatim = load_corpus_files()
    seen = {(d["title"], d["jurisdiction"]) for d in verbatim}
    merged = list(verbatim)
    legacy = 0
    for doc in AUTHORITATIVE_CORPUS:
        if (doc["title"], doc["jurisdiction"]) in seen:
            continue
        d = dict(doc)
        d.setdefault("text_provenance", "paraphrase_pending_replacement")
        merged.append(d)
        legacy += 1
    if legacy:
        print(f"[Seed Knowledge] *** {legacy} document(s) still use PARAPHRASED seed text and need verbatim replacement.")
    return merged


def _document_id(doc) -> str:
    """Stable id for a document, so re-seeding updates rather than duplicates."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"ayusakshi:{doc['jurisdiction']}:{doc['title']}"))


def _content_hash(doc) -> str:
    """Hash of the document's chunk text. Changing the text creates a new version."""
    h = hashlib.sha256()
    for chunk in doc["chunks"]:
        h.update(chunk["section_identifier"].encode("utf-8"))
        h.update(chunk["content"].encode("utf-8"))
    return h.hexdigest()


def seed_database():
    """
    Seed the authoritative corpus into PostgreSQL and the in-memory retriever.

    Idempotent. Document and version ids are derived deterministically from the
    document identity and a hash of its text, so restarting the service does not
    duplicate the corpus, and editing a statute's text produces a genuinely new
    version with the previous one marked is_current = FALSE.
    """
    print("[Seed Knowledge] Seeding Authoritative Legal Corpus...")

    # In-memory store is rebuilt from scratch each time.
    reset_in_memory_chunks()

    conn = None
    cur = None
    if psycopg2 is None:
        print("[Seed Knowledge] *** psycopg2 IS NOT INSTALLED. PostgreSQL and pgvector are NOT in use. ***")
    else:
        try:
            conn = psycopg2.connect(settings.DATABASE_URL)
            cur = conn.cursor()
            print("[Seed Knowledge] PostgreSQL connection established.")
        except Exception as e:
            print(f"[Seed Knowledge] *** PostgreSQL UNAVAILABLE ({e}). Falling back to in-memory store. ***")
            cur = None

    corpus = build_corpus()

    total_chunks = 0
    inserted_versions = 0
    skipped_versions = 0
    restored_versions = 0

    for doc in corpus:
        doc_id = _document_id(doc)
        c_hash = _content_hash(doc)
        version_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}:{doc['version_tag']}:{c_hash}"))

        # 1. Register in-memory for instant fallback retrieval
        for idx, chunk in enumerate(doc["chunks"]):
            # Indexed for search; never shown as the citation text.
            search_title = " ".join(filter(None, [chunk.get("title", ""), chunk.get("retrieval_context", "")]))
            search_text = " ".join(filter(None, [chunk["content"], chunk.get("retrieval_context", "")]))
            c_dict = {
                "id": f"{doc_id}-{idx}",
                "chunk_index": idx,
                "section_identifier": chunk["section_identifier"],
                "title": search_title,
                "doc_title": doc["title"],
                "authority": doc["authority"],
                "jurisdiction": doc["jurisdiction"],
                "category": doc["category"],
                "document_type": doc["document_type"],
                "source_url": chunk.get("chunk_source_url") or doc["source_url"],
                "version_tag": doc["version_tag"],
                "text_provenance": doc.get("text_provenance", "paraphrase_pending_replacement"),
                "content": chunk["content"],
                "embedding": generate_embedding(search_text)
            }
            register_in_memory_chunk(c_dict)
            total_chunks += 1

        # 2. Insert into PostgreSQL if database is reachable
        if cur:
            try:
                cur.execute(
                    """
                    INSERT INTO documents (id, title, authority, document_type, jurisdiction, category, source_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        authority = EXCLUDED.authority,
                        source_url = EXCLUDED.source_url,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    (doc_id, doc["title"], doc["authority"], doc["document_type"], doc["jurisdiction"], doc["category"], doc["source_url"])
                )

                # This exact text already ingested? Then there is nothing to do,
                # PROVIDED it is still the version retrieval will actually read.
                #
                # The check used to be "does this version row exist", which is
                # not the same question. Bulk PDF ingestion writes a new version
                # of the same document (same title, so same deterministic
                # document id) and flips is_current to itself. The verbatim
                # version row still existed, so re-seeding skipped it forever
                # and never put it back. Retrieval filters on is_current, so the
                # hand-transcribed corpus -- section labels, per-chunk source
                # URLs, retrieval_context bridges and all -- was sitting in the
                # database completely unreachable, while every query was served
                # from auto-extracted PDF text instead.
                cur.execute("SELECT is_current FROM document_versions WHERE id = %s;", (version_id,))
                row = cur.fetchone()
                if row:
                    if row[0]:
                        skipped_versions += 1
                    else:
                        cur.execute(
                            "UPDATE document_versions SET is_current = FALSE WHERE document_id = %s AND id <> %s;",
                            (doc_id, version_id)
                        )
                        cur.execute(
                            "UPDATE document_versions SET is_current = TRUE WHERE id = %s;",
                            (version_id,)
                        )
                        restored_versions += 1
                        print(
                            f"[Seed Knowledge] *** RESTORED verbatim version as current for "
                            f"'{doc['title']}'. Something (most likely bulk PDF ingestion) had "
                            f"superseded the hand-verified text, so retrieval was not using it."
                        )
                    continue

                # New text for this document. Retire the previous current version.
                cur.execute(
                    "UPDATE document_versions SET is_current = FALSE WHERE document_id = %s;",
                    (doc_id,)
                )
                cur.execute(
                    """
                    INSERT INTO document_versions (id, document_id, version_tag, content_hash, is_current, chunk_count)
                    VALUES (%s, %s, %s, %s, TRUE, %s);
                    """,
                    (version_id, doc_id, doc["version_tag"], c_hash, len(doc["chunks"]))
                )

                for idx, chunk in enumerate(doc["chunks"]):
                    # title carries the retrieval aid so PostgreSQL's generated
                    # tsv_content column indexes it for keyword search; content
                    # stays verbatim so the citation shown to a user is the law.
                    ins_title = " ".join(filter(None, [chunk.get("title", ""), chunk.get("retrieval_context", "")]))
                    ins_search = " ".join(filter(None, [chunk["content"], chunk.get("retrieval_context", "")]))
                    emb = generate_embedding(ins_search)
                    cur.execute(
                        """
                        INSERT INTO document_chunks (document_version_id, chunk_index, section_identifier, title, content, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s::vector);
                        """,
                        (version_id, idx, chunk["section_identifier"], ins_title, chunk["content"], str(emb))
                    )
                inserted_versions += 1
            except Exception as e:
                print(f"[Seed DB Error on doc {doc['title']}]: {e}")
                conn.rollback()

    if conn and cur:
        conn.commit()
        cur.close()
        conn.close()
        print(
            f"[Seed Knowledge] PostgreSQL corpus in sync: {len(corpus)} documents, "
            f"{inserted_versions} new version(s) ingested, {skipped_versions} already current, "
            f"{restored_versions} restored to current, "
            f"{total_chunks} chunks registered in memory."
        )
    else:
        print(f"[Seed Knowledge] Registered {total_chunks} authoritative chunks in IN-MEMORY store only (no PostgreSQL).")

if __name__ == "__main__":
    seed_database()
