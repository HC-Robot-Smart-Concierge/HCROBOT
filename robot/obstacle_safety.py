"""Fail-safe giữa lệnh chuyển động và MotorController."""

from dataclasses import dataclass
import logging
import time
from typing import Optional


logger = logging.getLogger("ObstacleSafety")

SENSOR_NAMES = ("front", "rear", "left", "right")

DEFAULT_THRESHOLDS_CM = {
    "forward": 35.0,
    "backward": 30.0,
    "left": 25.0,
    "right": 25.0,
}


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    reason: str
    sensor: Optional[str] = None
    distance_cm: Optional[float] = None
    threshold_cm: Optional[float] = None


@dataclass
class _SensorState:
    last_valid_distance: Optional[float] = None
    last_valid_at: Optional[float] = None
    consecutive_invalid: int = 0


class ObstacleSafetyController:
    """Chỉ chuyển lệnh tới motor khi mọi cảm biến liên quan đều an toàn.

    Khi quay tại chỗ, đầu và đuôi xe cùng quét theo vòng cung. Vì vậy lệnh quay
    kiểm tra cảm biến bên quay, phía trước và phía sau thay vì chỉ kiểm tra bên hông.
    """

    def __init__(
        self,
        motor,
        sensor_reader,
        thresholds_cm=None,
        stale_timeout=0.4,
        invalid_grace=0.2,
        allowed_null_packets=1,
        resume_margin_cm=10.0,
        resume_valid_packets=3,
        turn_clearance_cm=25.0,
    ):
        self.motor = motor
        self.sensor_reader = sensor_reader
        self.thresholds_cm = dict(DEFAULT_THRESHOLDS_CM)
        if thresholds_cm:
            self.thresholds_cm.update(
                {name: float(value) for name, value in thresholds_cm.items()}
            )

        self.stale_timeout = float(stale_timeout)
        self.invalid_grace = max(0.0, float(invalid_grace))
        self.allowed_null_packets = max(0, int(allowed_null_packets))
        self.resume_margin_cm = max(0.0, float(resume_margin_cm))
        self.resume_valid_packets = max(1, int(resume_valid_packets))
        self.turn_clearance_cm = float(turn_clearance_cm)

        self.motion = "stop"
        self._sensor_states = {name: _SensorState() for name in SENSOR_NAMES}
        self._last_snapshot_key = None
        self._blocked_motions = set()
        self._clear_streak = {
            motion: 0 for motion in ("forward", "backward", "left", "right")
        }

    def _requirements(self, motion):
        if motion == "forward":
            return (("front", self.thresholds_cm["forward"]),)
        if motion == "backward":
            return (("rear", self.thresholds_cm["backward"]),)
        if motion == "left":
            return (
                ("left", self.thresholds_cm["left"]),
                ("front", self.turn_clearance_cm),
                ("rear", self.turn_clearance_cm),
            )
        if motion == "right":
            return (
                ("right", self.thresholds_cm["right"]),
                ("front", self.turn_clearance_cm),
                ("rear", self.turn_clearance_cm),
            )
        return ()

    def _packet_is_clear_for_resume(self, snapshot, motion):
        """Resume chỉ dùng số đo hiện tại, tuyệt đối không dùng giá trị giữ tạm."""
        for sensor_name, stop_threshold in self._requirements(motion):
            distance = snapshot.distance(sensor_name)
            if distance is None:
                return False
            if distance <= stop_threshold + self.resume_margin_cm:
                return False
        return True

    def _refresh(self, snapshot):
        """Cập nhật trạng thái đúng một lần cho mỗi packet Serial."""
        snapshot_key = (snapshot.port, snapshot.sequence, snapshot.received_at)
        if snapshot_key == self._last_snapshot_key:
            return
        self._last_snapshot_key = snapshot_key

        for sensor_name in SENSOR_NAMES:
            state = self._sensor_states[sensor_name]
            distance = snapshot.distance(sensor_name)
            if distance is None:
                state.consecutive_invalid += 1
            else:
                state.last_valid_distance = distance
                state.last_valid_at = snapshot.received_at
                state.consecutive_invalid = 0

        for motion in self._clear_streak:
            if self._packet_is_clear_for_resume(snapshot, motion):
                self._clear_streak[motion] += 1
            else:
                self._clear_streak[motion] = 0

    def _distance_for_safety(self, snapshot, sensor_name, now):
        current = snapshot.distance(sensor_name)
        if current is not None:
            return current, False, None

        state = self._sensor_states[sensor_name]
        if state.last_valid_distance is None or state.last_valid_at is None:
            return None, False, f"sensor {sensor_name} chưa có số đo hợp lệ"

        valid_age = now - state.last_valid_at
        if state.consecutive_invalid > self.allowed_null_packets:
            return (
                None,
                False,
                f"sensor {sensor_name} null {state.consecutive_invalid} packet liên tiếp",
            )
        if valid_age > self.invalid_grace:
            return (
                None,
                False,
                f"sensor {sensor_name} không có số đo hợp lệ trong {valid_age:.2f}s",
            )

        return state.last_valid_distance, True, None

    def update(self):
        """Nhận packet mới cả khi xe đang dừng để chuẩn bị mở khóa an toàn."""
        snapshot = self.sensor_reader.latest()
        if snapshot is not None:
            self._refresh(snapshot)

    def evaluate(self, motion: str) -> SafetyDecision:
        if motion == "stop":
            return SafetyDecision(True, "stop luôn được phép")
        if not self._requirements(motion):
            return SafetyDecision(False, f"lệnh không hợp lệ: {motion}")

        snapshot = self.sensor_reader.latest()
        primary_sensor, primary_threshold = self._requirements(motion)[0]
        if snapshot is None:
            return SafetyDecision(
                False,
                "chưa nhận được packet từ ESP32",
                sensor=primary_sensor,
                threshold_cm=primary_threshold,
            )

        self._refresh(snapshot)
        now = time.monotonic()
        age = snapshot.age_seconds(now)
        if age > self.stale_timeout:
            return SafetyDecision(
                False,
                f"dữ liệu ESP32 đã cũ {age:.2f}s > {self.stale_timeout:.2f}s",
                sensor=primary_sensor,
                threshold_cm=primary_threshold,
            )

        if motion in self._blocked_motions:
            streak = self._clear_streak[motion]
            if streak < self.resume_valid_packets:
                return SafetyDecision(
                    False,
                    "khóa an toàn: cần {needed} packet liên tiếp cao hơn ngưỡng "
                    "+ {margin:.1f}cm (hiện có {current})".format(
                        needed=self.resume_valid_packets,
                        margin=self.resume_margin_cm,
                        current=streak,
                    ),
                    sensor=primary_sensor,
                    threshold_cm=primary_threshold + self.resume_margin_cm,
                )

        readings = []
        for sensor_name, threshold in self._requirements(motion):
            distance, held, error = self._distance_for_safety(
                snapshot, sensor_name, now
            )
            if error is not None:
                return SafetyDecision(
                    False,
                    error,
                    sensor=sensor_name,
                    threshold_cm=threshold,
                )
            if distance <= threshold:
                return SafetyDecision(
                    False,
                    f"vật cản {sensor_name}={distance:.1f}cm <= {threshold:.1f}cm",
                    sensor=sensor_name,
                    distance_cm=distance,
                    threshold_cm=threshold,
                )
            suffix = " (giữ tạm)" if held else ""
            readings.append(f"{sensor_name}={distance:.1f}cm{suffix}")

        return SafetyDecision(True, ", ".join(readings))

    def command(self, motion: str) -> bool:
        """Thực thi lệnh nếu an toàn; nếu không thì dừng motor ngay."""
        if motion == "stop":
            self.stop()
            return True

        was_blocked = motion in self._blocked_motions
        decision = self.evaluate(motion)
        if not decision.allowed:
            self.motor.stop()
            self.motion = "stop"
            self._blocked_motions.add(motion)
            if not was_blocked:
                self._clear_streak[motion] = 0
            logger.warning("SAFETY BLOCK %s: %s", motion.upper(), decision.reason)
            return False

        self._blocked_motions.discard(motion)
        actions = {
            "forward": self.motor.forward,
            "backward": self.motor.backward,
            "left": self.motor.turn_left,
            "right": self.motor.turn_right,
        }
        actions[motion]()
        self.motion = motion
        logger.info("SAFETY ALLOW %s: %s", motion.upper(), decision.reason)
        return True

    def enforce(self) -> bool:
        """Gọi liên tục; dừng motor nếu vật cản hoặc dữ liệu không còn an toàn."""
        self.update()
        if self.motion == "stop":
            return True

        decision = self.evaluate(self.motion)
        if decision.allowed:
            return True

        stopped_motion = self.motion
        self.motor.stop()
        self.motion = "stop"
        self._blocked_motions.add(stopped_motion)
        self._clear_streak[stopped_motion] = 0
        logger.error("SAFETY STOP %s: %s", stopped_motion.upper(), decision.reason)
        return False

    def stop(self):
        self.motor.stop()
        self.motion = "stop"
