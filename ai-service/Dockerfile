FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# torch first, from the CPU-only wheel index. The default PyPI wheel bundles
# CUDA runtime libraries (~2.5GB) that are dead weight on a CPU-only deployment.
RUN pip install --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding and reranker weights into the image so a cold start does
# not need to reach HuggingFace. Demo machines cannot rely on having internet.
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2'); \
print('[Build] Model weights cached into image.')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
