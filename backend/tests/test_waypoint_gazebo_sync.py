"""
Unit test for bidirectional synchronization between Web Endpoints and Gazebo World.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from app.api.v1.endpoints.map import (
    GAZEBO_WAYPOINT_POOL,
    _get_material_for_type,
    sync_all_waypoints_from_db_to_world_and_sim,
)
from app.schemas.map import Waypoint

def test_material_mapping_by_type():
    # PARK type -> Blue
    diffuse, _ = _get_material_for_type("PARK")
    assert diffuse == (0.38, 0.65, 0.98, 0.9)

    # CHARGER type -> Emerald Green
    diffuse, _ = _get_material_for_type("CHARGER")
    assert diffuse == (0.20, 0.83, 0.60, 0.9)

    # Default / WAYPOINT type -> Royal Blue / Slate
    diffuse, _ = _get_material_for_type("WAYPOINT")
    assert diffuse == (0.58, 0.64, 0.72, 0.9)

def test_sync_hides_excess_waypoints():
    # Given 2 active waypoints
    mock_wps = [
        Waypoint(id="wp1", name="Điểm 1", x=1.0, y=2.0, yaw=0.0, floor="Tầng 1", type="WAYPOINT"),
        Waypoint(id="wp2", name="Trạm Sạc", x=3.0, y=4.0, yaw=0.0, floor="Tầng 1", type="CHARGER"),
    ]
    # Pool has 9 slots
    assert len(GAZEBO_WAYPOINT_POOL) == 9
    # Run sync (will update file and send pose)
    sync_all_waypoints_from_db_to_world_and_sim(mock_wps)

    # Verify that first 2 slots are placed at z=0.01 and remaining 7 are at z=-10.00
    from app.api.v1.endpoints.map import _find_hotel_world_path
    import re
    world_path = _find_hotel_world_path()
    assert world_path is not None and world_path.exists()
    content = world_path.read_text(encoding="utf-8")

    # Slot 0: wp_marker_standby -> (1.00, 2.00, 0.01)
    m1 = re.search(r'<model name="wp_marker_standby">[\s\S]*?<pose>([^<]+)</pose>', content)
    assert m1 is not None and "1.00 2.00 0.01" in m1.group(1)

    # Slot 1: wp_marker_charger -> (3.00, 4.00, 0.01)
    m2 = re.search(r'<model name="wp_marker_charger">[\s\S]*?<pose>([^<]+)</pose>', content)
    assert m2 is not None and "3.00 4.00 0.01" in m2.group(1)

    # Slot 2..8 -> hidden at z=-10.00
    for model_name, _, _, _ in GAZEBO_WAYPOINT_POOL[2:]:
        m = re.search(rf'<model name="{model_name}">[\s\S]*?<pose>([^<]+)</pose>', content)
        assert m is not None and "-10.00" in m.group(1)

if __name__ == "__main__":
    test_material_mapping_by_type()
    test_sync_hides_excess_waypoints()
    print("ALL TESTS PASSED SUCCESSFULLY!")
