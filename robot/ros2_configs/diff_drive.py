"""Đổi lệnh vận tốc Twist (Nav2 /cmd_vel) sang % PWM có dấu cho hai bên bánh.

Động học vi sai: v_trái = vx - wz*track/2, v_phải = vx + wz*track/2.
PWM tỉ lệ tuyến tính với tốc độ bánh (mps_per_pct), có sàn PWM để motor
thắng ma sát tĩnh (xoay tại chỗ cần sàn cao hơn vì lốp skid-steer trượt ngang),
và trần PWM; vượt trần thì co cả hai bên cùng tỉ lệ để giữ nguyên độ cong.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class DiffDriveConfig:
    track_m: float = 0.297          # track hiệu dụng (HCROBOT_EFFECTIVE_TRACK)
    mps_per_pct: float = 0.0048     # 1% PWM ~ 0.0048 m/s (100% ~ 0.48 m/s)
    min_pwm: int = 22               # sàn khi hai bên cùng chiều / một bên đứng
    spin_min_pwm: int = 38          # sàn khi hai bên ngược chiều (xoay tại chỗ)
    max_pwm: int = 50               # trần an toàn
    deadband_mps: float = 0.02      # tốc độ bánh nhỏ hơn => bên đó dừng


def twist_to_wheel_pwm(vx: float, wz: float, cfg: DiffDriveConfig) -> Tuple[int, int]:
    """Trả về (trái %, phải %) có dấu; (0, 0) nghĩa là dừng."""
    half = cfg.track_m / 2.0
    v_left = vx - wz * half
    v_right = vx + wz * half

    left = v_left / cfg.mps_per_pct
    right = v_right / cfg.mps_per_pct

    # Vượt trần: co hai bên cùng tỉ lệ để giữ hướng cong Nav2 yêu cầu.
    peak = max(abs(left), abs(right))
    if peak > cfg.max_pwm:
        scale = cfg.max_pwm / peak
        left *= scale
        right *= scale
        v_left *= scale
        v_right *= scale

    spinning = (v_left > cfg.deadband_mps and v_right < -cfg.deadband_mps) or (
        v_left < -cfg.deadband_mps and v_right > cfg.deadband_mps
    )
    floor = cfg.spin_min_pwm if spinning else cfg.min_pwm

    def _side(pct: float, v: float) -> int:
        if abs(v) < cfg.deadband_mps:
            return 0
        mag = min(cfg.max_pwm, max(floor, abs(pct)))
        return int(round(mag)) if pct > 0 else -int(round(mag))

    return _side(left, v_left), _side(right, v_right)


@dataclass(frozen=True)
class StraightDriveConfig:
    """Chế độ 'straight' cho tự quét xe thật: chỉ XOAY TẠI CHỖ hoặc CHẠY THẲNG.

    Xe thật (skid-steer, L298N) không lăn với cung rẽ PWM thấp kiểu drive:0:22 hay
    drive:22:31 mà DWB hay phát lúc xe đang đứng => odom = 0 => DWB tiếp tục phát cung
    yếu => "Failed to make progress". Hai chuyển động lái tay đã chạy được: xoay 38%
    và tiến 30%. Vì vậy: Nav2 muốn XOAY (gần như không tiến) => xoay tại chỗ; còn lại
    chạy tiến/lùi với hai bên >= min_pwm, lệch tốc tối đa max_side_ratio để bám đường.

    Cung rẽ có tiến KHÔNG đổi thành xoay: Pi chỉ cần phía trước trống khi xe tiến, còn
    xoay cần cả hông trống (góc xe lố ~10 cm) => sát tường thì xoay bị chặn, xe đứng
    yên (log 05/11 14:07: hông phải 12 cm). Rẽ gắt thật sự (lệch > ~30°) thì
    RotationShim của Nav2 tự xoay tại chỗ ở chỗ thoáng.
    """
    track_m: float = 0.297
    mps_per_pct: float = 0.0048
    min_pwm: int = 30               # sàn khi chạy thẳng (= HCROBOT_TELEOP_PWM, đã chạy được)
    max_pwm: int = 50
    spin_radius_m: float = 0.15     # bán kính cong nhỏ hơn (gần như chỉ xoay) => xoay tại chỗ
    max_side_ratio: float = 1.4     # bên nhanh / bên chậm khi chạy thẳng (hiệu chỉnh hướng nhẹ)
    min_linear_mps: float = 0.02    # |vx| nhỏ hơn coi như 0
    min_angular_rps: float = 0.1    # |wz| nhỏ hơn coi như 0 khi không tiến


def twist_to_straight_command(vx: float, wz: float, cfg: StraightDriveConfig) -> Tuple[str, int, int]:
    """Trả về ("stop"|"left"|"right"|"drive", trái %, phải %).

    "left"/"right": xoay tại chỗ (bridge gửi lệnh rời rạc + cắt xung như lái tay).
    "drive": PWM có dấu hai bên, cùng chiều, mỗi bên >= min_pwm.
    """
    moving = abs(vx) >= cfg.min_linear_mps
    if not moving:
        if abs(wz) < cfg.min_angular_rps:
            return ("stop", 0, 0)
        return ("left" if wz > 0 else "right", 0, 0)
    if abs(wz) > 1e-6 and abs(vx) / abs(wz) < cfg.spin_radius_m:
        return ("left" if wz > 0 else "right", 0, 0)

    half = cfg.track_m / 2.0
    sign = 1.0 if vx > 0 else -1.0
    # Độ lớn tốc độ hai bên theo chiều chạy (luôn dương vì bán kính >= spin_radius > half).
    fast_left = (abs(vx) - sign * wz * half) / cfg.mps_per_pct
    fast_right = (abs(vx) + sign * wz * half) / cfg.mps_per_pct
    lo, hi = min(fast_left, fast_right), max(fast_left, fast_right)
    ratio = min(cfg.max_side_ratio, hi / lo) if lo > 0 else cfg.max_side_ratio
    base = min(cfg.max_pwm / ratio, max(cfg.min_pwm, lo))
    lo_pwm = int(round(max(cfg.min_pwm, base)))
    hi_pwm = int(round(min(cfg.max_pwm, max(lo_pwm, base * ratio))))
    left, right = (lo_pwm, hi_pwm) if fast_left <= fast_right else (hi_pwm, lo_pwm)
    s = 1 if vx > 0 else -1
    return ("drive", s * left, s * right)
