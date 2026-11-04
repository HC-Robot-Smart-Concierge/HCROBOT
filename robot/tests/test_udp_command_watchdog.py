import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from udp_command_watchdog import UdpCommandWatchdog  # noqa: E402


def test_stops_motor_when_commands_stop_arriving():
    wd = UdpCommandWatchdog(timeout=1.0)
    wd.on_command("drive:39:39", now=10.0)
    assert not wd.should_stop(now=10.9)
    assert wd.should_stop(now=11.1)
    assert not wd.should_stop(now=12.0)  # chi dung 1 lan


def test_heartbeat_keeps_robot_moving():
    wd = UdpCommandWatchdog(timeout=1.0)
    for i in range(30):  # gui lai moi 0.1 s nhu bridge / laptop_teleop_wasd
        wd.on_command("forward", now=i * 0.1)
        assert not wd.should_stop(now=i * 0.1 + 0.05)


def test_stop_and_zero_drive_disarm():
    wd = UdpCommandWatchdog(timeout=1.0)
    wd.on_command("left", now=0.0)
    wd.on_command("stop", now=0.2)
    assert not wd.should_stop(now=5.0)
    wd.on_command("drive:30:30", now=6.0)
    wd.on_command("drive:0:0", now=6.1)
    assert not wd.should_stop(now=9.0)


def test_speed_setting_is_not_a_motion_command():
    wd = UdpCommandWatchdog(timeout=1.0)
    wd.on_command("forward", now=0.0)
    wd.on_command("speed:30", now=0.9)  # chi doi PWM, khong tinh la lenh chay moi
    assert wd.should_stop(now=1.05)


def test_disabled_when_timeout_zero():
    wd = UdpCommandWatchdog(timeout=0.0)
    wd.on_command("forward", now=0.0)
    assert not wd.should_stop(now=100.0)
