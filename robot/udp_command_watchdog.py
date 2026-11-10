"""Watchdog lenh UDP cho main.py tren Pi: dung motor khi mat lenh dieu khien.

Bridge laptop (lidar_ws_to_ros2.py), laptop_teleop_wasd.py deu gui lai lenh chay moi
~0.1 s. Neu laptop treo, mat mang, hoac script bi tat truoc khi kip gui "stop" thi
lenh cuoi (vd "drive:39:39") se duoc giu mai -> xe chay mat kiem soat. Watchdog nay
dung xe sau `timeout` giay khong co lenh chay moi.
"""


def is_stop_command(cmd: str) -> bool:
    cmd = cmd.strip().lower()
    if cmd in ("stop", "x", ""):
        return True
    if cmd.startswith("drive:"):
        parts = cmd.split(":")
        try:
            return int(float(parts[1])) == 0 and int(float(parts[2])) == 0
        except (IndexError, ValueError):
            return False
    return False


class UdpCommandWatchdog:
    def __init__(self, timeout: float = 1.0):
        self.timeout = float(timeout)
        self.active = False
        self.last_cmd = 0.0

    def on_command(self, cmd: str, now: float) -> None:
        cmd = cmd.strip().lower()
        if cmd.startswith("speed:") or cmd.startswith("speed_"):
            return  # chi doi muc PWM, khong phai lenh chay
        if is_stop_command(cmd):
            self.active = False
        else:
            self.active = True
            self.last_cmd = now

    def should_stop(self, now: float) -> bool:
        if self.timeout <= 0 or not self.active:
            return False
        if now - self.last_cmd > self.timeout:
            self.active = False
            return True
        return False
