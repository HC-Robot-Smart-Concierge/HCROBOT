import os
import sys
import time
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROBOT_DIR)
sys.path.insert(0, os.path.join(ROBOT_DIR, "ros2_configs"))

from robot_status import (  # noqa: E402
    describe_drive_block, diagnose_stuck, format_status_line, lidar_clearances, threshold_warnings,
)
from obstacle_safety import ObstacleSafetyController  # noqa: E402
from test_ultrasonic_safety import FakeMotor, FakeReader, snapshot  # noqa: E402


class TestLidarClearances(unittest.TestCase):
    def test_edges_account_for_body_and_lidar_offset(self):
        # LiDAR at body centre; measured half-body 0.165 x 0.085 m.
        pts = [
            {"angle": 0.0, "distance": 0.38},
            {"angle": 90.0, "distance": 0.20},   # hong trai: 11.5 cm
            {"angle": 270.0, "distance": 0.50},  # hong phai: 41.5 cm
            {"angle": 180.0, "distance": 0.50},  # sau: 33.5 cm
        ]
        c = lidar_clearances(pts)
        self.assertAlmostEqual(c["front"], 21.5)
        self.assertAlmostEqual(c["left"], 11.5)
        self.assertAlmostEqual(c["right"], 41.5)
        self.assertAlmostEqual(c["rear"], 33.5)

    def test_empty_side_is_none(self):
        c = lidar_clearances([{"angle": 0.0, "distance": 1.0}])
        self.assertIsNone(c["rear"])


class TestDiagnose(unittest.TestCase):
    def test_reports_recent_pi_block(self):
        st = {"motion": "stop", "block": {"motion": "right", "reason": "vật cản right=14cm <= 20cm", "age": 0.3}}
        msg = diagnose_stuck(True, st, 0.2, "right")
        self.assertIn("Pi CHẶN RIGHT", msg)
        self.assertIn("right=14cm", msg)

    def test_missing_pi_status_points_to_pi_terminal(self):
        self.assertIn("không nhận trạng thái từ Pi", diagnose_stuck(True, None, None, "left"))

    def test_lost_encoder_first(self):
        self.assertIn("mất encoder", diagnose_stuck(False, None, None, "left"))

    def test_motor_running_but_not_moving(self):
        st = {"motion": "forward", "block": None}
        self.assertIn("không lăn", diagnose_stuck(True, st, 0.1, "drive:30:30"))


TH = {"forward": 15, "backward": 12, "left": 11, "right": 11, "turn_clearance": 6}


class TestDescribeDriveBlock(unittest.TestCase):
    """Ly do ket gui len Web (/robot/sensor_health -> drive_block)."""

    def test_none_while_moving_or_briefly_stopped(self):
        self.assertIsNone(describe_drive_block(0.0, "left", True, None, None))
        self.assertIsNone(describe_drive_block(1.5, "left", True, None, None))

    def test_turn_blocked_names_the_sonar_pi_used(self):
        # Log 08/11 22:58: Nav2 xoay trai, LiDAR trai 47 cm nhung sieu am trai 11 cm -> Pi chan.
        st = {"motion": "stop", "sonar": {"front": 76, "rear": 70, "left": 11, "right": 11},
              "thresholds": TH,
              "block": {"motion": "left", "age": 0.3,
                        "reason": "khóa an toàn: cần 2 packet liên tiếp cao hơn ngưỡng + 2.0cm (hiện có 0)"}}
        b = describe_drive_block(3.2, "left", True, st, 0.2)
        self.assertEqual(b["code"], "PI_BLOCK_TURN")
        self.assertEqual(b["stuck_sec"], 3)
        self.assertIn("xoay trái", b["message"])
        self.assertIn("siêu âm trái 11 cm", b["message"])
        self.assertNotIn("phải", b["message"])  # Pi khong xet hong phai khi xoay trai
        self.assertIn("TIẾN hoặc LÙI", b["hint"])
        self.assertIn("khóa an toàn", b["detail"])

    def test_turn_blocked_by_front_or_rear_turn_clearance(self):
        st = {"motion": "stop", "sonar": {"front": 40, "rear": 4, "left": 50, "right": 50},
              "thresholds": TH, "block": {"motion": "right", "age": 0.5, "reason": "rear=4cm"}}
        b = describe_drive_block(5, "right", True, st, 0.2)
        self.assertIn("siêu âm sau 4 cm", b["message"])

    def test_forward_and_backward_blocks(self):
        st = {"motion": "stop", "sonar": {"front": 9, "rear": 80, "left": 50, "right": 50},
              "thresholds": TH, "block": {"motion": "forward", "age": 0.2, "reason": "front=9cm"}}
        b = describe_drive_block(4, "drive:35:35", True, st, 0.2)
        self.assertEqual(b["code"], "PI_BLOCK_FORWARD")
        self.assertIn("siêu âm trước 9 cm", b["message"])
        st = {**st, "block": {"motion": "backward", "age": 0.2, "reason": "rear null"},
              "sonar": {"front": 9, "rear": None, "left": 50, "right": 50}}
        b = describe_drive_block(4, "drive:-35:-35", True, st, 0.2)
        self.assertEqual(b["code"], "PI_BLOCK_BACKWARD")
        self.assertIn("siêu âm sau không đo được", b["message"])

    def test_other_causes(self):
        self.assertEqual(describe_drive_block(3, "left", False, None, None)["code"], "NO_ENCODER")
        self.assertEqual(describe_drive_block(3, "left", True, None, None)["code"], "NO_PI_STATUS")
        old_block = {"motion": "stop", "sonar": {}, "thresholds": TH,
                     "block": {"motion": "left", "age": 30.0, "reason": "x"}}
        self.assertEqual(describe_drive_block(3, "left", True, old_block, 0.2)["code"], "PI_IDLE")
        running = {"motion": "forward", "sonar": {}, "thresholds": TH, "block": None}
        self.assertEqual(describe_drive_block(3, "drive:30:30", True, running, 0.2)["code"], "NOT_ROLLING")


class TestThresholdWarnings(unittest.TestCase):
    def test_flags_sides_under_pi_thresholds(self):
        st = {"thresholds": {"forward": 30, "backward": 18, "left": 15, "right": 20, "turn_clearance": 20}}
        w = threshold_warnings({"front": 45, "rear": 12, "left": 40, "right": 13}, st)
        self.assertIn("phải 13<=20cm", w)
        self.assertIn("sau 12<=18cm", w)
        self.assertIn("xoay cần sau>20cm", w)


class TestFormat(unittest.TestCase):
    def test_line_contains_all_sections(self):
        st = {"motion": "stop", "sonar": {"front": 40.0, "rear": None, "left": 15.0, "right": 14.0},
              "block": {"motion": "right", "reason": "x", "age": 0.5}}
        line = format_status_line(0.1, -0.3, True, "right", 0.0, 0.0,
                                  {"front": 45.0, "rear": None, "left": 60.0, "right": 13.0}, st, 0.2)
        for part in ("Nav2 v=+0.10 w=-0.30", "Pi 'right'", "T45", "P13", "Sonar(cm) T40", "Pi STOP", "chặn 0.5s"):
            self.assertIn(part, line)


class TestSafetyStatus(unittest.TestCase):
    def test_status_reports_block_and_sonar(self):
        safety = ObstacleSafetyController(FakeMotor(), FakeReader(snapshot(front=20.0)))
        self.assertFalse(safety.command("forward"))
        st = safety.status(now=time.monotonic())
        self.assertEqual(st["motion"], "stop")
        self.assertEqual(st["sonar"]["front"], 20.0)
        self.assertEqual(st["block"]["motion"], "forward")
        self.assertIn("front", st["block"]["reason"])
        self.assertIn("turn_clearance", st["thresholds"])


if __name__ == "__main__":
    unittest.main()
