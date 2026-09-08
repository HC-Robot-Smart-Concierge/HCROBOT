import sys
import time
import socket
import logging

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("LaptopTeleop")


def get_key_nonblocking() -> str:
    """Đọc 1 phím từ bàn phím không chặn (Non-blocking keyboard read)."""
    try:
        import msvcrt
        if msvcrt.kbhit():
            ch = msvcrt.getch().decode('utf-8', errors='ignore')
            return ch.lower()
        return ''
    except ImportError:
        pass

    try:
        import select
        import tty
        import termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            rlist, _, _ = select.select([fd], [], [], 0.05)
            if rlist:
                ch = sys.stdin.read(1)
                return ch.lower()
            return ''
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    except Exception:
        return ''


def main():
    target_host = "phuc.taila9018b.ts.net"
    if len(sys.argv) > 1 and not sys.argv[1].startswith('--'):
        target_host = sys.argv[1]

    port = 9999
    for arg in sys.argv:
        if arg.startswith('--port='):
            try:
                port = int(arg.split('=')[1])
            except ValueError:
                pass

    print("\n" + "=" * 60)
    print(f"  LAPTOP REMOTE WASD CONTROLLER -> PI 5 ({target_host}:{port})")
    print("=" * 60)
    print("  [W] : ĐI THẲNG (Forward)")
    print("  [S] : LÙI (Backward)")
    print("  [A] : QUẸO TRÁI (Turn Left)")
    print("  [D] : QUẸO PHẢI (Turn Right)")
    print("  [X] hoặc [Space] : DỪNG (Stop)")
    print("  [Q] : THOÁT (Quit)")
    print("=" * 60)
    print("Nhấn phím WASD để gửi lệnh trực tiếp sang Pi 5 qua Tailscale...\n")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    current_cmd = "stop"
    last_sent_time = 0

    try:
        while True:
            key = get_key_nonblocking()
            if key:
                if key == 'w':
                    current_cmd = 'w'
                elif key == 's':
                    current_cmd = 's'
                elif key == 'a':
                    current_cmd = 'a'
                elif key == 'd':
                    current_cmd = 'd'
                elif key in ['x', ' ']:
                    current_cmd = 'stop'
                elif key == 'q' or ord(key) == 3:
                    print("\nĐã thoát bộ điều khiển Laptop.")
                    sock.sendto(b"stop", (target_host, port))
                    break

            # Gửi tín hiệu Heartbeat/Command mỗi 100ms
            now = time.time()
            if now - last_sent_time >= 0.1:
                sock.sendto(current_cmd.encode('utf-8'), (target_host, port))
                last_sent_time = now

            time.sleep(0.02)
    except KeyboardInterrupt:
        print("\nĐã dừng Laptop Teleop.")
    finally:
        try:
            sock.sendto(b"stop", (target_host, port))
            sock.close()
        except Exception:
            pass


if __name__ == '__main__':
    main()
