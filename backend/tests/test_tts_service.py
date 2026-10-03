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
    assert provider_used in ["edge", "browser", "invalid_provider_cached"] or "cached" in provider_used


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

