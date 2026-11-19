"""Run actual encoder integration methods without ROS, serial, or motor access."""
import ast
import math
from pathlib import Path
import sys
import threading
import time
from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ros2_configs'))
from encoder_guard import EncoderSampleGuard

WHEEL_CIRCUMFERENCE = math.pi * .065


def method(path, class_name, name):
    tree = ast.parse(path.read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == class_name)
    fn = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == name)
    env = {'math': math, 'time': time, 'Dict': dict, 'Any': object}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), str(path), 'exec'), env)
    return env[name]


def bridge():
    node = NS(last_encoder_sample_id=None, encoder_packets=0,
              last_encoder_publish_time=time.monotonic() + 100,
              encoder_signs=dict.fromkeys(('m1', 'm2', 'm3', 'm4'), 1),
              gyro_sign=1, imu_seen=False, desired_motion='forward',
              _pose_lock=threading.RLock(), has_prev_encoder_ticks=False,
              encoder_guard=EncoderSampleGuard(), encoder_fault_cancelled=False,
              encoder_motion_detected=False, wheel_radius=.0325, encoder_cpr=330,
              yaw_track=.17,
              gyro_bias_dps=0, gyro_bias_alpha=.02, gyro_deadband_dps=.3,
              predicted_distance_since_encoder=0, predicted_yaw_since_encoder=0,
              current_pose={'x': 0, 'y': 0, 'yaw': 0}, scan_max_turn_dps=15,
              _freeze_invalid_encoder=Mock())
    callback = method(ROOT / 'ros2_configs/lidar_ws_to_ros2.py',
                      'LidarWsToRos2Bridge', 'update_from_encoder_telemetry')
    return node, callback


def test_one_wheel_revolution_moves_exactly_one_circumference():
    node, callback = bridge()
    ticks = 330
    for i in range(41):
        enc = {wheel: {'ticks': ticks * i / 40} for wheel in node.encoder_signs}
        callback(node, enc, sample_id=i, imu_available=True, sample_time=10 + i * .1)
    assert node.current_pose['x'] == pytest.approx(WHEEL_CIRCUMFERENCE)
    assert node.current_pose['y'] == 0
    assert node.measured_vx == pytest.approx(WHEEL_CIRCUMFERENCE / 4)
    node._freeze_invalid_encoder.assert_not_called()


def test_forward_then_reverse_returns_to_start():
    node, callback = bridge()
    sequence = list(range(21)) + list(range(19, -1, -1))
    for i, step in enumerate(sequence):
        enc = {wheel: {'ticks': 20 * step} for wheel in node.encoder_signs}
        callback(node, enc, sample_id=i, imu_available=True, sample_time=10 + i * .1)
    assert node.current_pose['x'] == pytest.approx(0, abs=1e-12)
    assert node.measured_vx < 0
    node._freeze_invalid_encoder.assert_not_called()


def test_gyro_angle_is_integrated_once():
    node, callback = bridge()
    enc = {wheel: {'ticks': 0} for wheel in node.encoder_signs}
    callback(node, enc, sample_id=0, imu_available=True, sample_time=10)
    callback(node, enc, yaw_rate_dps=10, sample_id=1, imu_available=True, sample_time=10.1)
    assert node.current_pose['yaw'] == pytest.approx(1)
    assert node.current_pose['x'] == 0


def test_encoder_speed_guard_rejects_impossible_distance():
    node, callback = bridge()
    for i, ticks in enumerate((0, 200)):
        enc = {wheel: {'ticks': ticks} for wheel in node.encoder_signs}
        callback(node, enc, sample_id=i, imu_available=True, sample_time=10 + .1 * i)
    # 200 ticks in .1 seconds exceeds the 1 m/s guard at this wheel size/CPR.
    node._freeze_invalid_encoder.assert_called_once()
    assert 'IMPOSSIBLE_SPEED' in node.encoder_guard.fault


def test_one_noisy_wheel_neither_stops_nor_distorts_odometry():
    # Phantom ticks rectified by the ESP32 ISR: M1 jumps +400 once and keeps that offset.
    node, callback = bridge()
    for i in range(41):
        enc = {wheel: {'ticks': 330 * i / 40} for wheel in node.encoder_signs}
        if i >= 20:
            enc['m1'] = {'ticks': 330 * i / 40 + 400}
        callback(node, enc, sample_id=i, imu_available=True, sample_time=10 + i * .1)
    node._freeze_invalid_encoder.assert_not_called()
    assert node.current_pose['x'] == pytest.approx(WHEEL_CIRCUMFERENCE, abs=0.005)


def spin_in_place(node, callback, left_ticks_per_sample, samples=10, gyro_dps=400.0):
    for i in range(samples + 1):
        enc = {'m1': {'ticks': left_ticks_per_sample * i}, 'm2': {'ticks': left_ticks_per_sample * i},
               'm3': {'ticks': -left_ticks_per_sample * i}, 'm4': {'ticks': -left_ticks_per_sample * i}}
        callback(node, enc, yaw_rate_dps=gyro_dps, sample_id=i, imu_available=True, sample_time=10 + i * .1)


def test_in_place_turn_yaw_comes_from_encoders_with_per_direction_scale():
    # Gyro sampled at ~8 Hz misjudges 0.1 s turn pulses (LiDAR check 18/11: x1.8-3.2), so an
    # in-place turn uses the cumulative wheel ticks; the absurd 400 deg/s gyro must be ignored.
    node, callback = bridge()
    node.desired_motion = 'right'
    node.turn_yaw_scale_right = 0.65
    spin_in_place(node, callback, left_ticks_per_sample=2)   # left forward, right backward = turn right
    side_m = 20 * WHEEL_CIRCUMFERENCE / 330
    expected = -math.degrees(2 * side_m / .17) * 0.65
    assert node.current_pose['yaw'] == pytest.approx(expected, rel=1e-6)
    node._freeze_invalid_encoder.assert_not_called()


def test_left_turn_uses_the_left_scale():
    node, callback = bridge()
    node.desired_motion = 'left'
    node.turn_yaw_scale_left = 0.96
    spin_in_place(node, callback, left_ticks_per_sample=-2, gyro_dps=-400.0)
    side_m = 20 * WHEEL_CIRCUMFERENCE / 330
    assert node.current_pose['yaw'] == pytest.approx(math.degrees(2 * side_m / .17) * 0.96, rel=1e-6)


def test_driving_straight_still_uses_the_gyro():
    node, callback = bridge()
    enc = {wheel: {'ticks': 0} for wheel in node.encoder_signs}
    callback(node, enc, sample_id=0, imu_available=True, sample_time=10)
    callback(node, enc, yaw_rate_dps=10, sample_id=1, imu_available=True, sample_time=10.1)
    assert node.current_pose['yaw'] == pytest.approx(1)


def test_pi_and_ros_apply_same_distance_conversion():
    pi = NS(_prev_left_ticks=None, _prev_right_ticks=None,
            _encoder_cpr=330, _wheel_radius=.0325,
            _wheel_sep=.17, robot_x=0, robot_y=0, robot_yaw=0,
            _encoder_side_ticks=lambda enc: (enc['ticks'], enc['ticks']))
    callback = method(ROOT / 'scripts/lidar_service.py', 'RPLidarSLAMCore', '_apply_encoder_odometry')
    ticks = 330
    for i in range(41):
        callback(pi, {'ticks': ticks * i / 40}, .1, update_yaw=False)
    assert pi.robot_x == pytest.approx(WHEEL_CIRCUMFERENCE)
    assert pi.robot_y == 0
