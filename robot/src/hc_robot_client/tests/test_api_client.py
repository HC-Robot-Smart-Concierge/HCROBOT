import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from hc_robot_client.utils.api_client import BackendAPIClient


@pytest.mark.asyncio
async def test_check_health_success():
    client = BackendAPIClient(host="localhost", port=8000)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"system": "HCRobot", "status": "online"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response
        result = await client.check_health()
        assert result is True


@pytest.mark.asyncio
async def test_send_chat_prompt_success():
    client = BackendAPIClient(host="localhost", port=8000)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "response": "Xin chào! Tôi có thể giúp gì cho ông chủ?",
        "model_used": "qwen2.5:7b"
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await client.send_chat_prompt(prompt="Xin chào robot")
        assert res["response"] == "Xin chào! Tôi có thể giúp gì cho ông chủ?"
        assert "error" not in res


@pytest.mark.asyncio
async def test_extract_intent_success():
    client = BackendAPIClient(host="localhost", port=8000)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "action": "deliver_towel",
        "room_number": "302",
        "items": ["khăn tắm"],
        "raw_output": {}
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await client.extract_intent(user_speech="Mang cho tôi khăn tắm lên phòng 302")
        assert res["action"] == "deliver_towel"
        assert res["room_number"] == "302"

