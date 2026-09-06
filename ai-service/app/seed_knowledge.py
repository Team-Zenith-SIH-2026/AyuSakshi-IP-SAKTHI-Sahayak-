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
from app.rag.hybrid_retriever import register_in_memory_chunk

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
    # -------------------------------------------------------------------------
    {
        "title": "WIPO GRATK Treaty (2024) & Nagoya Protocol on ABS",
        "authority": "WIPO / UN Convention on Biological Diversity",
        "document_type": "treaty",
        "jurisdiction": "international",
        "category": "treaties",
        "source_url": "https://www.wipo.int/treaties/ip/gratk/",
        "version_tag": "2024-Treaty",
        "chunks": [
            {
                "section_identifier": "WIPO GRATK Treaty (2024)",
                "title": "Mandatory Patent Disclosure of Genetic Resources and Traditional Knowledge",
                "content": (
                    "WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge (adopted May 2024): "
                    "Establishes a mandatory disclosure requirement in international patent applications. Where a claimed invention is based on genetic resources or associated traditional knowledge, patent applicants must disclose the country of origin or indigenous source. Provides a global defensive framework against biopiracy."
                )
            },
            {
                "section_identifier": "Nagoya Protocol Article 5 & 6",
                "title": "Access and Benefit Sharing (ABS) International Standards",
                "content": (
                    "Nagoya Protocol on Access to Genetic Resources and the Fair and Equitable Sharing of Benefits Arising from their Utilization: "
                    "Parties must ensure that genetic resources and traditional knowledge associated with genetic resources held by indigenous communities are accessed only with Prior Informed Consent (PIC) and based on Mutually Agreed Terms (MAT). Exporters of Ayurvedic botanical extracts to member nations must satisfy domestic ABS clearance."
                )
            },
            {
                "section_identifier": "TRIPS Agreement Article 27.3(b)",
                "title": "Patentability of Biological Inventions and Plant Protection",
                "content": (
                    "WTO TRIPS Agreement Article 27.3(b): Members may exclude from patentability plants and animals other than microorganisms, and essentially biological processes for the production of plants or animals. Members must provide for the protection of plant varieties either by patents or by an effective sui generis system (such as India's PPVFRA)."
                )
            },
            {
                "section_identifier": "PCT (Patent Cooperation Treaty) & Madrid System",
                "title": "International Filing Mechanisms for Patents and Trademarks",
                "content": (
                    "Patent Cooperation Treaty (PCT): Unified patent filing across 157+ countries with an International Search Report (ISR). "
                    "Madrid System: Streamlined international registration of trademarks across 130+ member countries via a single centralized application filed through the Indian Trade Marks Registry."
                )
            }
        ]
    }
]

def seed_database():
    """
    Seed authoritative corpus into PostgreSQL (and register in in-memory retriever for tests).
    """
    print("[Seed Knowledge] Seeding Authoritative Legal Corpus...")
    conn = None
    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        cur = conn.cursor()
    except Exception as e:
        print(f"[Seed Knowledge] PostgreSQL connection not available for seeding ({e}). Registering in memory.")
        cur = None

    total_chunks = 0
    for doc in AUTHORITATIVE_CORPUS:
        doc_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())
        
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
                "source_url": doc["source_url"],
                "version_tag": doc["version_tag"],
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
                    ON CONFLICT DO NOTHING;
                    """,
                    (doc_id, doc["title"], doc["authority"], doc["document_type"], doc["jurisdiction"], doc["category"], doc["source_url"])
                )
                
                cur.execute(
                    """
                    INSERT INTO document_versions (id, document_id, version_tag, content_hash, is_current, chunk_count)
                    VALUES (%s, %s, %s, %s, TRUE, %s)
                    ON CONFLICT DO NOTHING;
                    """,
                    (version_id, doc_id, doc["version_tag"], "sha256-seeded-auth", len(doc["chunks"]))
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
            except Exception as e:
                print(f"[Seed DB Error on doc {doc['title']}]: {e}")
                
    if conn and cur:
        conn.commit()
        print(f"[Seed Knowledge] Successfully seeded PostgreSQL with {len(AUTHORITATIVE_CORPUS)} documents and {total_chunks} chunks.")
    else:
        print(f"[Seed Knowledge] Registered {total_chunks} authoritative chunks in in-memory vector store.")

    # 3. Scan Knowledge-Base Directory Recursively for PDF files (India, International, Case-Law)
    scan_knowledge_base_directory(conn, cur)

    if conn and cur:
        cur.close()
        conn.close()

def scan_knowledge_base_directory(conn=None, cur=None):
    """
    Recursively scan knowledge-base subdirectories for PDF/Text files and ingest them using PyMuPDF & LegalAwareChunker.
    """
    try:
        from app.core.pdf_extractor import PDFExtractor
        from app.core.chunker import LegalAwareChunker
    except ImportError:
        PDFExtractor = None
        LegalAwareChunker = None

    if not PDFExtractor or not LegalAwareChunker:
        print("[Seed Directory Scan] PDFExtractor/LegalAwareChunker modules not available. Skipping directory PDF scan.")
        return

    kb_dir = os.getenv("KNOWLEDGE_BASE_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "knowledge-base")))
    if not os.path.exists(kb_dir):
        kb_dir = "/app/knowledge-base"

    if not os.path.exists(kb_dir):
        print(f"[Seed Directory Scan] Directory not found: {kb_dir}")
        return

    print(f"[Seed Directory Scan] Scanning directory for legal PDFs: {kb_dir}")
    pdf_count = 0
    total_pdf_chunks = 0

    for root, dirs, files in os.walk(kb_dir):
        for f in files:
            if f.endswith(('.pdf', '.txt', '.md')) and not f.startswith('.'):
                file_path = os.path.join(root, f)
                rel_path = os.path.relpath(file_path, kb_dir)
                
                # Determine jurisdiction & category from folder structure
                parts = rel_path.replace("\\", "/").split("/")
                jurisdiction = "india"
                category = "patents"
                if len(parts) > 1:
                    if parts[0] in ['india', 'international', 'case-law']:
                        jurisdiction = parts[0]
                    if len(parts) > 2:
                        category = parts[1]

                title = os.path.splitext(f)[0].replace("_", " ").title()
                doc_id = str(uuid.uuid4())
                version_id = str(uuid.uuid4())

                try:
                    pages_data = PDFExtractor.extract_document(file_path)
                    chunks = LegalAwareChunker.chunk_document(pages_data)
                    if not chunks:
                        continue

                    pdf_count += 1

                    for idx, chunk in enumerate(chunks):
                        c_dict = {
                            "id": f"{doc_id}-{idx}",
                            "chunk_index": idx,
                            "section_identifier": chunk["section_identifier"],
                            "title": chunk["title"],
                            "doc_title": title,
                            "authority": "Official Statutory Register",
                            "jurisdiction": jurisdiction,
                            "category": category,
                            "document_type": "statute",
                            "source_url": file_path,
                            "version_tag": "ingested-v1",
                            "content": chunk["content"],
                            "embedding": generate_embedding(chunk["content"])
                        }
                        register_in_memory_chunk(c_dict)
                        total_pdf_chunks += 1

                    if cur:
                        cur.execute(
                            """
                            INSERT INTO documents (id, title, authority, document_type, jurisdiction, category, source_url)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING;
                            """,
                            (doc_id, title, "Official Statutory Register", "statute", jurisdiction if jurisdiction in ['india', 'international'] else 'india', category, rel_path)
                        )
                        cur.execute(
                            """
                            INSERT INTO document_versions (id, document_id, version_tag, content_hash, is_current, file_path, chunk_count)
                            VALUES (%s, %s, %s, %s, TRUE, %s, %s)
                            ON CONFLICT DO NOTHING;
                            """,
                            (version_id, doc_id, "ingested-v1", "sha256-" + str(uuid.uuid4())[:8], rel_path, len(chunks))
                        )
                        for idx, chunk in enumerate(chunks):
                            emb = generate_embedding(chunk["content"])
                            cur.execute(
                                """
                                INSERT INTO document_chunks (document_version_id, chunk_index, section_identifier, title, content, embedding)
                                VALUES (%s, %s, %s, %s, %s, %s::vector);
                                """,
                                (version_id, idx, chunk["section_identifier"], chunk["title"], chunk["content"], str(emb))
                            )
                        if conn:
                            conn.commit()

                    print(f"[Seed Directory Scan] Ingested '{title}' ({len(pages_data)} pages, {len(chunks)} chunks) from {rel_path}")

                except Exception as e:
                    print(f"[Seed Directory Scan Error] Failed processing {f}: {e}")

    print(f"[Seed Directory Scan] Completed. Processed {pdf_count} PDF documents resulting in {total_pdf_chunks} chunks.")

if __name__ == "__main__":
    seed_database()

