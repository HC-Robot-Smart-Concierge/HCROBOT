import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

_chroma_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Returns a singleton ChromaDB PersistentClient."""
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False)
        )
    return _chroma_client


def get_concierge_collection(collection_name: str = "concierge_kb"):
    """Gets or creates the Concierge RAG Knowledge Base collection."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"description": "Hotel Concierge Knowledge Base Vector Store"}
    )
