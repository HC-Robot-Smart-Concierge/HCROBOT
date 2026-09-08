import os
import sys
import time
import logging
from typing import Optional

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("MotorController")

# 1. Thử import lgpio (Driver native tốt nhất cho RP1 chip trên Pi 5)
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
    Điều khiển động cơ L298N trên Raspberry Pi 5 theo sơ đồ chân BCM:
    - IN1 (GPIO 17) -> Bánh Phải Tiến
    - IN2 (GPIO 27) -> Bánh Phải Lùi
    - IN3 (GPIO 22) -> Bánh Trái Tiến
    - IN4 (GPIO 23) -> Bánh Trái Lùi
    """

    def __init__(
        self,
        left_forward_pin: int = 22,
        left_backward_pin: int = 23,
        right_forward_pin: int = 17,
        right_backward_pin: int = 27,
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
            self._init_mock("Yêu cầu chế độ Mock (--mock)")
            return

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
        logger.info("ROBOT: TIẾN -> Trái Tiến (22)=ON | Phải Tiến (17)=ON")

    def move_backward(self):
        """Lùi về phía sau."""
        self.left_forward_dev.off()
        self.left_backward_dev.on()
        self.right_forward_dev.off()
        self.right_backward_dev.on()
        logger.info("ROBOT: LÙI -> Trái Lùi (23)=ON | Phải Lùi (27)=ON")

    def turn_left(self, soft: bool = True):
        """Rẽ/Quẹo trái. Mặc định soft=True giúp bẻ lái nhẹ nhàng không bị khựng động cơ do ma sát sàn."""
        if soft:
            self.left_forward_dev.off()
            self.left_backward_dev.off()
            self.right_forward_dev.on()
            self.right_backward_dev.off()
            logger.info("ROBOT: QUẸO TRÁI (A) -> Trái DỪNG | Phải TIẾN (Bẻ lái mượt)")
        else:
            self.left_forward_dev.off()
            self.left_backward_dev.on()
            self.right_forward_dev.on()
            self.right_backward_dev.off()
            logger.info("ROBOT: XOAY TRÁI TẠI CHỖ -> Trái LÙI (23)=ON | Phải TIẾN (17)=ON")

    def turn_right(self, soft: bool = True):
        """Rẽ/Quẹo phải. Mặc định soft=True giúp bẻ lái nhẹ nhàng không bị khựng động cơ do ma sát sàn."""
        if soft:
            self.left_forward_dev.on()
            self.left_backward_dev.off()
            self.right_forward_dev.off()
            self.right_backward_dev.off()
            logger.info("ROBOT: QUẸO PHẢI (D) -> Trái TIẾN | Phải DỪNG (Bẻ lái mượt)")
        else:
            self.left_forward_dev.on()
            self.left_backward_dev.off()
            self.right_forward_dev.off()
            self.right_backward_dev.on()
            logger.info("ROBOT: XOAY PHẢI TẠI CHỖ -> Trái TIẾN (22)=ON | Phải LÙI (27)=ON")

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
        logger.info("ROBOT: DỪNG -> All GPIO OFF")

    def set_drive_cmd(self, linear_x: float, angular_z: float):
        """Chuyển đổi tín hiệu vận tốc Twist / Analog Joystick sang hướng chạy."""
        if linear_x > 0.1:
            if angular_z > 0.2:
                self.turn_left()
            elif angular_z < -0.2:
                self.turn_right()
            else:
                self.move_forward()
        elif linear_x < -0.1:
            self.move_backward()
        else:
            if angular_z > 0.2:
                self.turn_left()
            elif angular_z < -0.2:
                self.turn_right()
            else:
                self.stop()

    def cleanup(self):
        """Tắt toàn bộ động cơ và giải phóng chân GPIO."""
        self.stop()
        for dev in [self.left_forward_dev, self.left_backward_dev, self.right_forward_dev, self.right_backward_dev]:
            if dev and hasattr(dev, 'close'):
                dev.close()
        logger.info("Đã dọn dẹp tài nguyên GPIO an toàn.")


def get_char() -> str:
    """Đọc 1 ký tự từ bàn phím ngay lập tức (hỗ trợ cả WASD và phím mũi tên trên SSH)."""
    try:
        import tty
        import termios
        import select
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            rlist, _, _ = select.select([fd], [], [], 0.05)
            if rlist:
                ch = sys.stdin.read(1)
                if ch == '\x1b': # Xử lý phím Mũi tên (Escape sequence)
                    rlist_seq, _, _ = select.select([fd], [], [], 0.05)
                    if rlist_seq:
                        seq = sys.stdin.read(2)
                        if seq == '[A': return 'w'  # Up arrow -> Forward
                        if seq == '[B': return 's'  # Down arrow -> Backward
                        if seq == '[D': return 'a'  # Left arrow -> Turn left
                        if seq == '[C': return 'd'  # Right arrow -> Turn right
                return ch
            return ''
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    except Exception:
        try:
            import msvcrt
            if msvcrt.kbhit():
                ch = msvcrt.getch().decode('utf-8', errors='ignore')
                if ch == '\xe0' or ch == '\x00':
                    ch2 = msvcrt.getch().decode('utf-8', errors='ignore')
                    if ch2 == 'H': return 'w' # Up
                    if ch2 == 'P': return 's' # Down
                    if ch2 == 'K': return 'a' # Left
                    if ch2 == 'M': return 'd' # Right
                return ch
            return ''
        except Exception:
            return input("\nNhập phím (w/a/s/d/x/q): ").strip()


def run_wasd_controller(controller: MotorController):
    """Vòng lặp điều khiển trực tiếp bằng phím WASD và Phím mũi tên."""
    print("\n" + "=" * 60)
    print("  BỘ ĐIỀU KHIỂN ROBOT RASPBERRY PI 5 (WASD / PHÍM MŨI TÊN)")
    print("=" * 60)
    print("  [W] hoặc [Mũi tên Lên]   : ĐI THẲNG (Forward)")
    print("  [S] hoặc [Mũi tên Xuống] : LÙI (Backward)")
    print("  [A] hoặc [Mũi tên Trái]  : QUẸO TRÁI (Turn Left)")
    print("  [D] hoặc [Mũi tên Phải]  : QUẸO PHẢI (Turn Right)")
    print("  [X] hoặc [Space]         : DỪNG (Stop)")
    print("  [Q]                     : THOÁT (Quit)")
    print("=" * 60)
    print("Bắt đầu bấm phím WASD / Mũi tên để điều khiển ngay...\n")

    try:
        while True:
            char = get_char()
            if not char:
                time.sleep(0.02)
                continue
            key = char.lower()

            if key == 'w':
                controller.move_forward()
            elif key == 's':
                controller.move_backward()
            elif key == 'a':
                controller.turn_left()
            elif key == 'd':
                controller.turn_right()
            elif key in ['x', ' ', '\r', '\n']:
                controller.stop()
            elif key == 'q' or ord(char) == 3:
                print("\nThoát chương trình...")
                break
    except KeyboardInterrupt:
        print("\nĐã ngắt bằng Ctrl+C.")
    finally:
        controller.cleanup()



def run_joystick_controller(controller: MotorController):
    """Vòng lặp điều khiển bằng Tay cầm Gamepad / Joystick vật lý (USB/Bluetooth)."""
    try:
        import pygame
    except ImportError:
        logger.error("Chưa cài thư viện Pygame. Vui lòng cài đặt: pip install pygame")
        print("\n[LỖI] Cần thư viện Pygame để đọc Joystick. Hãy chạy: pip install pygame\n")
        return

    pygame.init()
    pygame.joystick.init()

    if pygame.joystick.get_count() == 0:
        logger.warning("Không tìm thấy tay cầm Joystick/Gamepad kết nối USB/Bluetooth!")
        print("\n[!] Không phát hiện Joystick. Chuyển sang điều khiển bàn phím WASD...\n")
        run_wasd_controller(controller)
        return

    js = pygame.joystick.Joystick(0)
    js.init()
    print("\n" + "=" * 60)
    print(f"  CHẾ ĐỘ ĐIỀU KHIỂN TAY CẦM JOYSTICK: {js.get_name()}")
    print("=" * 60)
    print("  - Cần Analog Trái (Đẩy lên/xuống) : Tiến / Lùi")
    print("  - Cần Analog Trái (Gạt trái/phải) : Rẽ Trái / Rẽ Phải")
    print("  - Nút D-Pad 4 Hướng               : Điều khiển hướng 4 phím")
    print("  - Nhấn Ctrl+C để dừng chương trình")
    print("=" * 60 + "\n")

    try:
        while True:
            pygame.event.pump()
            axis_y = -js.get_axis(1)  # Đảo ngược dấu: Đẩy lên = Tiến (+)
            axis_x = js.get_axis(0)   # Phải = (+), Trái = (-)

            # Deadzone chống trôi cần Analog
            if abs(axis_y) < 0.2:
                axis_y = 0.0
            if abs(axis_x) < 0.2:
                axis_x = 0.0

            # Đọc phím điều hướng D-Pad (Hat) nếu cần Analog ở vị trí nghỉ
            if axis_y == 0.0 and axis_x == 0.0 and js.get_numhats() > 0:
                hat_x, hat_y = js.get_hat(0)
                if hat_y != 0:
                    axis_y = float(hat_y)
                if hat_x != 0:
                    axis_x = float(hat_x)

            controller.set_drive_cmd(linear_x=axis_y, angular_z=-axis_x)
            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\nĐã dừng Joystick.")
    finally:
        controller.cleanup()
        pygame.quit()


def run_udp_server_controller(controller: MotorController, host: str = '0.0.0.0', port: int = 9999):
    """
    Vòng lặp nhận lệnh UDP từ xa từ Laptop qua Tailscale network.
    Có tích hợp Safety Watchdog: Tự động dừng motor nếu mất tín hiệu kết nối > 0.5s.
    """
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind((host, port))
        sock.settimeout(0.1)
    except Exception as e:
        logger.error(f"Không thể khởi chạy UDP Server tại {host}:{port}: {e}")
        return

    print("\n" + "=" * 60)
    print(f"  UDP REMOTE CONTROL SERVER ĐANG CHẠY TẠI PORT {port}")
    print("=" * 60)
    print("  Đang lắng nghe lệnh di chuyển từ Laptop qua Tailscale IP...")
    print("  Tự động dừng an toàn khi mất tín hiệu > 0.5 giây.")
    print("  Nhấn Ctrl+C để dừng Server.")
    print("=" * 60 + "\n")

    last_cmd_time = time.time()
    active_cmd = "stop"

    try:
        while True:
            try:
                data, addr = sock.recvfrom(1024)
                cmd = data.decode('utf-8', errors='ignore').strip().lower()
                if cmd:
                    last_cmd_time = time.time()
                    if cmd != active_cmd:
                        active_cmd = cmd
                        if cmd == 'w':
                            controller.move_forward()
                        elif cmd == 's':
                            controller.move_backward()
                        elif cmd == 'a':
                            controller.turn_left()
                        elif cmd == 'd':
                            controller.turn_right()
                        elif cmd in ['x', 'stop']:
                            controller.stop()
            except socket.timeout:
                pass

            # Safety Watchdog: Tự động ngắt động cơ nếu ngắt kết nối > 0.5s
            if active_cmd != "stop" and (time.time() - last_cmd_time > 0.5):
                logger.warning("Safety Watchdog: Mất tín hiệu truyền lệnh > 0.5s -> DỪNG ĐỘNG CƠ")
                controller.stop()
                active_cmd = "stop"

            time.sleep(0.02)
    except KeyboardInterrupt:
        print("\nĐã dừng UDP Remote Server.")
    finally:
        controller.cleanup()
        sock.close()


def load_config() -> dict:
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(curr_dir, 'settings.yaml')
    if os.path.exists(path):
        try:
            import yaml
            with open(path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except Exception:
            pass
    return {}


def main():
    config = load_config()
    gpio_cfg = config.get('robot', {}).get('gpio', {})

    left_forward = gpio_cfg.get('left_forward', 22)
    left_backward = gpio_cfg.get('left_backward', 23)
    right_forward = gpio_cfg.get('right_forward', 17)
    right_backward = gpio_cfg.get('right_backward', 27)

    force_mock = '--mock' in sys.argv
    controller = MotorController(
        left_forward_pin=left_forward,
        left_backward_pin=left_backward,
        right_forward_pin=right_forward,
        right_backward_pin=right_backward,
        force_mock=force_mock
    )

    if '--remote' in sys.argv or '-r' in sys.argv or '--server' in sys.argv:
        port = 9999
        for arg in sys.argv:
            if arg.startswith('--port='):
                try:
                    port = int(arg.split('=')[1])
                except ValueError:
                    pass
        run_udp_server_controller(controller, port=port)
    elif '--joy' in sys.argv or '-j' in sys.argv:
        run_joystick_controller(controller)
    else:
        run_wasd_controller(controller)


if __name__ == '__main__':
    main()

