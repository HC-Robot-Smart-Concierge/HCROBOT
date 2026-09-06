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


def run_hardware_test(controller: MotorController):
    """Tự động quay thử từng động cơ 2 giây để kiểm tra phần cứng đấu nối."""
    logger.info("=" * 60)
    logger.info("  BẮT ĐẦU KIỂM TRẢ TỰ ĐỘNG PHẦN CỨNG 2 ĐỘNG CƠ L298N")
    logger.info("=" * 60)

    try:
        logger.info("1. Đang thử TIẾN (Cả 2 bánh quay tiến 2 giây)...")
        controller.move_forward()
        time.sleep(2.0)
        controller.stop()
        time.sleep(1.0)

        logger.info("2. Đang thử LÙI (Cả 2 bánh quay lùi 2 giây)...")
        controller.move_backward()
        time.sleep(2.0)
        controller.stop()
        time.sleep(1.0)

        logger.info("3. Đang thử RẼ TRÁI (2 giây)...")
        controller.turn_left()
        time.sleep(2.0)
        controller.stop()
        time.sleep(1.0)

        logger.info("4. Đang thử RẼ PHẢI (2 giây)...")
        controller.turn_right()
        time.sleep(2.0)
        controller.stop()

        logger.info("=" * 60)
        logger.info("  HOÀN THÀNH TEST PHẦN CỨNG! ĐÃ TẮT TOÀN BỘ ĐỘNG CƠ.")
        logger.info("=" * 60)
    except KeyboardInterrupt:
        logger.info("Đã hủy test giữa chừng.")
    finally:
        controller.stop()


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
            self.get_logger().info("=" * 60)
            self.get_logger().info(f"ROS 2 Node ĐANG LẮNG NGHE LỆNH!")
            self.get_logger().info(f"- Topic Vận tốc Twist: '{cmd_vel_topic}'")
            self.get_logger().info(f"- Topic Lệnh Chữ:      '{cmd_text_topic}'")
            self.get_logger().info("Gợi ý test từ Terminal khác:")
            self.get_logger().info("  ros2 topic pub /robot/cmd_text std_msgs/msg/String \"{data: 'tien'}\" --once")
            self.get_logger().info("=" * 60)

        def on_twist(self, msg: Twist):
            self.ctrl.set_drive_cmd(msg.linear.x, msg.angular.z)

        def on_text(self, msg: String):
            cmd = msg.data.strip().lower()
            self.get_logger().info(f"Nhận lệnh di chuyển: '{cmd}'")
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
    logger.info("=" * 60)
    logger.info("  CHẾ ĐỘ ĐIỀU KHIỂN BÀN PHÍM TRỰC TIẾP")
    logger.info("  [W]: Tiến   | [S]: Lùi   | [A]: Rẽ Trái | [D]: Rẽ Phải")
    logger.info("  [X] hoặc [Space]: Dừng    | [Q]: Thoát chương trình")
    logger.info("=" * 60)

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
    logger.info(f"Sơ đồ chân BCM: Left(Fwd:{left_forward}, Bwd:{left_backward}) | Right(Fwd:{right_forward}, Bwd:{right_backward})")

    # Kiểm tra xem có cần dùng sudo trên Linux không
    force_mock = '--mock' in sys.argv
    controller = MotorController(
        left_forward_pin=left_forward,
        left_backward_pin=left_backward,
        right_forward_pin=right_forward,
        right_backward_pin=right_backward,
        force_mock=force_mock
    )

    if controller.is_mock and not force_mock:
        logger.warning("=" * 60)
        logger.warning("CẢNH BÁO: Code đang chạy ở chế độ MOCK (Giả lập).")
        logger.warning("Nếu đang ở trên Pi 5, ông chủ cần chạy lệnh bằng: sudo python3 main.py")
        logger.warning("hoặc cài thư viện: sudo apt install python3-gpiozero python3-lgpio")
        logger.warning("=" * 60)

    try:
        if '--test' in sys.argv:
            run_hardware_test(controller)
        elif '--cli' in sys.argv:
            run_interactive_cli(controller)
        else:
            # Tự động phát hiện ROS 2
            has_ros2 = False
            try:
                import rclpy
                has_ros2 = True
            except ImportError:
                has_ros2 = False

            if has_ros2:
                logger.info("Phát hiện ROS 2! Khởi chạy dưới dạng ROS 2 Node...")
                run_ros2_node(controller, cmd_vel_topic, cmd_text_topic)
            else:
                run_interactive_cli(controller)
    finally:
        controller.cleanup()
        logger.info("Đã tắt an toàn toàn bộ động cơ.")


if __name__ == '__main__':
    main()
