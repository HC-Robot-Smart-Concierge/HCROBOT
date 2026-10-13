import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.services.ai.scenario_service import scenario_service
from app.services.ai.concierge_graph import concierge_graph


@pytest.mark.asyncio
async def test_scenario_service_in_memory_matching():
    """Kiem tra logic doi soat In-Memory RAM Cache cua ScenarioService (< 0.1ms)."""
    # 1. Kiem tra kich ban mac dinh: Wifi
    hit = scenario_service.match_fast_path("cho tôi xin mật khẩu wifi", "vi-VN")
    assert hit is not None
    reply, lang_name, lang_code, act, payload = hit
    assert "aurora2026" in reply
    assert lang_code == "vi-VN"

    # 2. Kiem tra tieng Anh
    hit_en = scenario_service.match_fast_path("where is the breakfast buffet?", "en-US")
    assert hit_en is not None
    reply_en, lang_name_en, lang_code_en, act_en, payload_en = hit_en
    assert "Level 2" in reply_en or "breakfast" in reply_en.lower()
    assert lang_code_en == "en-US"
    assert act_en == "show_map"
    assert payload_en == {"destination_key": "restaurant"}

    # 3. Kiem tra Video Call
    hit_vc = scenario_service.match_fast_path("tôi muốn gặp nhân viên", "vi-VN")
    assert hit_vc is not None
    assert hit_vc[3] == "trigger_video_call"


@pytest.mark.asyncio
async def test_scenarios_crud_api_and_cache_sync():
    """Kiem tra toan bo luong CRUD API /api/v1/ai/scenarios va co che tu dong reload cache."""
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. GET danh sach kich ban
        res_list = await ac.get("/api/v1/ai/scenarios")
        assert res_list.status_code == 200
        data_list = res_list.json()
        assert data_list["total"] >= 1
        initial_count = data_list["total"]

        # 2. POST tao kich ban moi
        new_payload = {
            "title": "Quầy đổi ngoại tệ",
            "category": "facility",
            "match_keywords": ["đổi tiền", "ngoại tệ", "đổi đô", "currency exchange"],
            "match_type": "keyword",
            "response_vi": "Dạ quầy đổi ngoại tệ nằm ngay cạnh Quầy Lễ tân tại Tầng 1, phục vụ 24/7 ạ.",
            "response_en": "Currency exchange desk is right next to the Front Desk on Level 1, open 24/7.",
            "action_type": "none",
            "action_payload": None,
            "is_fast_path": True,
            "is_active": True,
            "priority": 120,
        }
        res_create = await ac.post("/api/v1/ai/scenarios", json=new_payload)
        assert res_create.status_code == 201
        created_item = res_create.json()
        scenario_id = created_item["id"]
        assert created_item["title"] == "Quầy đổi ngoại tệ"

        # Kiem tra RAM cache da cap nhat tuc thi (<1ms) ma khong can restart server!
        instant_hit = scenario_service.match_fast_path("tôi muốn đổi ngoại tệ ở đâu", "vi-VN")
        assert instant_hit is not None
        assert "Tầng 1" in instant_hit[0]

        # 3. PUT cap nhat kich ban
        update_payload = {
            "response_vi": "Dạ quầy đổi ngoại tệ đã dời sang sảnh A Tầng 1 ạ."
        }
        res_update = await ac.put(f"/api/v1/ai/scenarios/{scenario_id}", json=update_payload)
        assert res_update.status_code == 200
        assert "sảnh A" in res_update.json()["response_vi"]

        # Kiem tra RAM cache nhan gia tri moi ngay lap tuc
        updated_hit = scenario_service.match_fast_path("chỗ đổi tiền", "vi-VN")
        assert updated_hit is not None
        assert "sảnh A" in updated_hit[0]

        # 4. DELETE xoa kich ban
        res_del = await ac.delete(f"/api/v1/ai/scenarios/{scenario_id}")
        assert res_del.status_code == 200

        # Kiem tra sau khi xoa thi Fast-Path khong con khop kich ban do nua
        after_del_hit = scenario_service.match_fast_path("đổi ngoại tệ", "vi-VN")
        assert after_del_hit is None


@pytest.mark.asyncio
async def test_dynamic_fast_path_harness_integration():
    """Kiem tra su tich hop giua LangGraph Harness va Dynamic Scenarios Cache."""
    initial_state = {
        "session_id": "test_dynamic_harness",
        "prompt": "Mật khẩu wifi khách sạn là gì?",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_dynamic_harness"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    assert result["fast_path_hit"] is True
    assert len(result["response"]) > 0
    assert result["intent_category"] == "fast_path"
