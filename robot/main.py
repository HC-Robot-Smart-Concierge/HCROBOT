import os
import sys
import time
import logging
import yaml

from motor_controller import MotorController

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("RobotMain")


def load_config() -> dict:
    """Tải cấu hình từ settings.yaml nếu tồn tại."""
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(curr_dir, 'settings.yaml'),
        os.path.join(curr_dir, 'config', 'settings.yaml'),
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    logger.info(f"Đã nạp file cấu hình từ: {path}")
                    return yaml.safe_load(f) or {}
            except Exception as e:
                logger.error(f"Lỗi đọc cấu hình {path}: {e}")
    return {}


def run_ros2_node(controller: MotorController, cmd_vel_topic: str, cmd_text_topic: str):
    """Khởi chạy dưới dạng ROS 2 Node (nếu có rclpy)."""
    import rclpy
    from rclpy.node import Node
    from geometry_msgs.msg import Twist
    from std_msgs.msg import String

    class RobotROS2Node(Node):
        def __init__(self, ctrl: MotorController):
            super().__init__('robot_motor_node')
            self.ctrl = ctrl

            self.sub_twist = self.create_subscription(
                Twist, cmd_vel_topic, self.on_twist, 10
            )
            self.sub_text = self.create_subscription(
                String, cmd_text_topic, self.on_text, 10
            )
            self.get_logger().info(
                f"ROS 2 Node đang chạy! Subscribed: '{cmd_vel_topic}' & '{cmd_text_topic}'"
            )

        def on_twist(self, msg: Twist):
            self.ctrl.set_drive_cmd(msg.linear.x, msg.angular.z)

        def on_text(self, msg: String):
            cmd = msg.data.strip().lower()
            if cmd in ["forward", "tien", "tiến", "up", "w"]:
                self.ctrl.move_forward()
            elif cmd in ["backward", "lui", "lùi", "down", "s"]:
                self.ctrl.move_backward()
            elif cmd in ["left", "trai", "trái", "a"]:
                self.ctrl.turn_left()
            elif cmd in ["right", "phai", "phải", "d"]:
                self.ctrl.turn_right()
            elif cmd in ["stop", "dung", "dừng", "x", "space"]:
                self.ctrl.stop()

    rclpy.init()
    node = RobotROS2Node(controller)
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        logger.info("Nhận tín hiệu dừng từ bàn phím.")
    finally:
        node.destroy_node()
        rclpy.shutdown()


def run_interactive_cli(controller: MotorController):
    """Chế độ điều khiển trực tiếp bằng bàn phím CLI (Không cần ROS 2)."""
    logger.info("=" * 50)
    logger.info("  CHẾ ĐỘ ĐIỀU KHIỂN BÀN PHÍM TRỰC TIẾP (STANDALONE)")
    logger.info("  [W]: Tiến   | [S]: Lùi   | [A]: Rẽ Trái | [D]: Rẽ Phải")
    logger.info("  [X] hoặc [Space]: Dừng    | [Q]: Thoát chương trình")
    logger.info("=" * 50)

    try:
        while True:
            choice = input("\nNhập lệnh (w/a/s/d/x/q) rồi nhấn Enter: ").strip().lower()
            if choice == 'w':
                controller.move_forward()
            elif choice == 's':
                controller.move_backward()
            elif choice == 'a':
                controller.turn_left()
            elif choice == 'd':
                controller.turn_right()
            elif choice in ['x', ' ', 'dung', 'stop']:
                controller.stop()
            elif choice == 'q':
                logger.info("Thoát chương trình...")
                break
            else:
                print("Lệnh không hợp lệ! Dùng: w (tiến), s (lùi), a (trái), d (phải), x (dừng), q (thoát)")
    except KeyboardInterrupt:
        logger.info("\nĐã ngắt chương trình.")


def main():
    config = load_config()
    gpio_cfg = config.get('robot', {}).get('gpio', {})
    topics_cfg = config.get('topics', {})

    left_forward = gpio_cfg.get('left_forward', 17)
    left_backward = gpio_cfg.get('left_backward', 27)
    right_forward = gpio_cfg.get('right_forward', 22)
    right_backward = gpio_cfg.get('right_backward', 23)

    cmd_vel_topic = topics_cfg.get('cmd_vel', '/cmd_vel')
    cmd_text_topic = topics_cfg.get('cmd_text', '/robot/cmd_text')

    logger.info("Khởi tạo Robot Motor Controller...")
    logger.info(f"Sơ đồ chân: Left(Fwd:{left_forward}, Bwd:{left_backward}) | Right(Fwd:{right_forward}, Bwd:{right_backward})")

    controller = MotorController(
        left_forward_pin=left_forward,
        left_backward_pin=left_backward,
        right_forward_pin=right_forward,
        right_backward_pin=right_backward
    )

    # Tự động phát hiện ROS 2
    has_ros2 = False
    try:
        import rclpy
        has_ros2 = True
    except ImportError:
        has_ros2 = False

    try:
        if has_ros2 and '--cli' not in sys.argv:
            logger.info("Phát hiện ROS 2! Khởi chạy dưới dạng ROS 2 Node...")
            run_ros2_node(controller, cmd_vel_topic, cmd_text_topic)
        else:
            run_interactive_cli(controller)
    finally:
        controller.cleanup()
        logger.info("Đã tắt an toàn toàn bộ động cơ.")


if __name__ == '__main__':
    main()
