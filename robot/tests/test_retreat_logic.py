import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ros2_configs"))
from retreat_logic import RetreatTrail, ReverseFollower, body_scan, reverse_clear, turn_clear


class TestRetreatScan(unittest.TestCase):
    def test_empty_invalid_and_partial_scan_are_not_clear(self):
        for ranges in ([], [float("nan")] * 360, [0.0] * 360, [1.0] * 180):
            points, coverage = body_scan(0, math.pi / 180, ranges, 0.12, 12.0)
            self.assertFalse(coverage)
            self.assertFalse(reverse_clear(points, coverage))

    def test_infinity_is_observed_free_space(self):
        points, coverage = body_scan(0, math.pi / 180, [float("inf")] * 360, 0.12, 12.0)
        self.assertTrue(coverage)
        self.assertTrue(turn_clear(points, coverage))

    def test_rear_corner_obstacle_outside_old_rear_sector_blocks(self):
        # x=-0.23, y=0.11 is behind the rear corner, outside a +/-25 degree sector.
        self.assertFalse(reverse_clear([(-0.23, 0.11)], True))

    def test_side_wall_allows_straight_reverse_but_not_rotation(self):
        points = [(-0.10, 0.20), (0.10, -0.20)]
        self.assertFalse(turn_clear(points, True))
        self.assertTrue(reverse_clear(points, True))

    def test_laser_offset_matches_xacro(self):
        points, _ = body_scan(math.pi, 1.0, [0.4], 0.12, 12.0)
        self.assertAlmostEqual(points[0][0], -0.4)


class TestRetreatTrail(unittest.TestCase):
    def corridor(self):
        trail = RetreatTrail()
        for i in range(21):
            trail.record((i * 0.10, 0, 0), wide=i < 3)
        return trail

    def test_retreat_is_entire_corridor_to_latest_wide_anchor(self):
        route = self.corridor().route((2, 0, 0))
        self.assertGreater(len(route), 15)
        self.assertAlmostEqual(route[-1][0], 0.2)
        self.assertEqual(sorted(p[0] for p in route), [p[0] for p in reversed(route)])

    def test_small_timer_steps_accumulate_into_breadcrumbs(self):
        trail = RetreatTrail()
        for i in range(101):
            trail.record((i * 0.008, 0, 0), i < 20)
        self.assertGreater(len(trail.points), 8)
        self.assertTrue(trail.route((0.8, 0, 0)))

    def test_no_wide_anchor_and_odom_reset_do_not_invent_escape(self):
        trail = RetreatTrail()
        for i in range(5):
            trail.record((i * 0.1, 0, 0), False)
        self.assertEqual(trail.route((0.4, 0, 0)), [])
        trail = self.corridor()
        trail.record((20, 20, 0), False)
        self.assertEqual(trail.route((20, 20, 0)), [])
        trail.record(None, False)
        self.assertEqual(trail.points, [])

    def test_history_is_bounded(self):
        trail = RetreatTrail(max_length=1.0)
        for i in range(100):
            trail.record((i * 0.1, 0, 0), i == 0)
        self.assertLessEqual(len(trail.points), 11)
        self.assertEqual(trail.route((9.9, 0, 0)), [])


class TestReverseFollower(unittest.TestCase):
    def test_simulated_two_meter_escape_never_spins_or_drives_forward(self):
        trail = RetreatTrail()
        for i in range(21):
            trail.record((i * 0.1, 0, 0), i < 3)
        follower = ReverseFollower(trail.route((2, 0, 0)))
        pose = [2.0, 0.0, 0.0]
        for _ in range(400):
            vx, wz, reason = follower.command(pose)
            if reason == "arrived":
                break
            self.assertEqual(reason, "moving")
            self.assertLess(vx, 0)
            self.assertLessEqual(abs(wz), abs(vx) * 2)
            pose[0] += vx * math.cos(pose[2]) * 0.1
            pose[1] += vx * math.sin(pose[2]) * 0.1
            pose[2] += wz * 0.1
        self.assertEqual(reason, "arrived")
        self.assertLess(pose[0], 0.27)

    def test_sharp_turn_wrong_heading_and_jump_stop(self):
        for target in ((0, 1, 0), (1, 0, 0), (-1, 0, 0)):
            self.assertEqual(ReverseFollower([target]).command((0, 0, 0)),
                             (0.0, 0.0, "path_lost"))

    def test_gentle_curve_can_be_followed_back_without_rotation(self):
        trail = RetreatTrail()
        radius = 2.0
        for i in range(21):
            angle = i * 0.05
            trail.record((radius * math.sin(angle), radius * (1 - math.cos(angle)), angle), i < 3)
        pose = list(trail.points[-1].pose)
        follower = ReverseFollower(trail.route(pose))
        for _ in range(500):
            vx, wz, reason = follower.command(pose)
            if reason == "arrived":
                break
            self.assertEqual(reason, "moving")
            self.assertLess(vx, 0)
            self.assertLessEqual(abs(wz), abs(vx) * 2)
            pose[0] += vx * math.cos(pose[2]) * 0.1
            pose[1] += vx * math.sin(pose[2]) * 0.1
            pose[2] += wz * 0.1
        self.assertEqual(reason, "arrived")

    def test_small_tracking_error_steers_with_correct_reverse_sign(self):
        vx, wz, reason = ReverseFollower([(-0.15, -0.02, 0)]).command((0, 0, 0))
        self.assertEqual(reason, "moving")
        self.assertLess(vx, 0)
        self.assertGreater(wz, 0)

    def test_passing_a_breadcrumb_between_callbacks_does_not_require_a_turn(self):
        route = [(1.0 - i * 0.08, 0, 0) for i in range(11)]
        follower = ReverseFollower(route)
        vx, wz, reason = follower.command((0.84, 0, 0))
        self.assertEqual(reason, "moving")
        self.assertLess(vx, 0)
        self.assertEqual(wz, 0)
        self.assertAlmostEqual(follower.progress, 0.16)

    def test_nearby_odom_noise_does_not_make_the_passed_point_a_reverse_goal(self):
        route = [(1.0 - i * 0.08, 0, 0) for i in range(11)]
        vx, wz, reason = ReverseFollower(route).command((0.93, 0.045, 0))
        self.assertEqual(reason, "moving")
        self.assertLess(vx, 0)
        self.assertGreater(wz, 0)

    def test_real_lateral_deviation_and_odom_jump_still_stop(self):
        route = [(1.0 - i * 0.08, 0, 0) for i in range(11)]
        for pose in ((1.0, 0.13, 0), (0.5, 0, 0)):
            follower = ReverseFollower(route)
            self.assertEqual(follower.command(pose), (0, 0, "path_lost"))
            self.assertTrue(follower.diagnostic)

    def test_reported_43_degree_error_requests_alignment_then_reverse(self):
        angle = math.radians(43.7)
        target = (-0.213 * math.cos(angle), -0.213 * math.sin(angle), 0)
        follower = ReverseFollower([target])
        vx, wz, reason = follower.command((0, 0, 0))
        self.assertEqual(reason, "align")
        self.assertEqual(vx, 0)
        self.assertGreater(wz, 0)
        self.assertAlmostEqual(follower.heading_error, angle)
        # Alignment has hysteresis; do not oscillate between spin and reverse.
        self.assertEqual(follower.command((0, 0, angle - 0.3))[2], "align")
        vx, wz, reason = follower.command((0, 0, angle - 0.1))
        self.assertEqual(reason, "moving")
        self.assertLess(vx, 0)

    def test_loop_near_anchor_cannot_skip_remaining_route(self):
        # A crossed/looped trail must not jump to its far end just because it is nearby.
        route = [(0, 0, 0), (-0.2, 0, 0), (-0.2, 0.2, 0), (0, 0.2, 0), (0, 0, 0)]
        follower = ReverseFollower(route)
        self.assertEqual(follower.command((0, 0, 0))[2], "moving")
        self.assertEqual(follower.progress, 0.0)

    def test_reverse_with_odom_noise_and_faster_actual_motor(self):
        route = [(2.0 - i * 0.08, 0, 0) for i in range(24)]
        follower = ReverseFollower(route)
        pose = [2.0, 0.0, 0.0]
        for step in range(300):
            measured = (pose[0] + 0.01 * math.sin(step),
                        pose[1] + 0.025 * math.sin(step * 0.7), pose[2])
            vx, wz, reason = follower.command(measured)
            if reason == "arrived":
                break
            self.assertEqual(reason, "moving", follower.diagnostic)
            # The PWM floor can make the real motor faster than the requested vx.
            pose[0] += 1.8 * vx * math.cos(pose[2]) * 0.2
            pose[1] += 1.8 * vx * math.sin(pose[2]) * 0.2
            pose[2] += wz * 0.2
        self.assertEqual(reason, "arrived")


if __name__ == "__main__":
    unittest.main()
