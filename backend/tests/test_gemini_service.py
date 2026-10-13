import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ai.gemini_service import GeminiService
from app.services.ai.ollama_service import ollama_service
from app.core.config import settings


def test_gemini_service_initialization():
    """Kiểm tra khởi tạo GeminiService và candidate models."""
    service = GeminiService()
    assert service.is_configured is True
    assert "gemini-flash-latest" in service.candidate_models
    assert len(service.candidate_models) >= 1


def test_gemini_detect_language():
    """Kiểm tra khả năng nhận diện tiếng Việt và tiếng Anh của GeminiService."""
    service = GeminiService()
    
    name, code = service.detect_language("Khách sạn có dịch vụ dọn phòng không?")
    assert name == "Tiếng Việt" and code == "vi-VN"

    name, code = service.detect_language("Can I get extra towels for room 302?")
    assert name == "English" and code == "en-US"


@pytest.mark.asyncio
async def test_gemini_generate_response_mocked():
    """Kiểm tra hàm generate_response của GeminiService với mock HTTP response."""
    service = GeminiService()

    mock_resp_json = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Dạ em chào quý khách! Em là Rora, trợ lý của khách sạn Aurora Grand ạ."}]
                }
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_resp_json

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        reply, lang_name, lang_code = await service.generate_response(
            prompt="Bạn là ai?",
            language="Tiếng Việt"
        )

        assert "Rora" in reply
        assert lang_name == "Tiếng Việt"
        assert lang_code == "vi-VN"
        assert mock_post.called


@pytest.mark.asyncio
async def test_gemini_extract_intent_mocked():
    """Kiểm tra bóc tách intent từ GeminiService với mock JSON output."""
    service = GeminiService()

    mock_resp_json = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": '{"action": "housekeeping", "room_number": "502", "items": "2 cái khăn tắm"}'}
                    ]
                }
            }
        ]
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_resp_json

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        intent = await service.extract_intent(user_speech="Phòng 502 cần 2 cái khăn tắm")

        assert intent["action"] == "housekeeping"
        assert intent["room_number"] == "502"
        assert "khăn" in intent["items"]


@pytest.mark.asyncio
async def test_ollama_service_delegates_to_gemini_when_active():
    """Kiểm tra khi settings.is_gemini_active=True thì ollama_service gọi Gemini."""
    with patch.object(settings, "LLM_PROVIDER", "gemini"), \
         patch("app.services.ai.gemini_service.gemini_service.generate_response", new_callable=AsyncMock) as mock_gemini_gen:
        mock_gemini_gen.return_value = ("Dạ em là Rora được cấp nguồn bởi Gemini ạ.", "Tiếng Việt", "vi-VN")

        reply, lang_name, lang_code = await ollama_service.generate_response(
            prompt="Hãy giới thiệu về bản thân bạn",
            language="Tiếng Việt"
        )

        assert mock_gemini_gen.called
        assert "Gemini" in reply


@pytest.mark.asyncio
async def test_ollama_service_uses_llama_when_provider_is_ollama():
    """Kiểm tra khi settings.LLM_PROVIDER='ollama' thì ollama_service gọi trực tiếp Ollama client (Llama)."""
    mock_chat_response = {
        "message": {
            "content": "Phản hồi trực tiếp từ model Llama local."
        }
    }

    with patch.object(settings, "LLM_PROVIDER", "ollama"), \
         patch("ollama.AsyncClient.chat", new_callable=AsyncMock) as mock_ollama_chat:
        mock_ollama_chat.return_value = mock_chat_response

        reply, lang_name, lang_code = await ollama_service.generate_response(
            prompt="Xin chào từ Llama",
            language="Tiếng Việt"
        )

        assert mock_ollama_chat.called
        assert "Llama" in reply
