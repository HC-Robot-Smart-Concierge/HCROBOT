"""Default map seed data, zone geometry checks, and Gazebo world waypoint sync."""

import logging
import re
from ipaddress import IPv4Address
from pathlib import Path
from typing import Any, List, Optional, Sequence

from pydantic import BaseModel

from app.services.zone_geometry import point_in_zone
from app.repositories import MapRepository
from app.schemas.map import Pose2D, Waypoint, ZoneSchema

logger = logging.getLogger(__name__)

DEFAULT_WAYPOINTS: List[dict] = [
    {
        "id": "ROBOT_STANDBY",
        "name": "Vị Trí Chờ Robot Sảnh",
        "type": "PARK",
        "x": 7.20,
        "y": 9.60,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Vị trí dừng đỗ chờ sẵn của Robot Concierge.",
    },
    {
        "id": "CHARGER_STATION",
        "name": "Trạm Sạc Robot Sảnh",
        "type": "CHARGER",
        "x": 6.00,
        "y": 9.60,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Trạm sạc tự động của Robot Concierge.",
    },
    {
        "id": "MAIN_ENTRANCE",
        "name": "Cửa Chính Sảnh (Main Entrance)",
        "type": "WAYPOINT",
        "x": 0.90,
        "y": 6.25,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Cửa chính ra vào sảnh tầng trệt đón khách.",
    },
    {
        "id": "FRONT_DESK",
        "name": "Trước Quầy Lễ Tân (Front Desk)",
        "type": "WAYPOINT",
        "x": 11.44,
        "y": 2.80,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực check-in và đón tiếp khách tại quầy lễ tân.",
    },
    {
        "id": "STAFF_ONLY",
        "name": "Trước Phòng Nội Bộ (Staff Only)",
        "type": "WAYPOINT",
        "x": 11.44,
        "y": 6.40,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực sảnh tiếp giáp cửa phòng làm việc nội bộ.",
    },
    {
        "id": "ELEVATOR",
        "name": "Cụm Thang Máy Tầng 1",
        "type": "WAYPOINT",
        "x": 15.60,
        "y": 6.96,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Cụm thang máy dẫn khách lên các tầng phòng nghỉ.",
    },
    {
        "id": "RESTROOMS",
        "name": "Nhà Vệ Sinh Sảnh (WC)",
        "type": "WAYPOINT",
        "x": 15.20,
        "y": 2.40,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực nhà vệ sinh công cộng sảnh tầng trệt.",
    },
    {
        "id": "STAIRS",
        "name": "Lối Thoát Hiểm Khẩn Cấp",
        "type": "WAYPOINT",
        "x": 16.00,
        "y": 4.80,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Lối thoát hiểm thang bộ khẩn cấp phía Đông.",
    },
    {
        "id": "LOBBY_LOUNGE",
        "name": "Khu Sofa Khách Chờ Sảnh",
        "type": "WAYPOINT",
        "x": 3.60,
        "y": 7.20,
        "yaw": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực bàn ghế sofa tiếp khách thư giãn sảnh.",
    },
]
DEFAULT_ZONES: List[dict] = [
    {
        "id": "zone-keepout-staff",
        "name": "Khu Vực Quầy Lễ Tân Nội Bộ (Cấm Vào)",
        "type": "KEEP_OUT",
        "x": 11.44,
        "y": 6.4,
        "width": 2.80,
        "height": 3.60,
        "speed_limit": 0.0,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực quầy lễ tân nội bộ, robot tuyệt đối không đi vào.",
    },
    {
        "id": "zone-speed-frontdesk",
        "name": "Khu Vực Quầy Tiếp Tân (Giới Hạn Tốc Độ)",
        "type": "SPEED_ZONE",
        "x": 11.44,
        "y": 2.8,
        "width": 4.80,
        "height": 2.40,
        "speed_limit": 0.20,
        "floor": "Sảnh Tầng 1",
        "description": "Khu vực đón tiếp đông khách, tự động giới hạn tốc độ tối đa 0.20 m/s.",
    },
    {
        "id": "zone-nostop-doorway",
        "name": "Cửa Thông Sảnh Chính (Cấm Dừng)",
        "type": "NO_STOP",
        "x": 12.84,
        "y": 9.8,
        "width": 2.40,
        "height": 2.80,
        "speed_limit": 0.30,
        "floor": "Sảnh Tầng 1",
        "description": "Nút thắt lưu thông chính giữa 2 gian sảnh, robot chỉ được phép đi qua, cấm dừng đỗ.",
    },
]

current_robot_pose = Pose2D(x=0.0, y=0.0, yaw=0.0)


class Ros2MapRequest(BaseModel):
    name: str
    pi_ip: Optional[IPv4Address] = None


class Ros2ExploreRequest(BaseModel):
    name: str = "auto_explored_map"
    auto_save: bool = True


def is_point_in_zone(px: float, py: float, z) -> bool:
    return point_in_zone(px, py, z)


# Vung khong duoc co endpoint ben trong (cung luat voi Web: physicalMapZones.js).
# NO_STOP: robot chi duoc di ngang qua, moi endpoint deu la cho dung => cam moi loai endpoint.
NO_ENDPOINT_ZONE_TYPES = ("KEEP_OUT", "NO_STOP")


def _waypoint_zone_violation(x: float, y: float, zones) -> Optional[str]:
    for z in zones:
        if z.type == "KEEP_OUT" and is_point_in_zone(x, y, z):
            return f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm vào (Keep-out Zone) '{z.name}'!"
        if z.type == "NO_STOP" and is_point_in_zone(x, y, z):
            return (f"Tọa độ ({x:.2f}, {y:.2f}) nằm trong Khu vực cấm dừng (No-Stop Zone) '{z.name}': "
                    "robot chỉ được đi ngang qua, không thể đặt endpoint/điểm dừng tại đây!")
    return None


async def _zone_endpoint_conflict(zone: "ZoneSchema", repo: MapRepository) -> Optional[str]:
    """Vung cam dung/cam vao de len endpoint co san cua CUNG map => ly do tu choi (bat xoa truoc)."""
    if (zone.type or "KEEP_OUT") not in NO_ENDPOINT_ZONE_TYPES or not zone.map_id:
        return None  # khong ro map (du lieu cu) thi khong doan endpoint cua map nao
    waypoints = await repo.list_waypoints(zone.map_id)
    covered = [w for w in waypoints if is_point_in_zone(w.x, w.y, zone)]
    if not covered:
        return None
    kind = "cấm dừng" if zone.type == "NO_STOP" else "cấm vào"
    names = ", ".join(f"'{w.name or w.id}'" for w in covered)
    return (f"Không thể đặt vùng {kind} '{zone.name}' đè lên endpoint {names}. "
            "Hãy xóa endpoint đó trước, rồi vẽ lại vùng.")


async def ensure_default_waypoints(repo: MapRepository):
    if not DEFAULT_WAYPOINTS:
        return
    existing = await repo.list_waypoints()
    existing_ids = {wp.id for wp in existing}
    for wp in DEFAULT_WAYPOINTS:
        if wp["id"] not in existing_ids:
            await repo.save_or_update_waypoint(
                id=wp["id"],
                name=wp["name"],
                x=wp["x"],
                y=wp["y"],
                yaw=wp["yaw"],
                floor=wp["floor"],
                type=wp.get("type", "WAYPOINT"),
                description=wp.get("description", ""),
            )


async def ensure_default_zones(repo: MapRepository):
    if not DEFAULT_ZONES:
        return
    existing = await repo.list_zones()
    existing_ids = {z.id for z in existing}
    for z in DEFAULT_ZONES:
        if z["id"] not in existing_ids:
            await repo.save_or_update_zone(
                id=z["id"],
                name=z["name"],
                type=z["type"],
                x=z["x"],
                y=z["y"],
                width=z["width"],
                height=z["height"],
                speed_limit=z.get("speed_limit", 0.2),
                floor=z.get("floor", "Sảnh Tầng 1"),
                description=z.get("description", ""),
            )

GAZEBO_WAYPOINT_POOL = [
    ("wp_marker_standby", "PARK", (0.38, 0.65, 0.98, 0.9), (0.25, 0.50, 0.80, 1.0)),
    ("wp_marker_charger", "CHARGER", (0.20, 0.83, 0.60, 0.9), (0.15, 0.65, 0.45, 1.0)),
    ("wp_marker_frontdesk", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_entrance", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_staff", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_elevator", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_restrooms", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_emergency", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
    ("wp_marker_lounge", "WAYPOINT", (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)),
]


def _find_hotel_world_path() -> Optional[Path]:
    """Tìm đường dẫn chính xác tới file hotel_room.world."""
    world_candidates = [
        Path("robot/worlds/hotel_room.world"),
        Path(__file__).resolve().parents[5] / "robot" / "worlds" / "hotel_room.world" if len(Path(__file__).resolve().parents) > 5 else None,
        Path(__file__).resolve().parents[4] / "robot" / "worlds" / "hotel_room.world" if len(Path(__file__).resolve().parents) > 4 else None,
    ]
    return next((p for p in world_candidates if p and p.exists()), None)


def _send_gz_pose_wsl(model_name: str, x: float, y: float, z: float) -> bool:
    """Gửi service lệnh set_pose trực tiếp tới Gazebo Harmonic qua WSL."""
    try:
        import subprocess
        req_str = f'name: "{model_name}", position: {{x: {x:.2f}, y: {y:.2f}, z: {z:.2f}}}'
        bash_cmd = (
            "source /opt/ros/jazzy/setup.bash && "
            f"gz service -s /world/hotel_lobby_world/set_pose --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 2000 --req '{req_str}'"
        )
        res = subprocess.run(["wsl", "bash", "-c", bash_cmd], capture_output=True, timeout=3)
        return res.returncode == 0
    except Exception as e:
        logger.debug(f"[GAZEBO SYNC] Loi goi wsl set_pose cho {model_name}: {e}")
        return False


def _get_material_for_type(wp_type: str):
    """Trả về màu sắc material tương ứng với loại Waypoint."""
    tp = str(wp_type or "").upper()
    if tp in ("PARK", "PARKING_SPOT"):
        return (0.38, 0.65, 0.98, 0.9), (0.25, 0.50, 0.80, 1.0)
    elif tp in ("CHARGER", "DOCKING_TARGET"):
        return (0.20, 0.83, 0.60, 0.9), (0.15, 0.65, 0.45, 1.0)
    else:
        return (0.58, 0.64, 0.72, 0.9), (0.45, 0.50, 0.58, 1.0)


def sync_all_waypoints_from_db_to_world_and_sim(waypoints: Sequence[Any]):
    """
    Đồng bộ 100% danh sách Waypoints từ Web/DB sang Gazebo Sim và file hotel_room.world.
    - Duyệt qua từng model trong pool (9 điểm).
    - Điểm nào có trên Web -> set_pose z=0.01 tại (x, y), đồng thời cập nhật màu theo type.
    - Điểm nào bị xóa trên Web -> ẩn xuống z=-10.00.
    """
    total_slots = len(GAZEBO_WAYPOINT_POOL)
    active_count = min(len(waypoints), total_slots)

    world_path = _find_hotel_world_path()
    file_content = world_path.read_text(encoding="utf-8") if world_path else None

    for idx, (model_name, default_type, _, _) in enumerate(GAZEBO_WAYPOINT_POOL):
        if idx < active_count:
            wp = waypoints[idx]
            target_x = float(wp.x)
            target_y = float(wp.y)
            target_z = 0.01
            wp_type = getattr(wp, "type", default_type) or default_type
            diffuse, emissive = _get_material_for_type(wp_type)
        else:
            target_x = 0.0
            target_y = 0.0
            target_z = -10.00
            diffuse, emissive = None, None

        # 1. Cập nhật vị trí vào file hotel_room.world
        if file_content:
            pattern = rf'(<model name="{model_name}">\s*<static>true</static>\s*<pose>)([^<]+)(</pose>)'
            replacement = rf'\g<1>{target_x:.2f} {target_y:.2f} {target_z:.2f} 0 0 0\g<3>'
            file_content = re.sub(pattern, replacement, file_content)

            if diffuse and emissive:
                mat_pattern = rf'(<model name="{model_name}">[\s\S]*?<material>[\s\S]*?<ambient>)[^<]+(</ambient>[\s\S]*?<diffuse>)[^<]+(</diffuse>[\s\S]*?<emissive>)[^<]+(</emissive>)'
                mat_replace = (
                    rf'\g<1>{diffuse[0]} {diffuse[1]} {diffuse[2]} {diffuse[3]}\g<2>'
                    rf'{diffuse[0]} {diffuse[1]} {diffuse[2]} {diffuse[3]}\g<3>'
                    rf'{emissive[0]} {emissive[1]} {emissive[2]} {emissive[3]}\g<4>'
                )
                file_content = re.sub(mat_pattern, mat_replace, file_content)

        # 2. Gửi lệnh trực tiếp tới Gazebo Sim đang chạy
        _send_gz_pose_wsl(model_name, target_x, target_y, target_z)

    if file_content and world_path:
        try:
            world_path.write_text(file_content, encoding="utf-8")
            logger.info(f"[WORLD SYNC] Đã đồng bộ toàn bộ {active_count} điểm mốc vào {world_path.name}")
        except Exception as e:
            logger.warning(f"[WORLD SYNC] Lỗi ghi file {world_path}: {e}")
