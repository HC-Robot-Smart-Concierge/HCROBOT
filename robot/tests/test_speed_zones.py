import ast
import math
import os
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

CONFIG = Path(__file__).resolve().parents[1] / 'ros2_configs'
sys.path.insert(0, str(CONFIG))
from speed_zone_logic import limit_wheel_pwm, speed_mask_regions
from diff_drive import DiffDriveConfig, StraightDriveConfig, twist_to_straight_command, twist_to_wheel_pwm


class TestMotorSpeedCap(unittest.TestCase):
    def test_no_zone_restores_normal_pwm_and_spins_remain_possible(self):
        self.assertEqual(limit_wheel_pwm(42, 42, None, 0.0048, 35), (42, 42))
        self.assertEqual(limit_wheel_pwm(-40, 40, 0.05, 0.0048, 35), (-40, 40))

    def test_caps_translation_in_both_directions_without_rounding_up(self):
        for sign in (-1, 1):
            left, right = limit_wheel_pwm(sign*45, sign*50, 0.18, 0.0048, 22)
            self.assertLessEqual(abs(left+right) * 0.5 * 0.0048, 0.18)
            self.assertEqual(math.copysign(1, left), sign)

    def test_never_raises_speed_to_motor_floor(self):
        self.assertEqual(limit_wheel_pwm(35, 35, 0.12, 0.0048, 35), (0, 0))
        self.assertEqual(limit_wheel_pwm(35, 35, 0.18, 0.0048, 35), (35, 35))

    def test_stops_if_curvature_cannot_be_preserved_above_floor(self):
        self.assertEqual(limit_wheel_pwm(35, 49, 0.18, 0.0048, 35), (0, 0))

    def test_invalid_cap_stops_translation(self):
        for limit in (0, -1, math.nan, math.inf):
            self.assertEqual(limit_wheel_pwm(40, 40, limit, 0.0048, 35), (0, 0))

    def test_opposite_wheel_rounding_cannot_exceed_linear_cap(self):
        limit = 0.02138
        left, right = limit_wheel_pwm(-41, 50, limit, 0.0048, 22)
        self.assertLessEqual(abs(left+right) * 0.5 * 0.0048, limit)

    def test_bridge_applies_limit_and_zero_message_restores_normal_speed(self):
        tree = ast.parse((CONFIG / 'lidar_ws_to_ros2.py').read_text(encoding='utf-8'))
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'LidarWsToRos2Bridge')
        cls.bases = []
        methods = {'on_speed_limit', '_limit_zone_pwm', 'on_cmd_vel_received'}
        cls.body = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name in methods]
        namespace = dict(math=math, os=os, time=time, Twist=object,
                         limit_wheel_pwm=limit_wheel_pwm, twist_to_straight_command=twist_to_straight_command,
                         twist_to_wheel_pwm=twist_to_wheel_pwm)
        exec(compile(ast.Module(body=[cls], type_ignores=[]), 'bridge', 'exec'), namespace)
        node = namespace['LidarWsToRos2Bridge']()
        node.last_cmd_time = time.monotonic()
        node.current_vx = node.current_wz = 0
        node.cmd_vel_mode = 'straight'
        node.straight_cfg = StraightDriveConfig(min_pwm=35)
        node.diff_cfg = DiffDriveConfig()
        node._send_udp_to_pi5 = Mock()
        node._send_udp_speed = Mock()
        node._gate_turn_pulse = lambda motion, now: motion
        command = SimpleNamespace(linear=SimpleNamespace(x=0.12), angular=SimpleNamespace(z=0.0))
        node.on_speed_limit(SimpleNamespace(speed_limit=0.12, percentage=False))
        node.on_cmd_vel_received(command)
        node._send_udp_to_pi5.assert_called_with('stop')
        self.assertTrue(node.zone_speed_blocked)
        node.on_speed_limit(SimpleNamespace(speed_limit=0, percentage=False))
        node.on_cmd_vel_received(command)
        node._send_udp_to_pi5.assert_called_with('drive:35:35')
        self.assertFalse(node.zone_speed_blocked)
        node.on_speed_limit(SimpleNamespace(speed_limit=50, percentage=True))
        self.assertAlmostEqual(node.zone_speed_limit, 0.1)


class TestSpeedMaskGeometry(unittest.TestCase):
    def test_groups_by_speed_and_connectivity_ignoring_unrestricted_and_unknown(self):
        regions = speed_mask_regions(4, 3, [18, 18, 0, 18, 18, 12, -1, 0, 0, 12, 12, 0])
        self.assertEqual([round(v, 2) for v, _ in regions], [0.18, 0.18, 0.12])
        self.assertEqual([len(cells) for _, cells in regions], [3, 1, 3])

    def test_removing_all_zones_produces_empty_markers(self):
        self.assertEqual(speed_mask_regions(2, 2, [0]*4), [])
        self.assertEqual(speed_mask_regions(2, 2, [18]), [])


if __name__ == '__main__':
    unittest.main()
