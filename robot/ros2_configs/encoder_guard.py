"""Validate all four measured wheel deltas; never invent motion from commands.

Same-side wheels (M1/M2 left, M3/M4 right) share one drive command. When one wheel of a
pair glitches (electrical noise on its encoder line) the side's distance is taken from the
other wheel for that sample, so a single spike neither stops autonomy nor distorts
odometry. A wheel that stays bad for longer than `fault_after_sec`, both wheels of a side
being impossible, or a missing/invalid channel is still a fault.
"""
import math

WHEELS = ('m1', 'm2', 'm3', 'm4')
PAIRS = (('left', 'm1', 'm2'), ('right', 'm3', 'm4'))


class EncoderSampleGuard:
    def __init__(self, max_wheel_mps=1.0, max_pair_difference_mps=0.25, recovery_samples=5,
                 fault_after_sec=1.0):
        self.max_wheel_mps = max_wheel_mps
        self.max_pair_difference_mps = max_pair_difference_mps
        self.recovery_samples = recovery_samples
        self.fault_after_sec = fault_after_sec
        self.fault = None
        self.clean_samples = 0
        self.side_tick_deltas = {'left': 0.0, 'right': 0.0}
        self.dropped = dict.fromkeys(WHEELS, 0)        # samples where a wheel was replaced by its partner
        self.suspect_sec = dict.fromkeys(WHEELS, 0.0)  # how long a wheel has been continuously replaced

    @property
    def valid(self):
        return self.fault is None and self.clean_samples > 0

    def reject(self, reason):
        self.fault = reason
        self.clean_samples = 0
        return False

    def _pick(self, side, a, b, speeds, expected):
        """The trusted wheel of a disagreeing pair: the plausible one closest to the command."""
        target = (expected or {}).get(side, 0.0)
        candidates = [w for w in (a, b) if abs(speeds[w]) <= self.max_wheel_mps]
        return min(candidates, key=lambda w: abs(speeds[w] - target))

    def check(self, current, previous, signs, dt, radius, cpr, expected=None):
        """True when this sample may be integrated. `expected` = commanded side speeds (m/s)."""
        if not math.isfinite(dt) or dt <= 0 or dt > 1:
            return self.reject('ENCODER_SAMPLE_TIME_INVALID')
        try:
            ticks = {wheel: float(current[wheel]) for wheel in WHEELS}
            old = {wheel: float(previous[wheel]) for wheel in WHEELS}
            if not all(math.isfinite(v) for v in [*ticks.values(), *old.values()]):
                return self.reject('ENCODER_NONFINITE_TICKS')
            deltas = {wheel: (ticks[wheel] - old[wheel]) * signs[wheel] for wheel in WHEELS}
            speeds = {wheel: deltas[wheel] * 2 * math.pi * radius / cpr / dt for wheel in WHEELS}
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            return self.reject('ENCODER_MISSING_OR_INVALID_CHANNEL')

        substituted = False
        side_deltas = {}
        for side, a, b in PAIRS:
            impossible = [w for w in (a, b) if abs(speeds[w]) > self.max_wheel_mps]
            if len(impossible) == 2:
                wheel = impossible[0]
                return self.reject(f'ENCODER_{wheel.upper()}_IMPOSSIBLE_SPEED ({speeds[wheel]:+.2f} m/s)')
            if not impossible and abs(speeds[a] - speeds[b]) <= self.max_pair_difference_mps:
                side_deltas[side] = (deltas[a] + deltas[b]) / 2.0
                self.suspect_sec[a] = self.suspect_sec[b] = 0.0
                continue
            trusted = self._pick(side, a, b, speeds, expected)
            bad = b if trusted == a else a
            self.dropped[bad] += 1
            self.suspect_sec[bad] += dt
            self.suspect_sec[trusted] = 0.0
            substituted = True
            if self.suspect_sec[bad] > self.fault_after_sec + 1e-9:
                if abs(speeds[bad]) > self.max_wheel_mps:
                    return self.reject(f'ENCODER_{bad.upper()}_IMPOSSIBLE_SPEED ({speeds[bad]:+.2f} m/s)')
                return self.reject(f'ENCODER_{a.upper()}_{b.upper()}_DISAGREEMENT '
                                   f'({a.upper()}={speeds[a]:+.2f}, {b.upper()}={speeds[b]:+.2f} m/s)')
            side_deltas[side] = deltas[trusted]

        self.side_tick_deltas = side_deltas
        if self.fault:
            # Recovering from a fault needs fully clean samples, not substituted ones.
            if substituted:
                self.clean_samples = 0
                return False
            self.clean_samples += 1
            if self.clean_samples < self.recovery_samples:
                return False
            self.fault = None
            return True
        self.clean_samples += 1
        return True
