import pytest
from app.services.ai.tts_service import tts_service


@pytest.mark.asyncio
async def test_filler_speech_cache_keys():
    """Kiểm tra cache keys của 2 câu đệm song ngữ (VI & EN) được khởi tạo nhất quán."""
    vi_phrase = "Dạ đợi em một tí nhé ạ."
    en_phrase = "Please wait a moment."

    vi_key = tts_service._get_cache_key(vi_phrase, "edge", "vi-VN-HoaiMyNeural", "+0%")
    en_key = tts_service._get_cache_key(en_phrase, "edge", "en-US-JennyNeural", "+0%")

    assert vi_key is not None and len(vi_key) == 32
    assert en_key is not None and len(en_key) == 32
    assert vi_key != en_key


def test_filler_speech_clean_text():
    """Kiểm tra làm sạch chuỗi câu đệm trước khi đưa vào TTS."""
    vi_raw = "**Dạ đợi em một tí nhé ạ.**"
    en_raw = "Please wait a moment..."

    assert tts_service.clean_text_for_tts(vi_raw) == "Dạ đợi em một tí nhé ạ."
    assert tts_service.clean_text_for_tts(en_raw) == "Please wait a moment."
