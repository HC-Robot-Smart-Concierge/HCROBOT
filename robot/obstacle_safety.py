"""Fail-safe giữa lệnh chuyển động và MotorController."""

from dataclasses import dataclass
import logging
from typing import Optional


logger = logging.getLogger("ObstacleSafety")

DEFAULT_THRESHOLDS_CM = {
    "forward": 20.0,
    "backward": 20.0,
    "left": 15.0,
    "right": 15.0,
}

MOTION_SENSOR = {
    "forward": "front",
    "backward": "rear",
    "left": "left",
    "right": "right",
}


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    reason: str
    sensor: Optional[str] = None
    distance_cm: Optional[float] = None
    threshold_cm: Optional[float] = None


class ObstacleSafetyController:
    """Chỉ chuyển lệnh tới motor khi sensor tương ứng đang hợp lệ và đủ xa."""

    def __init__(
        self,
        motor,
        sensor_reader,
        thresholds_cm=None,
        stale_timeout=0.75,
    ):
        self.motor = motor
        self.sensor_reader = sensor_reader
        self.thresholds_cm = dict(DEFAULT_THRESHOLDS_CM)
        if thresholds_cm:
            self.thresholds_cm.update(
                {name: float(value) for name, value in thresholds_cm.items()}
            )
        self.stale_timeout = float(stale_timeout)
        self.motion = "stop"

    def evaluate(self, motion: str) -> SafetyDecision:
        if motion == "stop":
            return SafetyDecision(True, "stop luôn được phép")
        if motion not in MOTION_SENSOR:
            return SafetyDecision(False, f"lệnh không hợp lệ: {motion}")

        snapshot = self.sensor_reader.latest()
        sensor_name = MOTION_SENSOR[motion]
        threshold = self.thresholds_cm[motion]
        if snapshot is None:
            return SafetyDecision(
                False,
                "chưa nhận được packet từ ESP32",
                sensor=sensor_name,
                threshold_cm=threshold,
            )

        age = snapshot.age_seconds()
        if age > self.stale_timeout:
            return SafetyDecision(
                False,
                f"dữ liệu ESP32 đã cũ {age:.2f}s > {self.stale_timeout:.2f}s",
                sensor=sensor_name,
                threshold_cm=threshold,
            )

        distance = snapshot.distance(sensor_name)
        if distance is None:
            return SafetyDecision(
                False,
                f"sensor {sensor_name} timeout/out-of-range",
                sensor=sensor_name,
                threshold_cm=threshold,
            )
        if distance < threshold:
            return SafetyDecision(
                False,
                f"vật cản {sensor_name}={distance:.1f}cm < {threshold:.1f}cm",
                sensor=sensor_name,
                distance_cm=distance,
                threshold_cm=threshold,
            )
        return SafetyDecision(
            True,
            f"{sensor_name}={distance:.1f}cm",
            sensor=sensor_name,
            distance_cm=distance,
            threshold_cm=threshold,
        )

    def command(self, motion: str) -> bool:
        """Thực thi lệnh nếu an toàn; nếu không thì dừng motor ngay."""
        if motion == "stop":
            self.stop()
            return True

        decision = self.evaluate(motion)
        if not decision.allowed:
            self.motor.stop()
            self.motion = "stop"
            logger.warning("SAFETY BLOCK %s: %s", motion.upper(), decision.reason)
            return False

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
        """Gọi liên tục; dừng motor nếu vật cản xuất hiện hoặc Serial bị stale."""
        if self.motion == "stop":
            return True
        decision = self.evaluate(self.motion)
        if decision.allowed:
            return True

        stopped_motion = self.motion
        self.motor.stop()
        self.motion = "stop"
        logger.error("SAFETY STOP %s: %s", stopped_motion.upper(), decision.reason)
        return False

    def stop(self):
        self.motor.stop()
        self.motion = "stop"
