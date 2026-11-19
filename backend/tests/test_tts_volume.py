import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.ai import ChatRequest
from app.services.ai.ai_chat_service import process_chat_request
from app.services.ai.tts_providers import synthesize_edge_tts_detailed
from app.services.ai.tts_service import TTSService, tts_service


def test_voice_settings_uses_safe_zero_volume_and_standard_voices():
    settings = tts_service.get_voice_settings()
    assert settings["volume"] == "+0%"
    assert settings["vi_voice"] == "vi-VN-HoaiMyNeural"
    assert settings["en_voice"] == "en-US-JennyNeural"


def test_update_voice_settings_keeps_safe_zero_volume_for_edge_tts():
    updated = tts_service.update_voice_settings(volume="+35%")
    assert updated["volume"] == "+0%"


def test_clean_text_preserves_clean_vietnamese():
    cleaned = tts_service.clean_text_for_tts("Dạ vâng, Rora rất vui được phục vụ quý khách ạ!")
    assert "Rora" in cleaned or "Ro-ra" in cleaned
    assert "*" not in cleaned
    assert "#" not in cleaned


@pytest.mark.asyncio
async def test_edge_tts_uses_zero_volume_and_retries_same_voice():
    """EdgeTTS must always use volume='+0%' and must NOT swap HoaiMyNeural <-> NamMinhNeural on retry."""
    calls = []

    class FakeCommunicate:
        def __init__(self, text, voice, rate="+0%", volume="+0%"):
            calls.append({"text": text, "voice": voice, "rate": rate, "volume": volume})

        async def stream(self):
            if len(calls) == 1:
                raise RuntimeError("transient network error")
            yield {"type": "audio", "data": b"x" * 200}

    fake_edge_tts = MagicMock()
    fake_edge_tts.Communicate = FakeCommunicate

    with patch.dict("sys.modules", {"edge_tts": fake_edge_tts}):
        b64, err_code, err_detail = await synthesize_edge_tts_detailed(
            "Xin chào quý khách!",
            "vi-VN-HoaiMyNeural",
            rate="+0%",
            default_volume="+35%",
        )

    assert err_code is None
    assert err_detail is None
    assert b64 == base64.b64encode(b"x" * 200).decode("utf-8")
    assert len(calls) == 2
    assert calls[0]["voice"] == "vi-VN-HoaiMyNeural"
    assert calls[1]["voice"] == "vi-VN-HoaiMyNeural"
    assert calls[0]["volume"] == "+0%"
    assert calls[1]["volume"] == "+0%"


@pytest.mark.asyncio
async def test_google_fallback_is_not_cached_under_edge_cache_key(tmp_path):
    """google_fallback audio must NEVER be stored under edge cache_key in memory or on disk."""
    svc = TTSService(load_persisted=False)
    svc._cache_dir = str(tmp_path)

    fake_google_b64 = base64.b64encode(b"google_mp3_bytes_" * 20).decode("utf-8")

    with (
        patch.object(
            svc,
            "_synthesize_edge_tts_detailed",
            new=AsyncMock(return_value=(None, "TTS_PROVIDER_ERROR", "edge failed")),
        ),
        patch.object(
            svc,
            "_synthesize_google_tts",
            new=AsyncMock(return_value=fake_google_b64),
        ),
    ):
        result = await svc.synthesize_with_details(
            "Chào mừng quý khách đến khách sạn.",
            provider="edge",
            language="vi-VN",
            allow_fallback=True,
        )

    assert result["provider_used"] == "google_fallback"
    assert result["audio_base64"] == fake_google_b64
    assert svc._memory_cache == {}
    assert list(tmp_path.glob("*.mp3")) == []


@pytest.mark.asyncio
async def test_redis_ai_cache_hit_auto_lang_prefers_cached_lang_code_or_reply():
    """With language='auto', Redis AI cache hit must prefer cached_ai['lang_code'] or detect from reply."""
    req = ChatRequest(prompt="wifi?", language="auto", session_id="test_auto_lang_cache_1")
    cached_payload = {
        "full_text": "Dạ, mật khẩu Wi-Fi của khách sạn là GrandHotel2026 ạ.",
        "lang_code": "vi-VN",
        "action": "conversation",
    }

    synth_mock = AsyncMock(return_value=("", "audio/mp3", "edge"))
    with (
        patch(
            "app.services.cache.redis_service.redis_service.get_ai_cache",
            new=AsyncMock(return_value=cached_payload),
        ),
        patch("app.services.ai.ai_chat_service.tts_service.synthesize", new=synth_mock),
    ):
        resp = await process_chat_request(None, req)

    assert resp.model_used == "redis_cloud_cache"
    assert resp.lang_code == "vi-VN"
    assert resp.detected_language == "Tiếng Việt"
    synth_mock.assert_awaited_once()
    assert synth_mock.await_args.kwargs["language"] == "vi-VN"

    # Case 2: cached_ai omits lang_code -> must detect from reply (Vietnamese), not prompt ("wifi?")
    req2 = ChatRequest(prompt="wifi?", language="auto", session_id="test_auto_lang_cache_2")
    cached_payload_no_lang = {
        "full_text": "Dạ, mật khẩu Wi-Fi của khách sạn là GrandHotel2026 ạ.",
        "action": "conversation",
    }
    synth_mock_2 = AsyncMock(return_value=("", "audio/mp3", "edge"))
    with (
        patch(
            "app.services.cache.redis_service.redis_service.get_ai_cache",
            new=AsyncMock(return_value=cached_payload_no_lang),
        ),
        patch("app.services.ai.ai_chat_service.tts_service.synthesize", new=synth_mock_2),
    ):
        resp2 = await process_chat_request(None, req2)

    assert resp2.model_used == "redis_cloud_cache"
    assert resp2.lang_code == "vi-VN"
    assert resp2.detected_language == "Tiếng Việt"
    synth_mock_2.assert_awaited_once()
    assert synth_mock_2.await_args.kwargs["language"] == "vi-VN"
