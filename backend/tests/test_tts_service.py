import asyncio
import pytest
from app.services.ai.tts_service import TTSService, tts_service


@pytest.mark.asyncio
async def test_tts_service_vietnamese_detection():
    """Unit test kiểm tra hàm nhận diện Tiếng Việt cho TTS"""
    assert TTSService.is_vietnamese("Dạ em chào anh") is True
    assert TTSService.is_vietnamese("Phòng 302 cần dọn dẹp") is True
    assert TTSService.is_vietnamese("Hello, how can I help you?") is False


@pytest.mark.asyncio
async def test_tts_service_fallback_execution():
    """Unit test kiểm tra luồng tổng hợp giọng thoại và fallback thành công"""
    audio_b64, mime, provider_used = await tts_service.synthesize(
        text="Xin chào quý khách",
        provider="invalid_provider",
        language="vi-VN"
    )
    assert provider_used in ["edge", "browser", "google_fallback", "invalid_provider_cached"] or "cached" in provider_used


@pytest.mark.asyncio
async def test_tts_service_voice_selection_by_language():
    """Unit test kiểm tra phân giải giọng đọc chuẩn xác theo language code"""
    service = TTSService()
    
    # Text tiếng Anh có thể vô tình chứa từ tiếng Việt ("Aurora Hotel")
    en_key = service._get_cache_key("Welcome to Aurora Hotel", "edge", service.default_en_voice)
    vi_key = service._get_cache_key("Dạ em chào quý khách", "edge", service.default_vi_voice)

    assert service.default_en_voice == "en-US-JennyNeural"
    assert service.default_vi_voice == "vi-VN-HoaiMyNeural"
    assert en_key != vi_key


@pytest.mark.asyncio
async def test_tts_service_rate_cache_differentiation():
    """Unit test kiểm tra phân biệt cache key theo tốc độ đọc"""
    service = TTSService()
    key_normal = service._get_cache_key("Xin chào", "edge", service.default_vi_voice, "+0%")
    key_slower = service._get_cache_key("Xin chào", "edge", service.default_vi_voice, "-10%")
    key_faster = service._get_cache_key("Xin chào", "edge", service.default_vi_voice, "+15%")

    assert key_normal != key_slower
    assert key_normal != key_faster
    assert key_slower != key_faster


@pytest.mark.asyncio
async def test_tts_service_voice_settings_management():
    """Unit test kiểm tra hàm quản lý cấu hình tốc độ giọng nói cho Admin"""
    service = TTSService()
    assert TTSService.rate_float_to_percentage(1.0) == "+0%"
    assert TTSService.rate_float_to_percentage(0.85) == "-15%"
    assert TTSService.rate_float_to_percentage(1.15) == "+15%"
    assert TTSService.rate_float_to_percentage(0.2) == "-50%"  # clamped to 0.5
    assert TTSService.rate_float_to_percentage(3.0) == "+100%" # clamped to 2.0

    updated = service.update_voice_settings(speech_rate=0.85, vi_voice="vi-VN-NamMinhNeural")
    assert updated["speech_rate"] == 0.85
    assert updated["rate_percentage"] == "-15%"
    assert updated["vi_voice"] == "vi-VN-NamMinhNeural"

    fetched = service.get_voice_settings()
    assert fetched["speech_rate"] == 0.85
    assert fetched["rate_percentage"] == "-15%"
    assert fetched["vi_voice"] == "vi-VN-NamMinhNeural"


@pytest.mark.asyncio
async def test_tts_service_structured_error_codes(monkeypatch):
    """
    Scenario 6: Kiểm tra phân loại mã lỗi TTS chuẩn hóa:
    - TTS_INPUT_EMPTY
    - TTS_TIMEOUT
    - TTS_PROVIDER_ERROR
    - TTS_AUDIO_EMPTY
    """
    service = TTSService()
    service._get_from_cache = lambda k: None

    # 1. TTS_INPUT_EMPTY
    res_empty = await service.synthesize_with_details("   ***   ", allow_fallback=False)
    assert res_empty["audio_base64"] == ""
    assert res_empty["error_code"] == "TTS_INPUT_EMPTY"

    # 2. TTS_TIMEOUT
    async def _slow_task(*args, **kwargs):
        await asyncio.sleep(0.5)
        return None, "TTS_TIMEOUT", "Slow"

    monkeypatch.setattr(service, "_synthesize_and_cache_edge_tts_detailed", _slow_task)
    res_timeout = await service.synthesize_with_details(
        "Câu thử nghiệm quá thời gian chờ",
        language="vi-VN",
        timeout=0.05,
        allow_fallback=False,
    )
    assert res_timeout["audio_base64"] == ""
    assert res_timeout["error_code"] == "TTS_TIMEOUT"

    # 3. TTS_PROVIDER_ERROR
    async def _err_task(*args, **kwargs):
        return None, "TTS_PROVIDER_ERROR", "NoAudioReceived: WebSocket closed"

    monkeypatch.setattr(service, "_synthesize_and_cache_edge_tts_detailed", _err_task)
    res_prov = await service.synthesize_with_details(
        "Câu thử nghiệm lỗi provider",
        language="en-US",
        allow_fallback=False,
    )
    assert res_prov["audio_base64"] == ""
    assert res_prov["error_code"] == "TTS_PROVIDER_ERROR"
    assert "NoAudioReceived" in res_prov["error_detail"]

    # 4. TTS_AUDIO_EMPTY
    async def _empty_audio_task(*args, **kwargs):
        return None, "TTS_AUDIO_EMPTY", "0 bytes returned"

    monkeypatch.setattr(service, "_synthesize_and_cache_edge_tts_detailed", _empty_audio_task)
    res_audio_empty = await service.synthesize_with_details(
        "Câu thử nghiệm không có dữ liệu âm thanh",
        language="en-US",
        allow_fallback=False,
    )
    assert res_audio_empty["audio_base64"] == ""
    assert res_audio_empty["error_code"] == "TTS_AUDIO_EMPTY"
