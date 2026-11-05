import os
import re
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings

logger = logging.getLogger(__name__)

_chroma_client = None

# Common stop words in Vietnamese and English to ignore during keyword scoring
STOPWORDS = {
    "cho", "tôi", "các", "có", "không", "ở", "gì", "là", "như", "thế", "nào", 
    "được", "hay", "với", "và", "nhé", "ạ", "em", "ơi", "anh", "chị", "hãy",
    "của", "đến", "tại", "một", "những", "thì", "mà", "bị", "đã", "sẽ", "đang",
    "the", "a", "an", "is", "are", "to", "for", "in", "on", "at", "me", "you", "please", "tell", "what", "where"
}


def get_chroma_client() -> chromadb.PersistentClient:
    """Returns a singleton ChromaDB PersistentClient."""
    global _chroma_client
    if _chroma_client is None:
        abs_path = getattr(settings, "resolved_chroma_dir", os.path.abspath(settings.CHROMA_PERSIST_DIR))
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


def _hybrid_rerank(
    query: str,
    docs: List[str],
    metas: List[Dict[str, Any]],
    dists: List[Any],
    n_results: int = 4
) -> List[str]:
    """
    Kết hợp Vector Similarity với Keyword & Section Re-ranking (Hybrid RAG).
    Đảm bảo các truy vấn địa danh, ngoại khu, tiện ích tiếng Việt đạt độ chính xác tối đa.
    """
    if not docs:
        return []

    tokens = [w.lower() for w in re.findall(r'[\w]+', query, flags=re.UNICODE) if len(w) >= 2]
    keywords = [t for t in tokens if t not in STOPWORDS]
    if not keywords:
        keywords = tokens

    scored_items = []
    for doc, meta, dist in zip(docs, metas, dists):
        if not doc or not str(doc).strip():
            continue

        doc_str = str(doc).strip()
        doc_lower = doc_str.lower()
        sec_lower = (meta.get("section") or "").lower() if isinstance(meta, dict) else ""

        kw_score = 0.0
        for kw in keywords:
            # Tần suất xuất hiện trong nội dung
            c = doc_lower.count(kw)
            if c > 0:
                kw_score += 1.0 + min(c * 0.1, 1.5)
            # Ưu tiên cực lớn nếu từ khóa nằm trong tiêu đề / đề mục mục lục
            if kw in sec_lower:
                kw_score += 2.5

        # Thưởng điểm cho cụm từ khóa liên tiếp (phrase match)
        if len(keywords) >= 2:
            query_phrase = " ".join(keywords)
            if query_phrase in doc_lower:
                kw_score += 3.0

        # Khoảng cách Cosine sang điểm tương đồng (Similarity score)
        dist_val = dist if isinstance(dist, (int, float)) else 0.5
        vec_sim = 1.0 / (1.0 + max(dist_val, 0.0))
        norm_kw = min(kw_score / max(len(keywords) * 2.5, 1.0), 1.5)
        combined_score = 0.45 * vec_sim + 0.55 * norm_kw

        scored_items.append((combined_score, doc_str))

    scored_items.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored_items[:n_results]]


async def query_rag_context(prompt: str, n_results: int = 4, collection_name: str = "concierge_kb") -> str:
    """
    Truy vấn bất đồng bộ lấy ngữ cảnh tri thức khách sạn từ ChromaDB Vector Store
    kết hợp Hybrid Keyword & Semantic Re-ranking.
    """
    if not prompt or not prompt.strip():
        return ""
    try:
        import asyncio

        def _sync_query() -> str:
            col = get_concierge_collection(collection_name)
            
            total_docs = 10
            try:
                c = col.count()
                if isinstance(c, int):
                    total_docs = c
            except Exception:
                pass

            if total_docs == 0:
                return ""

            # Lấy tập ứng viên rộng hơn (n_candidates) để Re-ranking
            n_candidates = min(max(n_results * 3, 10), total_docs) if isinstance(total_docs, int) else n_results
            res = col.query(query_texts=[prompt.strip()], n_results=n_candidates)

            if res and res.get("documents") and len(res["documents"]) > 0:
                raw_docs = res["documents"][0]
                raw_metas = res.get("metadatas", [[]])[0] if res.get("metadatas") else [{}] * len(raw_docs)
                raw_dists = res.get("distances", [[]])[0] if res.get("distances") else [0.5] * len(raw_docs)

                best_docs = _hybrid_rerank(prompt.strip(), raw_docs, raw_metas, raw_dists, n_results=n_results)
                if best_docs:
                    return "\n\n---\n\n".join(best_docs)
            return ""

        return await asyncio.to_thread(_sync_query)
    except Exception as e:
        logger.warning(f"[query_rag_context Error] {e}")
        return ""
