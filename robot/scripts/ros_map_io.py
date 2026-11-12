"""Đọc map ROS 2 (map_server .yaml + .pgm) thành occupancy grid kiểu lidar_service.

Dùng khi map được lưu từ SLAM Toolbox/map_saver (chỉ có .yaml/.pgm, không có .json)
để chế độ tự hành trên Pi nạp được cùng một map. Không cần PyYAML/Pillow.

Quy ước (giống nav2_map_server, mode trinary):
- p = giá trị pixel 0..255; negate=0: occ = (255 - p) / 255, negate=1: occ = p / 255
- occ > occupied_thresh -> 100 ; occ < free_thresh -> 0 ; còn lại -> -1
- Hàng 0 của ảnh PGM là ĐỈNH map; grid_data hàng 0 là đáy (origin_y).
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

UNKNOWN_PIXEL = 205


def _parse_simple_yaml(text: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        out[key.strip()] = value.strip().strip("'\"")
    return out


def _read_pgm(path: str) -> Tuple[int, int, int, bytes]:
    raw = open(path, "rb").read()
    tokens: List[bytes] = []
    i = 0
    while len(tokens) < 4:
        while i < len(raw) and raw[i] in b" \t\r\n":
            i += 1
        if i < len(raw) and raw[i] == ord("#"):
            while i < len(raw) and raw[i] not in b"\r\n":
                i += 1
            continue
        start = i
        while i < len(raw) and raw[i] not in b" \t\r\n":
            i += 1
        if start == i:
            raise ValueError(f"PGM header không hợp lệ: {path}")
        tokens.append(raw[start:i])
    magic, width, height, maxval = tokens[0], int(tokens[1]), int(tokens[2]), int(tokens[3])
    i += 1  # đúng một ký tự trắng sau maxval
    if magic == b"P5":
        if maxval > 255:
            raise ValueError("Chỉ hỗ trợ PGM 8-bit")
        pixels = raw[i:i + width * height]
    elif magic == b"P2":
        pixels = bytes(int(v) for v in raw[i:].split()[: width * height])
    else:
        raise ValueError(f"Không phải PGM (P5/P2): {path}")
    if len(pixels) != width * height:
        raise ValueError(f"PGM thiếu dữ liệu: {len(pixels)} / {width * height}")
    return width, height, maxval, pixels


def read_ros_map_info(yaml_path: str) -> Dict[str, Any]:
    """Chỉ đọc kích thước + độ phân giải (không giải mã toàn bộ lưới)."""
    meta = _parse_simple_yaml(open(yaml_path, "r", encoding="utf-8").read())
    image = meta.get("image", "")
    pgm_path = image if os.path.isabs(image) else os.path.join(os.path.dirname(yaml_path), image)
    head = open(pgm_path, "rb").read(256)
    tokens = []
    for line in head.split(b"\n"):
        line = line.split(b"#", 1)[0]
        tokens.extend(line.split())
        if len(tokens) >= 3:
            break
    return {
        "width": int(tokens[1]),
        "height": int(tokens[2]),
        "resolution": float(meta.get("resolution", "0.05")),
    }


def load_ros_map_yaml(yaml_path: str) -> Dict[str, Any]:
    """Trả về dict width/height/resolution/origin_x/origin_y/grid_data."""
    meta = _parse_simple_yaml(open(yaml_path, "r", encoding="utf-8").read())
    image = meta.get("image", "")
    if not image:
        raise ValueError(f"YAML thiếu trường image: {yaml_path}")
    pgm_path = image if os.path.isabs(image) else os.path.join(os.path.dirname(yaml_path), image)

    resolution = float(meta.get("resolution", "0.05"))
    origin = [float(v) for v in meta.get("origin", "[0, 0, 0]").strip("[]").split(",")[:2]]
    negate = int(float(meta.get("negate", "0")))
    occ_th = float(meta.get("occupied_thresh", "0.65"))
    free_th = float(meta.get("free_thresh", "0.25"))

    width, height, maxval, pixels = _read_pgm(pgm_path)
    scale = float(maxval or 255)
    grid = [-1] * (width * height)
    for row in range(height):
        gy = height - 1 - row  # ảnh: hàng 0 ở trên; grid: hàng 0 ở đáy
        src = row * width
        dst = gy * width
        for gx in range(width):
            p = pixels[src + gx]
            if p == UNKNOWN_PIXEL and maxval == 255:
                continue  # map_saver và lidar_service đều ghi ô chưa biết = 205
            occ = (p / scale) if negate else ((scale - p) / scale)
            if occ > occ_th:
                grid[dst + gx] = 100
            elif occ < free_th:
                grid[dst + gx] = 0
    return {
        "width": width,
        "height": height,
        "resolution": resolution,
        "origin_x": origin[0],
        "origin_y": origin[1],
        "grid_data": grid,
    }
