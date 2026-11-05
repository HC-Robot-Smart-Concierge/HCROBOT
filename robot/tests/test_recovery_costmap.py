import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ros2_configs"))
from recovery_costmap import CostmapGrid, grid_sweep_clear, scan_sweep_clear


def free_grid():
    return CostmapGrid(160, 160, 0.025, (-2.0, -2.0, 0.0), [0] * (160 * 160))


def set_cell(grid, x, y, value):
    ox, oy, yaw = grid.origin
    cx = int((math.cos(yaw) * (x - ox) + math.sin(yaw) * (y - oy)) / grid.resolution)
    cy = int((-math.sin(yaw) * (x - ox) + math.cos(yaw) * (y - oy)) / grid.resolution)
    grid.data[cy * grid.width + cx] = value


class TestRecoveryCostmap(unittest.TestCase):
    def test_real_reported_angle_can_rotate_in_free_space(self):
        duration = math.radians(43.7) / 0.5
        self.assertTrue(scan_sweep_clear([], True, 0, 0.5, duration))
        self.assertTrue(grid_sweep_clear(free_grid(), (0, 0, 0), 0, 0.5, duration))

    def test_front_corner_sweep_blocks_rotation_even_if_current_pose_fits(self):
        points = [(0.12, 0.17)]
        grid = free_grid()
        set_cell(grid, 0.12, 0.17, 100)
        self.assertTrue(scan_sweep_clear(points, True, 0, 0, 0.1))
        self.assertFalse(scan_sweep_clear(points, True, 0, 0.5, 1.6))
        self.assertTrue(grid_sweep_clear(grid, (0, 0, 0), 0, 0, 0.1))
        self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), 0, 0.5, 1.6))

    def test_both_forward_and_reverse_check_the_whole_body(self):
        for vx, point in ((0.18, (0.30, 0.10)), (-0.18, (-0.29, 0.10))):
            grid = free_grid()
            set_cell(grid, *point, 100)
            self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), vx, 0, 0.6))
            self.assertFalse(scan_sweep_clear([point], True, vx, 0, 0.6))

    def test_costmap_and_lidar_are_independent_collision_evidence(self):
        grid = free_grid()
        set_cell(grid, -0.29, 0, 100)
        self.assertTrue(scan_sweep_clear([], True, -0.18, 0, 0.6))
        self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), -0.18, 0, 0.6))

    def test_unknown_outside_and_malformed_costmaps_do_not_allow_motion(self):
        grid = free_grid()
        set_cell(grid, -0.29, 0, -1)
        self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), -0.18, 0, 0.6))
        self.assertFalse(grid_sweep_clear(grid, (1.9, 0, 0), 0.18, 0, 0.6))
        grid.data = []
        self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), 0, 0.5, 1))
        self.assertFalse(scan_sweep_clear([], False, 0, 0.5, 1))

    def test_soft_inflation_cost_is_not_a_second_physical_obstacle(self):
        grid = free_grid()
        grid.data[:] = [99] * len(grid.data)
        self.assertTrue(grid_sweep_clear(grid, (0, 0, 0), 0, 0.5, 1.6))

    def test_rotated_costmap_origin(self):
        grid = free_grid()
        grid.origin = (2.0, -2.0, math.pi / 2)
        self.assertTrue(grid_sweep_clear(grid, (0, 0, 0), -0.18, 0, 0.6))
        set_cell(grid, -0.29, 0, 100)
        self.assertFalse(grid_sweep_clear(grid, (0, 0, 0), -0.18, 0, 0.6))


if __name__ == "__main__":
    unittest.main()
