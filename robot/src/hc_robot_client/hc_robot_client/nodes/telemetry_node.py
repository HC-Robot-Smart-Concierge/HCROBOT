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
        Cập nhật trạng thái hiện tại của Robot khi có message từ Topic và đồng bộ tức thời về Backend.
        Hỗ trợ cả chuỗi thuần (VD: 'NAVIGATING') hoặc JSON ({'status', 'battery_level', 'current_location'}).
        """
        raw = (msg.data or "").strip()
        if not raw:
            return

        if raw.startswith("{"):
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    if data.get("status"):
                        self.current_status = str(data["status"]).strip()
                    if data.get("battery_level") is not None:
                        self.battery_level = int(data["battery_level"])
                    if data.get("current_location"):
                        self.current_location = str(data["current_location"]).strip()
            except (ValueError, TypeError) as e:
                self.get_logger().warning(f"Không parse được JSON trạng thái '{raw}': {e}")
                return
        else:
            self.current_status = raw

        self.get_logger().info(
            f"Cập nhật trạng thái Robot: status={self.current_status}, "
            f"battery={self.battery_level}, location={self.current_location}"
        )
        self.send_heartbeat()

    def send_heartbeat(self):
        """
        Callback gửi telemetry/heartbeat định kỳ tới Backend Server.
        """
        asyncio.run(self._do_send_heartbeat())

    async def _do_send_heartbeat(self):
        is_synced = await self.api_client.update_robot_profile(
            status=self.current_status,
            battery_level=self.battery_level,
            current_location=self.current_location,
            is_online=True,
            robot_id=self.robot_id,
        )
        if is_synced:
            self.get_logger().debug(f"Đồng bộ telemetry thành công tới Laptop Server. Robot status: {self.current_status}")
        else:
            self.get_logger().warning("Cảnh báo: Không đồng bộ được telemetry tới Laptop Server qua Heartbeat!")


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
