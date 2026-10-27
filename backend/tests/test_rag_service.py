import pytest
from unittest.mock import patch, MagicMock
from app.services.rag.chroma import get_concierge_collection


def test_chroma_upsert_and_get():
    """Unit test kiểm tra thêm và đọc tài liệu trong ChromaDB"""
    mock_collection = MagicMock()
    mock_collection.get.return_value = {
        "ids": ["test_001"],
        "documents": ["Nội dung test"],
        "metadatas": [{"category": "test"}]
    }

    with patch("app.services.rag.chroma.get_concierge_collection", return_value=mock_collection):
        collection = get_concierge_collection("test")
        collection.upsert(ids=["test_001"], documents=["Nội dung test"], metadatas=[{"category": "test"}])
        
        data = collection.get()
        assert data["ids"][0] == "test_001"
        assert data["documents"][0] == "Nội dung test"


@pytest.mark.asyncio
async def test_query_rag_context_success():
    """Unit test kiểm tra hàm async query_rag_context lấy đúng tài liệu từ ChromaDB."""
    from app.services.rag.chroma import query_rag_context

    mock_collection = MagicMock()
    mock_collection.query.return_value = {
        "documents": [["Hồ bơi vô cực nằm ở Tầng 5, mở cửa từ 6:00 đến 21:00 hàng ngày."]]
    }

    with patch("app.services.rag.chroma.get_concierge_collection", return_value=mock_collection):
        context = await query_rag_context("Hồ bơi ở đâu?")
        assert "Hồ bơi vô cực nằm ở Tầng 5" in context


@pytest.mark.asyncio
async def test_ollama_auto_inject_rag_context():
    """Unit test kiểm tra OllamaService tự động nạp tri thức RAG khi rag_context=None."""
    from app.services.ai.ollama_service import OllamaService

    service = OllamaService()
    mock_chat_response = {"message": {"content": "Khách sạn có dịch vụ gửi đồ ạ."}}

    with patch("app.services.rag.chroma.query_rag_context", return_value="Dịch vụ giữ hành lý qua đêm tại sảnh.") as mock_rag, \
         patch("ollama.AsyncClient.chat", new_callable=MagicMock) as mock_chat:
        mock_chat.return_value = mock_chat_response

        # Gọi câu hỏi không thuộc Fast-path và không truyền rag_context
        await service.generate_response(prompt="Khách sạn có dịch vụ gửi hành lý qua đêm không?", rag_context=None)
        assert mock_rag.called


def test_ollama_offline_fallback_uses_rag():
    """Unit test kiểm tra fallback ngoại tuyến ưu tiên lấy thông tin từ RAG thay vì hardcode."""
    from app.services.ai.ollama_service import OllamaService

    service = OllamaService()
    mock_rag_ctx = "Dịch vụ trông trẻ em tại Aurora hoạt động từ 8:00 đến 20:00 hàng ngày."

    reply = service.generate_offline_fallback_response(
        prompt="Khách sạn có dịch vụ trông trẻ em không?",
        rag_context=mock_rag_ctx
    )
    assert "Dịch vụ trông trẻ em tại Aurora" in reply
    assert "Thang máy A" not in reply  # Đảm bảo không còn hardcode thang máy A
