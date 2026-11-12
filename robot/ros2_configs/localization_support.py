"""Sensor checks and bounded, stationary AMCL initialization updates."""
import math


def sensor_frame_is_fresh(scan_age, encoder_age, max_age=0.5):
    # Older Pi versions omit ages; retain compatibility in that case.
    return all(age is None or (isinstance(age, (int, float))
               and math.isfinite(age) and 0 <= age <= max_age)
               for age in (scan_age, encoder_age))


class LocalizationWarmup:
    """Request a few real scan updates after /initialpose, without moving."""

    def __init__(self):
        self.remaining = 0
        self.deadline = 0.0
        self.next_at = 0.0
        self.last_scan_at = 0.0

    def arm(self, now):
        self.remaining = 5
        self.deadline = now + 10.0
        self.next_at = now
        self.last_scan_at = now

    def ready(self, now, scan_at, stopped, vx, wz):
        return (self.remaining > 0 and self.next_at <= now < self.deadline
                and self.last_scan_at < scan_at <= now and now - scan_at < 0.5
                and stopped and math.isfinite(vx) and math.isfinite(wz)
                and abs(vx) < 0.01 and abs(wz) < 0.03)

    def sent(self, now, scan_at):
        self.remaining -= 1
        self.next_at = now + 0.5
        self.last_scan_at = scan_at
