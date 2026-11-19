"""Average the yaw rate over each telemetry packet interval (MicroPython and CPython).

The robot turns in place with short ~80 deg/s pulses. One instantaneous gyro sample per
packet (~8-12 Hz) misses or double-counts whole pulses, so the integrated heading drifts by
tens of degrees per turn. Sampling many times per packet and sending the AVERAGE rate over
the packet interval keeps the receiver's `rate * dt` equal to the angle actually turned.
"""


def _plain_diff(a, b):
    return a - b


class GyroIntegrator:
    def __init__(self, ticks_diff=_plain_diff):
        # ticks_diff(a, b) = a - b with wraparound (time.ticks_diff on the ESP32).
        self._diff = ticks_diff
        self._angle_deg = 0.0
        self._window_start_us = None
        self._last_us = None
        self._last_rate = 0.0

    def sample(self, rate_dps, now_us):
        """Add one gyro reading (deg/s) taken at now_us (trapezoidal integration)."""
        if self._last_us is not None:
            dt = self._diff(now_us, self._last_us) / 1_000_000
            if dt > 0:
                self._angle_deg += (rate_dps + self._last_rate) * 0.5 * dt
        if self._window_start_us is None:
            self._window_start_us = now_us
        self._last_us = now_us
        self._last_rate = rate_dps

    def average_rate(self, now_us):
        """Average deg/s since the previous call (None before any sample); starts a new window."""
        if self._last_us is None:
            return None
        # Hold the last reading up to now so the window is fully covered.
        tail = self._diff(now_us, self._last_us) / 1_000_000
        angle = self._angle_deg + (self._last_rate * tail if tail > 0 else 0.0)
        elapsed = self._diff(now_us, self._window_start_us) / 1_000_000
        average = angle / elapsed if elapsed > 0 else self._last_rate
        self._angle_deg = 0.0
        self._window_start_us = now_us
        if tail > 0:
            self._last_us = now_us
        return average
