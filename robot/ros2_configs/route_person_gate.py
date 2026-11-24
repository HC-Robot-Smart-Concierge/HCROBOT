"""Does YOLO (/robot/person_detections) see a person where LiDAR sees the blocking object?

While vision is live, only a person in the same direction may stop the robot. If vision is
missing or FAILED the gate lets the LiDAR decision through, so the guest stop keeps working.
Times are local receive times: the Pi and laptop clocks are not assumed to match.
"""
import math

VISION_STALE_SEC = 1.5
# YOLO can miss a frame at close range; a person stays confirmed briefly between detections.
PERSON_HOLD_SEC = 0.8
BEARING_MARGIN_DEG = 8.0
LIVE_MODES = {'YOLO', 'DEGRADED'}  # DEGRADED only means slow inference; the boxes are still valid


def _sector(person):
    sector = person.get('fov_sector_deg') if isinstance(person, dict) else None
    if not isinstance(sector, (list, tuple)) or len(sector) != 2:
        return None
    try:
        low, high = float(sector[0]), float(sector[1])
    except (TypeError, ValueError):
        return None
    if not math.isfinite(low) or not math.isfinite(high):
        return None
    return min(low, high), max(low, high)


class PersonGate:
    def __init__(self):
        self.vision_at = self.person_at = None
        self.sectors = []

    def update(self, payload, now):
        if not isinstance(payload, dict) or payload.get('mode') not in LIVE_MODES:
            self.vision_at = self.person_at = None
            self.sectors = []
            return
        self.vision_at = now
        persons = payload.get('persons')
        sectors = [s for s in map(_sector, persons if isinstance(persons, list) else []) if s]
        if sectors:
            self.sectors, self.person_at = sectors, now

    def available(self, now):
        return self.vision_at is not None and now - self.vision_at <= VISION_STALE_SEC

    def confirms(self, bearings_deg, now):
        if not self.available(now):
            return True
        if self.person_at is None or now - self.person_at > PERSON_HOLD_SEC:
            return False
        return any(low - BEARING_MARGIN_DEG <= bearing <= high + BEARING_MARGIN_DEG
                   for bearing in bearings_deg for low, high in self.sectors)
