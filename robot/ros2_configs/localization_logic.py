"""Logic thuan (khong ROS) cho Localization Manager - xem localization_manager.py.

- near_wall_mask + scan_match_score: bao nhieu % tia LiDAR roi sat tuong tren map khi dat xe o
  pose AMCL dang tin. Covariance nho chi noi AMCL TU TIN, khong noi AMCL DUNG; diem khop nay la
  bang chung doc lap (phong doi xung van co the khop o vi tri xoay 180 do - can nguoi xac nhan).
- LocalizationStateMachine: UNLOCALIZED -> LOCALIZING -> LOCALIZED <-> LOCALIZATION_LOST.
- save_last_pose / load_last_pose: luu pose cuoi ra file de lan khoi dong sau thu lai.
"""

from __future__ import annotations

import json
import math
import os
import time
from dataclasses import dataclass
from typing import Optional, Sequence, Tuple

UNLOCALIZED = "UNLOCALIZED"
LOCALIZING = "LOCALIZING"
LOCALIZED = "LOCALIZED"
LOST = "LOCALIZATION_LOST"

OCCUPIED = 65  # OccupancyGrid >= 65 = tuong (giong occupied_thresh 0.65 cua map_server)
Grid = Tuple[int, int, float, float, float]  # (rong, cao, do phan giai, goc x, goc y)


def near_wall_mask(data: Sequence[int], width: int, height: int, resolution: float,
                   tol_m: float = 0.12) -> bytearray:
    """1 = o cach o tuong gan nhat <= tol_m (khoang cach Euclid giua tam o)."""
    mask = bytearray(width * height)
    r = math.ceil(tol_m / resolution)
    r2 = (tol_m / resolution) ** 2
    offsets = [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx * dx + dy * dy <= r2]
    for i, v in enumerate(data):
        if v < OCCUPIED:
            continue
        cx, cy = i % width, i // width
        for dx, dy in offsets:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height:
                mask[ny * width + nx] = 1
    return mask


@dataclass(frozen=True)
class ScanMatch:
    score: float        # ti le tia roi sat tuong (tat ca cac huong)
    weak_sector: float  # ti le khop cua huong KEM NHI trong 8 huong quanh xe (du tia)
    beams: int


def scan_match(ranges: Sequence[float], angle_min: float, angle_increment: float,
               range_min: float, range_max: float, laser_pose: Tuple[float, float, float],
               mask: bytearray, grid: Grid, sectors: int = 8,
               max_beams: int = 120, min_beams: int = 30, min_sector_beams: int = 8) -> Optional[ScanMatch]:
    """Do LiDAR khop map tai laser_pose (mask = near_wall_mask cua map). Qua it tia hop le => None.

    Diem cuoi tia ngoai map hoac o o chua biet tinh la KHONG khop. Ti le tong KHONG du: dat xe
    lech doc theo tuong (hanh lang, phong dai) thi tia vao 2 tuong song song van khop (~65%).
    Chia 8 huong: lech doc tuong lam 2 huong nhin vao 2 tuong dau/cuoi gan 0 (test: <= 0.22),
    con nguoi dung sat che 1 huong chi lam hong 1 huong => xet huong KEM NHI (test: 0.64).
    """
    width, height, res, ox, oy = grid
    lx, ly, lyaw = laser_pose
    valid = [k for k, r in enumerate(ranges)
             if math.isfinite(r) and range_min < r < range_max]
    if len(valid) < min_beams:
        return None
    step = max(1, len(valid) // max_beams)
    used = hits = 0
    width_rad = 2 * math.pi / sectors
    sector_used, sector_hits = [0] * sectors, [0] * sectors
    for k in valid[::step]:
        rel = angle_min + k * angle_increment
        a = lyaw + rel
        r = ranges[k]
        cx = int((lx + r * math.cos(a) - ox) / res)
        cy = int((ly + r * math.sin(a) - oy) / res)
        hit = 0 <= cx < width and 0 <= cy < height and bool(mask[cy * width + cx])
        sector = int(((rel + width_rad / 2) % (2 * math.pi)) // width_rad) % sectors
        used += 1
        hits += hit
        sector_used[sector] += 1
        sector_hits[sector] += hit
    rates = sorted(h / u for h, u in zip(sector_hits, sector_used) if u >= min_sector_beams)
    weak = rates[1] if len(rates) >= 2 else (rates[0] if rates else 0.0)
    return ScanMatch(score=hits / used, weak_sector=weak, beams=used)


class LocalizationStateMachine:
    """Quyet dinh xe da dinh vi chua. Chi LOCALIZED moi duoc tu hanh (goal khac bi huy)."""

    def __init__(self, good_score: float = 0.6, lost_score: float = 0.35, confirm_sec: float = 2.0,
                 lost_sec: float = 3.0, localize_timeout_sec: float = 20.0,
                 max_sigma_xy: float = 0.35, max_sigma_yaw: float = 0.35, min_sector_score: float = 0.3):
        self.good_score = good_score
        self.lost_score = lost_score
        self.min_sector_score = min_sector_score
        self.confirm_sec = confirm_sec
        self.lost_sec = lost_sec
        self.localize_timeout_sec = localize_timeout_sec
        self.max_sigma_xy = max_sigma_xy
        self.max_sigma_yaw = max_sigma_yaw
        self.state = UNLOCALIZED
        self.reason = "Vừa khởi động: chưa có vị trí trên map."
        self._input_reason = True  # reason hien tai noi ve dau vao (thay duoc), khong phai that bai
        self.source = ""
        self._started = 0.0
        self._good_since: Optional[float] = None
        self._bad_since: Optional[float] = None

    def should_cancel_goals(self) -> bool:
        return self.state != LOCALIZED

    def on_initial_pose(self, now: float, source: str) -> None:
        """Co vi tri ban dau moi (Web / Foxglove / khoi phuc pose cu): xac minh lai tu dau."""
        self.state = LOCALIZING
        self.source = source
        self.reason = "Đang so LiDAR với bản đồ tại vị trí vừa đặt..."
        self._started = now
        self._good_since = None
        self._bad_since = None

    def _set(self, state: str, reason: str) -> bool:
        changed = state != self.state
        self.state, self.reason = state, reason
        self._input_reason = False
        self._good_since = self._bad_since = None
        return changed

    def update(self, now: float, inputs_ok: bool, missing_reason: str, match: Optional[ScanMatch],
               sigma_xy: Optional[float], sigma_yaw: Optional[float]) -> bool:
        """Goi dinh ky. Tra ve True neu doi trang thai."""
        confident = (sigma_xy is not None and sigma_yaw is not None
                     and sigma_xy <= self.max_sigma_xy and sigma_yaw <= self.max_sigma_yaw)
        score = match.score if match is not None else None
        aligned = match is not None and match.weak_sector >= self.min_sector_score
        good = score is not None and score >= self.good_score and aligned and confident
        pct = f"{score:.0%}" if score is not None else "?"

        if self.state == UNLOCALIZED:
            # Ly do ve dau vao (thieu LiDAR -> "dat vi tri tren Web") cap nhat lien tuc; ly do xac
            # minh THAT BAI thi giu de nguoi dung doc, tru khi lai mat dau vao.
            if not inputs_ok or self._input_reason:
                self.reason = missing_reason
                self._input_reason = True
            return False

        if self.state == LOCALIZING:
            if good:
                self._good_since = self._good_since if self._good_since is not None else now
                if now - self._good_since >= self.confirm_sec:
                    return self._set(LOCALIZED, f"Đã định vị: LiDAR khớp bản đồ {pct}.")
            else:
                self._good_since = None
            if now - self._started >= self.localize_timeout_sec:
                why = (f"LiDAR chỉ khớp {pct} bản đồ (cần ≥ {self.good_score:.0%})" if score is not None
                       else (missing_reason if not inputs_ok else "chưa đánh giá được LiDAR"))
                if match is not None and match.score >= self.good_score and not aligned:
                    why = (f"LiDAR khớp {pct} nhưng có hướng chỉ khớp {match.weak_sector:.0%}: "
                           "vị trí có thể lệch dọc theo tường")
                elif score is not None and score >= self.good_score and not confident:
                    why = "AMCL chưa đủ chắc chắn (độ phân tán vị trí còn lớn)"
                return self._set(UNLOCALIZED, f"Không xác nhận được vị trí sau "
                                              f"{self.localize_timeout_sec:.0f} s: {why}. Đặt lại vị trí trên Web.")
            return False

        if self.state == LOCALIZED:
            bad = score is not None and score < self.lost_score
            if bad:
                self._bad_since = self._bad_since if self._bad_since is not None else now
                if now - self._bad_since >= self.lost_sec:
                    return self._set(LOST, f"Mất định vị: LiDAR chỉ còn khớp {pct} bản đồ. Đã dừng xe.")
            else:
                self._bad_since = None
                if score is not None:
                    self.reason = f"Đã định vị: LiDAR khớp bản đồ {pct}."
            return False

        # LOST: tu khoi phuc khi LiDAR khop lai on dinh (vd. nguoi dung chan LiDAR roi di)
        if good:
            self._good_since = self._good_since if self._good_since is not None else now
            if now - self._good_since >= self.confirm_sec:
                return self._set(LOCALIZED, f"Đã khớp lại bản đồ ({pct}). Gửi lại endpoint để đi tiếp.")
        else:
            self._good_since = None
        return False


def save_last_pose(path: str, map_name: str, x: float, y: float, yaw: float) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"map": map_name, "x": round(x, 3), "y": round(y, 3), "yaw": round(yaw, 3),
                   "saved_at": time.time()}, f)
    os.replace(tmp, path)  # ghi nguyen tu: mat dien giua chung khong de lai file hong


def load_last_pose(path: str, map_name: str) -> Optional[dict]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("map") != map_name:
            return None
        return {k: (float(data[k]) if k != "map" else data[k]) for k in ("map", "x", "y", "yaw", "saved_at")}
    except (OSError, ValueError, KeyError, TypeError):
        return None
