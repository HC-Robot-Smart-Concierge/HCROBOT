import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai.ollama_service import OllamaService


@pytest.mark.asyncio
async def test_generate_response_success():
    """Unit test kiểm tra hàm generate_response của OllamaService với mock client"""
    mock_chat_response = {
        "message": {
            "content": "Xin chào! Tôi có thể giúp gì cho ông chủ hôm nay?"
        }
    }

    with patch("ollama.AsyncClient.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_chat_response

        service = OllamaService()
        reply, lang_name, lang_code = await service.generate_response(
            prompt="Xin chào robot",
            rag_context="Khách sạn có dịch vụ ăn sáng từ 6h-10h"
        )

        assert reply == "Xin chào! Tôi có thể giúp gì cho ông chủ hôm nay?"
        assert lang_name == "Tiếng Việt"
        assert lang_code == "vi-VN"
        assert mock_chat.called



@pytest.mark.asyncio
async def test_extract_intent_json_parsing():
    """Unit test kiểm tra hàm bóc tách intent JSON từ OllamaService"""
    mock_intent_response = {
        "message": {
            "content": '{"action": "housekeeping", "room_number": "302", "items": "2 cái khăn tắm"}'
        }
    }

    with patch("ollama.AsyncClient.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_intent_response

        service = OllamaService()
        intent = await service.extract_intent(user_speech="Phòng 302 cần 2 cái khăn tắm")

        assert intent["action"] == "housekeeping"
        assert intent["room_number"] == "302"
        assert intent["items"] == "2 cái khăn tắm"
