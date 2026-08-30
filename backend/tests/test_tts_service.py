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
    assert mime == "audio/mp3"
    assert provider_used in ["edge", "browser"]
