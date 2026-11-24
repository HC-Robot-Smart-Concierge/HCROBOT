import asyncio
import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.ai import ChatRequest
from app.services.ai.ai_chat_service import process_chat_request
from app.services.ai.tts_providers import synthesize_azure_speech_detailed, synthesize_edge_tts_detailed
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
async def test_failed_tts_is_not_cached(tmp_path):
    """Failed TTS must NEVER be stored in memory or on disk."""
    svc = TTSService(load_persisted=False)
    svc._cache_dir = str(tmp_path)

    with patch.object(
        svc,
        "_synthesize_edge_tts_detailed",
        new=AsyncMock(return_value=(None, "TTS_PROVIDER_ERROR", "edge failed")),
    ):
        result = await svc.synthesize_with_details(
            "Chào mừng quý khách đến khách sạn.",
            provider="edge",
            language="vi-VN",
        )

    assert result["audio_base64"] == ""
    assert result["error_code"] == "TTS_PROVIDER_ERROR"
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

    synth_mock = AsyncMock(return_value={"audio_base64": "", "mime_type": "audio/mp3", "provider_used": "edge"})
    with (
        patch(
            "app.services.cache.redis_service.redis_service.get_ai_cache",
            new=AsyncMock(return_value=cached_payload),
        ),
        patch("app.services.ai.ai_chat_service.tts_service.synthesize_with_details", new=synth_mock),
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
    synth_mock_2 = AsyncMock(return_value={"audio_base64": "", "mime_type": "audio/mp3", "provider_used": "edge"})
    with (
        patch(
            "app.services.cache.redis_service.redis_service.get_ai_cache",
            new=AsyncMock(return_value=cached_payload_no_lang),
        ),
        patch("app.services.ai.ai_chat_service.tts_service.synthesize_with_details", new=synth_mock_2),
    ):
        resp2 = await process_chat_request(None, req2)

    assert resp2.model_used == "redis_cloud_cache"
    assert resp2.lang_code == "vi-VN"
    assert resp2.detected_language == "Tiếng Việt"
    synth_mock_2.assert_awaited_once()
    assert synth_mock_2.await_args.kwargs["language"] == "vi-VN"


@pytest.mark.asyncio
async def test_edge_tts_attempt_timeout_bounds_stalled_stream():
    """Per-attempt timeout must bound a stalled EdgeTTS stream without leaving callers hung."""
    class StalledCommunicate:
        def __init__(self, text, voice, rate="+0%", volume="+0%"):
            pass

        async def stream(self):
            await asyncio.Event().wait()
            yield {"type": "audio", "data": b"never"}

    fake_edge_tts = MagicMock()
    fake_edge_tts.Communicate = StalledCommunicate

    with patch.dict("sys.modules", {"edge_tts": fake_edge_tts}):
        b64, err_code, err_detail = await synthesize_edge_tts_detailed(
            "Dạ vâng ạ.",
            "vi-VN-HoaiMyNeural",
            attempt_timeout=0.05,
        )

    assert b64 is None
    assert err_code == "TTS_TIMEOUT"
    assert "attempt 2 timed out" in err_detail


@pytest.mark.asyncio
async def test_synthesize_with_details_cancels_orphaned_edge_task_on_timeout(tmp_path):
    """When wait_for times out and no other caller waits, inflight EdgeTTS task must be cancelled."""
    svc = TTSService(load_persisted=False)
    svc._cache_dir = str(tmp_path)
    cancelled_flag = False

    async def slow_edge(*args, **kwargs):
        nonlocal cancelled_flag
        try:
            await asyncio.sleep(2.0)
            return base64.b64encode(b"late" * 50).decode("utf-8"), None, None
        except asyncio.CancelledError:
            cancelled_flag = True
            raise

    with patch.object(svc, "_synthesize_edge_tts_detailed", new=slow_edge):
        res = await svc.synthesize_with_details(
            "Xin chào quý khách.",
            provider="edge",
            language="vi-VN",
            timeout=0.05,
            allow_fallback=False,
        )
        await asyncio.sleep(0.02)

    assert res["error_code"] == "TTS_TIMEOUT"
    assert cancelled_flag is True
    assert svc._inflight_tasks == {}


@pytest.mark.asyncio
async def test_azure_speech_detailed_not_configured():
    with patch("app.services.ai.tts_providers.settings.AZURE_SPEECH_KEY", None):
        b64, err_code, err_detail = await synthesize_azure_speech_detailed(
            "Xin chào", "vi-VN-HoaiMyNeural", api_key=None
        )
    assert b64 is None
    assert err_code == "AZURE_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_azure_speech_detailed_success():
    fake_audio = b"fake_azure_audio_bytes_1234567890" * 10
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = fake_audio

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, headers=None, content=None):
            assert "southeastasia.tts.speech.microsoft.com" in url
            assert headers["Ocp-Apim-Subscription-Key"] == "test_azure_key"
            assert "vi-VN-HoaiMyNeural" in content.decode("utf-8")
            return mock_resp

    with patch("httpx.AsyncClient", FakeAsyncClient):
        b64, err_code, err_detail = await synthesize_azure_speech_detailed(
            "Dạ vâng, em chào quý khách!",
            "vi-VN-HoaiMyNeural",
            api_key="test_azure_key",
            region="southeastasia",
        )

    assert err_code is None
    assert err_detail is None
    assert b64 == base64.b64encode(fake_audio).decode("utf-8")


@pytest.mark.asyncio
async def test_multi_endpoint_falls_back_to_azure_when_edge_slow(tmp_path):
    svc = TTSService(load_persisted=False)
    svc._cache_dir = str(tmp_path)

    async def hanging_edge(*args, **kwargs):
        await asyncio.sleep(5.0)
        return None, "TTS_TIMEOUT", "Edge timed out"

    fake_azure_audio = base64.b64encode(b"azure_singapore_hoaimy_fast" * 10).decode("utf-8")
    mock_azure = AsyncMock(return_value=(fake_azure_audio, None, None))

    with (
        patch("app.services.ai.tts_service.settings.AZURE_SPEECH_KEY", "valid_azure_key"),
        patch.object(svc, "_synthesize_edge_tts_detailed", new=hanging_edge),
        patch.object(svc, "_synthesize_azure_speech_detailed", new=mock_azure),
    ):
        res = await svc.synthesize_with_details(
            "Xung quanh đây có gì chơi không?",
            language="vi-VN",
            timeout=10.0,
        )

    assert res["audio_base64"] == fake_azure_audio
    assert res["provider_used"] == "azure_speech"
    assert res["voice"] == "vi-VN-HoaiMyNeural"
    mock_azure.assert_awaited_once()


@pytest.mark.asyncio
async def test_multi_endpoint_falls_back_to_azure_when_edge_fails_early(tmp_path):
    svc = TTSService(load_persisted=False)
    svc._cache_dir = str(tmp_path)

    async def failing_edge(*args, **kwargs):
        return None, "TTS_PROVIDER_ERROR", "NoAudioReceived"

    fake_azure_audio = base64.b64encode(b"azure_singapore_immediate_fallback" * 10).decode("utf-8")
    mock_azure = AsyncMock(return_value=(fake_azure_audio, None, None))

    with (
        patch("app.services.ai.tts_service.settings.AZURE_SPEECH_KEY", "valid_azure_key"),
        patch.object(svc, "_synthesize_edge_tts_detailed", new=failing_edge),
        patch.object(svc, "_synthesize_azure_speech_detailed", new=mock_azure),
    ):
        res = await svc.synthesize_with_details(
            "Giới thiệu bản thân đi.",
            language="vi-VN",
            timeout=10.0,
        )

    assert res["audio_base64"] == fake_azure_audio
    assert res["provider_used"] == "azure_speech"
    assert res["voice"] == "vi-VN-HoaiMyNeural"
    mock_azure.assert_awaited_once()
