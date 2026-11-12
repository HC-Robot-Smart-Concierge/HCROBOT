import pytest
from app.services.ai.scenario_service import scenario_service
from app.services.rag.chroma import query_rag_context
from app.services.ai.concierge_graph import service_fsm_node, ConciergeState


@pytest.mark.asyncio
async def test_maintenance_scenario_fastpath_matching():
    # 1. Triggers maintenance menu screen
    res_menu = scenario_service.match_fast_path("mở menu bảo trì", lang_code="vi-VN")
    assert res_menu is not None
    assert res_menu[3] == "open_maintenance_menu"

    res_report = scenario_service.match_fast_path("báo hỏng", lang_code="vi-VN")
    assert res_report is not None
    assert res_report[3] == "open_maintenance_menu"

    # User issue queries: "phòng tôi bị hư", "phong toi bi hu"
    res_hu = scenario_service.match_fast_path("phòng tôi bị hư", lang_code="vi-VN")
    assert res_hu is not None
    assert res_hu[3] == "open_maintenance_menu"
    assert res_hu[4].get("trigger_menu") == "maintenance"

    res_hu_room = scenario_service.match_fast_path("phòng 301 bị hư", lang_code="vi-VN")
    assert res_hu_room is not None
    assert res_hu_room[3] == "open_maintenance_menu"
    assert res_hu_room[4].get("trigger_menu") == "maintenance"
    assert res_hu_room[4].get("target_room_number") == "301"

    # 2. English fastpath matching
    res_en = scenario_service.match_fast_path("open maintenance menu", lang_code="en-US")
    assert res_en is not None
    assert res_en[3] == "open_maintenance_menu"


@pytest.mark.asyncio
async def test_maintenance_status_inquiry_bypasses_fastpath():
    # Maintenance status checks must NOT be intercepted by the menu opener
    inquiries = [
        "sửa điều hòa tới đâu rồi",
        "kiểm tra tiến độ sửa chữa phòng 402",
        "bảo trì phòng 301 tới đâu rồi",
        "sửa bóng đèn xong chưa",
        "how is the repair progress for room 402",
    ]
    for q in inquiries:
        res = scenario_service.match_fast_path(q, lang_code="vi-VN")
        # Should be None so that LangGraph concierge_graph can process the database lookup
        assert res is None or res[3] != "open_maintenance_menu", f"Query '{q}' should bypass fastpath menu opener"


@pytest.mark.asyncio
async def test_maintenance_rag_retrieval():
    # Verify RAG returns maintenance policy and response time
    ctx = await query_rag_context("khách sạn có dịch vụ sửa chữa điều hòa không?")
    assert ctx is not None
    assert len(ctx) > 0
    # Must retrieve maintenance section
    assert any(k in ctx.lower() for k in ["kỹ thuật", "bảo trì", "sửa chữa", "maintenance"])


@pytest.mark.asyncio
async def test_maintenance_graph_missing_room():
    state: ConciergeState = {
        "current_query": "sửa điều hòa tới đâu rồi",
        "session_id": "test_mnt_sess_1",
        "language_code": "vi-VN",
        "action": "query_order_status",
        "room_number": None,
        "is_authenticated": False,
        "chat_history": [],
        "context": {},
        "rag_context": "",
    }
    result = await service_fsm_node(state)
    assert result.get("missing_room_number") is True
    assert "phòng bao nhiêu" in result.get("response", "").lower()
    assert any(k in result.get("response", "").lower() for k in ["sửa chữa", "bảo trì"])

