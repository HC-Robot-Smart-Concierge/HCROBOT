import pytest
import asyncio
from app.services.ai.concierge_graph import concierge_graph


@pytest.mark.asyncio
async def test_fast_path_harness():
    """Kiểm tra phản hồi tức thì (< 1ms) qua Fast-Path Node của Harness."""
    initial_state = {
        "session_id": "test_fast_session",
        "prompt": "Mật khẩu wifi là gì?",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_fast_session"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    assert result["fast_path_hit"] is True
    assert "aurora2026" in result["response"].lower()
    assert result["intent_category"] == "fast_path"


@pytest.mark.asyncio
async def test_service_fsm_missing_room():
    """Kiểm tra FSM Slot-Filling khi thiếu số phòng."""
    initial_state = {
        "session_id": "test_service_session_1",
        "prompt": "Cho tôi 2 cái khăn tắm",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_service_session_1"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    assert result["intent_category"] == "service"
    assert result["missing_room_number"] is True
    assert "xin số phòng" in result["response"].lower()


@pytest.mark.asyncio
async def test_service_fsm_with_room():
    """Kiểm tra FSM Slot-Filling khi đã có số phòng sẵn."""
    initial_state = {
        "session_id": "test_service_session_2",
        "prompt": "Tôi ở phòng 402 mang cho tôi nước suối",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_service_session_2"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    assert result["intent_category"] == "service"
    assert result["room_number"] == "402"
    assert result["missing_room_number"] is False
    assert "402" in result["response"]


@pytest.mark.asyncio
async def test_facilities_routed_to_rag_not_fastpath():
    """Kiểm tra câu hỏi tiện ích (Hồ bơi) không bị Fast-Path chặn mà đi qua FAQ Retrieval (ChromaDB RAG)."""
    initial_state = {
        "session_id": "test_facility_session",
        "prompt": "Hồ bơi của khách sạn ở tầng mấy và mở cửa mấy giờ?",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_facility_session"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    # Đảm bảo không bị Fast-Path chặn
    assert result["fast_path_hit"] is False
    assert result["intent_category"] == "faq"
    # Đảm bảo Node 3 đã tìm kiếm được context từ Obsidian ChromaDB
    assert result.get("rag_context") is not None
    assert len(result["rag_context"]) > 0
    assert "hồ bơi" in result["rag_context"].lower() or "pool" in result["rag_context"].lower()


@pytest.mark.asyncio
async def test_room_location_rag_retrieval():
    """Kiểm tra câu hỏi vị trí phòng (Phòng 406) được RAG Obsidian bóc tách đúng context."""
    initial_state = {
        "session_id": "test_room_location_session",
        "prompt": "Cho tôi hỏi phòng 406 ở đâu và tầng mấy?",
        "language": "Tiếng Việt",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_room_location_session"}}
    result = await concierge_graph.ainvoke(initial_state, config=config)

    assert result["fast_path_hit"] is False
    assert result["intent_category"] == "faq"
    assert result.get("rag_context") is not None
    assert "406" in result["rag_context"]
    assert "tầng 4" in result["rag_context"].lower()


@pytest.mark.asyncio
async def test_restroom_vs_housekeeping_classification():
    """Kiểm tra phân biệt chính xác giữa nhu cầu đi vệ sinh (FAQ/RAG) và dọn vệ sinh buồng phòng (Housekeeping)."""
    from app.services.ai.concierge_graph import intent_router_node

    # 1. Nhu cầu đi vệ sinh -> Phải là FAQ (không hỏi số phòng)
    state_wc_1 = {"prompt": "tôi cần đi vệ sinh", "room_number": None}
    res_wc_1 = await intent_router_node(state_wc_1)
    assert res_wc_1["intent_category"] == "faq"
    assert res_wc_1["action"] == "faq"

    state_wc_2 = {"prompt": "nhà vệ sinh ở đâu vậy em?", "room_number": None}
    res_wc_2 = await intent_router_node(state_wc_2)
    assert res_wc_2["intent_category"] == "faq"
    assert res_wc_2["action"] == "faq"

    state_wc_3 = {"prompt": "where is the restroom?", "room_number": None}
    res_wc_3 = await intent_router_node(state_wc_3)
    assert res_wc_3["intent_category"] == "faq"
    assert res_wc_3["action"] == "faq"

    # 2. Yêu cầu dọn dẹp vệ sinh phòng -> Phải là Housekeeping Service
    state_hk_1 = {"prompt": "dọn vệ sinh phòng giúp tôi", "room_number": None}
    res_hk_1 = await intent_router_node(state_hk_1)
    assert res_hk_1["intent_category"] == "service"
    assert res_hk_1["action"] == "housekeeping"

    state_hk_2 = {"prompt": "vệ sinh phòng 201 nhé", "room_number": None}
    res_hk_2 = await intent_router_node(state_hk_2)
    assert res_hk_2["intent_category"] == "service"
    assert res_hk_2["action"] == "housekeeping"
    assert res_hk_2["room_number"] == "201"



