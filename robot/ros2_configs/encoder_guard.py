"""Validate all four measured wheel deltas; never invent motion from commands."""
import math

WHEELS = ('m1', 'm2', 'm3', 'm4')


class EncoderSampleGuard:
    def __init__(self, max_wheel_mps=1.0, max_pair_difference_mps=0.25, recovery_samples=5):
        self.max_wheel_mps = max_wheel_mps
        self.max_pair_difference_mps = max_pair_difference_mps
        self.recovery_samples = recovery_samples
        self.fault = None
        self.clean_samples = 0

    @property
    def valid(self):
        return self.fault is None and self.clean_samples > 0

    def reject(self, reason):
        self.fault = reason
        self.clean_samples = 0
        return False

    def check(self, current, previous, signs, dt, radius, cpr):
        if not math.isfinite(dt) or dt <= 0 or dt > 1:
            return self.reject('ENCODER_SAMPLE_TIME_INVALID')
        try:
            ticks = {wheel: float(current[wheel]) for wheel in WHEELS}
            old = {wheel: float(previous[wheel]) for wheel in WHEELS}
            if not all(math.isfinite(v) for v in [*ticks.values(), *old.values()]):
                return self.reject('ENCODER_NONFINITE_TICKS')
            speeds = {wheel: (ticks[wheel] - old[wheel]) * signs[wheel] * 2 * math.pi * radius / cpr / dt for wheel in WHEELS}
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            return self.reject('ENCODER_MISSING_OR_INVALID_CHANNEL')
        for wheel, speed in speeds.items():
            if abs(speed) > self.max_wheel_mps:
                return self.reject(f'ENCODER_{wheel.upper()}_IMPOSSIBLE_SPEED ({speed:+.2f} m/s)')
        # Motors on the same side share the drive command. A large disagreement
        # indicates an unreliable channel, stalled wheel, or wrong wiring/sign.
        for a, b in [('m1', 'm2'), ('m3', 'm4')]:
            if abs(speeds[a] - speeds[b]) > self.max_pair_difference_mps:
                return self.reject(f'ENCODER_{a.upper()}_{b.upper()}_DISAGREEMENT '
                                   f'({a.upper()}={speeds[a]:+.2f}, {b.upper()}={speeds[b]:+.2f} m/s)')
        self.clean_samples += 1
        if self.fault and self.clean_samples < self.recovery_samples:
            return False
        self.fault = None
        return True
