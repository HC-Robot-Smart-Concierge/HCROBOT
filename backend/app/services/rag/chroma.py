import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

_chroma_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Returns a singleton ChromaDB PersistentClient."""
    global _chroma_client
    if _chroma_client is None:
        abs_path = os.path.abspath(settings.CHROMA_PERSIST_DIR)
        os.makedirs(abs_path, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=abs_path,
            settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False)
        )
    return _chroma_client


def get_concierge_collection(collection_name: str = "concierge_kb"):
    """Gets or creates the Concierge RAG Knowledge Base collection with auto-healing against corrupted HNSW segments."""
    client = get_chroma_client()
    try:
        col = client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Hotel Concierge Knowledge Base Vector Store"}
        )
        # Verify collection readability
        col.count()
        return col
    except Exception as e:
        err_msg = str(e).lower()
        if "hnsw" in err_msg or "corrupt" in err_msg or "segment reader" in err_msg:
            # Auto-healing: Remove corrupted collection and recreate freshly
            try:
                client.delete_collection(collection_name)
            except Exception:
                pass
            return client.get_or_create_collection(
                name=collection_name,
                metadata={"description": "Hotel Concierge Knowledge Base Vector Store"}
            )
        raise e
