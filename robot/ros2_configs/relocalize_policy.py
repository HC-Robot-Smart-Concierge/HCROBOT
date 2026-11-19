"""When the localization manager should nudge AMCL or search for a better pose.

- Stopped (goal reached, waiting for a guest, retry wait): AMCL does not update without
  motion, so ask it for a no-motion update every second for the first seconds of a stop, and
  if the scan still fits poorly, search a wide window (+-0.6 m, +-90 deg) every 3 s.
- Moving: AMCL updates itself; if the fit gets poor, search a narrow window (+-0.25 m,
  +-30 deg) once per second so a drifting heading is pulled back before it is too late.
- Only for a verified pose (LOCALIZED) or one that was lost; a pose still being verified
  after the user set it is left alone.
"""
from localization_logic import LOCALIZED, LOST

NARROW = ('search', 0.25, 30.0)
WIDE = ('search', 0.6, 90.0)


class RelocalizePolicy:
    def __init__(self, nomotion_period=1.0, nomotion_window=10.0, moving_period=1.0, stopped_period=3.0,
                 stopped_after=1.0, moving_poor_score=0.8, moving_poor_weak=0.4,
                 stopped_poor_score=0.85, stopped_poor_weak=0.45):
        self.nomotion_period = nomotion_period
        self.nomotion_window = nomotion_window
        self.moving_period = moving_period
        self.stopped_period = stopped_period
        self.stopped_after = stopped_after
        self.moving_poor = (moving_poor_score, moving_poor_weak)
        self.stopped_poor = (stopped_poor_score, stopped_poor_weak)
        self.last_nomotion = None
        self.last_search = None
        self.unfixable = False

    @staticmethod
    def _poor(match, limits):
        return match.score < limits[0] or match.weak < limits[1]

    @staticmethod
    def _due(last, now, period):
        return last is None or now - last >= period - 1e-9

    def actions(self, now, state, moving, stationary_for, match):
        """Actions for this tick: ('nomotion',) and/or ('search', xy_range_m, yaw_range_deg)."""
        if state not in (LOCALIZED, LOST):
            return []
        if match is not None and not self._poor(match, self.moving_poor):
            self.unfixable = False
        out = []
        if (not moving and stationary_for <= self.nomotion_window
                and self._due(self.last_nomotion, now, self.nomotion_period)):
            out.append(('nomotion',))
            self.last_nomotion = now
        if match is None:
            return out
        if moving:
            if self._poor(match, self.moving_poor) and self._due(self.last_search, now, self.moving_period):
                out.append(NARROW)
                self.last_search = now
        elif stationary_for >= self.stopped_after and (state == LOST or self._poor(match, self.stopped_poor)):
            if self._due(self.last_search, now, self.stopped_period):
                out.append(WIDE)
                self.last_search = now
        return out

    def result(self, found):
        """Outcome of the last search: no clear correction while the fit is poor = unfixable."""
        self.unfixable = not found
