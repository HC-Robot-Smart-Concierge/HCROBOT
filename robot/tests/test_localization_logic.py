import math
import os
import sys
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROBOT_DIR, "ros2_configs"))

from localization_logic import (  # noqa: E402
    LOCALIZED, LOCALIZING, LOST, UNLOCALIZED,
    LocalizationStateMachine, ScanMatch, load_last_pose, near_wall_mask, save_last_pose, scan_match,
)

RES = 0.05


def room(w=60, h=40):
    """Phong 3 x 2 m (0.05 m/o), tuong bao quanh + 1 tu o goc de phong khong doi xung."""
    data = [0] * (w * h)
    for y in range(h):
        for x in range(w):
            if x in (0, w - 1) or y in (0, h - 1) or (x >= 45 and y >= 28):
                data[y * w + x] = 100
    return data, w, h


def raycast_scan(data, w, h, pose, n=180, max_range=6.0):
    """Gia lap LiDAR tai pose (x, y, yaw) tren grid: ranges cho n tia quanh 360 do."""
    x0, y0, yaw = pose
    ranges = []
    for k in range(n):
        a = yaw - math.pi + k * (2 * math.pi / n)
        r = 0.0
        while r < max_range:
            r += RES / 2
            cx, cy = int((x0 + r * math.cos(a)) / RES), int((y0 + r * math.sin(a)) / RES)
            if not (0 <= cx < w and 0 <= cy < h) or data[cy * w + cx] >= 65:
                break
        ranges.append(r)
    return ranges, -math.pi, 2 * math.pi / n


class TestScanMatchScore(unittest.TestCase):
    def setUp(self):
        self.data, self.w, self.h = room()
        self.mask = near_wall_mask(self.data, self.w, self.h, RES, tol_m=0.10)
        self.grid = (self.w, self.h, RES, 0.0, 0.0)
        self.truth = (1.2, 0.8, 0.3)
        self.scan = raycast_scan(self.data, self.w, self.h, self.truth)

    def match_at(self, pose, ranges=None):
        r, amin, ainc = self.scan
        return scan_match(ranges or r, amin, ainc, 0.12, 8.0, pose, self.mask, self.grid)

    @staticmethod
    def accepted(m):
        return m.score >= 0.6 and m.weak_sector >= 0.3  # nguong mac dinh cua state machine

    def test_correct_pose_matches_walls(self):
        m = self.match_at(self.truth)
        self.assertGreater(m.beams, 50)
        self.assertGreater(m.score, 0.9)
        self.assertGreater(m.weak_sector, 0.8)
        self.assertTrue(self.accepted(m))

    def test_pose_shifted_along_the_walls_is_rejected(self):
        # Ti le tong van ~65% (tia vao 2 tuong song song van khop) - goc phan tu nhin vao tuong
        # cuoi phong moi lo ra sai lech.
        m = self.match_at((1.7, 0.8, 0.3))
        self.assertGreater(m.score, 0.6)
        self.assertLess(m.weak_sector, 0.3)
        self.assertFalse(self.accepted(m))
        self.assertFalse(self.accepted(self.match_at((1.2, 1.2, 0.3))))  # lech ngang 0.4 m

    def test_rotated_pose_is_rejected(self):
        self.assertFalse(self.accepted(self.match_at((1.2, 0.8, 0.3 + 0.6))))  # lech 34 do

    def test_person_next_to_robot_does_not_block_correct_pose(self):
        ranges, _amin, ainc = self.scan
        blocked = list(ranges)
        for k in range(len(blocked)):  # nguoi cach 0.4 m che 40 do phia truoc-trai
            if 0.0 <= -math.pi + k * ainc <= math.radians(40):
                blocked[k] = 0.4
        self.assertTrue(self.accepted(self.match_at(self.truth, blocked)))

    def test_too_few_beams_gives_no_match(self):
        self.assertIsNone(scan_match([float("inf")] * 20, -math.pi, 0.3, 0.12, 8.0,
                                     self.truth, self.mask, self.grid))


class TestStateMachine(unittest.TestCase):
    def setUp(self):
        self.sm = LocalizationStateMachine(good_score=0.6, lost_score=0.35, confirm_sec=2.0,
                                           lost_sec=3.0, localize_timeout_sec=20.0)

    def step(self, t, score, sigma=(0.2, 0.2), inputs_ok=True, sector=None):
        match = None if score is None else ScanMatch(score, score if sector is None else sector, 100)
        return self.sm.update(t, inputs_ok, "thieu LiDAR", match, *sigma)

    def test_good_total_but_one_blind_direction_is_not_enough(self):
        self.sm.on_initial_pose(0.0, "web")
        for t in (0.5, 1.5, 2.5, 3.5):
            self.step(t, 0.7, sector=0.05)
        self.assertEqual(self.sm.state, LOCALIZING)
        self.step(21.0, 0.7, sector=0.05)
        self.assertEqual(self.sm.state, UNLOCALIZED)
        self.assertIn("dọc theo tường", self.sm.reason)

    def test_starts_unlocalized_and_blocks_goals(self):
        self.assertEqual(self.sm.state, UNLOCALIZED)
        self.assertTrue(self.sm.should_cancel_goals())
        self.step(0.0, None, inputs_ok=False)
        self.assertIn("LiDAR", self.sm.reason)

    def test_unlocalized_reason_follows_inputs_but_keeps_failure_reason(self):
        self.step(0.0, None, inputs_ok=False)
        self.sm.update(1.0, True, "dat vi tri tren Web", None, None, None)
        self.assertEqual(self.sm.reason, "dat vi tri tren Web")  # het "thieu LiDAR" khi LiDAR da co
        self.sm.on_initial_pose(2.0, "web")
        self.step(23.0, 0.2)  # het gio xac minh
        failure = self.sm.reason
        self.sm.update(24.0, True, "dat vi tri tren Web", None, None, None)
        self.assertEqual(self.sm.reason, failure)  # giu ly do that bai cho nguoi dung doc
        self.sm.update(25.0, False, "thieu LiDAR", None, None, None)
        self.assertEqual(self.sm.reason, "thieu LiDAR")

    def test_initial_pose_then_sustained_match_localizes(self):
        self.sm.on_initial_pose(0.0, "web")
        self.assertEqual(self.sm.state, LOCALIZING)
        self.step(0.5, 0.8)
        self.step(1.5, 0.8)
        self.assertEqual(self.sm.state, LOCALIZING)  # chua du 2 s lien tuc
        self.step(2.6, 0.8)
        self.assertEqual(self.sm.state, LOCALIZED)
        self.assertFalse(self.sm.should_cancel_goals())

    def test_one_bad_reading_restarts_confirmation(self):
        self.sm.on_initial_pose(0.0, "web")
        self.step(0.5, 0.8)
        self.step(1.5, 0.2)
        self.step(2.6, 0.8)
        self.assertEqual(self.sm.state, LOCALIZING)

    def test_uncertain_amcl_is_not_enough_even_with_good_match(self):
        self.sm.on_initial_pose(0.0, "web")
        for t in (0.5, 1.5, 2.5, 3.5):
            self.step(t, 0.9, sigma=(0.8, 0.2))
        self.assertEqual(self.sm.state, LOCALIZING)

    def test_never_matching_times_out_back_to_unlocalized(self):
        self.sm.on_initial_pose(0.0, "web")
        self.step(10.0, 0.3)
        self.step(21.0, 0.3)
        self.assertEqual(self.sm.state, UNLOCALIZED)
        self.assertIn("30%", self.sm.reason)

    def test_lost_after_sustained_mismatch_then_recovers(self):
        self.sm.on_initial_pose(0.0, "web")
        self.step(0.1, 0.8)
        self.step(2.2, 0.8)
        self.assertEqual(self.sm.state, LOCALIZED)
        self.step(3.0, 0.2)
        self.step(5.0, 0.2)
        self.assertEqual(self.sm.state, LOCALIZED)  # 2 s chua du lost_sec
        self.step(6.1, 0.2)
        self.assertEqual(self.sm.state, LOST)
        self.assertTrue(self.sm.should_cancel_goals())
        self.step(7.0, 0.8)
        self.step(9.1, 0.8)
        self.assertEqual(self.sm.state, LOCALIZED)

    def test_new_initial_pose_while_localized_reverifies(self):
        self.sm.on_initial_pose(0.0, "web")
        self.step(0.1, 0.8)
        self.step(2.2, 0.8)
        self.sm.on_initial_pose(3.0, "web")
        self.assertEqual(self.sm.state, LOCALIZING)


class TestLastPoseFile(unittest.TestCase):
    def test_roundtrip_and_map_mismatch(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "sub", "phong.json")
            save_last_pose(path, "phong", 1.25, -0.5, 1.57)
            self.assertEqual(load_last_pose(path, "phong"), {"map": "phong", "x": 1.25, "y": -0.5, "yaw": 1.57,
                                                             "saved_at": load_last_pose(path, "phong")["saved_at"]})
            self.assertIsNone(load_last_pose(path, "phong_khac"))
            self.assertIsNone(load_last_pose(os.path.join(d, "khong_co.json"), "phong"))
            with open(path, "w", encoding="utf-8") as f:
                f.write("{hong")
            self.assertIsNone(load_last_pose(path, "phong"))


if __name__ == "__main__":
    unittest.main()
