#!/usr/bin/env python3
"""Lai xe bang phim W A S D trong terminal, publish geometry_msgs/Twist len /cmd_vel.

Dung cho mo phong (start_sim_foxglove.sh) hoac xe that (start_wsl_slam.sh).
Giu phim de chay, nha phim ~0.5 s thi xe tu dung.

  python3 robot/ros2_configs/wasd_teleop.py
  python3 robot/ros2_configs/wasd_teleop.py --ros-args -p linear:=0.15 -p angular:=0.4
"""

import select
import sys
import termios
import time
import tty

HELP = """
==============  LAI XE BANG WASD  ==============
   W : tien          Q : tien + quay trai
   S : lui           E : tien + quay phai
   A : quay trai     SPACE : dung ngay
   D : quay phai     + / - : tang / giam toc do
   Ctrl+C : thoat
Giu phim de chay, nha phim thi xe tu dung.
================================================
"""

# phim -> (huong tien/lui, huong quay)
KEY_DIRECTIONS = {
    "w": (1.0, 0.0),
    "s": (-1.0, 0.0),
    "a": (0.0, 1.0),
    "d": (0.0, -1.0),
    "q": (1.0, 1.0),
    "e": (1.0, -1.0),
}


def key_to_velocity(key, linear, angular):
    """Tra ve (v, w) cho phim lai, hoac None neu khong phai phim lai xe."""
    direction = KEY_DIRECTIONS.get(key.lower())
    if direction is None:
        return None
    return (direction[0] * linear, direction[1] * angular)


def scale_speed(linear, angular, key, factor=1.2, max_linear=0.5, max_angular=1.5):
    """+ / - doi toc do, gioi han de xe khong lat."""
    if key in ("+", "="):
        return (min(linear * factor, max_linear), min(angular * factor, max_angular))
    if key in ("-", "_"):
        return (max(linear / factor, 0.05), max(angular / factor, 0.1))
    return (linear, angular)


def main():
    import rclpy
    from geometry_msgs.msg import Twist

    rclpy.init(args=sys.argv)
    node = rclpy.create_node("wasd_teleop")
    linear = float(node.declare_parameter("linear", 0.2).value)
    angular = float(node.declare_parameter("angular", 0.5).value)
    hold_timeout = float(node.declare_parameter("hold_timeout", 0.5).value)
    topic = str(node.declare_parameter("topic", "/cmd_vel").value)
    pub = node.create_publisher(Twist, topic, 10)

    def publish(v, w):
        msg = Twist()
        msg.linear.x = float(v)
        msg.angular.z = float(w)
        pub.publish(msg)

    print(HELP)
    print(f"Topic: {topic} | toc do: {linear:.2f} m/s, quay {angular:.2f} rad/s")

    old_attrs = termios.tcgetattr(sys.stdin)
    current = (0.0, 0.0)
    last_key_time = 0.0
    stop_burst = 0
    try:
        tty.setcbreak(sys.stdin.fileno())
        while rclpy.ok():
            ready, _, _ = select.select([sys.stdin], [], [], 0.1)
            if ready:
                key = sys.stdin.read(1)
                if key == "\x03":
                    break
                if key == " ":
                    current = (0.0, 0.0)
                    stop_burst = 3
                elif key in "+=-_":
                    linear, angular = scale_speed(linear, angular, key)
                    print(f"\rToc do: {linear:.2f} m/s, quay {angular:.2f} rad/s   ", end="", flush=True)
                else:
                    vel = key_to_velocity(key, linear, angular)
                    if vel is not None:
                        current = vel
                        last_key_time = time.monotonic()
            if current != (0.0, 0.0) and time.monotonic() - last_key_time > hold_timeout:
                current = (0.0, 0.0)
            # Chi publish khi dang lai, va vai lenh dung luc vua nha phim. Khong spam (0,0)
            # khi ranh, de khong de len Teleop cua Foxglove/Gazebo hay Nav2.
            if current != (0.0, 0.0):
                stop_burst = 3
                publish(*current)
            elif stop_burst > 0:
                stop_burst -= 1
                publish(0.0, 0.0)
    except KeyboardInterrupt:
        pass
    finally:
        publish(0.0, 0.0)
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_attrs)
        node.destroy_node()
        rclpy.shutdown()
        print("\nDa dung xe.")


if __name__ == "__main__":
    main()
