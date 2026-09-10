import os
import sys
import time
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from obstacle_safety import ObstacleSafetyController
from ultrasonic_serial import SensorSnapshot, parse_sensor_packet


class FakeReader:
    def __init__(self, snapshot=None):
        self.snapshot = snapshot

    def latest(self):
        return self.snapshot


class FakeMotor:
    def __init__(self):
        self.motion = "stop"

    def forward(self):
        self.motion = "forward"

    def backward(self):
        self.motion = "backward"

    def turn_left(self):
        self.motion = "left"

    def turn_right(self):
        self.motion = "right"

    def stop(self):
        self.motion = "stop"


def snapshot(**overrides):
    distances = {"front": 100.0, "rear": 100.0, "left": 100.0, "right": 100.0}
    distances.update(overrides)
    return SensorSnapshot(distances, time.monotonic(), "/dev/ttyUSB0", 1)


class TestSerialPacketParser(unittest.TestCase):
    def test_valid_json_line(self):
        packet = parse_sensor_packet(
            b'{"front":42.3,"rear":105.1,"left":31.8,"right":78.4}\n'
        )
        self.assertEqual(packet["front"], 42.3)
        self.assertEqual(packet["right"], 78.4)

    def test_bad_field_becomes_none_without_losing_other_sensors(self):
        packet = parse_sensor_packet(
            '{"front":null,"rear":999,"left":"bad","right":30}'
        )
        self.assertIsNone(packet["front"])
        self.assertIsNone(packet["rear"])
        self.assertIsNone(packet["left"])
        self.assertEqual(packet["right"], 30.0)

    def test_invalid_json_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_sensor_packet("not-json")


class TestObstacleSafety(unittest.TestCase):
    def setUp(self):
        self.motor = FakeMotor()
        self.reader = FakeReader(snapshot())
        self.safety = ObstacleSafetyController(self.motor, self.reader)

    def test_direction_uses_corresponding_sensor(self):
        self.reader.snapshot = snapshot(front=10.0, rear=50.0)
        self.assertFalse(self.safety.command("forward"))
        self.assertEqual(self.motor.motion, "stop")
        self.assertTrue(self.safety.command("backward"))
        self.assertEqual(self.motor.motion, "backward")

    def test_running_motor_stops_when_obstacle_appears(self):
        self.assertTrue(self.safety.command("forward"))
        self.reader.snapshot = snapshot(front=8.0)
        self.assertFalse(self.safety.enforce())
        self.assertEqual(self.motor.motion, "stop")

    def test_missing_or_stale_serial_is_fail_safe(self):
        self.reader.snapshot = None
        self.assertFalse(self.safety.command("left"))

        self.reader.snapshot = SensorSnapshot(
            {"front": 100.0, "rear": 100.0, "left": 100.0, "right": 100.0},
            time.monotonic() - 2.0,
            "/dev/ttyUSB0",
            2,
        )
        self.assertFalse(self.safety.command("right"))


if __name__ == "__main__":
    unittest.main()
