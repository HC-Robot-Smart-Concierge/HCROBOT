import asyncio
import json
import os
from typing import Optional
import yaml

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from hc_robot_client.utils.api_client import BackendAPIClient


class TelemetryNode(Node):
    """
    ROS 2 Node gửi báo cáo trạng thái và heartbeat từ Raspberry Pi 5 về Laptop Backend Server.
    """

    def __init__(self):
        super().__init__('telemetry_node')

        config_path = self.get_config_path()
        server_host = "192.168.1.100"
        server_port = 8000
        robot_id = "hc_pi5_01"
        status_topic = "/robot/status"

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    server_host = config.get('server', {}).get('host', server_host)
                    server_port = config.get('server', {}).get('port', server_port)
                    robot_id = config.get('robot', {}).get('id', robot_id)
                    status_topic = config.get('topics', {}).get('robot_status', status_topic)
            except Exception as e:
                self.get_logger().error(f"Lỗi đọc config file: {e}")

        self.robot_id = robot_id
        self.api_client = BackendAPIClient(host=server_host, port=server_port)

        # Lắng nghe dữ liệu trạng thái từ các node phần cứng ROS 2 khác
        self.status_sub = self.create_subscription(
            String,
            status_topic,
            self.on_status_updated,
            10
        )

        # Timer định kỳ gửi heartbeat (mỗi 10 giây)
        self.heartbeat_timer = self.create_timer(10.0, self.send_heartbeat)
        self.current_status = "IDLE"
        self.battery_level: Optional[int] = None
        self.current_location: Optional[str] = None

        self.get_logger().info(f"TelemetryNode khởi chạy cho Robot ID '{robot_id}'. Heartbeat interval: 10s")

    def get_config_path(self) -> str:
        """
        Lấy đường dẫn file config/settings.yaml linh hoạt từ ROS 2 share dir hoặc đường dẫn tương đối.
        """
        try:
            from ament_index_python.packages import get_package_share_directory
            share_config = os.path.join(get_package_share_directory('hc_robot_client'), 'config', 'settings.yaml')
            if os.path.exists(share_config):
                return share_config
        except Exception:
            pass

        curr_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.abspath(os.path.join(curr_dir, '../../../../config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../robot/config/settings.yaml')),
            os.path.abspath(os.path.join(curr_dir, '../../../../../config/settings.yaml')),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return candidates[0]


    def on_status_updated(self, msg: String):
        """
        Cập nhật trạng thái hiện tại của Robot khi có message từ Topic (hỗ trợ chuỗi thuần hoặc JSON).
        Đồng bộ ngay telemetry lên Backend Server.
        """
        raw_data = (msg.data or "").strip()
        if raw_data:
            parsed = None
            if raw_data.startswith("{"):
                try:
                    parsed = json.loads(raw_data)
                except ValueError:
                    parsed = None

            if isinstance(parsed, dict):
                if parsed.get("status") is not None:
                    self.current_status = str(parsed["status"])
                if parsed.get("battery_level") is not None:
                    try:
                        self.battery_level = int(parsed["battery_level"])
                    except (TypeError, ValueError):
                        self.get_logger().warning(f"Giá trị battery_level không hợp lệ: {parsed.get('battery_level')}")
                if parsed.get("current_location") is not None:
                    self.current_location = str(parsed["current_location"])
            else:
                self.current_status = raw_data

        self.get_logger().info(
            f"Cập nhật trạng thái Robot: status={self.current_status}, "
            f"battery={self.battery_level}, location={self.current_location}"
        )
        self._dispatch_sync_profile()

    def _dispatch_sync_profile(self):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._sync_profile())
        except RuntimeError:
            asyncio.run(self._sync_profile())

    async def _sync_profile(self) -> bool:
        try:
            return await self.api_client.update_robot_profile(
                status=self.current_status,
                battery_level=self.battery_level,
                current_location=self.current_location,
                is_online=True,
                robot_id=self.robot_id,
            )
        except Exception as e:
            self.get_logger().error(f"Lỗi đồng bộ telemetry robot lên Backend: {e}")
            return False

    def send_heartbeat(self):
        """
        Callback gửi heartbeat định kỳ tới Backend Server.
        """
        asyncio.run(self._do_send_heartbeat())

    async def _do_send_heartbeat(self):
        is_alive = await self.api_client.check_health()
        if is_alive:
            synced = await self._sync_profile()
            self.get_logger().debug(
                f"Heartbeat thành công tới Laptop Server. Robot status: {self.current_status}, synced: {synced}"
            )
        else:
            self.get_logger().warning("Cảnh báo: Không kết nối được tới Laptop Server qua Heartbeat!")


def main(args=None):
    rclpy.init(args=args)
    node = TelemetryNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
