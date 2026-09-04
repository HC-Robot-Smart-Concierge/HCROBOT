import pytest
from hc_robot_client.utils.motor_controller import MotorController, MockDigitalOutputDevice


def test_motor_controller_initialization():
    """Kiểm tra khởi tạo MotorController ở chế độ Mock Mode."""
    controller = MotorController(
        left_forward_pin=17,
        left_backward_pin=27,
        right_forward_pin=22,
        right_backward_pin=23,
        force_mock=True
    )

    assert controller.is_mock is True
    assert controller.left_forward_pin == 17
    assert controller.left_backward_pin == 27
    assert controller.right_forward_pin == 22
    assert controller.right_backward_pin == 23
    controller.cleanup()


def test_motor_move_forward():
    """Kiểm tra trạng thái chân GPIO khi phát lệnh Tiến."""
    controller = MotorController(force_mock=True)
    controller.move_forward()

    assert controller.left_forward_dev.is_active is True
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is True
    assert controller.right_backward_dev.is_active is False
    controller.cleanup()


def test_motor_move_backward():
    """Kiểm tra trạng thái chân GPIO khi phát lệnh Lùi."""
    controller = MotorController(force_mock=True)
    controller.move_backward()

    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is True
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is True
    controller.cleanup()


def test_motor_turn_left():
    """Kiểm tra trạng thái chân GPIO khi phát lệnh Rẽ Trái."""
    controller = MotorController(force_mock=True)
    controller.turn_left()

    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is True
    assert controller.right_forward_dev.is_active is True
    assert controller.right_backward_dev.is_active is False
    controller.cleanup()


def test_motor_turn_right():
    """Kiểm tra trạng thái chân GPIO khi phát lệnh Rẽ Phải."""
    controller = MotorController(force_mock=True)
    controller.turn_right()

    assert controller.left_forward_dev.is_active is True
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is True
    controller.cleanup()


def test_motor_stop():
    """Kiểm tra trạng thái chân GPIO khi phát lệnh Dừng."""
    controller = MotorController(force_mock=True)
    controller.move_forward()
    controller.stop()

    assert controller.left_forward_dev.is_active is False
    assert controller.left_backward_dev.is_active is False
    assert controller.right_forward_dev.is_active is False
    assert controller.right_backward_dev.is_active is False
    controller.cleanup()


def test_set_drive_cmd_twist():
    """Kiểm tra việc chuyển đổi vận tốc Twist sang lệnh điều khiển motor."""
    controller = MotorController(force_mock=True)

    # 1. Forward
    controller.set_drive_cmd(linear_x=0.5, angular_z=0.0)
    assert controller.left_forward_dev.is_active is True
    assert controller.right_forward_dev.is_active is True

    # 2. Backward
    controller.set_drive_cmd(linear_x=-0.5, angular_z=0.0)
    assert controller.left_backward_dev.is_active is True
    assert controller.right_backward_dev.is_active is True

    # 3. Turn left
    controller.set_drive_cmd(linear_x=0.0, angular_z=0.5)
    assert controller.right_forward_dev.is_active is True
    assert controller.left_backward_dev.is_active is True

    # 4. Stop
    controller.set_drive_cmd(linear_x=0.0, angular_z=0.0)
    assert controller.left_forward_dev.is_active is False
    assert controller.right_forward_dev.is_active is False

    controller.cleanup()
