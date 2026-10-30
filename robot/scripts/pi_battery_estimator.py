"""
Ước tính % pin dự phòng cấp cho Pi 5 theo phiên cấp nguồn, không cần mạch đo.

Pi 5 khởi động ngay khi được cấp nguồn, nên uptime (/proc/uptime) chính là
thời gian kể từ lúc cắm pin; uptime không reset khi main.py khởi động lại.

    % còn lại = % mốc - (uptime - uptime mốc) / số phút tụt 1%

Mốc mặc định của mỗi lần cấp nguồn là uptime 0 với giả định pin đầy (100%).
Người dùng nhập % đang hiện trên cục pin để đặt lại mốc; giữa hai lần nhập tay
đủ xa nhau thì tốc độ tụt được tự hiệu chỉnh. Tốc độ lưu qua các lần cấp nguồn,
còn mốc gắn với boot_id nên lần cấp nguồn mới tự quay về giả định pin đầy.

Hạn chế: `sudo reboot` không rút nguồn cũng sinh boot_id mới, khi đó cần nhập
lại %. Tốc độ tụt coi như không đổi, đúng khi tải Pi tương đối ổn định (động cơ
dùng pin 12V riêng).
"""

import json
import logging
import os
import threading
from typing import Any, Dict, Optional

logger = logging.getLogger("PiBattery")

MIN_MINUTES_PER_PERCENT = 0.5
MAX_MINUTES_PER_PERCENT = 120.0
# Hiệu chỉnh tốc độ chỉ khi hai lần nhập tay cách đủ xa: % trên cục pin là số
# nguyên, khoảng ngắn thì sai số làm tròn lấn át.
CALIBRATE_MIN_MINUTES = 15.0
CALIBRATE_MIN_DROP = 5.0


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


class PiBatteryEstimator:
    def __init__(self, state_path: str,
                 minutes_per_percent: float = 5.0,
                 start_percent: float = 100.0,
                 uptime_path: str = "/proc/uptime",
                 boot_id_path: str = "/proc/sys/kernel/random/boot_id"):
        self.state_path = state_path
        self.default_minutes_per_percent = _clamp(
            minutes_per_percent, MIN_MINUTES_PER_PERCENT, MAX_MINUTES_PER_PERCENT
        )
        self.default_start_percent = _clamp(start_percent, 0.0, 100.0)
        self.uptime_path = uptime_path
        self.boot_id_path = boot_id_path
        self._lock = threading.Lock()
        self._state = self._load()

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            state = dict(self._state)
        uptime = self._read_uptime()
        if uptime is None:
            return {"available": False, "percent": None}

        rate = state["minutes_per_percent"]
        anchor_age_min = max(0.0, uptime - state["anchor_uptime_sec"]) / 60.0
        percent = _clamp(state["anchor_percent"] - anchor_age_min / rate, 0.0, 100.0)
        return {
            "available": True,
            "percent": round(percent, 1),
            "remaining_min": round(percent * rate),
            "session_min": round(uptime / 60.0, 1),
            "minutes_per_percent": round(rate, 2),
            "anchor_source": state["anchor_source"],
            "anchor_percent": state["anchor_percent"],
            "anchor_age_min": round(anchor_age_min, 1),
        }

    def sync(self, percent: Optional[float] = None,
             minutes_per_percent: Optional[float] = None) -> Dict[str, Any]:
        """Đặt lại mốc theo % đang hiện trên cục pin và/hoặc đặt tay tốc độ tụt."""
        uptime = self._read_uptime()
        if uptime is None:
            raise RuntimeError("Không đọc được /proc/uptime")

        calibrated = False
        with self._lock:
            state = dict(self._state)
            if minutes_per_percent is not None:
                state["minutes_per_percent"] = _clamp(
                    float(minutes_per_percent), MIN_MINUTES_PER_PERCENT, MAX_MINUTES_PER_PERCENT
                )
            if percent is not None:
                percent = _clamp(float(percent), 0.0, 100.0)
                # Chỉ học từ hai mốc đều do người dùng nhập; mốc "giả định đầy"
                # có thể sai nếu cắm cục pin chưa đầy.
                if minutes_per_percent is None and state["anchor_source"] == "user":
                    elapsed_min = (uptime - state["anchor_uptime_sec"]) / 60.0
                    dropped = state["anchor_percent"] - percent
                    if elapsed_min >= CALIBRATE_MIN_MINUTES and dropped >= CALIBRATE_MIN_DROP:
                        measured = elapsed_min / dropped
                        state["minutes_per_percent"] = _clamp(
                            0.5 * state["minutes_per_percent"] + 0.5 * measured,
                            MIN_MINUTES_PER_PERCENT, MAX_MINUTES_PER_PERCENT,
                        )
                        calibrated = True
                state["anchor_uptime_sec"] = uptime
                state["anchor_percent"] = percent
                state["anchor_source"] = "user"
            self._state = state
            self._save(state)

        if calibrated:
            logger.info(f"🔋 Hiệu chỉnh tốc độ tụt pin: {state['minutes_per_percent']:.2f} phút/1%")
        snap = self.snapshot()
        snap["calibrated"] = calibrated
        return snap

    def _load(self) -> Dict[str, Any]:
        boot_id = self._read_boot_id()
        try:
            with open(self.state_path, encoding="utf-8") as f:
                saved = json.load(f)
        except (OSError, ValueError):
            saved = {}

        try:
            rate = float(saved.get("minutes_per_percent", self.default_minutes_per_percent))
        except (TypeError, ValueError):
            rate = self.default_minutes_per_percent
        state = {
            "boot_id": boot_id,
            "minutes_per_percent": _clamp(rate, MIN_MINUTES_PER_PERCENT, MAX_MINUTES_PER_PERCENT),
            # Lần cấp nguồn mới: mốc là lúc kernel khởi động, giả định pin đầy.
            "anchor_uptime_sec": 0.0,
            "anchor_percent": self.default_start_percent,
            "anchor_source": "assumed",
        }
        if boot_id and saved.get("boot_id") == boot_id:
            try:
                state["anchor_uptime_sec"] = float(saved["anchor_uptime_sec"])
                state["anchor_percent"] = _clamp(float(saved["anchor_percent"]), 0.0, 100.0)
                state["anchor_source"] = saved.get("anchor_source", "user")
            except (KeyError, TypeError, ValueError):
                pass
        return state

    def _save(self, state: Dict[str, Any]) -> None:
        tmp_path = f"{self.state_path}.tmp"
        try:
            os.makedirs(os.path.dirname(self.state_path) or ".", exist_ok=True)
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            os.replace(tmp_path, self.state_path)
        except OSError as exc:
            logger.warning(f"🔋 Không lưu được trạng thái pin: {exc}")

    def _read_uptime(self) -> Optional[float]:
        try:
            with open(self.uptime_path) as f:
                return float(f.read().split()[0])
        except (OSError, ValueError, IndexError):
            return None

    def _read_boot_id(self) -> Optional[str]:
        try:
            with open(self.boot_id_path) as f:
                return f.read().strip() or None
        except OSError:
            return None
