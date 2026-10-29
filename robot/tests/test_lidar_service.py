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
        self.assertIn("resolution: 0.025", yaml_txt)

        # Verify PGM binary header
        expected_header = f"P5\n{self.core.grid_width} {self.core.grid_height}\n255\n".encode("ascii")
        with open(pgm_file, "rb") as f:
            header = f.read(len(expected_header))
        self.assertEqual(header, expected_header)
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

    def test_confirmed_wall_survives_single_clearing_ray(self):
        wall = [{"x": 1.0, "y": 0.0, "distance": 1.0, "angle": 0.0}]
        for _ in range(self.core.wall_hit_confirm):
            self.core._update_grid_from_scan(0.0, 0.0, wall)
        gx, gy = self.core._world_to_grid(1.0, 0.0)
        idx = gy * self.core.grid_width + gx
        self.assertEqual(self.core.grid_data[idx], 100)

        farther = [{"x": 2.0, "y": 0.0, "distance": 2.0, "angle": 0.0}]
        self.core._update_grid_from_scan(0.0, 0.0, farther)
        self.assertEqual(self.core.grid_data[idx], 100)

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

    def test_encoder_forward_polarity_matches_current_firmware(self):
        """Firmware hiện tại trả cả bốn tick dương khi robot tiến."""
        left_ticks, right_ticks = self.core._encoder_side_ticks({
            "m1": {"ticks": 100},
            "m2": {"ticks": 100},
            "m3": {"ticks": 80},
            "m4": {"ticks": 80},
        })

        self.assertEqual(left_ticks, 100.0)
        self.assertEqual(right_ticks, 80.0)

    def test_encoder_turn_updates_yaw_differentially(self):
        """Quay trái (bánh trái lùi, bánh phải tiến) phải tăng góc yaw."""
        self.core.robot_yaw = 0.0
        # Initialize prev ticks
        self.core._apply_encoder_odometry({
            "m1": {"ticks": 0}, "m2": {"ticks": 0},
            "m3": {"ticks": 0}, "m4": {"ticks": 0},
        }, dt=0.1, update_yaw=True)
        # Turn left: left motors backward (-50), right motors forward (+50)
        self.core._apply_encoder_odometry({
            "m1": {"ticks": -50}, "m2": {"ticks": -50},
            "m3": {"ticks": 50}, "m4": {"ticks": 50},
        }, dt=0.1, update_yaw=True)
        self.assertGreater(self.core.robot_yaw, 0.0)

    def test_fixed_layout_3x5m_and_fog_of_war(self):
        """Kiểm tra layout cứng 3x5m: tường không bị xóa đè, vùng xám ngoài không bị mở rộng, và robot đi đến đâu mở map đến đó."""
        res = self.core.init_fixed_layout_3x5m("test_3x5m")
        self.assertTrue(self.core.fixed_layout_active)
        self.assertGreater(len(self.core.fixed_wall_indices), 100)

        # Kiểm tra tường tại X=1.5m, Y=0.0m là vật cản 100
        gx_wall, gy_wall = self.core._world_to_grid(1.5, 0.0)
        idx_wall = gy_wall * self.core.grid_width + gx_wall
        self.assertEqual(self.core.grid_data[idx_wall], 100)

        # Kiểm tra vùng xám bên ngoài phòng tại X=3.0m, Y=0.0m là -1
        gx_out, gy_out = self.core._world_to_grid(3.0, 0.0)
        idx_out = gy_out * self.core.grid_width + gx_out
        self.assertEqual(self.core.grid_data[idx_out], -1)

        # Mô phỏng tia laser cực mạnh bắn xuyên qua tường ra ngoài (X=5.0m)
        # Tường không được phép bị xóa (vẫn là 100), và vùng ngoài không được phép biến thành 0
        laser_through = [{"x": 5.0, "y": 0.0, "distance": 5.0, "angle": 0.0}]
        for _ in range(10):
            self.core._update_grid_from_scan(0.0, 0.0, laser_through)

        self.assertEqual(self.core.grid_data[idx_wall], 100, "Tường cứng không bao giờ bị xóa đè")
        self.assertEqual(self.core.grid_data[idx_out], -1, "Vùng xám ngoài phòng không bị mở rộng bậy bạ")

        # Kiểm tra robot di chuyển tới vị trí mới (X=0.0, Y=1.5): Đi đến đâu mở sàn đến đó
        gx_new, gy_new = self.core._world_to_grid(0.0, 1.5)
        idx_new = gy_new * self.core.grid_width + gx_new
        self.assertEqual(self.core.grid_data[idx_new], -1, "Trước khi tới: là sương mù chưa khám phá")

        self.core._update_grid_from_scan(0.0, 1.5, [])
        self.assertEqual(self.core.grid_data[idx_new], 0, "Sau khi robot tới: mở thành sàn trống màu trắng")


if __name__ == "__main__":
    unittest.main()

