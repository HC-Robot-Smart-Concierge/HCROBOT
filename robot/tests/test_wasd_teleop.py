import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ros2_configs"))

termios = pytest.importorskip("termios")  # chi chay tren Linux/WSL
from wasd_teleop import key_to_velocity, scale_speed  # noqa: E402


def test_wasd_maps_to_forward_back_and_turn():
    assert key_to_velocity("w", 0.2, 0.5) == (0.2, 0.0)
    assert key_to_velocity("s", 0.2, 0.5) == (-0.2, 0.0)
    assert key_to_velocity("a", 0.2, 0.5) == (0.0, 0.5)
    assert key_to_velocity("d", 0.2, 0.5) == (0.0, -0.5)


def test_uppercase_works_and_other_keys_ignored():
    assert key_to_velocity("W", 0.2, 0.5) == (0.2, 0.0)
    assert key_to_velocity("x", 0.2, 0.5) is None


def test_speed_scaling_is_clamped():
    lin, ang = 0.45, 1.4
    for _ in range(10):
        lin, ang = scale_speed(lin, ang, "+")
    assert (lin, ang) == (0.5, 1.5)
    for _ in range(50):
        lin, ang = scale_speed(lin, ang, "-")
    assert (lin, ang) == (0.05, 0.1)
