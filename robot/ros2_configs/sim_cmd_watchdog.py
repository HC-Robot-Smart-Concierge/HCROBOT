#!/usr/bin/env python3
"""Watchdog lenh van toc cho xe MO PHONG, giong watchdog 0.5 s cua xe that.

Plugin DiffDrive cua Gazebo giu mai lenh /cmd_vel cuoi cung: nha nut Teleop
(Foxglove/Gazebo chi ngung gui, khong gui lenh 0) thi xe ao van chay tiep -> trong
nhu "quan tinh". Xe that thi motor_controller tu dung khi mat lenh > 0.5 s.

Node nay nghe thang topic Gazebo /cmd_vel (bat ca lenh tu ROS bridge, Nav2,
Foxglove lan Teleop trong cua so Gazebo); im lang qua `timeout` giay ma xe dang
duoc lenh chay thi gui 1 lenh dung.

  python3 robot/ros2_configs/sim_cmd_watchdog.py            # timeout 0.5 s
  python3 robot/ros2_configs/sim_cmd_watchdog.py --timeout 0.3
"""

import argparse
import threading
import time

EPS = 1e-4


class CmdWatchdog:
    """Logic thuan (khong phu thuoc Gazebo) de test duoc."""

    def __init__(self, timeout=0.5):
        self.timeout = float(timeout)
        self.moving = False
        self.last_active = 0.0

    def on_cmd(self, vx, wz, now):
        if abs(vx) > EPS or abs(wz) > EPS:
            self.moving = True
            self.last_active = now
        else:
            # Lenh dung (tu nguoi lai hoac chinh watchdog vong lai): khong can canh nua.
            self.moving = False

    def should_stop(self, now):
        if self.moving and now - self.last_active > self.timeout:
            self.moving = False
            return True
        return False


def main():
    from gz.msgs10.twist_pb2 import Twist
    from gz.transport13 import Node

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--topic", default="/cmd_vel")
    parser.add_argument("--timeout", type=float, default=0.5)
    args = parser.parse_args()

    wd = CmdWatchdog(args.timeout)
    lock = threading.Lock()

    def on_twist(msg):
        with lock:
            wd.on_cmd(msg.linear.x, msg.angular.z, time.monotonic())

    node = Node()
    pub = node.advertise(args.topic, Twist)
    if not node.subscribe(Twist, args.topic, on_twist):
        raise SystemExit(f"Khong subscribe duoc {args.topic}")
    print(f">> Watchdog {args.topic}: mat lenh > {args.timeout:.2f}s thi dung xe ao", flush=True)

    try:
        while True:
            time.sleep(0.05)
            with lock:
                stop = wd.should_stop(time.monotonic())
            if stop:
                pub.publish(Twist())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
