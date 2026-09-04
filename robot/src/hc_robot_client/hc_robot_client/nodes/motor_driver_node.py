import os
import sys
import yaml

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import String

from hc_robot_client.utils.motor_controller import MotorController


class MotorDriverNode(Node):
    """
    ROS 2 Node tiếp nhận các lệnh vận tốc / hướng từ topic /cmd_vel (Twist hoặc String)
    và điều khiển các chân GPIO của 2 mạch L298N trên Raspberry Pi 5.
    """

    def __init__(self):
        super().__init__('motor_driver_node')

        # Load cấu hình GPIO từ settings.yaml
        config_path = self._get_config_path()
        left_forward = 17
        left_backward = 27
        right_forward = 22
        right_backward = 23
        cmd_vel_topic = "/cmd_vel"

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f) or {}
                    gpio_cfg = config.get('robot', {}).get('gpio', {})
                    left_forward = gpio_cfg.get('left_forward', left_forward)
                    left_backward = gpio_cfg.get('left_backward', left_backward)
                    right_forward = gpio_cfg.get('right_forward', right_forward)
                    right_backward = gpio_cfg.get('right_backward', right_backward)
                    
                    topics_cfg = config.get('topics', {})
                    cmd_vel_topic = topics_cfg.get('cmd_vel', cmd_vel_topic)
            except Exception as e:
                self.get_logger().error(f"Lỗi đọc file cấu hình {config_path}: {e}")

        # Khởi tạo bộ điều khiển động cơ
        self.motor_controller = MotorController(
            left_forward_pin=left_forward,
            left_backward_pin=left_backward,
            right_forward_pin=right_forward,
            right_backward_pin=right_backward
        )

        # Topic Subscribers
        # 1. Subscriber chuẩn Twist (/cmd_vel)
        self.twist_sub = self.create_subscription(
            Twist,
            cmd_vel_topic,
            self.on_twist_received,
            10
        )

        # 2. Subscriber lệnh chuỗi String bổ trợ (/robot/cmd_text)
        self.text_cmd_sub = self.create_subscription(
            String,
            "/robot/cmd_text",
            self.on_text_command_received,
            10
        )

        self.get_logger().info(
            f"MotorDriverNode khởi chạy thành công. "
            f"Left(Fwd:{left_forward}, Bwd:{left_backward}) | Right(Fwd:{right_forward}, Bwd:{right_backward}). "
            f"Lắng nghe topic '{cmd_vel_topic}'"
        )

    def _get_config_path(self) -> str:
        """Đường dẫn tới file config/settings.yaml"""
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../'))
        return os.path.join(base_dir, 'config', 'settings.yaml')

    def on_twist_received(self, msg: Twist):
        """Callback xử lý tin nhắn vận tốc dạng Twist."""
        linear_x = msg.linear.x
        angular_z = msg.angular.z
        self.get_logger().debug(f"Twist received: linear.x={linear_x}, angular.z={angular_z}")
        self.motor_controller.set_drive_cmd(linear_x, angular_z)

    def on_text_command_received(self, msg: String):
        """Callback xử lý lệnh điều khiển hướng dạng văn bản (tiến, lùi, trái, phải, dừng)."""
        command = msg.data.strip().lower()
        self.get_logger().info(f"Nhận lệnh di chuyển dạng chữ: '{command}'")

        if command in ["forward", "tien", "tiến", "up"]:
            self.motor_controller.move_forward()
        elif command in ["backward", "lui", "lùi", "down"]:
            self.motor_controller.move_backward()
        elif command in ["left", "trai", "trái"]:
            self.motor_controller.turn_left()
        elif command in ["right", "phai", "phải"]:
            self.motor_controller.turn_right()
        elif command in ["stop", "dung", "dừng"]:
            self.motor_controller.stop()
        else:
            self.get_logger().warn(f"Lệnh không xác định: '{command}'")

    def destroy_node(self):
        """Tự động dọn dẹp GPIO khi dừng node."""
        if hasattr(self, 'motor_controller'):
            self.motor_controller.cleanup()
        super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = MotorDriverNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
