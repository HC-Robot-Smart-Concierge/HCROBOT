import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

# Ensure robot folder in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts import pi_power_monitor as ppm

PMIC_SAMPLE = """\
     3V7_WL_SW_A current(0)=0.00390372A
       3V3_SYS_A current(1)=0.05367620A
       1V8_SYS_A current(2)=0.17467020A
      DDR_VDD2_A current(3)=0.02049570A
       0V8_SYS_A current(6)=0.34254130A
      VDD_CORE_A current(7)=0.66402000A
         HDMI_A current(22)=0.01537950A
     3V7_WL_SW_V volt(8)=3.71520400V
       3V3_SYS_V volt(9)=3.30366600V
       1V8_SYS_V volt(10)=1.80073200V
      DDR_VDD2_V volt(11)=1.11108600V
       0V8_SYS_V volt(14)=0.80073240V
      VDD_CORE_V volt(15)=0.72000000V
         HDMI_V volt(23)=5.09157500V
        EXT5V_V volt(24)=5.09523800V
         BATT_V volt(25)=0.00000000V
"""


class TestParsers(unittest.TestCase):
    def test_parse_pmic_pairs_rails_and_reads_ext5v(self):
        rails, ext5v = ppm.parse_pmic_adc(PMIC_SAMPLE)
        self.assertAlmostEqual(ext5v, 5.095238)
        self.assertIn("VDD_CORE", rails)
        self.assertIn("3V7_WL_SW", rails)
        # EXT5V/BATT chỉ có áp, không có dòng -> không phải rail tính công suất.
        self.assertNotIn("EXT5V", rails)
        self.assertNotIn("BATT", rails)
        self.assertAlmostEqual(rails["VDD_CORE"]["w"], 0.66402 * 0.72, places=6)

    def test_parse_throttled(self):
        self.assertEqual(ppm.parse_throttled("throttled=0x50005\n"), 0x50005)
        self.assertIsNone(ppm.parse_throttled("garbage"))
        flags = ppm.decode_throttled(0x50005)
        self.assertTrue(flags["under_voltage_now"])
        self.assertTrue(flags["throttled_now"])
        self.assertTrue(flags["under_voltage_occurred"])
        self.assertFalse(flags["freq_capped_now"])

    def test_classify_power(self):
        ok = ppm.decode_throttled(0)
        self.assertEqual(ppm.classify_power(5.1, ok, False), "OK")
        self.assertEqual(ppm.classify_power(4.7, ok, False), "LOW_VOLTAGE")
        self.assertEqual(ppm.classify_power(5.1, ppm.decode_throttled(0x1), False), "UNDERVOLTAGE")
        self.assertEqual(ppm.classify_power(None, None, True), "UNDERVOLTAGE")
        self.assertEqual(ppm.classify_power(5.1, ppm.decode_throttled(0x10000), False),
                         "UNDERVOLTAGE_OCCURRED")
        self.assertEqual(ppm.classify_power(None, None, None), "UNAVAILABLE")


class TestPiPowerMonitor(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        hw = os.path.join(self.root, "hwmon", "hwmon1")
        os.makedirs(hw)
        with open(os.path.join(hw, "name"), "w") as f:
            f.write("rpi_volt\n")
        with open(os.path.join(hw, "in0_lcrit_alarm"), "w") as f:
            f.write("0\n")
        self.dt = os.path.join(self.root, "power")
        os.makedirs(self.dt)
        with open(os.path.join(self.dt, "max_current"), "wb") as f:
            f.write((900).to_bytes(4, "big"))
        with open(os.path.join(self.dt, "usbpd_power_data_objects"), "wb") as f:
            f.write(bytes(28))
        self.thermal = os.path.join(self.root, "temp")
        with open(self.thermal, "w") as f:
            f.write("49050\n")
        self.monitor = ppm.PiPowerMonitor(
            hwmon_root=os.path.join(self.root, "hwmon"),
            dt_power_dir=self.dt,
            thermal_path=self.thermal,
        )

    def tearDown(self):
        shutil.rmtree(self.root)

    def _fake_run(self, outputs):
        def run(cmd, **kwargs):
            stdout, stderr, code = outputs[cmd[1]]
            return mock.Mock(stdout=stdout, stderr=stderr, returncode=code)
        return run

    def test_read_once_as_root_computes_power(self):
        outputs = {
            "pmic_read_adc": (PMIC_SAMPLE, "", 0),
            "get_throttled": ("throttled=0x0\n", "", 0),
        }
        with mock.patch.object(ppm.subprocess, "run", side_effect=self._fake_run(outputs)):
            snap = self.monitor.read_once()

        rails, ext5v = ppm.parse_pmic_adc(PMIC_SAMPLE)
        expected_w = sum(r["w"] for r in rails.values())
        self.assertEqual(snap["status"], "OK")
        self.assertEqual(snap["source"], "pmic")
        self.assertAlmostEqual(snap["ext5v_v"], 5.095, places=3)
        self.assertAlmostEqual(snap["pmic_power_w"], round(expected_w, 2))
        self.assertAlmostEqual(snap["est_current_a"], round(expected_w / ext5v, 3))
        self.assertEqual(snap["psu_max_current_ma"], 900)
        self.assertFalse(snap["psu_usb_pd"])
        self.assertEqual(snap["cpu_temp_c"], 49.0)
        self.assertEqual(snap["message"], "")

    def test_without_root_falls_back_to_hwmon(self):
        denied = ("", "Can't open device file: /dev/vcio\n", 255)
        outputs = {"pmic_read_adc": denied, "get_throttled": denied}
        with mock.patch.object(ppm.subprocess, "run", side_effect=self._fake_run(outputs)):
            snap = self.monitor.read_once()

        self.assertEqual(snap["status"], "OK")
        self.assertEqual(snap["source"], "hwmon")
        self.assertIsNone(snap["ext5v_v"])
        self.assertIsNone(snap["pmic_power_w"])
        self.assertIn("sudo", snap["message"])

    def test_get_caches_between_calls(self):
        outputs = {
            "pmic_read_adc": (PMIC_SAMPLE, "", 0),
            "get_throttled": ("throttled=0x0\n", "", 0),
        }
        with mock.patch.object(ppm.subprocess, "run", side_effect=self._fake_run(outputs)) as run:
            self.monitor.get()
            self.monitor.get()
        self.assertEqual(run.call_count, 2)  # một lần đọc = 2 lệnh vcgencmd


if __name__ == "__main__":
    unittest.main()
