import pytest
from unittest.mock import AsyncMock, patch

from app.services.ai.piper_service import piper_service
from app.services.ai.tts_service import tts_service


@pytest.mark.asyncio
async def test_piper_service_availability():
    """Verify piper_service is available and models are present."""
    assert piper_service.is_available() is True


@pytest.mark.asyncio
async def test_piper_synthesize_vietnamese():
    """Verify local offline synthesis for Vietnamese."""
    text = "Xin chào quý khách, em là Robot Lễ Tân."
    b64 = await piper_service.synthesize(text, is_vi=True)
    assert b64 is not None
    assert len(b64) > 1000


@pytest.mark.asyncio
async def test_piper_synthesize_english():
    """Verify local offline synthesis for English."""
    text = "Welcome to Aurora Grand Hotel. How may I assist you?"
    b64 = await piper_service.synthesize(text, is_vi=False)
    assert b64 is not None
    assert len(b64) > 1000


@pytest.mark.asyncio
async def test_tts_service_with_piper_provider():
    """Verify tts_service executes with provider='piper' directly."""
    result = await tts_service.synthesize_with_details(
        text="Chúc quý khách một ngày tốt lành!",
        provider="piper",
        language="vi-VN",
    )
    assert result["error_code"] is None
    assert result["provider_used"] in ["piper", "piper_cached"]
    assert len(result["audio_base64"]) > 500


@pytest.mark.asyncio
async def test_tts_service_piper_offline_fallback():
    """Verify tts_service falls back to Piper offline when EdgeTTS and Google TTS fail (offline mode)."""
    with (
        patch.object(
            tts_service,
            "_synthesize_and_cache_edge_tts_detailed",
            new=AsyncMock(return_value=(None, "TTS_PROVIDER_ERROR", "Simulated Network Drop")),
        ),
        patch.object(
            tts_service,
            "_synthesize_google_tts",
            new=AsyncMock(return_value=None),
        ),
    ):
        result = await tts_service.synthesize_with_details(
            text="Hệ thống đang thử nghiệm dự phòng ngoại tuyến hoàn toàn.",
            provider="edge",
            language="vi-VN",
            allow_fallback=True,
        )
        assert result["error_code"] is None
        assert result["provider_used"] == "piper_offline_fallback"
        assert len(result["audio_base64"]) > 500
