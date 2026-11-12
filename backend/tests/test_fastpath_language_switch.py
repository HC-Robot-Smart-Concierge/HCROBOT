import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.ai.scenario_service import scenario_service
from app.services.ai.session_manager import session_manager


def test_fastpath_switch_to_english():
    """
    Kiem tra Fast-Path chuyen doi ngon ngu sang Tieng Anh:
    1. Khach noi tieng Viet: 'chuyen sang tieng anh', 'noi tieng anh di', 'doi qua tieng anh'.
    2. Khach noi tieng Anh: 'switch to english', 'speak english please'.
    3. Tra ve response tieng Anh, lang_name='English', lang_code='en-US', action_type='switch_language'.
    """
    vi_queries = [
        "chuyển sang tiếng anh",
        "nói tiếng anh đi",
        "đổi sang tiếng anh",
        "giao tiếp bằng tiếng anh nhé",
        "bạn có thể nói tiếng anh không",
    ]
    for q in vi_queries:
        hit = scenario_service.match_fast_path(q, lang_code="vi-VN")
        assert hit is not None, f"Query '{q}' phai khop fast-path switch to English"
        resp, lang_name, lang_code, action, payload = hit
        assert lang_name == "English"
        assert lang_code == "en-US"
        assert action == "switch_language"
        assert "English" in resp or "assist" in resp

    en_queries = [
        "switch to english",
        "speak english please",
        "can you speak english",
        "change language to english",
    ]
    for q in en_queries:
        hit = scenario_service.match_fast_path(q, lang_code="vi-VN")
        assert hit is not None, f"Query '{q}' phai khop fast-path switch to English"
        resp, lang_name, lang_code, action, payload = hit
        assert lang_name == "English"
        assert lang_code == "en-US"
        assert action == "switch_language"


def test_fastpath_switch_to_vietnamese():
    """
    Kiem tra Fast-Path chuyen doi ngon ngu sang Tieng Viet:
    1. Khach noi tieng Anh: 'switch to vietnamese', 'speak vietnamese please'.
    2. Khach noi tieng Viet: 'chuyen sang tieng viet', 'noi tieng viet di'.
    3. Tra ve response tieng Viet, lang_name='Tiếng Việt', lang_code='vi-VN', action_type='switch_language'.
    """
    queries = [
        ("switch to vietnamese", "en-US"),
        ("speak vietnamese please", "en-US"),
        ("can you speak vietnamese", "en-US"),
        ("nói tiếng việt đi", "en-US"),
        ("chuyển sang tiếng việt", "vi-VN"),
        ("đổi qua tiếng việt", "vi-VN"),
    ]
    for q, current_code in queries:
        hit = scenario_service.match_fast_path(q, lang_code=current_code)
        assert hit is not None, f"Query '{q}' phai khop fast-path switch to Vietnamese"
        resp, lang_name, lang_code, action, payload = hit
        assert lang_name == "Tiếng Việt"
        assert lang_code == "vi-VN"
        assert action == "switch_language"
        assert "Tiếng Việt" in resp or "Rora" in resp


def test_fastpath_toggle_language():
    """
    Kiem tra Fast-Path doi ngon ngu tong quat (Toggle Language):
    1. Khi dang o tieng Viet ma noi 'doi ngon ngu' -> Chuyen sang Tieng Anh.
    2. Khi dang o tieng Anh ma noi 'switch language' -> Chuyen sang Tieng Viet.
    """
    hit_vi = scenario_service.match_fast_path("đổi ngôn ngữ", lang_code="vi-VN")
    assert hit_vi is not None
    assert hit_vi[1] == "English"
    assert hit_vi[2] == "en-US"

    hit_en = scenario_service.match_fast_path("switch language", lang_code="en-US")
    assert hit_en is not None
    assert hit_en[1] == "Tiếng Việt"
    assert hit_en[2] == "vi-VN"


def test_session_manager_language_persistence():
    """
    Kiem tra luu tru ngon ngu trong Session Memory.
    """
    test_sid = "test_lang_session_01"
    assert session_manager.get_language(test_sid) is None

    session_manager.set_language(test_sid, "English")
    assert session_manager.get_language(test_sid) == "English"

    session_manager.set_language(test_sid, "Tiếng Việt")
    assert session_manager.get_language(test_sid) == "Tiếng Việt"

    session_manager.reset_session(test_sid)
    assert session_manager.get_language(test_sid) is None


@pytest.mark.asyncio
async def test_chat_api_language_switch_flow():
    """
    Kiem tra API /api/v1/ai/chat xu ly switch language tuc thi qua fast-path:
    1. Yeu cau 'nói tiếng anh đi' -> HTTP 200, detected_language='English', lang_code='en-US'.
    2. Yeu cau tiep theo 'nói tiếng việt đi' -> HTTP 200, detected_language='Tiếng Việt', lang_code='vi-VN'.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        sid = "test_api_lang_switch_sid"
        # 1. Chuyen sang Tieng Anh
        res_en = await ac.post("/api/v1/ai/chat", json={
            "session_id": sid,
            "prompt": "nói tiếng anh đi",
            "language": "auto",
        })
        assert res_en.status_code == 200
        data_en = res_en.json()
        assert data_en["detected_language"] == "English"
        assert data_en["lang_code"] == "en-US"
        assert data_en["action"] == "switch_language"
        assert "English" in data_en["response"]

        # 2. Chuyen lai Tieng Viet
        res_vi = await ac.post("/api/v1/ai/chat", json={
            "session_id": sid,
            "prompt": "chuyển sang tiếng việt",
            "language": "auto",
        })
        assert res_vi.status_code == 200
        data_vi = res_vi.json()
        assert data_vi["detected_language"] == "Tiếng Việt"
        assert data_vi["lang_code"] == "vi-VN"
        assert data_vi["action"] == "switch_language"
        assert "Tiếng Việt" in data_vi["response"]
