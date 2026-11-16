import os
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.rag.facilities_kb_service import get_facilities_from_kb, get_kb_facts_prompt
from app.services.ai.ollama_service import OllamaService
from app.services.ai.gemini_service import GeminiService
from app.services.ai.concierge_graph import concierge_graph


def test_facilities_kb_parses_real_vault_without_buffet_restaurant():
    vi_data = get_facilities_from_kb(lang="vi")
    assert vi_data["total"] >= 10
    assert vi_data["source_file"] == "hotel_facilities_floor_layout_vi.md"

    names = [f["name"] for f in vi_data["facilities"]]
    assert not any("nhà hàng aurora" in n.lower() for n in names)
    assert not any("buffet sáng á - âu" in (f["desc"] + f["knowledge"]["summary"]).lower() for f in vi_data["facilities"])

    dining_item = next((f for f in vi_data["facilities"] if f["key"] == "restaurant"), None)
    assert dining_item is not None
    assert dining_item["has_menu_action"] is True
    assert "không có nhà hàng" in dining_item["knowledge"]["summary"].lower()
    assert "room service" in dining_item["knowledge"]["summary"].lower()

    en_data = get_facilities_from_kb(lang="en")
    assert en_data["total"] >= 10
    assert en_data["source_file"] == "hotel_facilities_floor_layout_rag.md"
    en_dining = next((f for f in en_data["facilities"] if f["key"] == "restaurant"), None)
    assert en_dining is not None
    assert en_dining["has_menu_action"] is True
    assert "does not operate a walk-in restaurant" in en_dining["knowledge"]["summary"].lower()


def test_facilities_kb_reflects_markdown_edits_dynamically():
    with TemporaryDirectory() as tmp_dir:
        md_path = os.path.join(tmp_dir, "hotel_facilities_floor_layout_vi.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(
                "## 8. Tầng 5\n"
                "- **Hồ Bơi Vô Cực:**\n"
                "  - **Chi phí:** Miễn phí.\n\n"
                "## 10. Bảng Tổng Hợp Tra Cứu Tiện Ích Toàn Khách Sạn\n"
                "| Tầng | Tên Khu Vực / Tiện Ích | Giờ Hoạt Động | Chi Phí / Vé | Hướng Dẫn Di Chuyển |\n"
                "|---|---|---|---|---|\n"
                "| **Tầng 5** | Hồ Bơi Vô Cực | 05:30 - 23:30 | Miễn phí | Đi Thang máy A lên Tầng 5 |\n"
            )

        data = get_facilities_from_kb(lang="vi", vault_dir=tmp_dir)
        assert data["total"] == 1
        assert data["facilities"][0]["hours"] == "05:30 - 23:30"

        facts_prompt = get_kb_facts_prompt(lang_code="vi-VN", vault_dir=tmp_dir)
        assert "05:30 - 23:30" in facts_prompt


def test_rag_facilities_endpoint():
    with TestClient(app) as client:
        resp_vi = client.get("/api/v1/rag/facilities?lang=vi")
        assert resp_vi.status_code == 200
        body = resp_vi.json()
        assert body["total"] >= 10
        assert body["language"] == "vi"
        assert any(item["key"] == "infinity_pool" for item in body["facilities"])

        resp_en = client.get("/api/v1/rag/facilities?lang=en")
        assert resp_en.status_code == 200
        assert resp_en.json()["language"] == "en"


def test_system_prompts_inject_knowledge_base_facts():
    ollama_svc = OllamaService()
    vi_prompt = ollama_svc._build_system_prompt(lang_code="vi-VN")
    assert "DỮ LIỆU TRI THỨC CHÍNH THỨC TỪ KNOWLEDGE BASE" in vi_prompt
    assert "Room Service" in vi_prompt

    gemini_svc = GeminiService()
    en_prompt = gemini_svc._build_system_prompt(lang_code="en-US")
    assert "AUTHORITATIVE HOTEL KNOWLEDGE BASE" in en_prompt
    assert "In-Room Dining" in en_prompt


@pytest.mark.asyncio
async def test_graph_uses_explicit_kb_rag_context_without_fastpath_override():
    initial_state = {
        "session_id": "test_kb_facility_intro",
        "prompt": "Hãy giới thiệu ngắn gọn về Hồ Bơi Vô Cực",
        "rag_context": "Hồ Bơi Vô Cực (Tầng 5)\n- Giờ hoạt động: 06:00 - 22:00",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_kb_facility_intro"}}

    with patch("app.services.ai.ollama_service.ollama_service.generate_response", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = ("Dạ Hồ Bơi Vô Cực ở tầng 5 mở cửa từ 6 giờ sáng đến 22 giờ tối ạ.", "Tiếng Việt", "vi-VN")
        res = await concierge_graph.ainvoke(initial_state, config=config)

        assert res["fast_path_hit"] is False
        mock_gen.assert_awaited_once()
        passed_kwargs = mock_gen.call_args.kwargs
        assert "06:00 - 22:00" in (passed_kwargs.get("rag_context") or "")

