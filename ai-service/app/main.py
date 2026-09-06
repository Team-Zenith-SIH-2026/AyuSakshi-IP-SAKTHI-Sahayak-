import os
from fastapi import FastAPI, HTTPException, Header, Depends, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from app.config import settings
from app.agents.rag_orchestrator import RAGOrchestrator
from app.agents.formulation_classifier import FormulationClassifier
from app.agents import classification_tree
from app.multilingual.bhashini_service import BhashiniService
from app.core.pdf_extractor import PDFExtractor
from app.core.chunker import LegalAwareChunker
from app.core.ingestion import ingest_document_version
from app.rag.embeddings import generate_embedding
from app.rag.hybrid_retriever import register_in_memory_chunk
from app.seed_knowledge import seed_database
import uuid

app = FastAPI(
    title="AyuSakshi AI Service",
    version="1.0.0",
    description="SIH26045: Source-Cited Multilingual RAG & Formulation Intelligence Engine for Ayurveda IP"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Internal Security Dependency
def verify_internal_token(x_ai_service_token: Optional[str] = Header(None)):
    # In development, accept requests or match token
    if settings.ENVIRONMENT == "production":
        if not x_ai_service_token or x_ai_service_token != settings.AI_SERVICE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid internal AI service token."
            )
    return True

# --- Request / Response Models ---
class RAGQueryRequest(BaseModel):
    query: str
    conversation_id: str
    jurisdiction: Optional[str] = "india"
    language: Optional[str] = "en"
    history: Optional[List[Dict[str, Any]]] = []
    formulation_state: Optional[Dict[str, Any]] = {}

class FormulationClassifyRequest(BaseModel):
    text: str
    conversation_id: Optional[str] = None
    current_state: Optional[Dict[str, Any]] = {}

class WizardAnswer(BaseModel):
    node: str
    value: str

class WizardClassifyRequest(BaseModel):
    answers: List[WizardAnswer] = Field(default_factory=list)
    conversation_id: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str
    source_language: Optional[str] = "auto"
    target_language: Optional[str] = "en"

class DocumentIngestRequest(BaseModel):
    # Optional: the backend supplies one, but direct ingestion derives a stable
    # id from the document title and jurisdiction instead.
    document_id: Optional[str] = None
    version_tag: str
    file_path: Optional[str] = None
    title: str
    authority: str
    document_type: str
    jurisdiction: str
    category: str
    source_url: Optional[str] = ""

# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    print("==========================================================")
    print("  🌿 AyuSakshi AI Service (FastAPI + LangGraph) Initialized")
    print(f"  🚀 Embedding Model: {settings.EMBEDDING_MODEL_NAME}")
    print(f"  🔍 Hybrid Search: Dense Vector (pgvector) + BM25 Lexical")
    print("==========================================================")
    # Automatically seed authoritative corpus into memory/database
    seed_database()

# --- Endpoints ---

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "embedding_model": settings.EMBEDDING_MODEL_NAME,
        "bhashini_enabled": settings.BHASHINI_ENABLED,
    }

@app.post("/api/rag/query", dependencies=[Depends(verify_internal_token)])
async def execute_rag_query(request: RAGQueryRequest):
    try:
        response = await RAGOrchestrator.process_query(
            query=request.query,
            conversation_id=request.conversation_id,
            jurisdiction=request.jurisdiction or "india",
            language=request.language or "en",
            history=request.history or [],
            formulation_state=request.formulation_state or {}
        )
        return response
    except Exception as e:
        print(f"[RAG Query Exception]: {e}")
        raise HTTPException(status_code=500, detail=f"RAG processing failed: {str(e)}")

@app.post("/api/formulation/classify", dependencies=[Depends(verify_internal_token)])
async def classify_formulation(request: FormulationClassifyRequest):
    try:
        result = FormulationClassifier.classify(request.text, request.current_state)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

@app.get("/api/formulation/wizard/tree", dependencies=[Depends(verify_internal_token)])
async def get_wizard_tree():
    """The full rule-based decision tree, for a client that wants to render it."""
    return classification_tree.get_tree()


@app.post("/api/formulation/wizard/classify", dependencies=[Depends(verify_internal_token)])
async def wizard_classify(request: WizardClassifyRequest):
    """
    Walk the rule-based decision tree.

    Returns the next question while the tree is incomplete, and the final
    category plus its decision path once a leaf is reached. Deterministic:
    the same answers always produce the same category, and the path shows
    exactly which rule produced it.
    """
    try:
        answers = [{"node": a.node, "value": a.value} for a in request.answers]
        return classification_tree.classify(answers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[Wizard Classify Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Wizard classification failed: {str(e)}")


@app.post("/api/translate", dependencies=[Depends(verify_internal_token)])
async def translate_text(request: TranslateRequest):
    try:
        src = request.source_language
        if src == "auto":
            src = BhashiniService.detect_language(request.text)
        result = await BhashiniService.translate(request.text, source_lang=src, target_lang=request.target_language)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/api/document/ingest", dependencies=[Depends(verify_internal_token)])
async def ingest_document(request: DocumentIngestRequest):
    try:
        if not request.file_path or not os.path.exists(request.file_path):
            return {"status": "error", "message": f"File not found: {request.file_path}"}
            
        pages = PDFExtractor.extract_document(request.file_path)
        chunks = LegalAwareChunker.chunk_document(pages)

        if not chunks:
            return {
                "status": "error",
                "message": (
                    "No text could be extracted from this file. If it is a scanned PDF it has no "
                    "text layer and needs OCR before ingestion."
                ),
                "pages_extracted": len(pages),
                "chunks_count": 0,
                "persisted_to_postgres": False,
            }

        result = ingest_document_version(
            title=request.title,
            authority=request.authority,
            document_type=request.document_type,
            jurisdiction=request.jurisdiction,
            category=request.category,
            source_url=request.source_url or "",
            version_tag=request.version_tag,
            chunks=chunks,
            document_id=request.document_id,
            raw_text_length=sum(len(p.get("text", "")) for p in pages),
        )
        result["version_tag"] = request.version_tag
        result["pages_extracted"] = len(pages)
        return result
    except Exception as e:
        print(f"[Document Ingest Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
