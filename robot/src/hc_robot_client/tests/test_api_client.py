import sys
import types
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


@pytest.mark.asyncio
async def test_update_robot_profile_success_and_failure():
    client = BackendAPIClient(host="localhost", port=8000)

    mock_ok = MagicMock()
    mock_ok.status_code = 200
    with patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
        mock_put.return_value = mock_ok
        ok = await client.update_robot_profile(
            status="NAVIGATING",
            battery_level=84,
            current_location="Main Lobby",
            is_online=True,
            robot_id="hc_pi5_01",
        )
        assert ok is True
        mock_put.assert_awaited_once_with(
            "http://localhost:8000/api/v1/operations/robot/profile",
            params={"robot_id": "hc_pi5_01"},
            json={
                "status": "NAVIGATING",
                "is_online": True,
                "battery_level": 84,
                "current_location": "Main Lobby",
            },
        )

    mock_err = MagicMock()
    mock_err.status_code = 500
    mock_err.text = "Internal Error"
    with patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
        mock_put.return_value = mock_err
        ok = await client.update_robot_profile(status="IDLE", robot_id="RC-001")
        assert ok is False


def _load_telemetry_node_with_stub_rclpy():
    class _FakeLogger:
        def info(self, *_args, **_kwargs): pass
        def warning(self, *_args, **_kwargs): pass
        def debug(self, *_args, **_kwargs): pass
        def error(self, *_args, **_kwargs): pass

    class _FakeNode:
        def __init__(self, _name):
            self._logger = _FakeLogger()
        def create_subscription(self, *_args, **_kwargs): return MagicMock()
        def create_timer(self, *_args, **_kwargs): return MagicMock()
        def get_logger(self): return self._logger

    class _FakeString:
        def __init__(self, data=""):
            self.data = data

    fake_rclpy = types.ModuleType("rclpy")
    fake_rclpy.node = types.ModuleType("rclpy.node")
    fake_rclpy.node.Node = _FakeNode
    fake_std_msgs = types.ModuleType("std_msgs")
    fake_std_msgs.msg = types.ModuleType("std_msgs.msg")
    fake_std_msgs.msg.String = _FakeString

    return {
        "rclpy": fake_rclpy,
        "rclpy.node": fake_rclpy.node,
        "std_msgs": fake_std_msgs,
        "std_msgs.msg": fake_std_msgs.msg,
    }, _FakeString


def test_telemetry_node_syncs_profile_on_status_and_heartbeat():
    stub_modules, FakeString = _load_telemetry_node_with_stub_rclpy()
    with patch.dict(sys.modules, stub_modules):
        sys.modules.pop("hc_robot_client.nodes.telemetry_node", None)
        from hc_robot_client.nodes.telemetry_node import TelemetryNode

        node = TelemetryNode()
        node.api_client.update_robot_profile = AsyncMock(return_value=True)
        node.api_client.check_health = AsyncMock(return_value=True)

        # Plain status update triggers immediate sync
        node.on_status_updated(FakeString("NAVIGATING"))
        node.api_client.update_robot_profile.assert_awaited_with(
            status="NAVIGATING",
            battery_level=None,
            current_location=None,
            is_online=True,
            robot_id=node.robot_id,
        )
        node.api_client.check_health.assert_not_called()

        # JSON status update updates battery & location and syncs
        node.on_status_updated(
            FakeString('{"status": "CHARGING", "battery_level": 78, "current_location": "Lobby Dock"}')
        )
        node.api_client.update_robot_profile.assert_awaited_with(
            status="CHARGING",
            battery_level=78,
            current_location="Lobby Dock",
            is_online=True,
            robot_id=node.robot_id,
        )
