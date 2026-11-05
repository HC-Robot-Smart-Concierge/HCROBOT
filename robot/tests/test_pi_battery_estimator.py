import json
import os
import shutil
import sys
import tempfile
import unittest

# Ensure robot folder in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.pi_battery_estimator import PiBatteryEstimator


class TestPiBatteryEstimator(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.uptime_path = os.path.join(self.root, "uptime")
        self.boot_id_path = os.path.join(self.root, "boot_id")
        self.state_path = os.path.join(self.root, "config", "pi_battery_session.json")
        self.set_boot("boot-a")
        self.set_uptime_min(0)

    def tearDown(self):
        shutil.rmtree(self.root)

    def set_uptime_min(self, minutes):
        with open(self.uptime_path, "w") as f:
            f.write(f"{minutes * 60:.2f} 1234.00\n")

    def set_boot(self, boot_id):
        with open(self.boot_id_path, "w") as f:
            f.write(boot_id + "\n")

    def make(self, **kwargs):
        return PiBatteryEstimator(
            self.state_path,
            uptime_path=self.uptime_path,
            boot_id_path=self.boot_id_path,
            **kwargs,
        )

    def test_new_power_session_assumes_full_and_drains_by_time(self):
        est = self.make(minutes_per_percent=5.0)
        self.set_uptime_min(60)
        snap = est.snapshot()
        self.assertEqual(snap["anchor_source"], "assumed")
        self.assertAlmostEqual(snap["percent"], 88.0)  # 60 phút / 5 phút mỗi 1%
        self.assertEqual(snap["remaining_min"], 440)
        self.assertAlmostEqual(snap["session_min"], 60.0)

    def test_sync_reanchors_and_survives_service_restart(self):
        est = self.make(minutes_per_percent=5.0)
        self.set_uptime_min(10)
        est.sync(percent=40)
        self.set_uptime_min(30)
        self.assertAlmostEqual(est.snapshot()["percent"], 36.0)

        # main.py khởi động lại, cùng boot_id -> giữ mốc người dùng nhập.
        restarted = self.make(minutes_per_percent=5.0)
        snap = restarted.snapshot()
        self.assertEqual(snap["anchor_source"], "user")
        self.assertAlmostEqual(snap["percent"], 36.0)

    def test_new_boot_resets_anchor_but_keeps_learned_rate(self):
        est = self.make(minutes_per_percent=5.0)
        est.sync(minutes_per_percent=4.0)
        est.sync(percent=50)

        self.set_boot("boot-b")
        self.set_uptime_min(8)
        snap = self.make(minutes_per_percent=5.0).snapshot()
        self.assertEqual(snap["anchor_source"], "assumed")
        self.assertEqual(snap["minutes_per_percent"], 4.0)
        self.assertAlmostEqual(snap["percent"], 98.0)

    def test_two_user_readings_calibrate_rate(self):
        est = self.make(minutes_per_percent=5.0)
        self.set_uptime_min(1)
        est.sync(percent=100)
        self.set_uptime_min(61)  # thực tế tụt 10% trong 60 phút -> 6 phút/1%
        snap = est.sync(percent=90)
        self.assertTrue(snap["calibrated"])
        self.assertAlmostEqual(snap["minutes_per_percent"], 5.5)  # trung bình 5 và 6
        self.assertAlmostEqual(snap["percent"], 90.0)

    def test_no_calibration_from_assumed_anchor_or_short_interval(self):
        est = self.make(minutes_per_percent=5.0)
        self.set_uptime_min(60)
        snap = est.sync(percent=70)  # mốc trước chỉ là giả định 100%
        self.assertFalse(snap["calibrated"])
        self.set_uptime_min(65)
        snap = est.sync(percent=68)  # mới 5 phút, tụt 2%
        self.assertFalse(snap["calibrated"])
        self.assertEqual(snap["minutes_per_percent"], 5.0)

    def test_percent_clamped_and_state_file_written(self):
        est = self.make(minutes_per_percent=5.0)
        self.set_uptime_min(600)
        self.assertEqual(est.snapshot()["percent"], 0.0)
        est.sync(percent=150)
        self.assertEqual(est.snapshot()["percent"], 100.0)
        with open(self.state_path, encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual(saved["boot_id"], "boot-a")
        self.assertEqual(saved["anchor_percent"], 100.0)


if __name__ == "__main__":
    unittest.main()
