import pytest
from app.services.ai.ollama_service import ollama_service
from app.services.ai.concierge_graph import concierge_graph


@pytest.mark.asyncio
async def test_detect_language_vietnamese_and_english():
    # 1. Phát hiện tiếng Việt
    vi_text = "Tôi muốn gọi cho nhân viên lễ tân hỗ trợ"
    lang_name, lang_code = ollama_service.detect_language(vi_text)
    assert lang_code == "vi-VN"

    # 2. Phát hiện tiếng Anh
    en_text = "Please connect me to human staff for assistance"
    lang_name, lang_code = ollama_service.detect_language(en_text)
    assert lang_code == "en-US"


@pytest.mark.asyncio
async def test_concierge_intent_routing_triggers_call():
    config = {"configurable": {"thread_id": "thread_call_vi"}}
    # Test câu thoại tiếng Việt: 'gọi cho nhân viên'
    state_vi = {
        "session_id": "test_call_session",
        "prompt": "Rora ơi gọi cho nhân viên giúp tôi với",
        "language": "auto",
        "room_number": "402",
        "chat_history": [],
        "rag_context": "",
    }
    result_vi = await concierge_graph.ainvoke(state_vi, config=config)
    assert result_vi.get("action") == "concierge"
    assert result_vi.get("trigger_video_call") is True
    assert "nhân viên" in result_vi.get("response").lower()

    # Test câu thoại tiếng Anh: 'call staff'
    config_en = {"configurable": {"thread_id": "thread_call_en"}}
    state_en = {
        "session_id": "test_call_session_en",
        "prompt": "Hey Rora please call staff right now",
        "language": "auto",
        "room_number": None,
        "chat_history": [],
        "rag_context": "",
    }
    result_en = await concierge_graph.ainvoke(state_en, config=config_en)
    assert result_en.get("action") == "concierge"
    assert result_en.get("trigger_video_call") is True
    assert "connecting" in result_en.get("response").lower() or "concierge" in result_en.get("response").lower()


@pytest.mark.asyncio
async def test_other_services_not_affected():
    config_hk = {"configurable": {"thread_id": "thread_hk"}}
    # Kiểm tra đảm bảo các dịch vụ khác (housekeeping, taxi) KHÔNG bị ảnh hưởng
    state_hk = {
        "session_id": "test_hk",
        "prompt": "Cho tôi xin thêm 2 cái khăn tắm",
        "language": "auto",
        "room_number": "301",
        "chat_history": [],
        "rag_context": "",
    }
    result_hk = await concierge_graph.ainvoke(state_hk, config=config_hk)
    assert result_hk.get("action") == "housekeeping"
    assert result_hk.get("trigger_video_call") is not True
