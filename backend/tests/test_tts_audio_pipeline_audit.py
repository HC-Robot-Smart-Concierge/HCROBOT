import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ai.tts_service import TTSService
from app.services.ai.gemini_service import GeminiService
from app.services.ai.ollama_service import OllamaService
from app.services.ai.translation_service import TranslationService
from app.services.cache.redis_service import RedisService
from app.core.config import settings


@pytest.mark.asyncio
async def test_tts_inflight_deduplication():
    """Kiểm tra deduplication in-flight của TTSService khi nhiều request cùng tổng hợp 1 câu."""
    tts = TTSService()

    # Clear memory cache for clean test
    tts._memory_cache.clear()

    # Mock _synthesize_edge_tts to count real synthesis calls
    call_count = 0
    async def mock_internal(text, voice, rate=None):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)
        return "ZmFrZV9tcDNfZGF0YQ=="

    with patch.object(tts, "_synthesize_edge_tts", side_effect=mock_internal), \
         patch.object(tts, "_get_from_cache", return_value=None):
        # 3 calls with identical text simultaneously
        tasks = [
            tts.synthesize("Xin chào quý khách một ngày mới", provider="edge", language="vi-VN"),
            tts.synthesize("Xin chào quý khách một ngày mới", provider="edge", language="vi-VN"),
            tts.synthesize("Xin chào quý khách một ngày mới", provider="edge", language="vi-VN"),
        ]
        results = await asyncio.gather(*tasks)

        # All 3 calls should receive valid base64 audio
        for b64, mime, _ in results:
            assert b64 is not None
            assert mime == "audio/mp3"

        # Due to deduplication, internal synthesis should be called at most once for identical in-flight task
        assert call_count == 1


@pytest.mark.asyncio
async def test_gemini_to_groq_fallback_stream():
    """Kiểm tra khi Gemini stream bị lỗi, tự động fallback sang Groq stream nếu chưa emit token."""
    gemini = GeminiService()

    with patch.object(settings, "GROQ_API_KEY", "mock-groq-key"), \
         patch.object(gemini, "candidate_models", ["gemini-2.5-flash"]), \
         patch("httpx.AsyncClient.stream") as mock_stream, \
         patch.object(gemini, "_stream_groq_fallback") as mock_groq_stream:

        # Mock Gemini stream failing with 500
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.aread = AsyncMock(return_value=b"Internal Error")

        # Async context manager mock for client.stream
        mock_cm = AsyncMock()
        mock_cm.__aenter__.return_value = mock_resp
        mock_cm.__aexit__.return_value = None
        mock_stream.return_value = mock_cm

        # Mock Groq stream yielding tokens
        async def fake_groq_gen(*args, **kwargs):
            yield "Hello"
            yield " from"
            yield " Groq"

        mock_groq_stream.side_effect = fake_groq_gen

        tokens = []
        async for t in gemini.generate_response_stream(prompt="Test prompt", language="vi"):
            tokens.append(t)

        assert "".join(tokens) == "Hello from Groq"
        assert mock_groq_stream.called


def test_language_detection_strictly_bilingual():
    """Kiểm tra nhận diện ngôn ngữ chỉ ra Tiếng Việt hoặc English."""
    gemini = GeminiService()
    ollama = OllamaService()

    # Vietnamese
    name1, code1 = gemini.detect_language("Phòng 402 cần khăn tắm")
    assert name1 == "Tiếng Việt" and code1 == "vi-VN"

    name2, code2 = ollama.detect_language("Phòng 402 cần khăn tắm")
    assert name2 == "Tiếng Việt" and code2 == "vi-VN"

    # English
    name3, code3 = gemini.detect_language("Where is the swimming pool?")
    assert name3 == "English" and code3 == "en-US"

    name4, code4 = ollama.detect_language("Where is the swimming pool?")
    assert name4 == "English" and code4 == "en-US"

    # CJK text without Latin should not return Chinese or Japanese, but default gracefully to Vietnamese
    name5, code5 = gemini.detect_language("你好")
    assert code5 in ["vi-VN", "en-US"]


@pytest.mark.asyncio
async def test_translation_service_graceful_close():
    """Kiểm tra lifecycle close() của TranslationService."""
    trans = TranslationService()
    assert not trans.http_client.is_closed
    await trans.close()
    assert trans.http_client.is_closed


@pytest.mark.asyncio
async def test_redis_service_graceful_close():
    """Kiểm tra lifecycle close() của RedisService."""
    redis_srv = RedisService()
    # close should not crash even if redis is disabled or not connected
    await redis_srv.close()


@pytest.mark.asyncio
async def test_notification_websocket_endpoint_and_manager_lifecycle():
    """Kiểm tra WebSocket thông báo với department=All, ping/pong, broadcast và dọn dẹp khi ngắt kết nối."""
    from fastapi import WebSocketDisconnect
    from app.services.notification_manager import NotificationConnectionManager
    from app.api.v1.endpoints.operations.notifications import notification_websocket_endpoint

    mgr = NotificationConnectionManager()
    mock_ws = AsyncMock()
    # Receive 'ping' once, then disconnect
    mock_ws.receive_text = AsyncMock(side_effect=["ping", WebSocketDisconnect()])

    with patch("app.api.v1.endpoints.operations.notifications.notification_manager", mgr):
        await notification_websocket_endpoint(mock_ws, department="All")

    # Verify accept, welcome payload, and pong response
    mock_ws.accept.assert_awaited_once()
    mock_ws.send_json.assert_awaited_once_with({
        "type": "CONNECTION_ESTABLISHED",
        "message": "Connected to Realtime Notification Hub (All)",
        "department": "All",
    })
    mock_ws.send_text.assert_awaited_once_with("pong")
    # Verify socket was cleaned up on disconnect
    assert len(mgr.all_connections) == 0
    assert "All" not in mgr.department_connections

