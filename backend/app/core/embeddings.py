"""
Nomic-embed hybrid RAG — embeds invoice/mismatch text via Ollama's
nomic-embed-text model, stores in memory, and retrieves top-k relevant
chunks for a query. Falls back gracefully to pure graph RAG if Ollama
or the model is unavailable.
"""

import hashlib
from typing import Optional
import numpy as np
from app.config import get_settings

# In-memory vector store: { doc_id: { "text": str, "embedding": np.array, "metadata": dict } }
_vector_store: dict[str, dict] = {}
_embed_available: Optional[bool] = None  # lazy check


async def _get_embedding(text: str) -> Optional[np.ndarray]:
    """Get embedding vector from Ollama nomic-embed-text model."""
    global _embed_available
    if _embed_available is False:
        return None

    try:
        import httpx
        settings = get_settings()
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.ollama_url}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text},
            )
            response.raise_for_status()
            embedding = response.json().get("embedding")
            if embedding:
                _embed_available = True
                return np.array(embedding, dtype=np.float32)
            _embed_available = False
            return None
    except Exception as e:
        print(f"Embedding unavailable: {e}")
        _embed_available = False
        return None


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _doc_id(text: str) -> str:
    """Generate stable doc ID from text content."""
    return hashlib.md5(text.encode()).hexdigest()


async def index_documents(documents: list[dict]) -> int:
    """
    Index a list of documents into the vector store.
    Each doc should have: { "text": str, "metadata": dict }
    Returns number of newly indexed documents.
    """
    indexed = 0
    for doc in documents:
        text = doc.get("text", "")
        if not text:
            continue
        did = _doc_id(text)
        if did in _vector_store:
            continue

        embedding = await _get_embedding(text)
        if embedding is not None:
            _vector_store[did] = {
                "text": text,
                "embedding": embedding,
                "metadata": doc.get("metadata", {}),
            }
            indexed += 1

    return indexed


async def search_similar(query: str, top_k: int = 5) -> list[dict]:
    """
    Find top-k most similar documents to the query.
    Returns list of { "text": str, "score": float, "metadata": dict }
    """
    if not _vector_store:
        return []

    query_embedding = await _get_embedding(query)
    if query_embedding is None:
        return []

    scored = []
    for did, doc in _vector_store.items():
        score = _cosine_similarity(query_embedding, doc["embedding"])
        scored.append({
            "text": doc["text"],
            "score": score,
            "metadata": doc["metadata"],
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def is_available() -> bool:
    """Check if embedding service has been successfully used."""
    return _embed_available is True


def get_store_size() -> int:
    """Return number of indexed documents."""
    return len(_vector_store)
