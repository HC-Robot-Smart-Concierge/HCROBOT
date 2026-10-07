import pytest
from unittest.mock import AsyncMock, patch
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
async def test_conversational_generator_harness():
    """Kiểm tra luồng hội thoại đi thẳng tới Generator, không qua RAG hay FSM slot-filling."""
    initial_state = {
        "session_id": "test_conv_session",
        "prompt": "Hôm nay tâm trạng của em thế nào rồi?",
        "language": "Tiếng Việt",
        "room_number": "402",
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": "test_conv_session"}}

    with patch("app.services.ai.ollama_service.ollama_service.generate_response", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = ("Dạ nhà hàng Aurora có buffet sáng và các món hải sản đặc sản rất ngon ạ.", "Tiếng Việt", "vi-VN")
        result = await concierge_graph.ainvoke(initial_state, config=config)

        assert result["fast_path_hit"] is False
        assert result["action"] == "conversation"
        assert result["missing_room_number"] is False
        assert "hải sản" in result["response"]
        assert result["lang_code"] == "vi-VN"
