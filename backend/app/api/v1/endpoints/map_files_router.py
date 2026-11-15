"""Map file persistence, export (PGM/YAML/ZIP), layouts, and deletion endpoints."""

import asyncio
import io
import json
import logging
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import FileResponse

from app.services.hardware.rplidar_service import rplidar_service, MAPS_DIR

logger = logging.getLogger(__name__)
router = APIRouter()

def get_robot_maps_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "robot", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "..", "robot", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "robot", "maps")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


def get_static_maps_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "static", "maps")),
        os.path.abspath(os.path.join(os.getcwd(), "static", "maps")),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


def generate_pgm_bytes(width: int, height: int, grid_data: Optional[List[int]] = None) -> bytes:
    """Tạo file PGM binary P5 chuẩn grayscale cho ROS 2 Nav2."""
    header = f"P5\n{width} {height}\n255\n".encode("ascii")
    if not grid_data or len(grid_data) != width * height:
        pixels = bytearray([205] * (width * height))
    else:
        pixels = bytearray(width * height)
        for i, val in enumerate(grid_data):
            if val == 100:
                pixels[i] = 0
            elif val == 0:
                pixels[i] = 254
            else:
                pixels[i] = 205
    return header + bytes(pixels)


@router.get("/download/{map_name}", summary="Tải file bản đồ về máy tính cá nhân (ZIP hoặc từng file .yaml/.pgm/.json)")
async def download_map_file(map_name: str, format: str = "zip"):
    """
    Tải gói bản đồ SLAM trực tiếp về thư mục Downloads của người dùng (chỉ lưu trên máy tính admin, không lưu CSDL).
    Hỗ trợ format: 'zip' (trọn gói .yaml + .pgm + .json), 'yaml', 'pgm', 'json'.
    Nếu file chưa kịp xuất ra đĩa, tự động tổng hợp trực tiếp từ ma trận LiDAR hiện tại.
    """
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        safe_name = "slam_map"

    robot_maps_dir = get_robot_maps_dir()
    static_maps_dir = get_static_maps_dir()
    os.makedirs(robot_maps_dir, exist_ok=True)
    os.makedirs(static_maps_dir, exist_ok=True)

    yaml_path = os.path.join(robot_maps_dir, f"{safe_name}.yaml")
    pgm_path = os.path.join(robot_maps_dir, f"{safe_name}.pgm")
    json_path = os.path.join(robot_maps_dir, f"{safe_name}.json")
    if not os.path.exists(json_path):
        json_path = os.path.join(static_maps_dir, f"{safe_name}.json")

    # Đợi tối đa 0.8s nếu file vừa mới được lưu bởi SLAM Toolbox
    for _ in range(8):
        if os.path.exists(yaml_path) or os.path.exists(json_path):
            break
        await asyncio.sleep(0.1)

    # Nếu trên đĩa chưa có file nào, tự động tổng hợp trực tiếp từ ma trận rplidar_service
    if not os.path.exists(yaml_path) and not os.path.exists(json_path):
        map_info = rplidar_service.get_grid_map_data()
        res_val = map_info.get("resolution", 0.05)
        width_val = map_info.get("width", 200)
        height_val = map_info.get("height", 200)
        ox_val = map_info.get("origin_x", -5.0)
        oy_val = map_info.get("origin_y", -5.0)
        grid_data = map_info.get("grid_data", [])

        # 1. Sinh file YAML chuẩn Nav2
        yaml_text = f"""image: {safe_name}.pgm
mode: trinary
resolution: {res_val:.4f}
origin: [{ox_val:.3f}, {oy_val:.3f}, 0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
"""
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(yaml_text)

        # 2. Sinh file PGM nhị phân
        pgm_bytes = generate_pgm_bytes(width_val, height_val, grid_data)
        with open(pgm_path, "wb") as f:
            f.write(pgm_bytes)

        # 3. Sinh file JSON
        json_data = {
            "name": safe_name,
            "resolution": res_val,
            "width": width_val,
            "height": height_val,
            "origin_x": ox_val,
            "origin_y": oy_val,
            "grid_data": grid_data,
            "saved_at": datetime.now().isoformat(),
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f)

    if format == "yaml":
        return FileResponse(path=yaml_path, filename=f"{safe_name}.yaml", media_type="text/yaml")
    elif format == "pgm":
        return FileResponse(path=pgm_path, filename=f"{safe_name}.pgm", media_type="image/x-portable-graymap")
    elif format == "json":
        return FileResponse(path=json_path, filename=f"{safe_name}.json", media_type="application/json")

    # Mặc định format == "zip": đóng gói toàn bộ file liên quan
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(yaml_path):
            zf.write(yaml_path, arcname=f"{safe_name}.yaml")
        if os.path.exists(pgm_path):
            zf.write(pgm_path, arcname=f"{safe_name}.pgm")
        if os.path.exists(json_path):
            zf.write(json_path, arcname=f"{safe_name}.json")

        readme_content = f"""HCRobot Concierge - SLAM Map Package
Map Name: {safe_name}
Created At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Contents:
- {safe_name}.yaml : ROS 2 Nav2 Map Server metadata configuration
- {safe_name}.pgm  : 2D Occupancy Grid Graymap image (100: Obstacle, 0: Free, -1: Unknown)
- {safe_name}.json : Web Canvas / Pi 5 compatible JSON grid format

Usage in ROS 2 Nav2:
ros2 run nav2_map_server map_server --ros-args -p yaml_filename:={safe_name}.yaml
"""
        zf.writestr("README.txt", readme_content)

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_slam_map.zip"'
        }
    )


@router.post("/load_map", summary="Nạp lại bản đồ cố định đã lưu từ CSDL/file")
async def load_saved_map(map_id: str = "phong_lam_viec", lock: bool = True):
    """Tải lại bản đồ 2D cố định đã lưu từ trước vào bộ nhớ hệ thống."""
    success = rplidar_service.load_map_from_storage(map_id=map_id, lock=lock)
    if success:
        return {
            "status": "SUCCESS",
            "message": f"Đã tải thành công bản đồ cố định '{map_id}'!",
            "map_id": map_id,
            "is_map_locked": rplidar_service.is_map_locked
        }
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy bản đồ '{map_id}'")


@router.get("/list_saved_maps", summary="Lấy danh sách các bản đồ đã lưu trên máy tính (robot/maps và static/maps)")
async def list_saved_maps():
    """Trả về danh sách tất cả các bản đồ có sẵn trên đĩa máy tính (robot/maps và static/maps)."""
    maps = []
    seen = set()
    robot_maps_dir = get_robot_maps_dir()
    if os.path.exists(robot_maps_dir):
        for f in os.listdir(robot_maps_dir):
            if f.endswith(".yaml"):
                mname = f[:-5]
                seen.add(mname)
                mtime = os.path.getmtime(os.path.join(robot_maps_dir, f))
                time_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
                maps.append({
                    "map_id": mname,
                    "name": mname,
                    "floor": "Sảnh Tầng 1",
                    "width": 200,
                    "height": 200,
                    "resolution": 0.05,
                    "created_at": time_str,
                })
    if os.path.exists(MAPS_DIR):
        for f in os.listdir(MAPS_DIR):
            if f.endswith(".json"):
                mid = f[:-5]
                if mid in seen:
                    continue
                seen.add(mid)
                filepath = os.path.join(MAPS_DIR, f)
                try:
                    with open(filepath, "r", encoding="utf-8") as fp:
                        meta = json.load(fp)
                    maps.append({
                        "map_id": meta.get("map_id", mid),
                        "name": meta.get("name", mid),
                        "floor": meta.get("floor", "Sảnh Tầng 1"),
                        "width": meta.get("width", 200),
                        "height": meta.get("height", 200),
                        "resolution": meta.get("resolution", 0.05),
                        "created_at": meta.get("saved_at", ""),
                    })
                except Exception:
                    maps.append({"map_id": mid, "name": mid, "floor": "Sảnh Tầng 1"})
    return {
        "status": "SUCCESS",
        "maps": maps,
        "active_map_id": rplidar_service.saved_map_id,
        "is_map_locked": rplidar_service.is_map_locked,
    }


def _read_map_layout(yaml_path: str) -> Optional[dict]:
    """Đọc thông số map Nav2 (.yaml + .pgm) để Web vẽ đúng tỉ lệ và gốc tọa độ."""
    import yaml

    try:
        with open(yaml_path, "r", encoding="utf-8") as f:
            meta = yaml.safe_load(f) or {}
        pgm_path = os.path.join(os.path.dirname(yaml_path), str(meta.get("image", "")))
        if not os.path.isfile(pgm_path):
            return None
        from pathlib import Path
        from app.services.hardware.ros2_runtime_service import Ros2RuntimeService

        stats = Ros2RuntimeService._read_pgm_stats(Path(pgm_path))
        resolution = float(meta.get("resolution", 0.05))
        origin = meta.get("origin") or [0.0, 0.0, 0.0]
    except Exception as exc:
        logger.warning("Bỏ qua map lỗi %s: %s", yaml_path, exc)
        return None

    name = os.path.splitext(os.path.basename(yaml_path))[0]
    return {
        "map_id": name,
        "name": name,
        "width": stats["width"],
        "height": stats["height"],
        "resolution": resolution,
        "origin_x": float(origin[0]),
        "origin_y": float(origin[1]),
        "width_m": round(stats["width"] * resolution, 3),
        "height_m": round(stats["height"] * resolution, 3),
        "image_file": os.path.basename(pgm_path),
        "updated_at": datetime.fromtimestamp(os.path.getmtime(yaml_path)).strftime("%Y-%m-%d %H:%M"),
    }


@router.get("/layouts", summary="Danh sách map SLAM (.yaml + .pgm) để chọn trên Bản Đồ Vật Lý")
async def list_map_layouts():
    maps_dir = get_robot_maps_dir()
    layouts = []
    if os.path.isdir(maps_dir):
        for f in sorted(os.listdir(maps_dir)):
            # Bỏ file tạm của lần lưu đang dở (pending_<ten>_<timestamp>).
            if f.endswith(".yaml") and not f.startswith("pending_"):
                info = await asyncio.to_thread(_read_map_layout, os.path.join(maps_dir, f))
                if info:
                    layouts.append(info)
    return {"status": "SUCCESS", "maps": layouts}


@router.get("/layouts/{map_name}/image", summary="Ảnh PGM của map SLAM (hàng 0 là đỉnh ảnh)")
async def get_map_layout_image(map_name: str):
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    yaml_path = os.path.join(get_robot_maps_dir(), f"{safe_name}.yaml")
    info = await asyncio.to_thread(_read_map_layout, yaml_path) if safe_name and os.path.isfile(yaml_path) else None
    if not info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy map '{map_name}'")
    return FileResponse(
        path=os.path.join(get_robot_maps_dir(), info["image_file"]),
        media_type="image/x-portable-graymap",
    )


@router.delete("/saved/{map_name}", summary="Xóa file bản đồ trên máy tính")
async def delete_saved_map(map_name: str):
    """Xóa file bản đồ trên máy tính (robot/maps và static/maps)."""
    safe_name = "".join(c for c in map_name if c.isalnum() or c in ("_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Tên bản đồ không hợp lệ")
    deleted = False
    for folder in [get_robot_maps_dir(), get_static_maps_dir(), MAPS_DIR]:
        for ext in [".yaml", ".pgm", ".json"]:
            fpath = os.path.join(folder, f"{safe_name}{ext}")
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                    deleted = True
                except Exception:
                    pass
    return {"status": "SUCCESS", "message": f"Đã xóa file bản đồ '{safe_name}'", "deleted": deleted}
