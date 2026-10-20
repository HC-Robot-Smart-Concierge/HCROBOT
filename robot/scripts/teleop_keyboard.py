#!/usr/bin/env python3
"""
Bộ điều khiển Robot bằng bàn phím qua Terminal cho HCROBOT.
Tích hợp phát topic ROS 2 /cmd_vel và gửi UDP trực tiếp tới Pi 5 (port 9999).
Hiển thị phản hồi Real-time trên RViz2 và di chuyển robot thực tế.
"""

import sys
import os
import time
import socket
import select
import termios
import tty

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist


BANNER = """
==================================================================
 🤖 HCROBOT - TERMINAL TELEOP CONTROLLER (REALTIME RVIZ & PI 5)
==================================================================
                 [ W ] : Tiến thẳng (Forward)
   [ Q ] : Rẽ trái           [ E ] : Rẽ phải
   [ A ] : Xoay trái         [ D ] : Xoay phải
                 [ S ] : Lùi lại (Backward)

   [ SPACE ] hoặc [ X ] : DỪNG PHANH KHẨN CẤP
   [ + ] / [ - ]        : Tăng / Giảm tốc độ tuyến tính (linear)
   [ ] ] / [ [ ]        : Tăng / Giảm tốc độ góc (angular)
   [ CTRL + C ]         : Thoát chương trình
==================================================================
"""

PI5_IP = os.getenv("PI5_IP", "100.99.72.51")
PI5_PORT = int(os.getenv("PI5_PORT", "9999"))


class KeyboardTeleopNode(Node):
    def __init__(self):
        super().__init__('keyboard_teleop_node')
        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        # Tốc độ mặc định
        self.linear_speed = 0.35   # m/s
        self.angular_speed = 1.2   # rad/s

        self.get_logger().info("✅ Node Teleop đã sẵn sàng. Topic: /cmd_vel, UDP: %s:%d" % (PI5_IP, PI5_PORT))

    def publish_twist(self, vx: float, wz: float, motion_name: str = ""):
        msg = Twist()
        msg.linear.x = float(vx)
        msg.angular.z = float(wz)
        self.cmd_vel_pub.publish(msg)

        # Bắn UDP đồng thời sang Pi 5
        if motion_name:
            try:
                self.udp_sock.sendto(motion_name.encode('utf-8'), (PI5_IP, PI5_PORT))
            except Exception:
                pass


def get_key(settings, timeout=0.08):
    tty.setraw(sys.stdin.fileno())
    rlist, _, _ = select.select([sys.stdin], [], [], timeout)
    if rlist:
        key = sys.stdin.read(1)
    else:
        key = ''
    termios.tcsetattr(sys.stdin, termios.TCSADRAIN, settings)
    return key


def main():
    settings = termios.tcgetattr(sys.stdin)
    rclpy.init()
    node = KeyboardTeleopNode()

    print(BANNER)

    curr_motion = "stop"
    last_print = 0.0

    try:
        while rclpy.ok():
            key = get_key(settings, timeout=0.08)
            k = key.lower()

            vx = 0.0
            wz = 0.0
            motion = "stop"

            if k == 'w':
                vx = node.linear_speed
                wz = 0.0
                motion = "forward"
            elif k == 's':
                vx = -node.linear_speed
                wz = 0.0
                motion = "backward"
            elif k == 'a':
                vx = 0.0
                wz = node.angular_speed
                motion = "left"
            elif k == 'd':
                vx = 0.0
                wz = -node.angular_speed
                motion = "right"
            elif k == 'q':
                vx = node.linear_speed * 0.7
                wz = node.angular_speed * 0.7
                motion = "forward_left"
            elif k == 'e':
                vx = node.linear_speed * 0.7
                wz = -node.angular_speed * 0.7
                motion = "forward_right"
            elif k in (' ', 'x'):
                vx = 0.0
                wz = 0.0
                motion = "stop"
            elif k in ('+', '='):
                node.linear_speed = min(1.0, round(node.linear_speed + 0.05, 2))
                print(f"\r⚡ Tốc độ tiến/lùi: {node.linear_speed:.2f} m/s           ", end="")
                continue
            elif k in ('-', '_'):
                node.linear_speed = max(0.1, round(node.linear_speed - 0.05, 2))
                print(f"\r⚡ Tốc độ tiến/lùi: {node.linear_speed:.2f} m/s           ", end="")
                continue
            elif k == ']':
                node.angular_speed = min(3.0, round(node.angular_speed + 0.1, 2))
                print(f"\r⚡ Tốc độ xoay: {node.angular_speed:.2f} rad/s           ", end="")
                continue
            elif k == '[':
                node.angular_speed = max(0.2, round(node.angular_speed - 0.1, 2))
                print(f"\r⚡ Tốc độ xoay: {node.angular_speed:.2f} rad/s           ", end="")
                continue
            elif k == '\x03' or k == '\x1b':  # Ctrl+C or ESC
                break

            if motion != "stop" or curr_motion != "stop":
                node.publish_twist(vx, wz, motion)
                curr_motion = motion

            now = time.monotonic()
            if now - last_print > 0.15:
                last_print = now
                status_icon = "🛑 DỪNG" if motion == "stop" else f"🚀 ĐANG CHẠY [{motion.upper()}] (v={vx:.2f}m/s, w={wz:.2f}rad/s)"
                print(f"\r>> Trạng thái: {status_icon}               ", end="", flush=True)

    except Exception as e:
        print(f"\nLỗi: {e}")
    finally:
        # Dừng xe khi thoát
        node.publish_twist(0.0, 0.0, "stop")
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, settings)
        print("\n\n🛑 Đã ngắt điều khiển. Robot đã phanh dừng an toàn.")
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
