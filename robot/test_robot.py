import pytest
from motor_controller import MotorController


def test_motor_controller_actions():
    controller = MotorController(force_mock=True)

    # Test Forward
    controller.move_forward()
    assert controller.left_forward_dev.is_active is True
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is True
    assert controller.right_backward_dev.is_active is False

    # Test Backward
    controller.move_backward()
    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is True
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is True

    # Test Turn Left
    controller.turn_left()
    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is True
    assert controller.right_forward_dev.is_active is True
    assert controller.right_backward_dev.is_active is False

    # Test Turn Right
    controller.turn_right()
    assert controller.left_forward_dev.is_active is True
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is True

    # Test Stop
    controller.stop()
    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is False

    controller.cleanup()
