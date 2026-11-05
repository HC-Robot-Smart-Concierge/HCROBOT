"""Exercise explorer action callbacks without requiring a ROS installation."""

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ros2_configs"))
from retreat_logic import RetreatTrail, ReverseFollower, body_scan, reverse_clear, turn_clear
from frontier_logic import MotionWatchdog, choose_unstick_direction


def explorer_class():
    source = Path(__file__).resolve().parents[1] / "ros2_configs" / "frontier_explorer.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "FrontierExplorer")
    # Keep the real orchestration methods; ROS imports and node setup are unnecessary here.
    methods = {"_on_nav_result", "_goal_finished", "_tick", "_watch_goal",
               "_retreat_scan", "_needs_retreat", "_start_unstick", "_maneuver_step",
               "_stop_recovery", "_publish_vx", "_on_stop"}
    cls.body = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name in methods]
    cls.bases = []
    namespace = {"math": __import__("math"), "ReverseFollower": ReverseFollower,
                 "body_scan": body_scan, "reverse_clear": reverse_clear,
                 "turn_clear": turn_clear, "MotionWatchdog": MotionWatchdog,
                 "choose_unstick_direction": choose_unstick_direction}
    exec(compile(ast.Module(body=[cls], type_ignores=[]), str(source), "exec"), namespace)
    return namespace["FrontierExplorer"]


class TestFrontierRecovery(unittest.TestCase):
    def setUp(self):
        self.node = explorer_class()()
        n = self.node
        n.busy = True
        n.goal_seq = 7
        n.goal_frontier = (2.0, 1.0)
        n.goal_handle = Mock()
        n.goal_point = (2.0, 1.0)
        n.pending_unstick = False
        n.recovery_blocked = False
        n.memory = Mock()
        n.memory.record_failure.return_value = False
        n.get_logger = Mock()
        n._now = Mock(return_value=10.0)
        n.settle_sec = 2.0
        n.settle = None
        n.visited = 0
        n.trail = RetreatTrail()
        n.retreat_speed = 0.08
        n.turn_radius_m = 0.40
        n.scan_timeout_sec = 0.8
        n.scan_msg = None
        n.scan_received_at = None
        n._odom_pose = Mock(return_value=(1.0, 0.0, 0.0))
        n._publish_motion = Mock()

    def result(self, status, seq=7):
        future = Mock()
        future.result.return_value = SimpleNamespace(status=status)
        self.node._on_nav_result(future, seq)

    def test_abort_before_watchdog_still_requests_recovery(self):
        self.result(6)
        self.assertTrue(self.node.pending_unstick)
        self.assertFalse(self.node.busy)
        self.node.memory.record_failure.assert_called_once_with((2.0, 1.0))

    def test_success_settles_without_recovery(self):
        self.result(4)
        self.assertFalse(self.node.pending_unstick)
        self.assertEqual(self.node.settle, ((2.0, 1.0), 12.0))

    def test_canceled_goal_does_not_request_recovery(self):
        self.result(5)
        self.assertFalse(self.node.pending_unstick)

    def test_late_abort_cannot_interrupt_new_goal(self):
        self.result(6, seq=6)
        self.assertTrue(self.node.busy)
        self.assertFalse(self.node.pending_unstick)
        self.node.memory.record_failure.assert_not_called()

    def test_already_finished_goal_ignores_abort(self):
        self.node.busy = False
        self.result(6)
        self.assertFalse(self.node.pending_unstick)

    def test_timeout_waits_for_cancel_before_recovery(self):
        n = self.node
        n._robot_xy = Mock(return_value=None)
        n.watchdog = Mock()
        n.watchdog.is_stuck.return_value = False
        n._odom_pose = Mock(return_value=(0.0, 0.0, 0.0))
        n.goal_started = 0.0
        n.goal_timeout_sec = 5.0
        n._cancel_current = Mock()
        n._watch_goal(10.0)
        n._cancel_current.assert_called_once_with(10.0)
        self.assertTrue(n.pending_unstick)
        self.assertFalse(n.busy)

        n.finished = False
        n.maneuver = None
        n.draining_future = Mock()
        n.draining_future.done.return_value = False
        n.draining_deadline = 13.0
        n._start_unstick = Mock(return_value=True)
        n._tick()
        n._start_unstick.assert_not_called()
        # Even after the old 3-second deadline, do not override a live Nav2 goal.
        n._now.return_value = 20.0
        n._tick()
        n._start_unstick.assert_not_called()
        n.draining_future.done.return_value = True
        n._tick()
        n._start_unstick.assert_called_once_with(20.0)
        self.assertFalse(n.pending_unstick)

    def corridor(self):
        n = self.node
        n._retreat_scan = Mock(return_value=([(0.0, 0.20), (0.0, -0.20)], True))
        for i in range(11):
            n.trail.record((i * 0.1, 0, 0), i < 3)
        n.maneuver = None
        return n

    def test_narrow_goal_settles_then_reverses_instead_of_sending_goal(self):
        n = self.corridor()
        self.result(4)
        n.finished = False
        n.draining_future = None
        n._judge_reached = Mock()
        n._now.return_value = 13.0
        n._tick()
        self.assertTrue(n.pending_unstick)
        n._tick()
        self.assertIn("follower", n.maneuver)
        n._maneuver_step()
        vx, wz = n._publish_motion.call_args.args
        self.assertLess(vx, 0)
        self.assertEqual(wz, 0)

    def test_new_rear_obstacle_stops_and_latches_auto_pause(self):
        n = self.corridor()
        n._start_unstick(10.0)
        n._retreat_scan.return_value = ([(-0.23, 0.11)], True)
        n._maneuver_step()
        self.assertTrue(n.recovery_blocked)
        self.assertIsNone(n.maneuver)
        n._publish_motion.assert_called_with(0.0, 0.0)
        n.finished = False
        n._tick()  # Remains paused; cannot dispatch another Nav2 goal.

    def test_lost_scan_or_odom_stops_reverse(self):
        for lost in ("scan", "odom"):
            with self.subTest(lost=lost):
                self.setUp()
                n = self.corridor()
                n._start_unstick(10.0)
                if lost == "scan":
                    n._retreat_scan.return_value = ([], False)
                else:
                    n._odom_pose.return_value = None
                n._maneuver_step()
                self.assertTrue(n.recovery_blocked)
                n._publish_motion.assert_called_with(0.0, 0.0)

    def test_wide_anchor_releases_nav_but_changed_anchor_does_not(self):
        for wide in (True, False):
            with self.subTest(wide=wide):
                self.setUp()
                n = self.corridor()
                n._start_unstick(10.0)
                n.maneuver["follower"].route = [(0.2, 0, 0)]
                n._odom_pose.return_value = (0.2, 0, 0)
                n._retreat_scan.return_value = ([(2.0, 0.0)] if wide else [(0, 0.20)], True)
                n._maneuver_step()
                self.assertIsNone(n.maneuver)
                self.assertEqual(n.recovery_blocked, not wide)
                n._publish_motion.assert_called_with(0.0, 0.0)

    def test_recent_receipt_cannot_hide_old_sensor_timestamp(self):
        n = self.node
        n.scan_received_at = 10.0
        n.scan_msg = SimpleNamespace(header=SimpleNamespace(stamp=SimpleNamespace(sec=5, nanosec=0)))
        self.assertEqual(n._retreat_scan(10.0), ([], False))

    def test_stop_button_cancels_retreat_and_prevents_new_goals(self):
        n = self.corridor()
        n._start_unstick(10.0)
        handle = n.goal_handle
        n.pending_unstick = True
        n._on_stop(None)
        self.assertTrue(n.finished)
        self.assertFalse(n.pending_unstick)
        self.assertIsNone(n.maneuver)
        handle.cancel_goal_async.assert_called_once()
        n._publish_motion.assert_called_with(0.0, 0.0)
        n._tick()

    def test_motor_block_without_translation_pauses_instead_of_looping(self):
        n = self.corridor()
        n._start_unstick(10.0)
        n._now.return_value = 15.1
        n._maneuver_step()
        self.assertTrue(n.recovery_blocked)
        n._publish_motion.assert_called_with(0.0, 0.0)


if __name__ == "__main__":
    unittest.main()
