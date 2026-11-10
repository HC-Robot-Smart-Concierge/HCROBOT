import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import lidar_service  # noqa: E402

RES = 0.05
W = H = 60  # 3m x 3m


def _room_with_wall_gap():
    """Phong 3x3m da quet (o trong), tuong ngang y=1.5m chan het, chi ho o x in [1.8, 2.8]m.

    Ho rong 1m vi planner noi tuong ~0.25m moi ben (ban kinh robot + le an toan).
    """
    grid = [0] * (W * H)
    wall_gy = int(1.5 / RES)
    for gx in range(W):
        x = (gx + 0.5) * RES
        if not (1.8 <= x <= 2.8):
            grid[wall_gy * W + gx] = 100
    return grid, wall_gy


class TestFrontierRoute(unittest.TestCase):
    def setUp(self):
        self.core = lidar_service.RPLidarSLAMCore(port="/dev/null")
        grid, self.wall_gy = _room_with_wall_gap()
        self.core.grid_data = grid
        self.core.grid_width = W
        self.core.grid_height = H
        self.core.resolution = RES
        self.core.origin_x = 0.0
        self.core.origin_y = 0.0
        self.core.robot_x = 0.5
        self.core.robot_y = 0.5
        self.core.nav_zones = []

    def test_route_goes_through_gap_not_through_wall(self):
        route = self.core._plan_frontier_route(0.5, 2.5)
        self.assertIsNotNone(route)
        self.assertGreater(len(route), 1, "phai vong qua cho ho, khong di thang")
        # Moi doan thang cua duong di cat qua hang tuong chi duoc o cho ho
        pts = [(self.core.robot_x, self.core.robot_y)] + list(route)
        wall_y = (self.wall_gy + 0.5) * RES
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if (y0 - wall_y) * (y1 - wall_y) < 0:
                xc = x0 + (x1 - x0) * (wall_y - y0) / (y1 - y0)
                self.assertTrue(1.8 <= xc <= 2.8, f"duong cat tuong tai x={xc:.2f}")
        self.assertAlmostEqual(route[-1][0], 0.5, places=2)
        self.assertAlmostEqual(route[-1][1], 2.5, places=2)

    def test_drive_follows_each_waypoint(self):
        with mock.patch.object(self.core, "_navigate_to_sync", return_value=True) as nav:
            ok = self.core._drive_to_frontier(0.5, 2.5)
        self.assertTrue(ok)
        self.assertGreater(nav.call_count, 1)
        last_call = nav.call_args_list[-1]
        self.assertEqual(last_call.kwargs["goal_radius"], 0.30)

    def test_drive_falls_back_to_direct_when_no_route(self):
        # Bit lo hong => khong co duong qua tuong
        self.core.grid_data = [100 if gy == self.wall_gy else 0 for gy in range(H) for _ in range(W)]
        with mock.patch.object(self.core, "_navigate_to_sync", return_value=False) as nav:
            ok = self.core._drive_to_frontier(0.5, 2.5)
        self.assertFalse(ok)
        nav.assert_called_once_with(0.5, 2.5, timeout=25.0, goal_radius=0.30)


if __name__ == "__main__":
    unittest.main()
