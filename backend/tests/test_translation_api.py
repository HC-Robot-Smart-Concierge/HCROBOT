import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.ai.stt_service import _score_bilingual_candidates


@pytest.mark.asyncio
async def test_quick_translate_en_to_vi():
    """Scenario 2: Khách tại Robot nói tiếng Anh -> Staff nhận bản dịch tiếng Việt"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Where is the swimming pool?",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest",
                "with_audio": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_lang"] == "en"
        assert data["target_lang"] == "vi"
        assert data["needs_translation"] is True
        assert len(data["translated_text"]) > 0


@pytest.mark.asyncio
async def test_quick_translate_staff_vi_to_robot_en():
    """Scenario 1: Staff nói tiếng Việt -> Robot nhận phụ đề tiếng Anh"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Dạ bể bơi nằm ở tầng 3 thưa quý khách",
                "source_lang": "auto",
                "target_lang": "en",
                "sender_role": "staff",
                "with_audio": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_lang"] == "vi"
        assert data["target_lang"] == "en"
        assert data["needs_translation"] is True
        assert len(data["translated_text"]) > 0
        assert data["translated_text"].lower() != "dạ bể bơi nằm ở tầng 3 thưa quý khách"


@pytest.mark.asyncio
async def test_quick_translate_guest_interleaved_vi_between_en():
    """
    Scenario 3: Khách nói câu tiếng Việt xen giữa hai câu tiếng Anh ->
    Câu tiếng Việt giữ nguyên tiếng Việt ở Staff (needs_translation=False, không dịch vòng),
    câu tiếng Anh kế tiếp vẫn dịch sang tiếng Việt bình thường.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Câu 1: Tiếng Anh
        r1 = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Excuse me, could you help me with my room key?",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest",
                "with_audio": False,
            },
        )
        d1 = r1.json()
        assert d1["source_lang"] == "en"
        assert d1["needs_translation"] is True

        # Câu 2: Tiếng Việt xen giữa
        r2 = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Xin chào tôi muốn hỏi thêm về giờ ăn sáng",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest",
                "with_audio": False,
            },
        )
        d2 = r2.json()
        assert d2["source_lang"] == "vi"
        assert d2["target_lang"] == "vi"
        assert d2["needs_translation"] is False
        assert d2["translated_text"] == "Xin chào tôi muốn hỏi thêm về giờ ăn sáng"

        # Câu 3: Tiếng Anh tiếp theo vẫn dịch bình thường
        r3 = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Also, please send two towels to room 302.",
                "source_lang": "auto",
                "target_lang": "vi",
                "sender_role": "guest",
                "with_audio": False,
            },
        )
        d3 = r3.json()
        assert d3["source_lang"] == "en"
        assert d3["needs_translation"] is True


@pytest.mark.asyncio
async def test_quick_translate_staff_speaks_english_when_guest_target_is_english():
    """
    Scenario 4: Staff nói tiếng Anh khi khách đang nhận tiếng Anh (target_lang='en') ->
    Giữ nguyên tiếng Anh, needs_translation=False, không gọi TTS thừa.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/translate",
            json={
                "text": "Please wait a moment, I will check your reservation right now.",
                "source_lang": "auto",
                "target_lang": "en",
                "sender_role": "staff",
                "with_audio": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source_lang"] == "en"
        assert data["target_lang"] == "en"
        assert data["needs_translation"] is False
        assert data["translated_text"] == "Please wait a moment, I will check your reservation right now."
        assert data["audio_base64"] is None


def test_bilingual_stt_candidate_scoring():
    """
    Kiểm tra thuật toán chấm điểm ứng viên âm thanh song ngữ (vi-VN vs en-US):
    - Khi khách nói tiếng Anh nhưng model vi-VN sinh ra từ ASCII rác không dấu ('Turn on Messenger'),
      model en-US thắng nhờ độ tự tin âm học + từ vựng tiếng Anh + độ phủ âm tiết.
    - Khi khách nói tiếng Việt có dấu ('Cho tôi hỏi nhà hàng ở đâu'), model vi-VN thắng.
    """
    text_en, lang_en, conf_en = _score_bilingual_candidates(
        vi_text="Turn on Messenger",
        vi_conf=0.61,
        en_text="Excuse me where is the hotel restaurant",
        en_conf=0.93,
        preferred_lang="en",
    )
    assert lang_en == "en"
    assert text_en == "Excuse me where is the hotel restaurant"
    assert conf_en >= 0.9

    text_vi, lang_vi, conf_vi = _score_bilingual_candidates(
        vi_text="Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ",
        vi_conf=0.95,
        en_text="jaw toy hoy nha hang",
        en_conf=0.64,
        preferred_lang="en",
    )
    assert lang_vi == "vi"
    assert text_vi == "Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ"
    assert conf_vi >= 0.9
