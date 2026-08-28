import pytest
import os
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from app.services.rag.obsidian_service import ObsidianRAGService


def test_parse_frontmatter():
    markdown_content = """---
category: dining
tags: [breakfast, menu]
---

# Bữa Sáng Buffet
Nội dung giới thiệu bữa sáng...
"""
    metadata, body = ObsidianRAGService.parse_frontmatter(markdown_content)
    assert metadata.get("category") == "dining"
    assert "breakfast" in metadata.get("tags")
    assert "# Bữa Sáng Buffet" in body


def test_chunk_markdown():
    markdown_content = """# Tiêu Đề 1
Nội dung phần 1...

## Tiêu Đề 2
Nội dung phần 2...
"""
    file_metadata = {"category": "test"}
    chunks = ObsidianRAGService.chunk_markdown(markdown_content, "test.md", file_metadata)
    
    assert len(chunks) == 2
    assert chunks[0]["metadata"]["category"] == "test"
    assert "Tiêu Đề 1" in chunks[0]["document"]
    assert "Tiêu Đề 2" in chunks[1]["document"]


def test_sync_vault_to_chroma():
    with TemporaryDirectory() as tmp_dir:
        # Tạo file markdown tạm thời
        test_file = os.path.join(tmp_dir, "quy_dinh.md")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("# Quy Định Khách Sạn\n- Trả phòng lúc 12h.")

        mock_collection = MagicMock()
        
        with patch("app.services.rag.obsidian_service.get_concierge_collection", return_value=mock_collection):
            service = ObsidianRAGService()
            res = service.sync_vault_to_chroma(vault_dir=tmp_dir)
            
            assert res["status"] == "success"
            assert res["files_processed"] == 1
            assert res["chunks_upserted"] > 0
            assert mock_collection.upsert.called
