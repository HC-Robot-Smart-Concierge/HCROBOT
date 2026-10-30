"""
Đọc nguồn cấp cho Raspberry Pi 5 qua PMIC (vcgencmd pmic_read_adc).

Pi 5 chỉ đo được phía sau cổng USB-C: điện áp 5 V vào (EXT5V_V) và dòng/áp
từng rail bên trong PMIC. Pin dự phòng hay mạch hạ áp luôn giữ đầu ra ~5.1 V
cho tới lúc cắt, nên KHÔNG suy ra được % pin từ các số này. Muốn có % thật phải
đo điện áp khối pin trước mạch hạ áp (INA219 trên I2C hoặc phân áp vào ADC).

Công suất trả về là tổng các rail PMIC: chưa gồm thiết bị cắm USB (LiDAR,
ESP32, camera) và hao hụt chuyển đổi, nên là cận dưới của công suất đầu vào.

vcgencmd cần quyền root (/dev/vcio). main.py chạy bằng sudo nên đọc được; chạy
bằng user thường thì chỉ còn cờ thiếu áp từ hwmon rpi_volt.
"""

import glob
import logging
import os
import re
import subprocess
import threading
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("PiPower")

# "     VDD_CORE_A current(7)=0.66402000A" / "   EXT5V_V volt(24)=5.09523800V"
_ADC_LINE = re.compile(r"^\s*(\S+)_([AV])\s+(?:current|volt)\(\d+\)=(-?[\d.]+)[AV]\s*$")
_THROTTLED = re.compile(r"throttled=(0x[0-9a-fA-F]+)")

# Pi 5 báo thiếu áp quanh 4.63 V; dưới mức này coi là sắp chạm ngưỡng.
LOW_VOLTAGE_V = 4.85

THROTTLE_BITS = {
    "under_voltage_now": 0,
    "freq_capped_now": 1,
    "throttled_now": 2,
    "soft_temp_limit_now": 3,
    "under_voltage_occurred": 16,
    "freq_capped_occurred": 17,
    "throttled_occurred": 18,
    "soft_temp_limit_occurred": 19,
}


def parse_pmic_adc(text: str) -> Tuple[Dict[str, Dict[str, float]], Optional[float]]:
    """Ghép dòng/áp cùng tên rail. Trả về (rails, EXT5V_V)."""
    currents: Dict[str, float] = {}
    volts: Dict[str, float] = {}
    for line in text.splitlines():
        m = _ADC_LINE.match(line)
        if not m:
            continue
        name, kind, value = m.group(1), m.group(2), float(m.group(3))
        (currents if kind == "A" else volts)[name] = value

    rails = {
        name: {"a": amps, "v": volts[name], "w": amps * volts[name]}
        for name, amps in currents.items()
        if name in volts
    }
    return rails, volts.get("EXT5V")


def parse_throttled(text: str) -> Optional[int]:
    m = _THROTTLED.search(text or "")
    return int(m.group(1), 16) if m else None


def decode_throttled(value: int) -> Dict[str, bool]:
    return {name: bool(value & (1 << bit)) for name, bit in THROTTLE_BITS.items()}


def classify_power(ext5v_v: Optional[float], flags: Optional[Dict[str, bool]],
                   hwmon_undervoltage: Optional[bool]) -> str:
    if ext5v_v is None and flags is None and hwmon_undervoltage is None:
        return "UNAVAILABLE"
    if hwmon_undervoltage or (flags and flags["under_voltage_now"]):
        return "UNDERVOLTAGE"
    if ext5v_v is not None and ext5v_v < LOW_VOLTAGE_V:
        return "LOW_VOLTAGE"
    if flags and flags["under_voltage_occurred"]:
        return "UNDERVOLTAGE_OCCURRED"
    if flags and (flags["throttled_now"] or flags["freq_capped_now"]):
        return "THROTTLED"
    return "OK"


class PiPowerMonitor:
    """Đọc PMIC theo yêu cầu, cache ngắn để nhiều tab web không gọi vcgencmd dồn dập."""

    def __init__(self, cache_sec: float = 1.5, vcgencmd: str = "vcgencmd",
                 hwmon_root: str = "/sys/class/hwmon",
                 dt_power_dir: str = "/proc/device-tree/chosen/power",
                 thermal_path: str = "/sys/class/thermal/thermal_zone0/temp"):
        self.cache_sec = cache_sec
        self.vcgencmd = vcgencmd
        self.hwmon_root = hwmon_root
        self.dt_power_dir = dt_power_dir
        self.thermal_path = thermal_path
        self._lock = threading.Lock()
        self._cached: Optional[Dict[str, Any]] = None
        self._cached_at = 0.0
        self._vcgencmd_error: Optional[str] = None
        self._error_logged = False

    def get(self) -> Dict[str, Any]:
        with self._lock:
            now = time.monotonic()
            if self._cached is None or now - self._cached_at >= self.cache_sec:
                self._cached = self.read_once()
                self._cached_at = now
            return dict(self._cached)

    def read_once(self) -> Dict[str, Any]:
        self._vcgencmd_error = None
        rails: Dict[str, Dict[str, float]] = {}
        ext5v_v = None
        adc_text = self._run_vcgencmd("pmic_read_adc")
        if adc_text:
            rails, ext5v_v = parse_pmic_adc(adc_text)

        throttled = parse_throttled(self._run_vcgencmd("get_throttled") or "")
        flags = decode_throttled(throttled) if throttled is not None else None
        hwmon_undervoltage = self._read_hwmon_undervoltage()

        pmic_power_w = sum(r["w"] for r in rails.values()) if rails else None
        est_current_a = (
            pmic_power_w / ext5v_v
            if pmic_power_w is not None and ext5v_v and ext5v_v > 0
            else None
        )

        if self._vcgencmd_error and not self._error_logged:
            logger.warning(f"⚡ Không đọc được PMIC Pi 5: {self._vcgencmd_error}")
            self._error_logged = True

        return {
            "status": classify_power(ext5v_v, flags, hwmon_undervoltage),
            "source": "pmic" if rails else ("hwmon" if hwmon_undervoltage is not None else None),
            "ext5v_v": _round(ext5v_v, 3),
            "pmic_power_w": _round(pmic_power_w, 2),
            "est_current_a": _round(est_current_a, 3),
            "rails": {
                name: {k: round(v, 4) for k, v in values.items()}
                for name, values in sorted(rails.items())
            },
            "throttled_hex": None if throttled is None else hex(throttled),
            "flags": flags,
            "hwmon_undervoltage": hwmon_undervoltage,
            "psu_max_current_ma": self._read_dt_u32("max_current"),
            "psu_usb_pd": self._read_usb_pd(),
            "cpu_temp_c": self._read_cpu_temp_c(),
            "message": self._vcgencmd_error or "",
            "read_at": time.time(),
        }

    def _run_vcgencmd(self, arg: str) -> Optional[str]:
        try:
            proc = subprocess.run(
                [self.vcgencmd, arg], capture_output=True, text=True, timeout=1.5
            )
        except FileNotFoundError:
            self._vcgencmd_error = "Không tìm thấy vcgencmd trên Pi."
            return None
        except (subprocess.TimeoutExpired, OSError) as exc:
            self._vcgencmd_error = f"vcgencmd {arg} lỗi: {exc}"
            return None

        output = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode != 0 or "Can't open device file" in output:
            if "/dev/vcio" in output:
                self._vcgencmd_error = "Chưa có quyền đọc PMIC (/dev/vcio): chạy main.py bằng sudo."
            else:
                self._vcgencmd_error = f"vcgencmd {arg} lỗi: {output.strip()[:120]}"
            return None
        return proc.stdout

    def _read_hwmon_undervoltage(self) -> Optional[bool]:
        for hw in glob.glob(os.path.join(self.hwmon_root, "hwmon*")):
            try:
                with open(os.path.join(hw, "name")) as f:
                    if f.read().strip() != "rpi_volt":
                        continue
                with open(os.path.join(hw, "in0_lcrit_alarm")) as f:
                    return f.read().strip() == "1"
            except OSError:
                continue
        return None

    def _read_dt_u32(self, name: str) -> Optional[int]:
        try:
            with open(os.path.join(self.dt_power_dir, name), "rb") as f:
                data = f.read(4)
        except OSError:
            return None
        return int.from_bytes(data, "big") if len(data) == 4 else None

    def _read_usb_pd(self) -> Optional[bool]:
        """Bootloader ghi lại các PDO nguồn chào; toàn 0 nghĩa là không có USB-PD."""
        try:
            with open(os.path.join(self.dt_power_dir, "usbpd_power_data_objects"), "rb") as f:
                return any(f.read())
        except OSError:
            return None

    def _read_cpu_temp_c(self) -> Optional[float]:
        try:
            with open(self.thermal_path) as f:
                return round(int(f.read().strip()) / 1000.0, 1)
        except (OSError, ValueError):
            return None


def _round(value: Optional[float], digits: int) -> Optional[float]:
    return None if value is None else round(value, digits)
