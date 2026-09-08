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

    # Total time one LLM call may spend, including rate-limit backoff. Must stay
    # comfortably under the Node backend and browser timeouts (both 45s), so that
    # a rate-limited request abstains honestly instead of surfacing as a
    # connection timeout with no explanation.
    LLM_TOTAL_BUDGET_SECONDS: float = float(os.getenv("LLM_TOTAL_BUDGET_SECONDS", "28"))

    # Must be set explicitly. Rate limiters bill the *reserved* completion length,
    # not the length actually produced, so omitting it makes the provider reserve
    # the model's maximum output against the per-minute token budget and reject a
    # single request as though it had consumed the entire minute's allowance.
    # 1600 is comfortably above the longest structured answer this system emits.
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1600"))

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
    DENSE_TOP_K: int = int(os.getenv("DENSE_TOP_K", "15"))
    BM25_TOP_K: int = int(os.getenv("BM25_TOP_K", "15"))
    RERANK_TOP_K: int = int(os.getenv("RERANK_TOP_K", "5"))

    # Semantic floor for keeping a retrieved chunk that has no lexical overlap
    # with the query. Asymmetric pairs (a plain-language question against
    # verbatim statute) score far lower than sentence-similarity pairs, so the
    # old 0.45 would have rejected almost every legitimate semantic match. It
    # never actually did, because nothing read this setting until the retrieval
    # filter was fixed to use it.
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.30"))

    CONFIDENCE_ABSTAIN_THRESHOLD: float = float(os.getenv("CONFIDENCE_ABSTAIN_THRESHOLD", "0.50"))

    # Squashed cross-encoder score below which a retrieved chunk is not eligible
    # to be presented as a citation. 0.10 corresponds to a raw logit of about
    # -2.2, which the reranker only assigns when a chunk plainly does not
    # address the query.
    CITATION_RELEVANCE_FLOOR: float = float(os.getenv("CITATION_RELEVANCE_FLOOR", "0.10"))

settings = Settings()
