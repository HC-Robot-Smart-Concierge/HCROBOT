import json
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import lidar_service  # noqa: E402
from scripts.nav_planner import PlanGrid, plan_path, point_in_zone  # noqa: E402


class TestRotatedZones(unittest.TestCase):
    def test_pi_zone_sync_keeps_rotation_for_endpoint_checks(self):
        core = lidar_service.RPLidarSLAMCore(port="/dev/null")
        core.set_nav_zones([dict(id="z", name="Rotated", type="NO_STOP", x=2, y=2,
                                 width=2, height=.4, yaw=90)])
        self.assertEqual(core.nav_zones[0]["yaw"], 90)
        self.assertTrue(point_in_zone(2, 2.8, core.nav_zones[0]))

    def test_rotated_keepout_blocks_cells_beyond_old_horizontal_bounds(self):
        zone = dict(x=2, y=2, width=2, height=.4, yaw=90)
        self.assertTrue(point_in_zone(2, 2.8, zone))
        self.assertFalse(point_in_zone(2.8, 2, zone))
        grid = PlanGrid([0] * 1600, 40, 40, .1, 0, 0,
                        keepout_zones=[zone], robot_radius=0, inflate_margin=0)
        x, y = grid.to_cell(2.05, 2.85)
        self.assertTrue(grid.blocked[y * grid.w + x])
        x, y = grid.to_cell(2.85, 2.05)
        self.assertFalse(grid.blocked[y * grid.w + x])

RES = 0.05


def make_room(width_m=4.0, height_m=3.0):
    """Phong rong co tuong bao 1 o, goc (0, 0) o goc duoi trai."""
    w, h = int(width_m / RES), int(height_m / RES)
    grid = [0] * (w * h)
    for x in range(w):
        grid[x] = grid[(h - 1) * w + x] = 100
    for y in range(h):
        grid[y * w] = grid[y * w + w - 1] = 100
    return grid, w, h


def wall_x(grid, w, x_m, y0_m, y1_m):
    gx = int(x_m / RES)
    for gy in range(int(y0_m / RES), int(y1_m / RES)):
        for dx in (0, 1):
            grid[gy * w + gx + dx] = 100


def segment_samples(path, start, step=0.02):
    pts = [start] + list(path)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        for i in range(n + 1):
            yield x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n


def crosses_occupied(grid, w, h, res, ox, oy, path, start):
    for x, y in segment_samples(path, start):
        gx, gy = int((x - ox) / res), int((y - oy) / res)
        if 0 <= gx < w and 0 <= gy < h and grid[gy * w + gx] == 100:
            return True
    return False


class TestNavPlanner(unittest.TestCase):
    def test_path_goes_around_wall_on_map(self):
        grid, w, h = make_room()
        # Tuong giua phong tu day len 2.2m, chi chua lo phia tren
        wall_x(grid, w, 2.0, 0.0, 2.2)
        pg = PlanGrid(grid, w, h, RES, 0.0, 0.0)
        start, goal = (0.5, 0.5), (3.5, 0.5)

        path, msg = plan_path(pg, start, goal)

        self.assertIsNotNone(path, msg)
        self.assertEqual(path[-1], goal)
        self.assertGreater(len(path), 1, "Phai re vong qua tuong, khong di thang")
        self.assertFalse(crosses_occupied(grid, w, h, RES, 0.0, 0.0, path, start))
        self.assertTrue(any(y > 2.2 for _, y in path), "Duong di phai vong qua lo phia tren tuong")

    def test_keepout_zone_blocks_direct_route(self):
        grid, w, h = make_room()
        zone = {"type": "KEEP_OUT", "x": 2.0, "y": 1.0, "width": 0.8, "height": 1.8}
        pg = PlanGrid(grid, w, h, RES, 0.0, 0.0, keepout_zones=[zone])
        start, goal = (0.5, 1.0), (3.5, 1.0)

        path, msg = plan_path(pg, start, goal)

        self.assertIsNotNone(path, msg)
        for x, y in segment_samples(path, start):
            self.assertFalse(point_in_zone(x, y, zone), f"Di xuyen vung cam tai ({x:.2f}, {y:.2f})")

    def test_no_path_when_fully_blocked(self):
        grid, w, h = make_room()
        wall_x(grid, w, 2.0, 0.0, 3.0)
        pg = PlanGrid(grid, w, h, RES, 0.0, 0.0)

        path, msg = plan_path(pg, (0.5, 1.5), (3.5, 1.5))

        self.assertIsNone(path)
        self.assertIn("Không tìm được đường", msg)

    def test_goal_on_wall_is_rejected(self):
        grid, w, h = make_room()
        wall_x(grid, w, 2.0, 0.0, 3.0)
        pg = PlanGrid(grid, w, h, RES, 0.0, 0.0)
        # Dich nam giua buc tuong day; o trong gan nhat o ca hai phia nhung phia kia bi chan
        path, _ = plan_path(pg, (0.5, 1.5), (2.02, 1.5))
        if path is not None:
            self.assertLess(path[-1][0], 2.0, "Chi duoc dung o phia robot dang dung")

    def test_layout2_route_avoids_walls(self):
        """Truong hop trong anh: tu Dock (0, 0) toi (3.31, 0.61) tren map layout2 that."""
        maps_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
        with open(os.path.join(maps_dir, "layout2.json"), encoding="utf-8") as f:
            data = json.load(f)
        grid, w, h = data["grid_data"], data["width"], data["height"]
        res, ox, oy = data["resolution"], data["origin_x"], data["origin_y"]
        pg = PlanGrid(grid, w, h, res, ox, oy)
        start = (0.0, 0.0)

        path, msg = plan_path(pg, start, (3.31, 0.61))

        self.assertIsNotNone(path, msg)
        self.assertFalse(crosses_occupied(grid, w, h, res, ox, oy, path, start))


class TestNavigateToZones(unittest.TestCase):
    def setUp(self):
        self.core = lidar_service.RPLidarSLAMCore(port="/dev/null")
        self.core.send_udp_motor_command = lambda *a, **k: None

    def test_goal_inside_keepout_is_rejected(self):
        self.core.set_nav_zones([{"id": "z1", "name": "Cấm", "type": "KEEP_OUT", "x": 1.0, "y": 1.0, "width": 1.0, "height": 1.0}])
        res = self.core.navigate_to(1.0, 1.0)
        self.assertFalse(res["ok"])
        self.assertIn("vùng cấm vào", res["message"])
        self.assertFalse(self.core.is_navigating)

    def test_goal_inside_no_stop_is_rejected(self):
        self.core.set_nav_zones([{"id": "z2", "name": "Lối đi", "type": "NO_STOP", "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}])
        res = self.core.navigate_to(0.1, 0.1)
        self.assertFalse(res["ok"])
        self.assertIn("vùng cấm dừng", res["message"])

    def test_plan_route_uses_loaded_static_map(self):
        grid, w, h = make_room()
        wall_x(grid, w, 2.0, 0.0, 2.2)
        core = self.core
        core.grid_width, core.grid_height, core.resolution = w, h, RES
        core.origin_x = core.origin_y = 0.0
        core.static_grid_data = grid
        core.is_map_locked = True
        core.robot_x, core.robot_y = 0.5, 0.5

        path, msg = core.plan_route(3.5, 0.5)

        self.assertIsNotNone(path, msg)
        self.assertFalse(crosses_occupied(grid, w, h, RES, 0.0, 0.0, path, (0.5, 0.5)))


if __name__ == "__main__":
    unittest.main()
