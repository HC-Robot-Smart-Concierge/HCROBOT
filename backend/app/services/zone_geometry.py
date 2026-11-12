"""Load the same dependency-free geometry used on the robot (single source)."""
import importlib.util
from pathlib import Path

_path = Path(__file__).resolve().parents[3] / 'robot' / 'scripts' / 'zone_geometry.py'
_spec = importlib.util.spec_from_file_location('hcrobot_zone_geometry', _path)
_geometry = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_geometry)

polygon_geometry = _geometry.polygon_geometry
point_in_zone = _geometry.point_in_zone
zone_points = _geometry.zone_points
points_bounds = _geometry.points_bounds
distance_to_polygon = _geometry.distance_to_polygon
