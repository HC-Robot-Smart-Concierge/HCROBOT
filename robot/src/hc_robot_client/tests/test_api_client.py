import asyncio
import json
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
            status="BUSY",
            battery_level=82,
            current_location="Tầng 3",
            is_online=True,
            robot_id="hc_pi5_01",
        )
        assert ok is True
        mock_put.assert_awaited_once_with(
            "http://localhost:8000/api/v1/operations/robot/profile",
            params={"robot_id": "hc_pi5_01"},
            json={
                "status": "BUSY",
                "is_online": True,
                "battery_level": 82,
                "current_location": "Tầng 3",
            },
        )

    mock_err = MagicMock()
    mock_err.status_code = 500
    mock_err.text = "Internal Server Error"
    with patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
        mock_put.return_value = mock_err
        fail_status = await client.update_robot_profile(status="IDLE")
        assert fail_status is False

    with patch("httpx.AsyncClient.put", new_callable=AsyncMock, side_effect=httpx.ConnectError("offline")):
        fail_exc = await client.update_robot_profile(status="IDLE")
        assert fail_exc is False


@pytest.mark.asyncio
async def test_telemetry_node_syncs_profile_on_status_and_heartbeat():
    class FakeLogger:
        def info(self, *_args, **_kwargs):
            pass

        def debug(self, *_args, **_kwargs):
            pass

        def warning(self, *_args, **_kwargs):
            pass

        def error(self, *_args, **_kwargs):
            pass

    class FakeNode:
        def __init__(self, _name):
            self._logger = FakeLogger()

        def create_subscription(self, *_args, **_kwargs):
            return MagicMock()

        def create_timer(self, *_args, **_kwargs):
            return MagicMock()

        def get_logger(self):
            return self._logger

    class FakeString:
        def __init__(self, data=""):
            self.data = data

    fake_rclpy = types.ModuleType("rclpy")
    fake_rclpy.init = MagicMock()
    fake_rclpy.spin = MagicMock()
    fake_rclpy.shutdown = MagicMock()
    fake_rclpy_node = types.ModuleType("rclpy.node")
    fake_rclpy_node.Node = FakeNode
    fake_std_msgs = types.ModuleType("std_msgs")
    fake_std_msgs_msg = types.ModuleType("std_msgs.msg")
    fake_std_msgs_msg.String = FakeString

    with patch.dict(
        sys.modules,
        {
            "rclpy": fake_rclpy,
            "rclpy.node": fake_rclpy_node,
            "std_msgs": fake_std_msgs,
            "std_msgs.msg": fake_std_msgs_msg,
        },
    ):
        import importlib
        import hc_robot_client.nodes.telemetry_node as telemetry_mod

        importlib.reload(telemetry_mod)
        node = telemetry_mod.TelemetryNode()

        node.api_client.update_robot_profile = AsyncMock(return_value=True)
        node.api_client.check_health = AsyncMock(return_value=True)

        # 1. Plain string message on /robot/status
        node.on_status_updated(FakeString("DELIVERING"))
        await asyncio.sleep(0)
        assert node.current_status == "DELIVERING"
        assert node.battery_level is None
        node.api_client.update_robot_profile.assert_awaited_with(
            status="DELIVERING",
            battery_level=None,
            current_location=None,
            is_online=True,
            robot_id=node.robot_id,
        )

        # 2. JSON telemetry payload on /robot/status
        payload = json.dumps(
            {
                "status": "CHARGING",
                "battery_level": 45,
                "current_location": "Charging Dock",
            }
        )
        node.on_status_updated(FakeString(payload))
        await asyncio.sleep(0)
        assert node.current_status == "CHARGING"
        assert node.battery_level == 45
        assert node.current_location == "Charging Dock"
        node.api_client.update_robot_profile.assert_awaited_with(
            status="CHARGING",
            battery_level=45,
            current_location="Charging Dock",
            is_online=True,
            robot_id=node.robot_id,
        )

        # 3. Periodic heartbeat calls check_health + update_robot_profile
        node.api_client.update_robot_profile.reset_mock()
        await node._do_send_heartbeat()
        node.api_client.check_health.assert_awaited_once()
        node.api_client.update_robot_profile.assert_awaited_once_with(
            status="CHARGING",
            battery_level=45,
            current_location="Charging Dock",
            is_online=True,
            robot_id=node.robot_id,
        )

