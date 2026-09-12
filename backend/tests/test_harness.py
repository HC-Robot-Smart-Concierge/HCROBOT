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
