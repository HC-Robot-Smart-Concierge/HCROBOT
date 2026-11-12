import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ros2_configs"))

from sim_cmd_watchdog import CmdWatchdog  # noqa: E402


def test_stops_once_after_timeout_without_new_command():
    wd = CmdWatchdog(timeout=0.5)
    wd.on_cmd(0.2, 0.0, now=10.0)
    assert not wd.should_stop(now=10.4)
    assert wd.should_stop(now=10.6)
    # Da gui lenh dung roi thi khong gui lap lai (khong de len Teleop/Nav2)
    assert not wd.should_stop(now=11.0)


def test_continuous_commands_keep_robot_moving():
    wd = CmdWatchdog(timeout=0.5)
    for i in range(20):  # 10 Hz trong 2 s
        wd.on_cmd(0.2, 0.0, now=i * 0.1)
        assert not wd.should_stop(now=i * 0.1 + 0.05)


def test_explicit_zero_command_needs_no_stop():
    wd = CmdWatchdog(timeout=0.5)
    wd.on_cmd(0.0, 0.5, now=0.0)
    wd.on_cmd(0.0, 0.0, now=0.2)  # nguoi lai tu gui lenh dung
    assert not wd.should_stop(now=5.0)


def test_rotation_only_counts_as_moving():
    wd = CmdWatchdog(timeout=0.5)
    wd.on_cmd(0.0, -0.8, now=1.0)
    assert wd.should_stop(now=1.6)


def test_own_zero_echo_does_not_rearm():
    wd = CmdWatchdog(timeout=0.5)
    wd.on_cmd(0.2, 0.0, now=0.0)
    assert wd.should_stop(now=0.6)
    wd.on_cmd(0.0, 0.0, now=0.61)  # chinh lenh dung cua watchdog vong lai
    assert not wd.should_stop(now=2.0)
    wd.on_cmd(0.1, 0.0, now=3.0)  # lenh moi -> canh lai tu dau
    assert wd.should_stop(now=3.6)
