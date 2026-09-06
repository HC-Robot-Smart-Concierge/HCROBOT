import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Thử import gpiozero. Nếu chạy ở môi trường không có GPIO (Windows / Dev), dùng MockDevice.
try:
    from gpiozero import DigitalOutputDevice
    HAS_GPIOZERO = True
except (ImportError, Exception):
    HAS_GPIOZERO = False


class MockDigitalOutputDevice:
    """Mock device phục vụ testing và chạy trên môi trường không có Raspberry Pi GPIO."""
    def __init__(self, pin: int):
        self.pin = pin
        self.value = 0

    def on(self):
        self.value = 1

    def off(self):
        self.value = 0

    def close(self):
        self.value = 0

    @property
    def is_active(self) -> bool:
        return self.value == 1


class MotorController:
    """
    Quản lý điều khiển 2 mạch L298N kết nối với Raspberry Pi 5.
    - Mạch 1 (Bên Trái): Tiến = GPIO 17 (IN1+IN3), Lùi = GPIO 27 (IN2+IN4)
    - Mạch 2 (Bên Phải): Tiến = GPIO 22 (IN1+IN3), Lùi = GPIO 23 (IN2+IN4)
    """

    def __init__(
        self,
        left_forward_pin: int = 17,
        left_backward_pin: int = 27,
        right_forward_pin: int = 22,
        right_backward_pin: int = 23,
        force_mock: bool = False
    ):
        self.left_forward_pin = left_forward_pin
        self.left_backward_pin = left_backward_pin
        self.right_forward_pin = right_forward_pin
        self.right_backward_pin = right_backward_pin
        self.is_mock = force_mock or not HAS_GPIOZERO

        self.left_forward_dev = None
        self.left_backward_dev = None
        self.right_forward_dev = None
        self.right_backward_dev = None

        self._init_gpio()

    def _init_gpio(self):
        """Khởi tạo các thiết bị điều khiển chân GPIO."""
        try:
            if not self.is_mock:
                self.left_forward_dev = DigitalOutputDevice(self.left_forward_pin)
                self.left_backward_dev = DigitalOutputDevice(self.left_backward_pin)
                self.right_forward_dev = DigitalOutputDevice(self.right_forward_pin)
                self.right_backward_dev = DigitalOutputDevice(self.right_backward_pin)
                logger.info("MotorController khởi tạo thành công với gpiozero trên Pi 5.")
            else:
                self._use_mock_devices()
        except Exception as e:
            logger.warning(f"Không thể kết nối phần cứng GPIO: {e}. Chuyển sang Mock Mode.")
            self.is_mock = True
            self._use_mock_devices()

    def _use_mock_devices(self):
        """Sử dụng Mock Device khi không có phần cứng real GPIO."""
        self.left_forward_dev = MockDigitalOutputDevice(self.left_forward_pin)
        self.left_backward_dev = MockDigitalOutputDevice(self.left_backward_pin)
        self.right_forward_dev = MockDigitalOutputDevice(self.right_forward_pin)
        self.right_backward_dev = MockDigitalOutputDevice(self.right_backward_pin)
        logger.info("MotorController hoạt động ở chế độ MOCK (Virtual GPIO).")

    def move_forward(self):
        """Tiến về phía trước."""
        try:
            self.left_forward_dev.on()
            self.left_backward_dev.off()
            self.right_forward_dev.on()
            self.right_backward_dev.off()
            logger.debug("Motor State: FORWARD")
        except Exception as e:
            logger.error(f"Lỗi khi điều khiển Tiến: {e}")

    def move_backward(self):
        """Lùi về phía sau."""
        try:
            self.left_forward_dev.off()
            self.left_backward_dev.on()
            self.right_forward_dev.off()
            self.right_backward_dev.on()
            logger.debug("Motor State: BACKWARD")
        except Exception as e:
            logger.error(f"Lỗi khi điều khiển Lùi: {e}")

    def turn_left(self):
        """Xoay rẽ trái."""
        try:
            self.left_forward_dev.off()
            self.left_backward_dev.on()
            self.right_forward_dev.on()
            self.right_backward_dev.off()
            logger.debug("Motor State: TURN_LEFT")
        except Exception as e:
            logger.error(f"Lỗi khi điều khiển Rẽ Trái: {e}")

    def turn_right(self):
        """Xoay rẽ phải."""
        try:
            self.left_forward_dev.on()
            self.left_backward_dev.off()
            self.right_forward_dev.off()
            self.right_backward_dev.on()
            logger.debug("Motor State: TURN_RIGHT")
        except Exception as e:
            logger.error(f"Lỗi khi điều khiển Rẽ Phải: {e}")

    def stop(self):
        """Dừng toàn bộ động cơ."""
        try:
            if self.left_forward_dev:
                self.left_forward_dev.off()
            if self.left_backward_dev:
                self.left_backward_dev.off()
            if self.right_forward_dev:
                self.right_forward_dev.off()
            if self.right_backward_dev:
                self.right_backward_dev.off()
            logger.debug("Motor State: STOP")
        except Exception as e:
            logger.error(f"Lỗi khi dừng động cơ: {e}")

    def set_drive_cmd(self, linear_x: float, angular_z: float):
        """
        Chuyển đổi tín hiệu vận tốc linear_x và angular_z từ Twist topic thành hướng di chuyển.
        """
        if linear_x > 0.05:
            if angular_z > 0.1:
                self.turn_left()
            elif angular_z < -0.1:
                self.turn_right()
            else:
                self.move_forward()
        elif linear_x < -0.05:
            self.move_backward()
        else:
            if angular_z > 0.1:
                self.turn_left()
            elif angular_z < -0.1:
                self.turn_right()
            else:
                self.stop()

    def cleanup(self):
        """Dọn dẹp và giải phóng tài nguyên GPIO khi tắt node."""
        self.stop()
        try:
            for dev in [self.left_forward_dev, self.left_backward_dev, self.right_forward_dev, self.right_backward_dev]:
                if dev and hasattr(dev, 'close'):
                    dev.close()
            logger.info("Đã dọn dẹp tài nguyên GPIO MotorController.")
        except Exception as e:
            logger.error(f"Lỗi khi dọn dẹp GPIO: {e}")
