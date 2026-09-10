import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from motor_controller import MotorController
from main import run_auto_drive, run_auto_forward, run_direct_motor_test


class FakeAutoSafety:
    def __init__(self, can_start=True):
        self.can_start = can_start
        self.motion = "stop"
        self.commands = []
        self.update_count = 0
        self.enforce_count = 0

    def update(self):
        self.update_count += 1

    def command(self, motion):
        self.commands.append(motion)
        if not self.can_start:
            return False
        self.motion = motion
        return True

    def enforce(self):
        self.enforce_count += 1
        self.motion = "stop"
        return False


class TestMotorControllerRemote(unittest.TestCase):
    """Unit tests kiểm tra điều khiển động cơ robot ở chế độ Mock và tín hiệu hướng di chuyển."""

    def setUp(self):
        self.controller = MotorController(force_mock=True)

    def tearDown(self):
        self.controller.cleanup()

    def test_move_forward(self):
        self.controller.move_forward()
        self.assertTrue(self.controller.left_forward_dev.is_active)
        self.assertFalse(self.controller.left_backward_dev.is_active)
        self.assertTrue(self.controller.right_forward_dev.is_active)
        self.assertFalse(self.controller.right_backward_dev.is_active)

    def test_move_backward(self):
        self.controller.move_backward()
        self.assertFalse(self.controller.left_forward_dev.is_active)
        self.assertTrue(self.controller.left_backward_dev.is_active)
        self.assertFalse(self.controller.right_forward_dev.is_active)
        self.assertTrue(self.controller.right_backward_dev.is_active)

    def test_turn_left(self):
        self.controller.turn_left()
        self.assertFalse(self.controller.left_forward_dev.is_active)
        self.assertTrue(self.controller.left_backward_dev.is_active)
        self.assertTrue(self.controller.right_forward_dev.is_active)

    def test_turn_right(self):
        self.controller.turn_right()
        self.assertTrue(self.controller.left_forward_dev.is_active)
        self.assertFalse(self.controller.right_forward_dev.is_active)
        self.assertTrue(self.controller.right_backward_dev.is_active)

    def test_stop(self):
        self.controller.move_forward()
        self.controller.stop()
        self.assertFalse(self.controller.left_forward_dev.is_active)
        self.assertFalse(self.controller.right_forward_dev.is_active)

    def test_direction_can_be_inverted_for_physical_motor_orientation(self):
        controller = MotorController(
            force_mock=True,
            invert_left_direction=True,
            invert_right_direction=True,
        )
        try:
            controller.move_forward()
            self.assertFalse(controller.left_forward_dev.is_active)
            self.assertTrue(controller.left_backward_dev.is_active)
            self.assertFalse(controller.right_forward_dev.is_active)
            self.assertTrue(controller.right_backward_dev.is_active)

            controller.turn_left()
            self.assertTrue(controller.left_forward_dev.is_active)
            self.assertFalse(controller.left_backward_dev.is_active)
            self.assertFalse(controller.right_forward_dev.is_active)
            self.assertTrue(controller.right_backward_dev.is_active)
        finally:
            controller.cleanup()

    def test_direct_motor_test_runs_selected_direction_and_cleans_up(self):
        controller = MotorController(force_mock=True)
        with patch("main.time.sleep", return_value=None):
            result = run_direct_motor_test(
                controller,
                "forward",
                duration_seconds=0.01,
                countdown=0,
            )

        self.assertEqual(result, 0)
        self.assertEqual(controller.motion, "stop")
        self.assertFalse(controller.left_forward_dev.is_active)
        self.assertFalse(controller.right_forward_dev.is_active)

    def test_auto_forward_starts_once_and_exits_after_safety_stop(self):
        safety = FakeAutoSafety()
        with patch("main.time.sleep", return_value=None):
            result = run_auto_forward(safety, countdown=0)

        self.assertEqual(result, 0)
        self.assertEqual(safety.commands, ["forward"])
        self.assertEqual(safety.enforce_count, 1)
        self.assertEqual(safety.motion, "stop")

    def test_auto_backward_uses_rear_direction(self):
        safety = FakeAutoSafety()
        with patch("main.time.sleep", return_value=None):
            result = run_auto_drive(safety, "backward", countdown=0)

        self.assertEqual(result, 0)
        self.assertEqual(safety.commands, ["backward"])
        self.assertEqual(safety.enforce_count, 1)

    def test_auto_forward_does_not_move_when_initially_unsafe(self):
        safety = FakeAutoSafety(can_start=False)
        with patch("main.time.sleep", return_value=None):
            result = run_auto_forward(safety, countdown=0)

        self.assertEqual(result, 4)
        self.assertEqual(safety.commands, ["forward"])
        self.assertEqual(safety.enforce_count, 0)


if __name__ == '__main__':
    unittest.main()
