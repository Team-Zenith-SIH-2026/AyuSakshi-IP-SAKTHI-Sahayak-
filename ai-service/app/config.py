import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "AyuSakshi AI Service"
    ENVIRONMENT: str = os.getenv("NODE_ENV", "development")
    API_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    
    # Internal Security Token
    AI_SERVICE_SECRET: str = os.getenv("AI_SERVICE_SECRET", "ayusakshi_internal_ai_token_2026")
    
    # Database (PostgreSQL + pgvector)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://ayusakshi_user:ayusakshi_secure_pass_2026@localhost:5432/ayusakshi_db")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # LLM & Embedding Settings
    # Provider order of preference: groq (fast, free) -> openai -> ollama (offline).
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # Default 0. In a legal domain there is no value in sampling variety, and a
    # non-zero temperature made the benchmark move by a case or two between runs,
    # which makes measured results hard to quote honestly.
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0"))

    # Ollama gives the on-premise story: nothing leaves the machine.
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    RERANKER_MODEL_NAME: str = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    EMBEDDING_DIMENSION: int = 384
    
    # Bhashini Configuration
    BHASHINI_USER_ID: str = os.getenv("BHASHINI_USER_ID", "")
    BHASHINI_API_KEY: str = os.getenv("BHASHINI_API_KEY", "")
    BHASHINI_PIPELINE_ID: str = os.getenv("BHASHINI_PIPELINE_ID", "")
    BHASHINI_ENABLED: bool = os.getenv("BHASHINI_ENABLED", "false").lower() == "true"
    
    # RAG Retrieval Parameters
    DENSE_TOP_K: int = 15
    BM25_TOP_K: int = 15
    RERANK_TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.45
    CONFIDENCE_ABSTAIN_THRESHOLD: float = 0.50

settings = Settings()
