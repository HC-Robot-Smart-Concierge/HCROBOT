import os
import sys
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROBOT_DIR, "ros2_configs"))

from frontier_logic import Frontier, choose_frontier, find_frontiers  # noqa: E402

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


if __name__ == "__main__":
    unittest.main()
