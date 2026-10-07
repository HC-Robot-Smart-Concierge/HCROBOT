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


if __name__ == "__main__":
    unittest.main()
