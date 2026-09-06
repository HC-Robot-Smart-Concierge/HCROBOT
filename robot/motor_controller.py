import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 1. Thử import lgpio (Thư viện chuẩn nhất cho Raspberry Pi 5 / RP1 chip)
HAS_LGPIO = False
try:
    import lgpio
    HAS_LGPIO = True
except ImportError:
    HAS_LGPIO = False

# 2. Thử import gpiozero
HAS_GPIOZERO = False
try:
    from gpiozero import DigitalOutputDevice
    HAS_GPIOZERO = True
except (ImportError, Exception):
    HAS_GPIOZERO = False


class LGPIOOutputDevice:
    """Điều khiển trực tiếp chân GPIO trên Raspberry Pi 5 bằng lgpio (trực tiếp qua RP1 chip)."""
    def __init__(self, pin: int):
        self.pin = pin
        self.handle = None
        # Trên Pi 5, RP1 GPIO chip thường là chip 4, trên một số bản OS khác là chip 0
        for chip_num in [4, 0]:
            try:
                h = lgpio.gpiochip_open(chip_num)
                lgpio.gpio_claim_output(h, self.pin, 0)
                self.handle = h
                self.chip_num = chip_num
                break
            except Exception:
                if self.handle is not None:
                    try:
                        lgpio.gpiochip_close(self.handle)
                    except Exception:
                        pass
                self.handle = None

        if self.handle is None:
            raise RuntimeError(f"Không mở được GPIO {self.pin} bằng lgpio qua chip 4 hoặc 0.")

        self.value = 0

    def on(self):
        if self.handle is not None:
            lgpio.gpio_write(self.handle, self.pin, 1)
            self.value = 1

    def off(self):
        if self.handle is not None:
            lgpio.gpio_write(self.handle, self.pin, 0)
            self.value = 0

    def close(self):
        if self.handle is not None:
            try:
                self.off()
                lgpio.gpio_free(self.handle, self.pin)
                lgpio.gpiochip_close(self.handle)
            except Exception:
                pass
            self.handle = None

    @property
    def is_active(self) -> bool:
        return self.value == 1


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
        self.is_mock = force_mock

        self.left_forward_dev = None
        self.left_backward_dev = None
        self.right_forward_dev = None
        self.right_backward_dev = None

        self._init_devices()

    def _init_devices(self):
        if self.is_mock:
            self._init_mock("Yêu cầu chế độ Mock cưỡng chế (--mock)")
            return

        # 1. Thử dùng LGPIO (Ưu tiên số 1 cho Pi 5)
        if HAS_LGPIO:
            try:
                self.left_forward_dev = LGPIOOutputDevice(self.left_forward_pin)
                self.left_backward_dev = LGPIOOutputDevice(self.left_backward_pin)
                self.right_forward_dev = LGPIOOutputDevice(self.right_forward_pin)
                self.right_backward_dev = LGPIOOutputDevice(self.right_backward_pin)
                logger.info("MotorController khởi chạy THÀNH CÔNG trên Raspberry Pi 5 (Native lgpio RP1 Driver).")
                return
            except Exception as e:
                logger.warning(f"Thử LGPIO thất bại: {e}")

        # 2. Thử dùng gpiozero
        if HAS_GPIOZERO:
            try:
                self.left_forward_dev = DigitalOutputDevice(self.left_forward_pin)
                self.left_backward_dev = DigitalOutputDevice(self.left_backward_pin)
                self.right_forward_dev = DigitalOutputDevice(self.right_forward_pin)
                self.right_backward_dev = DigitalOutputDevice(self.right_backward_pin)
                logger.info("MotorController khởi chạy THÀNH CÔNG với gpiozero.")
                return
            except Exception as e:
                logger.warning(f"Thử gpiozero thất bại: {e}")

        # 3. Fallback Mock
        self._init_mock("Không kết nối được thư viện GPIO (lgpio/gpiozero)")

    def _init_mock(self, reason: str = ""):
        self.is_mock = True
        self.left_forward_dev = MockDigitalOutputDevice(self.left_forward_pin)
        self.left_backward_dev = MockDigitalOutputDevice(self.left_backward_pin)
        self.right_forward_dev = MockDigitalOutputDevice(self.right_forward_pin)
        self.right_backward_dev = MockDigitalOutputDevice(self.right_backward_pin)
        logger.info(f"MotorController chạy ở chế độ MOCK (Giả lập). Lý do: {reason}")

    def move_forward(self):
        """Tiến về phía trước."""
        self.left_forward_dev.on()
        self.left_backward_dev.off()
        self.right_forward_dev.on()
        self.right_backward_dev.off()
        logger.info("ROBOT: TIẾN (FORWARD) -> GPIO 17=ON, 27=OFF, 22=ON, 23=OFF")

    def move_backward(self):
        """Lùi về phía sau."""
        self.left_forward_dev.off()
        self.left_backward_dev.on()
        self.right_forward_dev.off()
        self.right_backward_dev.on()
        logger.info("ROBOT: LÙI (BACKWARD) -> GPIO 17=OFF, 27=ON, 22=OFF, 23=ON")

    def turn_left(self):
        """Rẽ trái."""
        self.left_forward_dev.off()
        self.left_backward_dev.on()
        self.right_forward_dev.on()
        self.right_backward_dev.off()
        logger.info("ROBOT: RẼ TRÁI (LEFT) -> GPIO 17=OFF, 27=ON, 22=ON, 23=OFF")

    def turn_right(self):
        """Rẽ phải."""
        self.left_forward_dev.on()
        self.left_backward_dev.off()
        self.right_forward_dev.off()
        self.right_backward_dev.on()
        logger.info("ROBOT: RẼ PHẢI (RIGHT) -> GPIO 17=ON, 27=OFF, 22=OFF, 23=ON")

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
        logger.info("ROBOT: DỪNG (STOP) -> All GPIO OFF")

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
