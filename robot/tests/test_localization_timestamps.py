"""Exercise real manager methods without requiring ROS or starting hardware."""
import ast
import math
from pathlib import Path
from types import SimpleNamespace as NS
import unittest
from unittest.mock import Mock


class FakeTime:
    def __init__(self, nanoseconds=0):
        self.nanoseconds = nanoseconds

    @classmethod
    def from_msg(cls, stamp):
        return cls(stamp.sec * 10**9 + stamp.nanosec)

    def __sub__(self, other):
        return FakeTime(self.nanoseconds - other.nanoseconds)


class TestLocalizationTimestamps(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).resolve().parents[1] / 'ros2_configs/localization_manager.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'LocalizationManager')
        methods = [n for n in cls.body if isinstance(n, ast.FunctionDef)
                   and n.name in ('_lookup', '_compute_match')]
        self.scorer = Mock(return_value=NS(score=0.95))
        namespace = {'Time': FakeTime, '_yaw': lambda q: q.yaw, 'scan_match': self.scorer}
        exec(compile(ast.Module(body=methods, type_ignores=[]), str(path), 'exec'), namespace)
        self.node = NS(
            scan=NS(header=NS(stamp=NS(sec=10, nanosec=0), frame_id='/laser_frame'),
                    ranges=[1.0] * 360, angle_min=0, angle_increment=math.pi / 180,
                    range_min=0.2, range_max=12.0),
            mask=bytearray([1]), grid=(1, 1, 1, 0, 0), input_timeout=1.5,
            get_clock=lambda: NS(now=lambda: FakeTime(10_200_000_000)),
            tf_buffer=NS(lookup_transform=Mock(return_value=NS(transform=NS(
                translation=NS(x=1, y=2), rotation=NS(yaw=0.3))))),
        )
        self.node._lookup = lambda *args: namespace['_lookup'](self.node, *args)
        self.compute = lambda: namespace['_compute_match'](self.node)

    def test_matches_scan_with_historical_pose_while_robot_moves(self):
        # Latest pose has moved; the old observation must use the old TF.
        def transform_at(target, child, when):
            return NS(transform=NS(translation=NS(x=1 if when.nanoseconds == 10**10 else 5, y=2),
                                   rotation=NS(yaw=0.3)))
        self.node.tf_buffer.lookup_transform.side_effect = transform_at
        self.compute()
        self.assertEqual(self.node.tf_buffer.lookup_transform.call_args.args[2].nanoseconds, 10**10)
        self.assertEqual(self.scorer.call_args.args[5], (1, 2, 0.3))

    def test_missing_historical_tf_never_falls_back_to_latest(self):
        self.node.tf_buffer.lookup_transform.side_effect = RuntimeError('past TF missing')
        self.assertIsNone(self.compute())
        self.node.tf_buffer.lookup_transform.assert_called_once()
        self.scorer.assert_not_called()
        self.assertIn('past TF missing', self.node.match_failure_reason)

    def test_zero_old_or_future_scan_is_rejected(self):
        for sec in (0, 7, 11):
            with self.subTest(sec=sec):
                self.node.scan.header.stamp.sec = sec
                self.assertIsNone(self.compute())
                self.assertTrue(self.node.match_failure_reason)
        self.node.tf_buffer.lookup_transform.assert_not_called()
        self.scorer.assert_not_called()

    def test_insufficient_beams_provides_diagnostic(self):
        self.scorer.return_value = None
        self.assertIsNone(self.compute())
        self.assertIn('tia LiDAR', self.node.match_failure_reason)

    def test_save_pose_can_still_request_latest_transform(self):
        self.assertEqual(self.node._lookup('base_link'), (1, 2, 0.3))
        self.assertEqual(self.node.tf_buffer.lookup_transform.call_args.args[2].nanoseconds, 0)


if __name__ == '__main__':
    unittest.main()
