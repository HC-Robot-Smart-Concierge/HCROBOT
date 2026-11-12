import json
import os
import shutil
import sys
import tempfile
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROBOT_DIR)

from scripts import lidar_service  # noqa: E402
from scripts.ros_map_io import load_ros_map_yaml, read_ros_map_info  # noqa: E402

MAPS = os.path.join(ROBOT_DIR, "maps")


def _write_map(dirpath, name, rows, origin=(-1.0, -2.0), free_thresh=0.196):
    """rows: list chuoi tu tren xuong, '#'=tuong(0) '.'=trong(254) '?'=chua biet(205)."""
    h, w = len(rows), len(rows[0])
    px = {"#": 0, ".": 254, "?": 205}
    data = bytes(px[c] for row in rows for c in row)
    with open(os.path.join(dirpath, f"{name}.pgm"), "wb") as f:
        f.write(f"P5\n# comment\n{w} {h}\n255\n".encode("ascii") + data)
    with open(os.path.join(dirpath, f"{name}.yaml"), "w", encoding="utf-8") as f:
        f.write(
            f"image: {name}.pgm\nmode: trinary\nresolution: 0.05\n"
            f"origin: [{origin[0]}, {origin[1]}, 0.0]\nnegate: 0\n"
            f"occupied_thresh: 0.65\nfree_thresh: {free_thresh}\n"
        )


class TestRosMapIo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_flip_and_values(self):
        _write_map(self.tmp, "m", ["#?", ".#"])
        d = load_ros_map_yaml(os.path.join(self.tmp, "m.yaml"))
        self.assertEqual((d["width"], d["height"]), (2, 2))
        self.assertEqual((d["origin_x"], d["origin_y"]), (-1.0, -2.0))
        # Hang day cua grid = hang cuoi cua anh
        self.assertEqual(d["grid_data"], [0, 100, 100, -1])

    def test_unknown_205_stays_unknown_even_with_loose_free_thresh(self):
        _write_map(self.tmp, "m", ["?"], free_thresh=0.25)
        self.assertEqual(load_ros_map_yaml(os.path.join(self.tmp, "m.yaml"))["grid_data"], [-1])

    def test_info_reads_header_only(self):
        _write_map(self.tmp, "m", ["###", "..."])
        info = read_ros_map_info(os.path.join(self.tmp, "m.yaml"))
        self.assertEqual((info["width"], info["height"], info["resolution"]), (3, 2, 0.05))

    @unittest.skipUnless(os.path.exists(os.path.join(MAPS, "layout2.yaml")), "thieu map that")
    def test_real_map_matches_existing_json(self):
        d = load_ros_map_yaml(os.path.join(MAPS, "layout2.yaml"))
        ref = json.load(open(os.path.join(MAPS, "layout2.json"), encoding="utf-8"))
        self.assertEqual((d["width"], d["height"]), (ref["width"], ref["height"]))
        self.assertEqual(d["grid_data"], ref["grid_data"])


class TestLoadMapFallback(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.orig = lidar_service.MAPS_DIR
        lidar_service.MAPS_DIR = self.tmp
        self.core = lidar_service.RPLidarSLAMCore(port="/dev/null")

    def tearDown(self):
        lidar_service.MAPS_DIR = self.orig
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_loads_yaml_only_map_and_lists_it(self):
        _write_map(self.tmp, "ros_only", ["###", "#.#", "###"])
        self.assertTrue(self.core.load_map("ros_only"))
        self.assertEqual((self.core.grid_width, self.core.grid_height), (3, 3))
        self.assertEqual(sum(v == 100 for v in self.core.grid_data), 8)
        self.assertTrue(self.core.is_map_locked)
        names = [m["name"] for m in self.core.list_saved_maps()]
        self.assertIn("ros_only", names)

    def test_json_with_data_key_is_accepted(self):
        with open(os.path.join(self.tmp, "old.json"), "w", encoding="utf-8") as f:
            json.dump({"width": 2, "height": 1, "resolution": 0.05,
                       "origin_x": 0, "origin_y": 0, "data": [100, 0]}, f)
        self.assertTrue(self.core.load_map("old"))
        self.assertEqual(self.core.grid_data, [100, 0])

    def test_broken_json_falls_back_to_yaml(self):
        _write_map(self.tmp, "both", ["#."])
        with open(os.path.join(self.tmp, "both.json"), "w", encoding="utf-8") as f:
            json.dump({"width": 2, "height": 1, "grid_data": []}, f)
        self.assertTrue(self.core.load_map("both"))
        self.assertEqual(self.core.grid_data, [100, 0])

    def test_missing_map_returns_false(self):
        self.assertFalse(self.core.load_map("khong_co"))


if __name__ == "__main__":
    unittest.main()
