import math
import pytest


def calculate_differential_displacement(
    left_ticks_delta: float,
    right_ticks_delta: float,
    cpr: float = 330.0,
    wheel_radius: float = 0.033,
    wheel_base: float = 0.22,
):
    """Kinematic test utility reproducing OdomEncoderNode calculations."""
    dist_per_tick = (2.0 * math.pi * wheel_radius) / cpr
    delta_left_m = left_ticks_delta * dist_per_tick
    delta_right_m = right_ticks_delta * dist_per_tick

    delta_s = (delta_right_m + delta_left_m) / 2.0
    delta_theta = (delta_right_m - delta_left_m) / wheel_base
    return delta_s, delta_theta


def test_straight_forward_motion():
    """When both sides rotate identically forward, delta_s > 0 and delta_theta == 0."""
    delta_s, delta_theta = calculate_differential_displacement(
        left_ticks_delta=330.0,
        right_ticks_delta=330.0,
        cpr=330.0,
        wheel_radius=0.033,
        wheel_base=0.22,
    )
    expected_dist = 2.0 * math.pi * 0.033  # ~0.2073m
    assert math.isclose(delta_s, expected_dist, rel_tol=1e-3)
    assert math.isclose(delta_theta, 0.0, abs_tol=1e-6)


def test_pure_rotation_in_place():
    """When left wheels reverse and right wheels go forward with same ticks, delta_s == 0."""
    delta_s, delta_theta = calculate_differential_displacement(
        left_ticks_delta=-165.0,
        right_ticks_delta=165.0,
        cpr=330.0,
        wheel_radius=0.033,
        wheel_base=0.22,
    )
    assert math.isclose(delta_s, 0.0, abs_tol=1e-6)
    assert delta_theta > 0.0


import os
import sys

# Ensure package directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def test_euler_to_quaternion_math():
    """Verify yaw conversion to quaternion components without requiring ROS 2 binary."""
    def euler_to_quat(yaw: float):
        return {
            'x': 0.0,
            'y': 0.0,
            'z': math.sin(yaw / 2.0),
            'w': math.cos(yaw / 2.0),
        }

    q = euler_to_quat(0.0)
    assert q['x'] == 0.0 and q['y'] == 0.0 and q['z'] == 0.0 and q['w'] == 1.0

    q_90 = euler_to_quat(math.pi / 2.0)
    assert math.isclose(q_90['w'], math.cos(math.pi / 4.0), abs_tol=1e-4)
    assert math.isclose(q_90['z'], math.sin(math.pi / 4.0), abs_tol=1e-4)

