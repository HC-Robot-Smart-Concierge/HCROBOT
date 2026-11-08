"""Exercise explorer action callbacks without requiring a ROS installation."""

import ast
import math
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ros2_configs"))
from retreat_logic import RetreatTrail, ReverseFollower, body_scan, reverse_clear, turn_clear
from frontier_logic import MotionWatchdog, choose_unstick_direction, exploration_result
from recovery_costmap import CostmapGrid, grid_sweep_clear, scan_sweep_clear


def explorer_class():
    source = Path(__file__).resolve().parents[1] / "ros2_configs" / "frontier_explorer.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "FrontierExplorer")
    # Keep the real orchestration methods; ROS imports and node setup are unnecessary here.
    methods = {"_on_nav_result", "_goal_finished", "_tick", "_watch_goal",
               "_retreat_scan", "_needs_retreat", "_start_unstick", "_maneuver_step",
               "_stop_recovery", "_publish_vx", "_on_stop", "_costmap_snapshot",
               "_motion_allowed", "_retry_navigation", "_wait_recovery", "_recovery_missing"}
    cls.body = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name in methods]
    cls.bases = []
    namespace = {"math": __import__("math"), "ReverseFollower": ReverseFollower,
                 "body_scan": body_scan, "reverse_clear": reverse_clear,
                 "turn_clear": turn_clear, "MotionWatchdog": MotionWatchdog,
                 "choose_unstick_direction": choose_unstick_direction,
                 "CostmapGrid": CostmapGrid, "grid_sweep_clear": grid_sweep_clear,
                 "scan_sweep_clear": scan_sweep_clear, "exploration_result": exploration_result}
    yaw_helper = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "_yaw_from_quat")
    exec(compile(ast.Module(body=[yaw_helper, cls], type_ignores=[]), str(source), "exec"), namespace)
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
        n.retreat_retry_after = 0.0
        n.last_frontier = None
        n.memory = Mock()
        n.memory.record_failure.return_value = False
        n.get_logger = Mock()
        n._now = Mock(return_value=10.0)
        n.exit_at = None  # chua bao ket qua /explore/status
        n._report_and_exit = Mock()
        n.stuck_count = 0
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
        grid = CostmapGrid(160, 160, 0.025, (-1.0, -2.0, 0), [0] * (160 * 160))
        n._costmap_snapshot = Mock(return_value=(grid, (1, 0, 0)))

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

    def test_new_rear_obstacle_stops_then_replans_instead_of_latching(self):
        n = self.corridor()
        n._start_unstick(10.0)
        n._retreat_scan.return_value = ([(-0.23, 0.11)], True)
        n._maneuver_step()
        self.assertFalse(n.recovery_blocked)
        n._publish_motion.assert_called_with(0.0, 0.0)
        n._now.return_value = 12.1
        n._maneuver_step()
        self.assertIsNone(n.maneuver)
        self.assertFalse(n.recovery_blocked)
        self.assertGreater(n.retreat_retry_after, 12.1)

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
                self.assertFalse(n.recovery_blocked)
                n._publish_motion.assert_called_with(0.0, 0.0)
                n._now.return_value = 15.1
                n._maneuver_step()
                self.assertTrue(n.recovery_blocked)

    def test_anchor_releases_nav_to_use_current_costmap(self):
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
                self.assertFalse(n.recovery_blocked)
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
        # Bao Web "da dung" roi tu thoat de backend ve MAPPING (Web hien bang luu map)
        n._report_and_exit.assert_called_once()
        self.assertEqual(n._report_and_exit.call_args[0][0]["state"], "STOPPED")
        n._tick()

    def test_motor_block_without_translation_replans_instead_of_looping(self):
        n = self.corridor()
        n._start_unstick(10.0)
        n._now.return_value = 15.1
        n._maneuver_step()
        self.assertFalse(n.recovery_blocked)
        self.assertIsNone(n.maneuver)
        n._publish_motion.assert_called_with(0.0, 0.0)

    def alignment(self):
        n = self.corridor()
        n._start_unstick(10.0)
        angle = math.radians(43.7)
        n.maneuver["follower"].route = [(1 - 0.213 * math.cos(angle),
                                        -0.213 * math.sin(angle), 0)]
        return n

    def test_reported_43_degree_error_rotates_when_lidar_and_costmap_allow(self):
        n = self.alignment()
        n._retreat_scan.return_value = ([], True)
        n._maneuver_step()
        self.assertFalse(n.recovery_blocked)
        self.assertIsNotNone(n.maneuver)
        vx, wz = n._publish_motion.call_args.args
        self.assertEqual(vx, 0)
        self.assertGreater(wz, 0)

    def test_blocked_rotation_tries_reverse_arc(self):
        n = self.alignment()
        n._retreat_scan.return_value = ([(0.12, 0.17)], True)
        n._maneuver_step()
        vx, wz = n._publish_motion.call_args.args
        self.assertLess(vx, 0)
        self.assertGreater(wz, 0)
        self.assertFalse(n.recovery_blocked)

    def test_costmap_obstacle_can_veto_alignment_despite_empty_lidar(self):
        n = self.alignment()
        n._retreat_scan.return_value = ([], True)
        grid, pose = n._costmap_snapshot.return_value
        grid.data[:] = [100] * len(grid.data)
        n._maneuver_step()
        n._publish_motion.assert_called_with(0.0, 0.0)
        n._now.return_value = 12.1
        n._maneuver_step()
        self.assertIsNone(n.maneuver)
        self.assertFalse(n.recovery_blocked)

    def test_stale_costmap_holds_motion_and_cannot_be_bypassed(self):
        n = self.alignment()
        n._retreat_scan.return_value = ([], True)
        n._costmap_snapshot.return_value = None
        n._maneuver_step()
        n._publish_motion.assert_called_with(0.0, 0.0)
        n._now.return_value = 15.1
        n._maneuver_step()
        self.assertTrue(n.recovery_blocked)

    def test_costmap_snapshot_uses_matching_odom_frame_and_rejects_old_data(self):
        n = self.node
        del n._costmap_snapshot
        n.costmap_received_at = 10.0
        n.costmap_msg = SimpleNamespace(
            header=SimpleNamespace(frame_id="odom", stamp=SimpleNamespace(sec=10, nanosec=0)),
            info=SimpleNamespace(width=2, height=2, resolution=0.025,
                                 origin=SimpleNamespace(position=SimpleNamespace(x=0, y=0),
                                                        orientation=SimpleNamespace(x=0, y=0, z=0, w=1))),
            data=[0, 0, 0, 0])
        grid, pose = n._costmap_snapshot(10.0)
        self.assertEqual(pose, (1.0, 0.0, 0.0))
        self.assertEqual(grid.origin, (0, 0, 0))
        self.assertIsNone(n._costmap_snapshot(12.0))
        n.costmap_received_at = 12.0
        self.assertIsNone(n._costmap_snapshot(12.0))

    def test_post_cancel_scan_gap_waits_then_recovers_without_manual_restart(self):
        n = self.corridor()
        n._retreat_scan.return_value = ([], False)
        n._start_unstick(10.0)
        self.assertTrue(n.maneuver["awaiting_sensors"])
        self.assertFalse(n.recovery_blocked)
        n._publish_motion.assert_called_with(0.0, 0.0)
        n._now.return_value = 11.0
        n._retreat_scan.return_value = ([(0.0, 0.20), (0.0, -0.20)], True)
        n._maneuver_step()
        self.assertTrue(n.maneuver["awaiting_sensors"])
        n._now.return_value = 11.4
        n._maneuver_step()
        self.assertIn("follower", n.maneuver)
        self.assertFalse(n.recovery_blocked)
        n._maneuver_step()
        self.assertLess(n._publish_motion.call_args.args[0], 0)

    def test_start_without_odom_times_out_with_specific_reason_and_no_motion(self):
        n = self.corridor()
        n._odom_pose.return_value = None
        n._start_unstick(10.0)
        self.assertFalse(n.recovery_blocked)
        n._now.return_value = 15.1
        n._maneuver_step()
        self.assertTrue(n.recovery_blocked)
        self.assertIn("odom->base_link", n.get_logger().error.call_args.args[0])
        for call in n._publish_motion.call_args_list:
            self.assertEqual(call.args, (0.0, 0.0))

    def test_start_without_costmap_does_not_release_motion_when_scan_recovers(self):
        n = self.corridor()
        n._costmap_snapshot.return_value = None
        n._start_unstick(10.0)
        n._now.return_value = 11.0
        n._maneuver_step()
        self.assertTrue(n.maneuver["awaiting_sensors"])
        n._publish_motion.assert_called_with(0.0, 0.0)

    def test_brief_scan_gap_keeps_existing_route_anchors(self):
        n = self.corridor()
        count = len(n.trail.points)
        n._retreat_scan.return_value = ([], False)
        n._maneuver_step()
        self.assertEqual(len(n.trail.points), count)

    def test_stop_button_while_waiting_cannot_resume_recovery(self):
        n = self.corridor()
        n._retreat_scan.return_value = ([], False)
        n._start_unstick(10.0)
        n._on_stop(None)
        self.assertIsNone(n.maneuver)
        self.assertTrue(n.finished)

    def test_diagnostics_distinguish_stale_scan_from_partial_coverage(self):
        n = self.node
        n.scan_received_at = 10.0
        n.scan_msg = SimpleNamespace(header=SimpleNamespace(stamp=SimpleNamespace(sec=9, nanosec=0)))
        snapshot = n._costmap_snapshot.return_value
        reason = n._recovery_missing(10.0, (1, 0, 0), False, snapshot)
        self.assertIn("timestamp 1.00 s", reason)
        n.scan_msg.header.stamp.sec = 10
        self.assertIn("24 vùng góc", n._recovery_missing(10.0, (1, 0, 0), False, snapshot))


if __name__ == "__main__":
    unittest.main()
