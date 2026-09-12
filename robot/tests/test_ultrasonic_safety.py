import os
import sys
import time
import unittest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from obstacle_safety import ObstacleSafetyController
from ultrasonic_serial import (
    SensorSnapshot,
    parse_sensor_packet,
    parse_telemetry_packet,
)


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


def snapshot(sequence=1, received_at=None, **overrides):
    distances = {"front": 100.0, "rear": 100.0, "left": 100.0, "right": 100.0}
    distances.update(overrides)
    return SensorSnapshot(
        distances,
        time.monotonic() if received_at is None else received_at,
        "/dev/ttyUSB0",
        sequence,
    )


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

    def test_combined_packet_parses_mpu_without_changing_ultrasonic(self):
        packet = parse_telemetry_packet(
            '{"front":42.3,"rear":105.1,"left":31.8,"right":78.4,'
            '"mpu_available":true,'
            '"accel":{"x":0.01,"y":-0.02,"z":0.99},'
            '"gyro":{"x":0.3,"y":-0.1,"z":12.4},'
            '"yaw_rate_dps":12.4}'
        )
        self.assertEqual(packet.distances["front"], 42.3)
        self.assertTrue(packet.mpu_available)
        self.assertEqual(packet.accel, {"x": 0.01, "y": -0.02, "z": 0.99})
        self.assertEqual(packet.gyro["z"], 12.4)
        self.assertEqual(packet.yaw_rate_dps, 12.4)

    def test_bad_mpu_data_becomes_none_without_losing_ultrasonic(self):
        packet = parse_telemetry_packet(
            '{"front":80,"rear":90,"left":100,"right":110,'
            '"mpu_available":true,'
            '"accel":{"x":"bad","y":0,"z":1},'
            '"gyro":null,"yaw_rate_dps":null}'
        )
        self.assertEqual(packet.distances["front"], 80.0)
        self.assertTrue(packet.mpu_available)
        self.assertIsNone(packet.accel)
        self.assertIsNone(packet.gyro)
        self.assertIsNone(packet.yaw_rate_dps)

    def test_legacy_ultrasonic_packet_reports_mpu_unavailable(self):
        packet = parse_telemetry_packet(
            '{"front":80,"rear":90,"left":100,"right":110}'
        )
        self.assertFalse(packet.mpu_available)
        self.assertIsNone(packet.accel)


class TestObstacleSafety(unittest.TestCase):
    def setUp(self):
        self.motor = FakeMotor()
        self.reader = FakeReader(snapshot())
        self.safety = ObstacleSafetyController(self.motor, self.reader)

    def test_direction_uses_corresponding_sensor(self):
        self.reader.snapshot = snapshot(front=10.0, rear=80.0)
        self.assertFalse(self.safety.command("forward"))
        self.assertEqual(self.motor.motion, "stop")
        self.assertTrue(self.safety.command("backward"))
        self.assertEqual(self.motor.motion, "backward")

    def test_running_motor_stops_when_obstacle_appears(self):
        self.assertTrue(self.safety.command("forward"))
        self.reader.snapshot = snapshot(sequence=2, front=8.0)
        self.assertFalse(self.safety.enforce())
        self.assertEqual(self.motor.motion, "stop")

    def test_turn_checks_side_front_and_rear(self):
        self.reader.snapshot = snapshot(front=20.0, left=100.0, rear=100.0)
        self.assertEqual(self.safety.evaluate("left").sensor, "front")
        self.assertFalse(self.safety.command("left"))

        self.reader.snapshot = snapshot(
            sequence=2, front=100.0, left=100.0, rear=20.0
        )
        self.assertEqual(self.safety.evaluate("right").sensor, "rear")
        self.assertFalse(self.safety.command("right"))

    def test_one_null_packet_uses_recent_valid_value_then_stops(self):
        self.assertTrue(self.safety.command("forward"))

        self.reader.snapshot = snapshot(sequence=2, front=None)
        self.assertTrue(self.safety.enforce())
        self.assertEqual(self.motor.motion, "forward")

        self.reader.snapshot = snapshot(sequence=3, front=None)
        self.assertFalse(self.safety.enforce())
        self.assertEqual(self.motor.motion, "stop")

    def test_safety_lock_requires_three_clear_packets_and_new_command(self):
        self.assertTrue(self.safety.command("forward"))
        self.reader.snapshot = snapshot(sequence=2, front=20.0)
        self.assertFalse(self.safety.enforce())

        for sequence in (3, 4):
            self.reader.snapshot = snapshot(sequence=sequence, front=90.0)
            self.safety.enforce()
        self.assertFalse(self.safety.command("forward"))

        self.reader.snapshot = snapshot(sequence=5, front=90.0)
        self.safety.enforce()
        self.assertTrue(self.safety.command("forward"))
        self.assertEqual(self.motor.motion, "forward")

    def test_forward_block_does_not_prevent_safe_reverse(self):
        self.reader.snapshot = snapshot(front=20.0, rear=100.0)
        self.assertFalse(self.safety.command("forward"))
        self.assertTrue(self.safety.command("backward"))
        self.assertEqual(self.motor.motion, "backward")

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
