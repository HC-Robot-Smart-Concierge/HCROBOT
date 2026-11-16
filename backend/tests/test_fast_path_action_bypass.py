import pytest
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.concierge_graph import fast_path_node, intent_router_node
from app.services.ai.session_manager import session_manager

@pytest.mark.asyncio
async def test_cho_toi_khan_tam_bypasses_static_fast_path():
    """Kiểm tra câu 'cho tôi khăn tắm' không bị kịch bản FAQ tĩnh nuốt mất."""
    prompt = "cho tôi khăn tắm"
    
    # 1. match_fast_path trực tiếp từ scenario_service
    match_result = scenario_service.match_fast_path(prompt, "vi-VN")
    assert match_result is None, f"Expected None but got: {match_result}"

    # 2. fast_path_node trong ConciergeGraph
    sid = "test_fp_towel_bypass"
    session_manager.reset_session(sid)
    fp_res = await fast_path_node({
        "prompt": prompt,
        "language": "Tiếng Việt",
        "session_id": sid,
        "room_number": None,
    })
    assert fp_res.get("fast_path_hit") is False, "fast_path_hit should be False for towel request"

    # 3. intent_router_node nhận diện đúng category service
    router_res = await intent_router_node({
        "prompt": prompt,
        "session_id": sid,
        "room_number": None,
    })
    assert router_res.get("intent_category") == "service"
    assert router_res.get("action") == "housekeeping"

@pytest.mark.asyncio
async def test_hoi_thong_tin_khan_tam_still_matches_faq():
    """Kiểm tra câu hỏi thông tin 'có khăn tắm không' vẫn được giải đáp qua fast path."""
    prompt = "có khăn tắm không"
    match_result = scenario_service.match_fast_path(prompt, "vi-VN")
    assert match_result is not None
    assert "khăn tắm" in match_result[0].lower()

