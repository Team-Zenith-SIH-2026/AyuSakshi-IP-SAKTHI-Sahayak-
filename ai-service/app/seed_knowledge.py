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
AUTHORITATIVE_CORPUS = [
    # -------------------------------------------------------------------------
    # 1. INDIAN PATENTS REGIME
    # -------------------------------------------------------------------------
    {
        "title": "The Patents Act, 1970 (Consolidated with 2024 Amendments)",
        "authority": "Indian Patent Office (CGPDTM)",
        "document_type": "statute",
        "jurisdiction": "india",
        "category": "patents",
        "source_url": "https://ipindia.gov.in/pages/patents/publications/acts",
        "version_tag": "1970-Consolidated-2024",
        "chunks": [
            {
                "section_identifier": "Section 3(p)",
                "title": "Inventions Not Patentable - Traditional Knowledge",
                "content": (
                    "Section 3(p) of the Patents Act, 1970: The following are not inventions within the meaning of this Act: "
                    "an invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components. "
                    "Ayurvedic classical medicines, home remedies, and known multi-herbal combinations documented in classical texts (such as Charaka Samhita or Ayurvedic Formulary) fall strictly under Section 3(p) and cannot be patented in India."
                )
            },
            {
                "section_identifier": "Section 3(e)",
                "title": "Inventions Not Patentable - Mere Admixture & Synergy",
                "content": (
                    "Section 3(e) of the Patents Act, 1970: A substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof or a process for producing such substance is not patentable. "
                    "In Ayurvedic and herbal formulations, combining two or more herbs is considered a mere admixture unless unexpected synergistic bio-efficacy is demonstrated through comparative quantitative pharmacological assays."
                )
            },
            {
                "section_identifier": "Section 3(d)",
                "title": "Inventions Not Patentable - Known Substances & Enhanced Efficacy",
                "content": (
                    "Section 3(d) of the Patents Act, 1970: The mere discovery of a new form of a known substance which does not result in the enhancement of the known efficacy of that substance is not patentable. "
                    "In herbal chemistry and phytopharmaceuticals, derivatives, salts, polymorphs, or modified particle sizes (e.g. nano-herbals) must establish significantly enhanced therapeutic efficacy."
                )
            },
            {
                "section_identifier": "Section 10(4)",
                "title": "Specification - Biological Material Source & Origin Disclosure",
                "content": (
                    "Section 10(4)(ii)(D) of the Patents Act, 1970: The complete specification shall disclose the source and geographical origin of the biological material in the specification, when that material used in the invention is or was obtained from India. "
                    "Failure to disclose or wrongful disclosure of biological source or traditional knowledge is a valid ground for pre-grant opposition under Section 25(1)(j) and post-grant revocation under Section 64(1)(p)."
                )
            }
        ]
    },

    # -------------------------------------------------------------------------
    # 2. BIODIVERSITY & ABS REGIME
    # -------------------------------------------------------------------------
    {
        "title": "Biological Diversity Act, 2002 (As Amended by Biological Diversity (Amendment) Act, 2023)",
        "authority": "National Biodiversity Authority (NBA)",
        "document_type": "statute",
        "jurisdiction": "india",
        "category": "biodiversity",
        "source_url": "https://www.indiacode.nic.in/handle/123456789/18553",
        "version_tag": "2002-Amended-2023",
        "chunks": [
            {
                "section_identifier": "Section 6(1)",
                "title": "Prior Approval of NBA for Intellectual Property Rights Application",
                "content": (
                    "Section 6(1) of Biological Diversity Act: No person shall apply for any intellectual property right, by whatever name called, in or outside India for any invention based on any research or information on a biological resource obtained from India, without obtaining the previous approval of the National Biodiversity Authority before grant of such right. "
                    "Application must be filed via Form III before NBA prior to the grant of the patent."
                )
            },
            {
                "section_identifier": "Section 7 & 2023 Proviso",
                "title": "Prior Intimation to SBB and AYUSH Practitioner Exemptions",
                "content": (
                    "Section 7 of Biological Diversity Act: No person who is a citizen of India or a body corporate registered in India shall access biological resources for commercial utilization without giving prior intimation to the concerned State Biodiversity Board. "
                    "2023 Amendment Proviso: Registered AYUSH practitioners (Vaidyas and Hakims) and local people who have been practicing indigenous medicine, growers, and cultivators of biological resources are exempted from prior approval and ABS fee payment."
                )
            },
            {
                "section_identifier": "Section 3 & Form I",
                "title": "Access to Biological Resources by Foreign Entities",
                "content": (
                    "Section 3 of Biological Diversity Act: Non-Indian citizens, non-resident Indians (NRIs), foreign corporations, or Indian companies with foreign shareholding/management must obtain mandatory prior approval from NBA via Form I before accessing any Indian biological resource for research, bio-survey, or commercial utilization."
                )
            }
        ]
    },

    # -------------------------------------------------------------------------
    # 3. AYUSH & DRUGS AND COSMETICS REGIME
    # -------------------------------------------------------------------------
    {
        "title": "Drugs and Cosmetics Act, 1940 & Rules 1945 (Chapter IV-A: ASU Drugs)",
        "authority": "Ministry of AYUSH / CDSCO",
        "document_type": "statute",
        "jurisdiction": "india",
        "category": "ayush",
        "source_url": "https://www.ayush.gov.in/",
        "version_tag": "1940-Consolidated",
        "chunks": [
            {
                "section_identifier": "Section 3(a) & 33EEB",
                "title": "Classical vs Patent or Proprietary (P or P) Ayurvedic Drugs",
                "content": (
                    "Under Drugs and Cosmetics Act 1940: "
                    "(1) Classical Ayurvedic Drug (Section 3(a)): Manufactured exclusively in accordance with formulae prescribed in authoritative classical texts listed in the First Schedule (e.g. Charaka Samhita, Sushruta Samhita, AFI). Exempted from clinical trials for licensing. "
                    "(2) Patent or Proprietary (P or P) Ayurvedic Medicine (Section 3(h) & 33EEB): Contains ingredients mentioned in First Schedule texts but formulated in a non-classical combination, new ratio, or proprietary dosage form. Requires safety and pilot proof-of-concept data."
                )
            },
            {
                "section_identifier": "Rule 158-B",
                "title": "Guidelines for Issue of License for Ayurvedic, Siddha and Unani Drugs",
                "content": (
                    "Rule 158-B of Drugs and Cosmetics Rules, 1945: Specifies evidentiary requirements for ASU drug licensing. Classical drugs require citation of authoritative First Schedule text. P or P medicines with classical ingredients for traditional indications require published literature or textual evidence. Formulations with modified extracts or novel therapeutic indications require clinical and safety trial evidence."
                )
            },
            {
                "section_identifier": "Phytopharmaceutical Regulations",
                "title": "CDSCO Phytopharmaceutical Drug Definition (Rule 122E)",
                "content": (
                    "Phytopharmaceutical Drug (Rule 122E CDSCO): Defined as purified and standardized fraction with defined minimum four bioactive/analytical markers of an extract of a medicinal plant or its part, for internal or external use of human beings or animals. Subject to CDSCO Schedule Y approval, safety toxicology, and Phase I-III clinical trial pathways."
                )
            }
        ]
    },

    # -------------------------------------------------------------------------
    # 4. FSSAI & AYURVEDA AAHARA REGIME
    # -------------------------------------------------------------------------
    {
        "title": "Food Safety and Standards (Ayurveda Aahara) Regulations, 2022",
        "authority": "FSSAI (Food Safety and Standards Authority of India)",
        "document_type": "regulation",
        "jurisdiction": "india",
        "category": "fssai",
        "source_url": "https://www.fssai.gov.in/food-law/regulations",
        "version_tag": "2022-Regulations",
        "chunks": [
            {
                "section_identifier": "Regulation 3 & 4",
                "title": "Scope and Definition of Ayurveda Aahara",
                "content": (
                    "FSSAI Ayurveda Aahara Regulations 2022: 'Ayurveda Aahara' means food prepared in accordance with recipes or ingredients/processes described in authoritative Ayurvedic books listed in Schedule A. "
                    "It shall not include Ayurvedic drugs covered under Drugs and Cosmetics Act 1940. Every food business operator manufacturing Ayurveda Aahara must display the official Ayurveda Aahara logo and print mandatory disclaimer: 'NOT FOR MEDICINAL USE'."
                )
            }
        ]
    },

    # -------------------------------------------------------------------------
    # 5. TRADEMARKS, GI, DESIGNS & PLANT VARIETY
    # -------------------------------------------------------------------------
    {
        "title": "Trade Marks Act 1999 & GI of Goods Act 1999",
        "authority": "Trade Marks Registry & GI Registry of India",
        "document_type": "statute",
        "jurisdiction": "india",
        "category": "trademarks",
        "source_url": "https://ipindia.gov.in/",
        "version_tag": "1999-Consolidated",
        "chunks": [
            {
                "section_identifier": "Class 5, 3, 30 Classification",
                "title": "Nice Classification for Ayurvedic Products",
                "content": (
                    "Trade Marks Classification for Ayurveda: "
                    "- Class 5: Ayurvedic medicinal preparations, therapeutic formulations, and medicated oils. "
                    "- Class 3: Ayurvedic cosmetics, herbal soaps, non-medicated skin creams, hair oils, shampoos. "
                    "- Class 30 & 32: Ayurveda-Aahar, herbal teas, health tonics (food), dietary nutritional preparations. "
                    "Generic Sanskrit medicine names (e.g., 'Chyawanprash', 'Triphala') cannot be monopolized as trademarks; only distinctive invented prefix marks are registerable."
                )
            },
            {
                "section_identifier": "GI of Goods Act 1999",
                "title": "Geographical Indications for Ayurvedic Herbs & Products",
                "content": (
                    "Geographical Indications of Goods (Registration and Protection) Act, 1999: Protects goods having special quality or reputation attributable to their geographical origin (e.g. Kashmiri Saffron, Malabar Pepper, Navara Rice, Kangra Tea). Authorised users gain collective intellectual property rights preventing counterfeit origin claims."
                )
            },
            {
                "section_identifier": "PPVFR Act 2001",
                "title": "Protection of Plant Varieties and Farmers Rights Act, 2001",
                "content": (
                    "PPVFR Act 2001: Provides intellectual property protection to plant breeders, farmers, and researchers who develop Distinct, Uniform, and Stable (DUS) varieties of medicinal plants. Farmers retain rights to save, use, sow, re-sow, exchange, or sell farm produce/seeds."
                )
            }
        ]
    },

    # -------------------------------------------------------------------------
    # 6. INTERNATIONAL IP, TREATIES & TK
    #
    # Removed. The paraphrased summaries that lived here have been replaced by
    # verbatim treaty text in knowledge-base/corpus/international.json, covering
    # the Nagoya Protocol (Arts 5, 6, 7, 15, 16, 17), the CBD (Arts 8(j), 15),
    # TRIPS (Arts 22, 27) and the WIPO GRATK Treaty 2024 (Arts 1-6).
    #
    # Still to add for the international jurisdiction: TRIPS Arts 23-24, and
    # scope entries for PCT, Madrid, Hague and Budapest.
    # -------------------------------------------------------------------------
]

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

    Documents loaded from disk supersede any hardcoded document with the same
    title and jurisdiction.
    """
    loaded = []
    if not os.path.isdir(CORPUS_DIR):
        print(f"[Seed Knowledge] No corpus directory at {CORPUS_DIR}. Using hardcoded seed only.")
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
                chunks.append({
                    "section_identifier": c["section_identifier"],
                    "title": c.get("title", ""),
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
    """Verbatim corpus files first, then any hardcoded document they do not supersede."""
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

    for doc in corpus:
        doc_id = _document_id(doc)
        c_hash = _content_hash(doc)
        version_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}:{doc['version_tag']}:{c_hash}"))

        # 1. Register in-memory for instant fallback retrieval
        for idx, chunk in enumerate(doc["chunks"]):
            c_dict = {
                "id": f"{doc_id}-{idx}",
                "chunk_index": idx,
                "section_identifier": chunk["section_identifier"],
                "title": chunk["title"],
                "doc_title": doc["title"],
                "authority": doc["authority"],
                "jurisdiction": doc["jurisdiction"],
                "category": doc["category"],
                "document_type": doc["document_type"],
                "source_url": chunk.get("chunk_source_url") or doc["source_url"],
                "version_tag": doc["version_tag"],
                "text_provenance": doc.get("text_provenance", "paraphrase_pending_replacement"),
                "content": chunk["content"],
                "embedding": generate_embedding(chunk["content"])
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

                # This exact text already ingested? Then there is nothing to do.
                cur.execute("SELECT 1 FROM document_versions WHERE id = %s;", (version_id,))
                if cur.fetchone():
                    skipped_versions += 1
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
                    emb = generate_embedding(chunk["content"])
                    cur.execute(
                        """
                        INSERT INTO document_chunks (document_version_id, chunk_index, section_identifier, title, content, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s::vector);
                        """,
                        (version_id, idx, chunk["section_identifier"], chunk["title"], chunk["content"], str(emb))
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
            f"{total_chunks} chunks registered in memory."
        )
    else:
        print(f"[Seed Knowledge] Registered {total_chunks} authoritative chunks in IN-MEMORY store only (no PostgreSQL).")

if __name__ == "__main__":
    seed_database()
