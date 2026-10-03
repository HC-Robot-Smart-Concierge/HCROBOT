"""ESP32 MicroPython Quadrature Encoder driver for 4 independent JGA25-370 motors.

Tracks ticks, rotational direction, and RPM using hardware interrupts and non-blocking timers.
"""

import time
from machine import Pin


class QuadratureEncoder:
    """Quadrature encoder reader for a single motor using interrupt-capable GPIOs."""

    def __init__(self, pin_a: int, pin_b: int, cpr: float = 330.0, invert: bool = False):
        self.pin_a_num = pin_a
        self.pin_b_num = pin_b
        self.pin_a = Pin(pin_a, Pin.IN, Pin.PULL_UP)
        self.pin_b = Pin(pin_b, Pin.IN, Pin.PULL_UP)
        self.cpr = float(cpr) if cpr > 0 else 330.0
        self.invert = bool(invert)

        self.ticks = 0
        self.direction = 0  # +1 = Forward, -1 = Reverse, 0 = Stopped
        self.rpm = 0.0

        # For RPM calculation
        self._last_ticks = 0
        self._last_time_ms = time.ticks_ms()

        # Attach hardware interrupt to Channel A
        self.pin_a.irq(trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING, handler=self._handle_interrupt)

    def _handle_interrupt(self, pin):
        """Interrupt Service Routine (ISR) triggered by Channel A transitions."""
        a_val = self.pin_a.value()
        b_val = self.pin_b.value()

        # Determine direction from quadrature phase relationship
        if a_val == b_val:
            step = -1 if not self.invert else 1
        else:
            step = 1 if not self.invert else -1

        self.ticks += step
        self.direction = 1 if step > 0 else -1

    def update_rpm(self, current_time_ms=None):
        """Calculates RPM over the elapsed time period since last update (non-blocking)."""
        if current_time_ms is None:
            current_time_ms = time.ticks_ms()

        elapsed_ms = time.ticks_diff(current_time_ms, self._last_time_ms)
        if elapsed_ms <= 0:
            return self.rpm

        # Calculate ticks elapsed
        current_ticks = self.ticks
        delta_ticks = current_ticks - self._last_ticks
        elapsed_sec = elapsed_ms / 1000.0

        # RPM = (Revolutions / second) * 60 = (delta_ticks / CPR) / elapsed_sec * 60
        revolutions = delta_ticks / self.cpr
        calculated_rpm = (revolutions / elapsed_sec) * 60.0

        # Filter out micro-jitter if stopped
        if delta_ticks == 0:
            self.direction = 0
            self.rpm = 0.0
        else:
            self.rpm = round(calculated_rpm, 2)

        self._last_ticks = current_ticks
        self._last_time_ms = current_time_ms
        return self.rpm

    def getTicks(self) -> int:
        return self.ticks

    def getRPM(self) -> float:
        return self.rpm

    def getDirection(self) -> int:
        return self.direction

    def reset(self):
        """Reset tick counter to 0."""
        self.ticks = 0
        self._last_ticks = 0
        self.rpm = 0.0
        self.direction = 0
        self._last_time_ms = time.ticks_ms()


class EncoderManager:
    """Manages independent encoder state for all 4 motors."""

    def __init__(self, enc1: QuadratureEncoder, enc2: QuadratureEncoder,
                 enc3: QuadratureEncoder, enc4: QuadratureEncoder):
        self.encoders = {
            1: enc1,
            2: enc2,
            3: enc3,
            4: enc4,
        }
        self.encoder1 = enc1
        self.encoder2 = enc2
        self.encoder3 = enc3
        self.encoder4 = enc4

    def updateAll(self):
        """Update RPM calculations for all 4 encoders."""
        now = time.ticks_ms()
        for enc in self.encoders.values():
            enc.update_rpm(now)

    def getMotorRPM(self, motor_id: int) -> float:
        enc = self.encoders.get(motor_id)
        return enc.getRPM() if enc else 0.0

    def getEncoderTicks(self, motor_id: int) -> int:
        enc = self.encoders.get(motor_id)
        return enc.getTicks() if enc else 0

    def getEncoderDirection(self, motor_id: int) -> int:
        enc = self.encoders.get(motor_id)
        return enc.getDirection() if enc else 0

    def getAllSnapshot(self) -> dict:
        """Returns snapshot dictionary for telemetry."""
        return {
            "m1": {"ticks": self.encoder1.ticks, "rpm": self.encoder1.rpm, "dir": self.encoder1.direction},
            "m2": {"ticks": self.encoder2.ticks, "rpm": self.encoder2.rpm, "dir": self.encoder2.direction},
            "m3": {"ticks": self.encoder3.ticks, "rpm": self.encoder3.rpm, "dir": self.encoder3.direction},
            "m4": {"ticks": self.encoder4.ticks, "rpm": self.encoder4.rpm, "dir": self.encoder4.direction},
        }
