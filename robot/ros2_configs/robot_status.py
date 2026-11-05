"""Dòng trạng thái 1 Hz in lên terminal: vì sao xe đứng yên.

Gom về một chỗ: lệnh Nav2 (/cmd_vel) -> lệnh bridge gửi Pi -> xe đo được chạy bao
nhiêu (encoder/gyro) -> khoảng hở LiDAR 4 phía tính từ MÉP xe -> số đo sonar + lần
chặn gần nhất do Pi gửi về (pi_status). Không phụ thuộc ROS để test được.
"""

from __future__ import annotations

import math
from typing import Dict, Iterable, Optional
from robot_geometry import HALF_LENGTH_M, HALF_WIDTH_M, LIDAR_X_M

SIDES = ("front", "rear", "left", "right")
SIDE_VI = {"front": "trước", "rear": "sau", "left": "trái", "right": "phải"}
# Góc tâm mỗi phía (độ, CCW, 0 = mũi xe), quét ±25°.
SECTOR_CENTER = {"front": 0.0, "left": 90.0, "rear": 180.0, "right": 270.0}


def lidar_clearances(
    points: Iterable[dict],
    lidar_x: float = LIDAR_X_M,
    half_length: float = HALF_LENGTH_M,
    half_width: float = HALF_WIDTH_M,
    sector_half_deg: float = 25.0,
) -> Dict[str, Optional[float]]:
    """Khoảng hở nhỏ nhất (cm) từ MÉP thân xe tới vật cản ở 4 phía.

    points: [{'angle': độ CCW (0 = trước), 'distance': m}] tính từ tâm LiDAR, LiDAR
    lắp lệch lên trước tâm xe lidar_x (laser_joint trong lidar.xacro). Không có điểm => None.
    """
    best: Dict[str, Optional[float]] = {s: None for s in SIDES}
    for p in points:
        d = p.get("distance") or 0.0
        if d <= 0.05:
            continue
        a = math.radians(p.get("angle", 0.0))
        # Toạ độ điểm trong khung thân xe (gốc = tâm xe)
        x = lidar_x + d * math.cos(a)
        y = d * math.sin(a)
        ang = math.degrees(math.atan2(y, x)) % 360.0
        for side, center in SECTOR_CENTER.items():
            diff = abs((ang - center + 180.0) % 360.0 - 180.0)
            if diff > sector_half_deg:
                continue
            gap = (abs(x) - half_length) if side in ("front", "rear") else (abs(y) - half_width)
            gap_cm = max(0.0, gap) * 100.0
            if best[side] is None or gap_cm < best[side]:
                best[side] = gap_cm
    return best


def _cm(v: Optional[float]) -> str:
    return "-" if v is None else f"{v:.0f}"


def diagnose_stuck(
    encoder_fresh: bool,
    pi_status: Optional[dict],
    pi_status_age: Optional[float],
    sent_motion: str,
) -> str:
    """Lý do khả dĩ nhất khi có lệnh chạy mà encoder báo xe không nhúc nhích."""
    if not encoder_fresh:
        return "mất encoder/IMU từ Pi (không đo được xe có chạy hay không)"
    if pi_status is None or pi_status_age is None or pi_status_age > 3.0:
        return ("không nhận trạng thái từ Pi (main.py trên Pi chưa cập nhật bản mới, "
                "hoặc mất mạng) -> xem dòng SAFETY trên terminal Pi")
    block = pi_status.get("block")
    if block and block.get("age", 99.0) < 2.5:
        return f"Pi CHẶN {str(block.get('motion', '?')).upper()}: {block.get('reason', '?')}"
    if pi_status.get("motion") == "stop" and sent_motion != "stop":
        return "Pi đang để motor dừng dù bridge gửi lệnh chạy (watchdog / lệnh không tới Pi?)"
    return "Pi đang cấp điện motor nhưng xe không lăn: PWM thấp, kẹt bánh hoặc vướng vật"


def threshold_warnings(clear: Dict[str, Optional[float]], pi_status: Optional[dict]) -> str:
    """So khoảng hở LiDAR với ngưỡng Pi: phía nào đang dưới ngưỡng => Pi sẽ chặn."""
    if not pi_status:
        return ""
    th = pi_status.get("thresholds") or {}
    side_th = {
        "front": th.get("forward"), "rear": th.get("backward"),
        "left": th.get("left"), "right": th.get("right"),
    }
    out = []
    for side in SIDES:
        c, t = clear.get(side), side_th.get(side)
        if c is not None and t is not None and c <= t:
            out.append(f"{SIDE_VI[side]} {c:.0f}<={t:.0f}cm")
    turn = th.get("turn_clearance")
    if turn is not None:
        for side in ("front", "rear"):
            c = clear.get(side)
            if c is not None and c <= turn:
                out.append(f"xoay cần {SIDE_VI[side]}>{turn:.0f}cm (đang {c:.0f})")
    return ("dưới ngưỡng Pi: " + ", ".join(out)) if out else ""


def format_status_line(
    cmd_vx: float,
    cmd_wz: float,
    cmd_active: bool,
    sent_motion: str,
    meas_vx: float,
    meas_wz: float,
    clear: Dict[str, Optional[float]],
    pi_status: Optional[dict],
    pi_status_age: Optional[float],
) -> str:
    cmd = f"Nav2 v={cmd_vx:+.2f} w={cmd_wz:+.2f}" if cmd_active else "Nav2 không ra lệnh"
    parts = [
        f"{cmd} -> Pi '{sent_motion}'",
        f"đo v={meas_vx:+.2f}m/s w={math.degrees(meas_wz):+.0f}°/s",
        "LiDAR mép xe(cm) T{} S{} Tr{} P{}".format(*(_cm(clear.get(s)) for s in SIDES)),
    ]
    if pi_status is not None and pi_status_age is not None and pi_status_age < 3.0:
        sonar = pi_status.get("sonar") or {}
        parts.append("Sonar(cm) T{} S{} Tr{} P{}".format(*(_cm(sonar.get(s)) for s in SIDES)))
        block = pi_status.get("block")
        state = f"Pi {str(pi_status.get('motion', '?')).upper()}"
        if block and block.get("age", 99.0) < 5.0:
            state += f" (chặn {block['age']:.1f}s trước: {block.get('reason', '?')})"
        parts.append(state)
    else:
        parts.append("Pi: chưa gửi trạng thái")
    return " | ".join(parts)
