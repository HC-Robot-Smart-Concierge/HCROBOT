import os
import sys
import unittest

ROBOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROBOT_DIR)
sys.path.insert(0, os.path.join(ROBOT_DIR, "ros2_configs"))

from diff_drive import (  # noqa: E402
    DiffDriveConfig, StraightDriveConfig, twist_to_straight_command, twist_to_wheel_pwm,
)
from motor_controller import MotorController  # noqa: E402
from obstacle_safety import ObstacleSafetyController, classify_wheel_motion  # noqa: E402
from test_ultrasonic_safety import FakeMotor, FakeReader, snapshot  # noqa: E402

CFG = DiffDriveConfig()


class TestTwistToWheelPwm(unittest.TestCase):
    def test_zero_twist_is_stop(self):
        self.assertEqual(twist_to_wheel_pwm(0.0, 0.0, CFG), (0, 0))

    def test_straight_scales_with_speed(self):
        slow = twist_to_wheel_pwm(0.12, 0.0, CFG)
        fast = twist_to_wheel_pwm(0.20, 0.0, CFG)
        self.assertEqual(slow, (25, 25))  # 0.12 / 0.0048
        self.assertEqual(fast, (42, 42))
        self.assertGreater(fast[0], slow[0])

    def test_small_heading_correction_is_not_dropped(self):
        # Truoc day |wz| < 0.2 bi bo qua; gio banh phai nhanh hon banh trai.
        left, right = twist_to_wheel_pwm(0.15, 0.1, CFG)
        self.assertGreater(right, left)
        self.assertGreater(left, 0)

    def test_spin_in_place_uses_spin_floor(self):
        left, right = twist_to_wheel_pwm(0.0, 0.5, CFG)
        self.assertLess(left, 0)
        self.assertGreater(right, 0)
        self.assertGreaterEqual(abs(left), CFG.spin_min_pwm)
        self.assertEqual(abs(left), abs(right))

    def test_over_max_keeps_ratio(self):
        left, right = twist_to_wheel_pwm(0.4, 0.8, CFG)
        self.assertLessEqual(max(abs(left), abs(right)), CFG.max_pwm)
        self.assertEqual(right, CFG.max_pwm)
        self.assertGreater(right, left)

    def test_tiny_speed_side_stops(self):
        # Ban kinh cong = track/2 => banh trong ~0, banh ngoai chay
        left, right = twist_to_wheel_pwm(0.10, 0.10 / (CFG.track_m / 2.0), CFG)
        self.assertEqual(left, 0)
        self.assertGreater(right, 0)


SCFG = StraightDriveConfig()


class TestTwistToStraightCommand(unittest.TestCase):
    """Che do 'straight' (tu quet xe that): chi xoay tai cho hoac chay thang."""

    def test_zero_twist_is_stop(self):
        self.assertEqual(twist_to_straight_command(0.0, 0.0, SCFG), ("stop", 0, 0))
        self.assertEqual(twist_to_straight_command(0.01, 0.05, SCFG), ("stop", 0, 0))

    def test_pure_rotation_is_spin(self):
        self.assertEqual(twist_to_straight_command(0.0, 0.32, SCFG)[0], "left")
        self.assertEqual(twist_to_straight_command(0.0, -0.32, SCFG)[0], "right")

    def test_almost_pure_rotation_is_spin(self):
        # RotationShim / RotateToGoal: van toc tien rat nho so voi toc do xoay
        self.assertEqual(twist_to_straight_command(0.02, 0.80, SCFG)[0], "left")
        self.assertEqual(twist_to_straight_command(0.02, -0.80, SCFG)[0], "right")

    def test_arc_with_forward_speed_drives_both_sides_not_spin(self):
        # Truoc day ra drive:0:22 (xe dung im) roi doi thanh xoay (sat tuong bi Pi chan).
        # Gio: tien, hai ben >= san PWM, ben ngoai cung nhanh hon (Pi chi xet phia truoc).
        for vx, wz in ((0.05, 0.32), (0.10, -0.32), (0.20, -0.46)):
            kind, left, right = twist_to_straight_command(vx, wz, SCFG)
            self.assertEqual(kind, "drive", (vx, wz))
            self.assertGreaterEqual(min(left, right), SCFG.min_pwm)
            if wz > 0:
                self.assertGreater(right, left)
            else:
                self.assertGreater(left, right)

    def test_straight_uses_floor_on_both_sides(self):
        kind, left, right = twist_to_straight_command(0.05, 0.0, SCFG)
        self.assertEqual(kind, "drive")
        self.assertEqual((left, right), (SCFG.min_pwm, SCFG.min_pwm))

    def test_gentle_correction_keeps_both_sides_above_floor(self):
        kind, left, right = twist_to_straight_command(0.15, 0.1, SCFG)
        self.assertEqual(kind, "drive")
        self.assertGreaterEqual(left, SCFG.min_pwm)
        self.assertGreater(right, left)
        self.assertLessEqual(right, SCFG.max_pwm)
        self.assertLessEqual(right / left, SCFG.max_side_ratio + 1e-9)

    def test_fast_straight_capped(self):
        kind, left, right = twist_to_straight_command(0.4, 0.0, SCFG)
        self.assertEqual((kind, left, right), ("drive", SCFG.max_pwm, SCFG.max_pwm))

    def test_backward_is_straight_backward(self):
        kind, left, right = twist_to_straight_command(-0.10, 0.0, SCFG)
        self.assertEqual(kind, "drive")
        self.assertLessEqual(left, -SCFG.min_pwm)
        self.assertEqual(left, right)


class TestClassifyWheelMotion(unittest.TestCase):
    def test_mapping(self):
        cases = {
            (0, 0): "stop",
            (30, 40): "forward",
            (-30, -40): "backward",
            (0, 30): "forward_left",
            (30, 0): "forward_right",
            (0, -30): "backward_left",
            (-30, 0): "backward_right",
            (-38, 38): "left",
            (38, -38): "right",
        }
        for (left, right), expected in cases.items():
            self.assertEqual(classify_wheel_motion(left, right), expected, (left, right))


class DriveFakeMotor(FakeMotor):
    def __init__(self):
        super().__init__()
        self.wheels = (0, 0)

    def drive_wheels(self, left, right):
        self.wheels = (left, right)
        self.motion = "drive"

    def stop(self):
        super().stop()
        self.wheels = (0, 0)


class TestSafetyDrive(unittest.TestCase):
    def test_drive_allowed_when_clear_and_updates_speed(self):
        motor = DriveFakeMotor()
        safety = ObstacleSafetyController(motor, FakeReader(snapshot()))
        self.assertTrue(safety.drive(30, 40))
        self.assertEqual(motor.wheels, (30, 40))
        self.assertEqual(safety.motion, "forward")
        # Cung huong, doi toc do: cap nhat ngay
        self.assertTrue(safety.drive(35, 30))
        self.assertEqual(motor.wheels, (35, 30))

    def test_drive_blocked_by_front_obstacle(self):
        motor = DriveFakeMotor()
        safety = ObstacleSafetyController(motor, FakeReader(snapshot(front=20.0)))
        self.assertFalse(safety.drive(30, 30))
        self.assertEqual(motor.wheels, (0, 0))
        self.assertEqual(safety.motion, "stop")

    def test_enforce_stops_drive_when_obstacle_appears(self):
        motor = DriveFakeMotor()
        reader = FakeReader(snapshot())
        safety = ObstacleSafetyController(motor, reader)
        self.assertTrue(safety.drive(30, 30))
        reader.snapshot = snapshot(sequence=2, front=20.0)
        self.assertFalse(safety.enforce())
        self.assertEqual(motor.wheels, (0, 0))

    def test_drive_zero_is_stop(self):
        motor = DriveFakeMotor()
        safety = ObstacleSafetyController(motor, FakeReader(snapshot()))
        safety.drive(30, 30)
        self.assertTrue(safety.drive(0, 0))
        self.assertEqual(motor.wheels, (0, 0))


class TestMotorDriveWheels(unittest.TestCase):
    def test_sets_per_side_direction_and_speed(self):
        motor = MotorController.__new__(MotorController)
        calls = {}

        def fake_set_outputs(lf, lb, rf, rb, left_speed=None, right_speed=None):
            calls.update(lf=lf, lb=lb, rf=rf, rb=rb, ls=left_speed, rs=right_speed)
            return (lf, lb, rf, rb)

        motor._set_outputs = fake_set_outputs
        motor.motion = "stop"
        motor.drive_wheels(-40, 25)
        self.assertEqual(calls, dict(lf=False, lb=True, rf=True, rb=False, ls=40, rs=25))
        self.assertEqual(motor.motion, "drive")


if __name__ == "__main__":
    unittest.main()
