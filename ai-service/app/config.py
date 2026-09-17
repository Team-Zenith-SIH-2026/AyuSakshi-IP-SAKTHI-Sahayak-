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
    # Provider order: each Groq model in turn (every key tried per model) ->
    # local Ollama model -> OpenAI (only with a real key). See app/llm/providers.py.
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # Further keys, tried when the one before is rejected or rate limited.
    #
    # Worth knowing before relying on them: Groq counts free-tier quota per
    # organization and per model, not per key. Four keys cut from one account
    # share a single allowance. Measured by sending one request per key and
    # watching x-ratelimit-remaining-requests fall 999, 998, 997, 996 across
    # four different keys. Extra keys therefore only add capacity when they
    # belong to a different account; what does add capacity is GROQ_MODEL_FALLBACKS.
    GROQ_API_KEY_2: str = os.getenv("GROQ_API_KEY_2", "")
    GROQ_API_KEY_3: str = os.getenv("GROQ_API_KEY_3", "")
    GROQ_API_KEY_4: str = os.getenv("GROQ_API_KEY_4", "")
    # 20b, not 120b. On the demo questions 120b repeatedly named provisions it
    # was never shown (Section 64(1)(q), Section 25(1)(k)); the citation verifier
    # correctly blocked them, so 120b refused questions 20b answers from evidence.
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    # Tried in order when GROQ_MODEL is out of quota. Each model carries its own
    # per-day token budget, so this is what multiplies a free-tier day: roughly
    # 200k tokens per model rather than 200k in total.
    #
    # Deliberately absent: openai/gpt-oss-120b, which names provisions it was
    # never shown (see GROQ_MODEL above), and groq/compound, which can reach the
    # web mid-answer and so cannot be held to the retrieved evidence.
    GROQ_MODEL_FALLBACKS: str = os.getenv(
        "GROQ_MODEL_FALLBACKS", "qwen/qwen3.8-27b,qwen/qwen3.6-27b"
    )

    # Default 0. In a legal domain there is no value in sampling variety, and a
    # non-zero temperature made the benchmark move by a case or two between runs,
    # which makes measured results hard to quote honestly.
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0"))

    # Total time the Groq keys may spend together, including rate-limit backoff.
    # Kept short so a rate-limited request moves on to the local model quickly.
    # The chat path's Node, nginx and browser timeouts (about five minutes) are
    # sized for the slow local fallback on top of this budget.
    LLM_TOTAL_BUDGET_SECONDS: float = float(os.getenv("LLM_TOTAL_BUDGET_SECONDS", "28"))

    # Must be set explicitly. Rate limiters bill the *reserved* completion length,
    # not the length actually produced, so omitting it makes the provider reserve
    # the model's maximum output against the per-minute token budget and reject a
    # single request as though it had consumed the entire minute's allowance.
    # 1600 is comfortably above the longest structured answer this system emits.
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1600"))

    # Ollama gives the on-premise story: nothing leaves the machine.
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-nothink:latest")
    # A 7B model on a laptop CPU is far slower than a hosted one (measured about
    # 168s cold for one answer), so it gets its own timeout and a shorter
    # maximum answer: every output token costs time.
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "240"))
    OLLAMA_MAX_TOKENS: int = int(os.getenv("OLLAMA_MAX_TOKENS", "450"))
    # Ollama otherwise sizes the context window from free memory, which for this
    # 7B model meant 9.3 GB on a 16 GB laptop. 4096 comfortably fits the lean prompt.
    OLLAMA_NUM_CTX: int = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
    # What the local model is shown: the top sources only, each trimmed.
    LOCAL_EVIDENCE_TOP_K: int = int(os.getenv("LOCAL_EVIDENCE_TOP_K", "3"))
    LOCAL_EVIDENCE_CHAR_CAP: int = int(os.getenv("LOCAL_EVIDENCE_CHAR_CAP", "1500"))
    
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    RERANKER_MODEL_NAME: str = os.getenv("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    EMBEDDING_DIMENSION: int = 384
    
    # Bhashini Configuration
    BHASHINI_USER_ID: str = os.getenv("BHASHINI_USER_ID", "")
    BHASHINI_API_KEY: str = os.getenv("BHASHINI_API_KEY", "")
    _raw_pipeline_id: str = os.getenv("BHASHINI_PIPELINE_ID", "")
    BHASHINI_PIPELINE_ID: str = (
        _raw_pipeline_id.strip() if _raw_pipeline_id and _raw_pipeline_id.strip() != "demo_pipeline_id"
        else "64392f96daac500b55c543cd"
    )
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
