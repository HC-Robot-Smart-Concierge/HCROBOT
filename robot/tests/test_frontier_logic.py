import math
import os
import sys
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROBOT_DIR, "ros2_configs"))

from frontier_logic import (  # noqa: E402
    Frontier, FrontierMemory, MotionWatchdog, choose_frontier, choose_unstick_direction, exploration_result,
    find_frontiers,
    frontier_still_open, safe_goal, scan_to_points,
)

RES = 0.1


def grid_from_rows(rows):
    """rows tu DAY len DINH: '.'=trong(0) '#'=tuong(100) '?'=chua biet(-1)."""
    val = {".": 0, "#": 100, "?": -1}
    h, w = len(rows), len(rows[0])
    return [val[c] for row in rows for c in row], w, h


class TestFindFrontiers(unittest.TestCase):
    def test_fully_known_room_has_no_frontier(self):
        data, w, h = grid_from_rows(["#####", "#...#", "#...#", "#####"])
        self.assertEqual(find_frontiers(data, w, h, RES, (0, 0), min_cluster_cells=1), [])

    def test_open_side_is_one_cluster_with_goal_on_free_cell(self):
        rows = [
            "##########",
            "#........?",
            "#........?",
            "#........?",
            "##########",
        ]
        data, w, h = grid_from_rows(rows)
        fronts = find_frontiers(data, w, h, RES, (0, 0), min_cluster_cells=2)
        self.assertEqual(len(fronts), 1)
        self.assertEqual(fronts[0].size, 3)
        gx, gy = fronts[0].goal
        cx, cy = int(gx / RES), int(gy / RES)
        self.assertEqual(data[cy * w + cx], 0, "dich phai la o trong")
        self.assertEqual(cx, 8)  # cot sat vung chua biet

    def test_small_clusters_are_noise(self):
        rows = ["#####", "#..?#", "#...#", "#####"]
        data, w, h = grid_from_rows(rows)
        self.assertEqual(find_frontiers(data, w, h, RES, (0, 0), min_cluster_cells=3), [])
        self.assertEqual(len(find_frontiers(data, w, h, RES, (0, 0), min_cluster_cells=1)), 1)

    def test_two_separate_openings_are_two_clusters(self):
        rows = [
            "#??#######",
            "#........#",
            "#........#",
            "#######??#",
        ]
        data, w, h = grid_from_rows(rows)
        self.assertEqual(len(find_frontiers(data, w, h, RES, (0, 0), min_cluster_cells=2)), 2)

    def test_ring_cluster_around_robot_still_gives_far_goals(self):
        # Gazebo 07/11: xe dung yen, LiDAR thua o xa => mot cum frontier khong lo bao quanh xe,
        # them khe "bong" chua biet chay toi sat xe. Tam cum ~ chinh xe => dich cu cach xe 0.3 m,
        # choose_frontier bo (qua gan) => explorer dung "chua toi duoc frontier nao".
        n, r, c = 61, 25, 30  # 6.1 x 6.1 m, dia trong ban kinh 2.5 m, xe o tam (3.05, 3.05)
        data = [-1] * (n * n)
        for y in range(n):
            for x in range(n):
                if (x - c) ** 2 + (y - c) ** 2 <= r * r:
                    data[y * n + x] = 0
        for y in range(c + 3, n):  # khe bong phia tren xe
            data[y * n + c] = -1
        robot = ((c + 0.5) * RES, (c + 0.5) * RES)
        fronts = find_frontiers(data, n, n, RES, (0, 0))
        self.assertGreater(len(fronts), 1, "cum lon phai duoc chia thanh nhieu dich")
        best = choose_frontier(fronts, robot)
        self.assertIsNotNone(best)
        self.assertGreaterEqual(math.hypot(best.goal[0] - robot[0], best.goal[1] - robot[1]), 0.3)
        for f in fronts:
            gx, gy = int(f.goal[0] / RES), int(f.goal[1] / RES)
            self.assertEqual(data[gy * n + gx], 0, "dich phai la o trong")


class TestExplorationResult(unittest.TestCase):
    """Ket qua cuoi phien tu quet -> /explore/status -> Web hien popup luu map."""

    def test_done_when_robot_visited_frontiers(self):
        left = [Frontier(goal=(1.0, 2.0), size=9, centroid=(1.0, 2.0))]
        r = exploration_result(visited=5, stuck_count=1, frontiers=left)
        self.assertEqual(r["state"], "DONE")
        self.assertEqual((r["visited"], r["stuck"], r["frontiers_left"]), (5, 1, 1))
        self.assertIn("5", r["message"])

    def test_failed_when_nothing_was_reached(self):
        r = exploration_result(visited=0, stuck_count=0, frontiers=[])
        self.assertEqual(r["state"], "FAILED")

    def test_stopped_wins_over_counts(self):
        r = exploration_result(visited=3, stuck_count=0, frontiers=[], stopped=True)
        self.assertEqual(r["state"], "STOPPED")
        self.assertEqual(r["visited"], 3)


class TestChooseFrontier(unittest.TestCase):
    def setUp(self):
        self.near = Frontier(goal=(1.0, 0.0), size=5, centroid=(1.0, 0.0))
        self.far = Frontier(goal=(5.0, 0.0), size=5, centroid=(5.0, 0.0))

    def test_prefers_nearest(self):
        self.assertIs(choose_frontier([self.far, self.near], (0, 0)), self.near)

    def test_blacklist_skips_failed_goal(self):
        self.assertIs(choose_frontier([self.near, self.far], (0, 0), blacklist=[(1.1, 0.0)]), self.far)

    def test_ignores_frontier_under_robot(self):
        self.assertIsNone(choose_frontier([self.near], (0.95, 0.0)))

    def test_big_cluster_can_beat_slightly_closer_small_one(self):
        big = Frontier(goal=(1.5, 0.0), size=100, centroid=(1.5, 0.0))
        self.assertIs(choose_frontier([self.near, big], (0, 0)), big)


class TestSafeGoal(unittest.TestCase):
    # Hanh lang rong 7 o (0.7 m), tuong tren/duoi, ben phai chua biet.
    ROWS = [
        "############",
        "#.........??",
        "#.........??",
        "#.........??",
        "#.........??",
        "#.........??",
        "#.........??",
        "#.........??",
        "############",
    ]

    def _grid(self):
        return grid_from_rows(self.ROWS)

    def _cell(self, p):
        return int(p[0] / RES), int(p[1] / RES)

    def test_goal_near_wall_is_pulled_away_from_wall(self):
        data, w, h = self._grid()
        # Frontier sat tuong duoi (hang 1), robot o giua hanh lang ben trai.
        goal = safe_goal(data, w, h, RES, (0, 0), (0.95, 0.15), (0.25, 0.45), clearance_m=0.2)
        self.assertIsNotNone(goal)
        cx, cy = self._cell(goal)
        self.assertEqual(data[cy * w + cx], 0)
        self.assertGreaterEqual(cy, 3, "phai cach tuong duoi >= 2 o")

    def test_goal_with_enough_clearance_is_kept(self):
        data, w, h = self._grid()
        goal = safe_goal(data, w, h, RES, (0, 0), (0.95, 0.45), (0.25, 0.45), clearance_m=0.2)
        self.assertEqual(self._cell(goal), (9, 4))

    def test_no_safe_cell_returns_none(self):
        data, w, h = self._grid()
        # Hanh lang 0.7 m khong the cach ca hai tuong 0.4 m.
        self.assertIsNone(
            safe_goal(data, w, h, RES, (0, 0), (0.95, 0.45), (0.25, 0.45), clearance_m=0.4)
        )


class TestFrontierStillOpen(unittest.TestCase):
    def test_open_when_a_frontier_is_near_target(self):
        fronts = [Frontier(goal=(2.0, 0.1), size=10, centroid=(2.0, 0.1))]
        self.assertTrue(frontier_still_open(fronts, (2.0, 0.0), radius=0.5))

    def test_closed_when_lidar_already_revealed_it(self):
        fronts = [Frontier(goal=(5.0, 0.0), size=10, centroid=(5.0, 0.0))]
        self.assertFalse(frontier_still_open(fronts, (2.0, 0.0), radius=0.5))
        self.assertFalse(frontier_still_open([], (2.0, 0.0), radius=0.5))


class TestFrontierMemory(unittest.TestCase):
    def test_done_blind_and_given_up_are_blacklisted(self):
        m = FrontierMemory()
        m.mark_done((1.0, 1.0))
        m.mark_blind((2.0, 2.0))
        m.give_up((3.0, 3.0))
        self.assertEqual(len(m.blacklist()), 3)

    def test_gives_up_after_max_failures(self):
        m = FrontierMemory(max_attempts=2)
        self.assertFalse(m.record_failure((1.0, 0.0)))
        self.assertEqual(m.blacklist(), [])
        self.assertTrue(m.record_failure((1.05, 0.0)))
        self.assertEqual(len(m.blacklist()), 1)

    def test_retry_round_reopens_done_and_given_up_but_not_blind(self):
        m = FrontierMemory(max_attempts=1)
        m.mark_done((5.0, 5.0))
        m.mark_blind((6.0, 6.0))
        m.record_failure((1.0, 0.0))
        self.assertEqual(m.retry_round(), 2)
        self.assertEqual(m.blacklist(), [(6.0, 6.0)])
        # dem lai tu dau sau vong thu lai
        self.assertTrue(m.record_failure((1.0, 0.0)))


class TestMotionWatchdog(unittest.TestCase):
    def test_standing_still_becomes_stuck(self):
        w = MotionWatchdog(timeout_sec=8.0)
        w.reset(0.0, (0.0, 0.0, 0.0))
        self.assertFalse(w.is_stuck(5.0, (0.01, 0.0, 0.02)))
        self.assertTrue(w.is_stuck(8.5, (0.02, 0.0, 0.03)))

    def test_rotation_counts_as_progress(self):
        w = MotionWatchdog(timeout_sec=8.0)
        w.reset(0.0, (0.0, 0.0, 0.0))
        self.assertFalse(w.is_stuck(6.0, (0.0, 0.0, 0.3)))   # xoay 17 do => moc moi
        self.assertFalse(w.is_stuck(12.0, (0.0, 0.0, 0.3)))  # moi dung yen 6 s
        self.assertTrue(w.is_stuck(14.5, (0.0, 0.0, 0.3)))

    def test_yaw_wraparound(self):
        w = MotionWatchdog(timeout_sec=8.0)
        w.reset(0.0, (0.0, 0.0, 3.13))
        self.assertTrue(w.is_stuck(9.0, (0.0, 0.0, -3.13)))  # chi lech 0.02 rad


class TestUnstick(unittest.TestCase):
    def test_goes_to_the_open_end(self):
        self.assertEqual(choose_unstick_direction(88.0, 1.0), "forward")   # duoi xe sat vat (log 14:12)
        self.assertEqual(choose_unstick_direction(20.0, 47.0), "backward")
        self.assertEqual(choose_unstick_direction(None, 10.0), "forward")  # khong thay gi phia truoc

    def test_boxed_in_returns_none(self):
        self.assertIsNone(choose_unstick_direction(20.0, 12.0))


class TestScanToPoints(unittest.TestCase):
    def test_skips_invalid_and_converts_angles(self):
        pts = scan_to_points(0.0, math.radians(90.0), [1.0, float("inf"), 0.01, 2.0])
        self.assertEqual([round(p["angle"]) for p in pts], [0, 270])
        self.assertEqual([p["distance"] for p in pts], [1.0, 2.0])


if __name__ == "__main__":
    unittest.main()
