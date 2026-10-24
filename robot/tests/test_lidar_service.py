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
        # Add a minimally valid room map (wall cells + ray-traced free space).
        self.core.grid_data[:10] = [100] * 10
        self.core.grid_data[10:200] = [0] * 190
        self.core.robot_x = 1.25
        self.core.robot_y = 2.50
        self.core.robot_yaw = 45.0

    def tearDown(self):
        lidar_service.MAPS_DIR = self.original_maps_dir
        shutil.rmtree(self.temp_maps_dir, ignore_errors=True)

    def test_save_map_creates_json_yaml_and_pgm(self):
        res = self.core.save_map("test_room")
        self.assertEqual(res["name"], "test_room")
        self.assertEqual(res["occupied_cells"], 10)
        self.assertEqual(res["free_cells"], 190)

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
        self.assertTrue(self.core.is_map_locked)
        self.assertEqual(self.core.map_mode, "NAVIGATION")

    def test_navigation_mode_never_overwrites_saved_grid(self):
        self.core.save_map("fixed_room")
        frozen = list(self.core.grid_data)

        self.core._update_grid_from_scan(
            0.0,
            0.0,
            [{"x": 1.0, "y": 0.0, "distance": 1.0, "angle": 0.0}],
        )

        self.assertEqual(self.core.grid_data, frozen)

    def test_reset_starts_a_new_mapping_session(self):
        self.core.save_map("fixed_room")
        self.core.reset_map()

        self.assertFalse(self.core.is_map_locked)
        self.assertEqual(self.core.map_mode, "MAPPING")
        self.assertTrue(all(value == -1 for value in self.core.grid_data))

    def test_load_map_restores_data(self):
        self.core.save_map("saved_floor")

        # Reset core map
        self.core.reset_map()
        self.assertEqual(self.core.grid_data[0], -1)

        # Load back
        ok = self.core.load_map("saved_floor")
        self.assertTrue(ok)
        self.assertEqual(self.core.grid_data[0], 100)
        self.assertEqual(self.core.grid_data[10], 0)
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

    def test_empty_map_is_rejected_without_creating_files(self):
        self.core.grid_data = [-1] * (self.core.grid_width * self.core.grid_height)

        with self.assertRaisesRegex(ValueError, "Từ chối lưu"):
            self.core.save_map("must_not_overwrite")

        self.assertFalse(os.path.exists(os.path.join(self.temp_maps_dir, "must_not_overwrite.json")))
        self.assertFalse(os.path.exists(os.path.join(self.temp_maps_dir, "must_not_overwrite.yaml")))
        self.assertFalse(os.path.exists(os.path.join(self.temp_maps_dir, "must_not_overwrite.pgm")))

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


if __name__ == "__main__":
    unittest.main()
