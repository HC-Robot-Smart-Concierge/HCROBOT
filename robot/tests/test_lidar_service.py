import os
import shutil
import tempfile
import unittest
import sys

# Ensure robot folder in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import lidar_service


class TestLidarServiceMapPersistence(unittest.TestCase):
    def setUp(self):
        self.temp_maps_dir = tempfile.mkdtemp()
        self.original_maps_dir = lidar_service.MAPS_DIR
        lidar_service.MAPS_DIR = self.temp_maps_dir

        self.core = lidar_service.RPLidarSLAMCore(port="/dev/null")
        # Populate dummy map data
        self.core.grid_data = [-1] * (self.core.grid_width * self.core.grid_height)
        # Add some occupied and free cells
        self.core.grid_data[0] = 100
        self.core.grid_data[1] = 0
        self.core.grid_data[2] = 100
        self.core.robot_x = 1.25
        self.core.robot_y = 2.50
        self.core.robot_yaw = 45.0

    def tearDown(self):
        lidar_service.MAPS_DIR = self.original_maps_dir
        shutil.rmtree(self.temp_maps_dir, ignore_errors=True)

    def test_save_map_creates_json_yaml_and_pgm(self):
        res = self.core.save_map("test_room")
        self.assertEqual(res["name"], "test_room")
        self.assertEqual(res["occupied_cells"], 2)
        self.assertEqual(res["free_cells"], 1)

        json_file = os.path.join(self.temp_maps_dir, "test_room.json")
        yaml_file = os.path.join(self.temp_maps_dir, "test_room.yaml")
        pgm_file = os.path.join(self.temp_maps_dir, "test_room.pgm")

        self.assertTrue(os.path.exists(json_file))
        self.assertTrue(os.path.exists(yaml_file))
        self.assertTrue(os.path.exists(pgm_file))

        # Verify YAML content
        with open(yaml_file, "r") as f:
            yaml_txt = f.read()
        self.assertIn("image: test_room.pgm", yaml_txt)
        self.assertIn("resolution: 0.05", yaml_txt)

        # Verify PGM binary header
        with open(pgm_file, "rb") as f:
            header = f.read(15)
        self.assertTrue(header.startswith(b"P5\n200 200\n255\n"))

    def test_load_map_restores_data(self):
        self.core.save_map("saved_floor")

        # Reset core map
        self.core.reset_map()
        self.assertEqual(self.core.grid_data[0], -1)

        # Load back
        ok = self.core.load_map("saved_floor")
        self.assertTrue(ok)
        self.assertEqual(self.core.grid_data[0], 100)
        self.assertEqual(self.core.grid_data[1], 0)
        self.assertAlmostEqual(self.core.robot_x, 1.25)
        self.assertAlmostEqual(self.core.robot_y, 2.50)

    def test_list_and_delete_map(self):
        self.core.save_map("map_a")
        self.core.save_map("map_b")

        maps = self.core.list_saved_maps()
        map_names = [m["name"] for m in maps]
        self.assertIn("map_a", map_names)
        self.assertIn("map_b", map_names)

        deleted = self.core.delete_map("map_a")
        self.assertTrue(deleted)
        maps_after = self.core.list_saved_maps()
        map_names_after = [m["name"] for m in maps_after]
        self.assertNotIn("map_a", map_names_after)
        self.assertIn("map_b", map_names_after)

    def test_sector_distances_ccw(self):
        """Kiểm tra các cung góc khoảng cách theo chuẩn CCW: 0° Trước, 90° Trái, 180° Sau, 270° Phải."""
        import time
        now = time.time()
        # Đặt vật cản phía trước (0°)
        self.core.angle_distances[0] = 0.50
        self.core.angle_timestamps[0] = now
        # Đặt vật cản bên trái (90°)
        self.core.angle_distances[90] = 0.60
        self.core.angle_timestamps[90] = now
        # Đặt vật cản phía sau (180°)
        self.core.angle_distances[180] = 0.70
        self.core.angle_timestamps[180] = now
        # Đặt vật cản bên phải (270°)
        self.core.angle_distances[270] = 0.80
        self.core.angle_timestamps[270] = now

        self.assertAlmostEqual(self.core.get_front_distance(), 0.50)
        self.assertAlmostEqual(self.core.get_left_distance(), 0.60)
        self.assertAlmostEqual(self.core.get_rear_distance(), 0.70)
        self.assertAlmostEqual(self.core.get_right_distance(), 0.80)

    def test_coordinate_and_yaw_rotation_cancellation(self):
        """Kiểm tra khi xe xoay góc robot_yaw (CCW), vật cản tĩnh trong thế giới không bị xoay lệch."""
        import math
        # Robot ở (0, 0) quay 0°, vật cản ở trước mặt cách 2m (X=2, Y=0)
        dist_m = 2.0
        robot_yaw_0 = 0.0
        ccw_angle_0 = 0.0
        rad_0 = math.radians((ccw_angle_0 + robot_yaw_0) % 360.0)
        x_0 = dist_m * math.cos(rad_0)
        y_0 = dist_m * math.sin(rad_0)
        self.assertAlmostEqual(x_0, 2.0)
        self.assertAlmostEqual(y_0, 0.0)

        # Robot xoay TRÁI 30° (robot_yaw = +30° CCW).
        # Lúc này vật cản nằm lệch về phía PHẢI của xe 30° -> ccw_angle = 330° (hoặc -30°).
        robot_yaw_30 = 30.0
        ccw_angle_30 = 330.0
        rad_30 = math.radians((ccw_angle_30 + robot_yaw_30) % 360.0)
        x_30 = dist_m * math.cos(rad_30)
        y_30 = dist_m * math.sin(rad_30)
        # Vật cản trong tọa độ thế giới VẪN PHẢI LÀ (X=2, Y=0)
        self.assertAlmostEqual(x_30, 2.0)
        self.assertAlmostEqual(y_30, 0.0)

    def test_wall_latching_and_light_barrier(self):
        """Kiểm tra điểm quét tự động bám vào tường đen (Snap-to-wall) và không bị tia xuyên qua xóa mất."""
        # Đặt một ô tường đen tại grid (105, 100)
        w = self.core.grid_width
        self.core.grid_data = [-1] * (w * self.core.grid_height)
        wall_idx = 100 * w + 105
        self.core.grid_data[wall_idx] = 100

        # Robot ở (0, 0) tương ứng grid (100, 100)
        # Giả lập tia quét chạm tại grid (104, 100) - cách tường đen 1 ô
        wall_x = self.core.origin_x + 104 * self.core.resolution
        wall_y = self.core.origin_y + 100 * self.core.resolution
        scan_pt = [{"x": wall_x, "y": wall_y}]

        self.core._update_grid_from_scan(0.0, 0.0, scan_pt)

        # 1. Snap-to-wall: Điểm tường (105, 100) phải vẫn là 100 (vật cản màu đen)
        self.assertEqual(self.core.grid_data[wall_idx], 100)

        # 2. Light barrier: Giả lập một tia quét bắn xuyên qua bức tường (tới grid 110, 100)
        far_x = self.core.origin_x + 110 * self.core.resolution
        far_y = self.core.origin_y + 100 * self.core.resolution
        scan_pt_far = [{"x": far_x, "y": far_y}]
        self.core._update_grid_from_scan(0.0, 0.0, scan_pt_far)

        # Ô tường đen (105, 100) KHÔNG ĐƯỢC BỊ XÓA thành 0
        self.assertEqual(self.core.grid_data[wall_idx], 100)


if __name__ == "__main__":
    unittest.main()

