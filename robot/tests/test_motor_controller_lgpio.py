import os
import sys
import unittest
from unittest.mock import patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import motor_controller


class FakeLGPIO:
    def __init__(self, failing_chips=None):
        self.failing_chips = set(failing_chips or [])
        self.opened = []
        self.claimed = []
        self.freed = []
        self.closed = []

    def gpiochip_open(self, chip_num):
        self.opened.append(chip_num)
        if chip_num in self.failing_chips:
            raise RuntimeError("can not open gpiochip")
        return 100 + chip_num

    def gpio_claim_output(self, handle, pin, value):
        self.claimed.append((handle, pin, value))

    def gpio_write(self, handle, pin, value):
        pass

    def tx_pwm(self, handle, pin, frequency, duty_cycle):
        pass

    def gpio_free(self, handle, pin):
        self.freed.append((handle, pin))

    def gpiochip_close(self, handle):
        self.closed.append(handle)


class TestLGPIOBackend(unittest.TestCase):
    def test_uses_configured_chip_and_one_shared_handle(self):
        fake_lgpio = FakeLGPIO()
        with (
            patch.object(motor_controller, "lgpio", fake_lgpio, create=True),
            patch.object(motor_controller, "HAS_LGPIO", True),
            patch.object(motor_controller, "HAS_GPIOZERO", False),
        ):
            controller = motor_controller.MotorController(
                left_forward_pin=17,
                left_backward_pin=27,
                right_forward_pin=22,
                right_backward_pin=23,
                gpio_chip=7,
            )

            self.assertFalse(controller.is_mock)
            self.assertEqual(controller.gpio_chip_num, 7)
            self.assertEqual(fake_lgpio.opened, [7])
            self.assertEqual(fake_lgpio.claimed, [
                (107, 17, 0),
                (107, 27, 0),
                (107, 22, 0),
                (107, 23, 0),
            ])

            controller.cleanup()
            self.assertEqual(fake_lgpio.closed, [107])
            self.assertEqual(
                sorted(pin for _, pin in fake_lgpio.freed),
                [17, 22, 23, 27],
            )

    def test_tries_next_chip_after_open_failure(self):
        fake_lgpio = FakeLGPIO(failing_chips={4})
        with patch.object(motor_controller, "lgpio", fake_lgpio, create=True):
            handle, chip_num = motor_controller._open_lgpio_chip(
                [17, 27, 22, 23], preferred_chip=4
            )

        self.assertEqual(chip_num, 0)
        self.assertEqual(handle, 100)
        self.assertEqual(fake_lgpio.opened, [4, 0])


if __name__ == "__main__":
    unittest.main()
