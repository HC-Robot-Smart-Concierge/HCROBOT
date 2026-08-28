import pytest
from unittest.mock import patch, MagicMock
from app.db.chroma import get_concierge_collection


def test_chroma_upsert_and_get():
    """Unit test kiểm tra thêm và đọc tài liệu trong ChromaDB"""
    mock_collection = MagicMock()
    mock_collection.get.return_value = {
        "ids": ["test_001"],
        "documents": ["Nội dung test"],
        "metadatas": [{"category": "test"}]
    }

    with patch("app.db.chroma.get_concierge_collection", return_value=mock_collection):
        collection = get_concierge_collection("test")
        collection.upsert(ids=["test_001"], documents=["Nội dung test"], metadatas=[{"category": "test"}])
        
        data = collection.get()
        assert data["ids"][0] == "test_001"
        assert data["documents"][0] == "Nội dung test"
