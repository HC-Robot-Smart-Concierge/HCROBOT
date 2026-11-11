import ast
import math
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

CONFIG = Path(__file__).resolve().parents[1] / 'ros2_configs'
sys.path.insert(0, str(CONFIG))
from localization_support import LocalizationWarmup, sensor_frame_is_fresh


class TestSensorFreshness(unittest.TestCase):
    def test_accepts_recent_and_legacy_frames(self):
        self.assertTrue(sensor_frame_is_fresh(0.1, 0.05))
        self.assertTrue(sensor_frame_is_fresh(None, None))

    def test_rejects_old_or_invalid_measurements(self):
        for ages in [(0.6, 0.1), (0.1, 2), (math.nan, 0), (0, math.inf), (-1, 0)]:
            with self.subTest(ages=ages):
                self.assertFalse(sensor_frame_is_fresh(*ages))

    def test_bridge_does_not_refresh_health_or_publish_stale_scan(self):
        # Execute the actual bridge method without starting ROS or UDP threads.
        tree = ast.parse((CONFIG / 'lidar_ws_to_ros2.py').read_text(encoding='utf-8'))
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'LidarWsToRos2Bridge')
        method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'publish_scan')
        namespace = {'sensor_frame_is_fresh': sensor_frame_is_fresh}
        exec(compile(ast.Module(body=[method], type_ignores=[]), 'bridge', 'exec'), namespace)
        node = SimpleNamespace(dropped_stale_scans=0, last_scan_time=10)
        namespace['publish_scan'](node, [{'angle': 0, 'distance': 1}], 3, 0.1)
        self.assertEqual(node.dropped_stale_scans, 1)
        self.assertEqual(node.last_scan_time, 10)


class TestLocalizationWarmup(unittest.TestCase):
    def test_only_after_initial_pose_with_new_stationary_scans(self):
        warmup = LocalizationWarmup()
        self.assertFalse(warmup.ready(10, 9.9, True, 0, 0))
        warmup.arm(10)
        self.assertFalse(warmup.ready(10.1, 9.9, True, 0, 0))
        self.assertTrue(warmup.ready(10.2, 10.1, True, 0, 0))
        warmup.sent(10.2, 10.1)
        self.assertFalse(warmup.ready(10.3, 10.25, True, 0, 0))
        self.assertFalse(warmup.ready(10.8, 10.1, True, 0, 0))
        self.assertTrue(warmup.ready(10.8, 10.7, True, 0, 0))

    def test_never_forces_updates_while_moving_or_sensors_stale(self):
        warmup = LocalizationWarmup()
        warmup.arm(10)
        for stopped, vx, wz in [(False, 0, 0), (True, 0.1, 0), (True, 0, 0.1), (True, math.nan, 0)]:
            self.assertFalse(warmup.ready(11, 10.9, stopped, vx, wz))
        self.assertFalse(warmup.ready(11, 10.1, True, 0, 0))
        self.assertFalse(warmup.ready(21, 20.9, True, 0, 0))

    def test_bounded_and_can_be_rearmed(self):
        warmup = LocalizationWarmup()
        warmup.arm(10)
        for i in range(5):
            now = 11 + i
            self.assertTrue(warmup.ready(now, now - 0.1, True, 0, 0))
            warmup.sent(now, now - 0.1)
        self.assertFalse(warmup.ready(16, 15.9, True, 0, 0))
        warmup.arm(16)
        self.assertTrue(warmup.ready(17, 16.9, True, 0, 0))


if __name__ == '__main__':
    unittest.main()
