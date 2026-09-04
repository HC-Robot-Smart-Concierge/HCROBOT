import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Tự động phát hiện gpiozero trên Raspberry Pi
try:
    from gpiozero import DigitalOutputDevice
    HAS_GPIOZERO = True
except (ImportError, Exception):
    HAS_GPIOZERO = False


class MockDigitalOutputDevice:
    """Device giả lập khi chạy thử trên PC/Laptop không có chân GPIO."""
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
    Điều khiển 2 mạch L298N trên Raspberry Pi 5:
    - Mạch 1 (Trái): Tiến = GPIO 17 (IN1+IN3), Lùi = GPIO 27 (IN2+IN4)
    - Mạch 2 (Phải): Tiến = GPIO 22 (IN1+IN3), Lùi = GPIO 23 (IN2+IN4)
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

        self._init_devices()

    def _init_devices(self):
        try:
            if not self.is_mock:
                self.left_forward_dev = DigitalOutputDevice(self.left_forward_pin)
                self.left_backward_dev = DigitalOutputDevice(self.left_backward_pin)
                self.right_forward_dev = DigitalOutputDevice(self.right_forward_pin)
                self.right_backward_dev = DigitalOutputDevice(self.right_backward_pin)
                logger.info("MotorController khởi chạy thành công trên phần cứng GPIO Pi 5.")
            else:
                self._init_mock()
        except Exception as e:
            logger.warning(f"Không nhận diện được GPIO hardware ({e}). Chuyển sang MOCK Mode.")
            self.is_mock = True
            self._init_mock()

    def _init_mock(self):
        self.left_forward_dev = MockDigitalOutputDevice(self.left_forward_pin)
        self.left_backward_dev = MockDigitalOutputDevice(self.left_backward_pin)
        self.right_forward_dev = MockDigitalOutputDevice(self.right_forward_pin)
        self.right_backward_dev = MockDigitalOutputDevice(self.right_backward_pin)
        logger.info("MotorController chạy ở chế độ MOCK (Giả lập).")

    def move_forward(self):
        """Tiến về phía trước."""
        self.left_forward_dev.on()
        self.left_backward_dev.off()
        self.right_forward_dev.on()
        self.right_backward_dev.off()
        logger.info("ROBOT: TIẾN (FORWARD)")

    def move_backward(self):
        """Lùi về phía sau."""
        self.left_forward_dev.off()
        self.left_backward_dev.on()
        self.right_forward_dev.off()
        self.right_backward_dev.on()
        logger.info("ROBOT: LÙI (BACKWARD)")

    def turn_left(self):
        """Rẽ trái."""
        self.left_forward_dev.off()
        self.left_backward_dev.on()
        self.right_forward_dev.on()
        self.right_backward_dev.off()
        logger.info("ROBOT: RẼ TRÁI (LEFT)")

    def turn_right(self):
        """Rẽ phải."""
        self.left_forward_dev.on()
        self.left_backward_dev.off()
        self.right_forward_dev.off()
        self.right_backward_dev.on()
        logger.info("ROBOT: RẼ PHẢI (RIGHT)")

    def stop(self):
        """Dừng tất cả động cơ."""
        if self.left_forward_dev:
            self.left_forward_dev.off()
        if self.left_backward_dev:
            self.left_backward_dev.off()
        if self.right_forward_dev:
            self.right_forward_dev.off()
        if self.right_backward_dev:
            self.right_backward_dev.off()
        logger.info("ROBOT: DỪNG (STOP)")

    def set_drive_cmd(self, linear_x: float, angular_z: float):
        """Chuyển đổi tín hiệu vận tốc Twist sang hướng chạy."""
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
        """Tắt toàn bộ động cơ và giải phóng chân GPIO."""
        self.stop()
        for dev in [self.left_forward_dev, self.left_backward_dev, self.right_forward_dev, self.right_backward_dev]:
            if dev and hasattr(dev, 'close'):
                dev.close()
        logger.info("Đã dọn dẹp tài nguyên GPIO.")
