import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from motor_controller import MotorController


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


if __name__ == '__main__':
    unittest.main()
