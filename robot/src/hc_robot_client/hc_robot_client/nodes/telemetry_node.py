import asyncio
import os
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

        self.get_logger().info(f"TelemetryNode khởi chạy cho Robot ID '{robot_id}'. Heartbeat interval: 10s")

    def get_config_path(self) -> str:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../'))
        return os.path.join(base_dir, 'config', 'settings.yaml')

    def on_status_updated(self, msg: String):
        """
        Cập nhật trạng thái hiện tại của Robot khi có message từ Topic.
        """
        self.current_status = msg.data
        self.get_logger().info(f"Cập nhật trạng thái Robot: {self.current_status}")

    def send_heartbeat(self):
        """
        Callback gửi heartbeat định kỳ tới Backend Server.
        """
        asyncio.run(self._do_send_heartbeat())

    async def _do_send_heartbeat(self):
        is_alive = await self.api_client.check_health()
        if is_alive:
            self.get_logger().debug(f"Heartbeat thành công tới Laptop Server. Robot status: {self.current_status}")
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
