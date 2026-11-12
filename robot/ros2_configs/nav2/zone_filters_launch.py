"""Costmap filter cho cac vung ve tren Web: KEEP_OUT (KeepoutFilter) + SPEED_ZONE (SpeedFilter).

    ros2 launch nav2/zone_filters_launch.py map_name:=phong_test use_sim_time:=false

Luon bat ca 2 mask server: map chua co mask thi server cho service load_map, nen vung ve
tren Web luc Nav2 dang chay van ap dung ngay (backend goi load_map) khong can khoi dong lai.
Mask: robot/maps/keepout/<map>.yaml va robot/maps/speed/<map>.yaml (backend ghi tu CSDL).
"""

import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, LogInfo, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "maps"))
PARAMS = os.path.join(HERE, "zone_filter_params.yaml")

# (mask server, info server, thu muc mask)
FILTERS = [
    ("filter_mask_server", "costmap_filter_info_server", "keepout"),
    ("speed_mask_server", "speed_filter_info_server", "speed"),
]


def _launch_setup(context, *args, **kwargs):
    map_name = os.path.basename(LaunchConfiguration("map_name").perform(context).strip())
    if map_name.endswith(".yaml"):
        map_name = map_name[:-5]
    use_sim_time = LaunchConfiguration("use_sim_time").perform(context).strip().lower() in ("true", "1", "yes")

    actions, managed = [], []
    for mask_server, info_server, subdir in FILTERS:
        mask_yaml = os.path.join(MAPS_DIR, subdir, f"{map_name}.yaml") if map_name else ""
        if mask_yaml and os.path.isfile(mask_yaml):
            actions.append(LogInfo(msg=f"[zone filters] {subdir}: {mask_yaml}"))
        else:
            actions.append(LogInfo(msg=f"[zone filters] {subdir}: chua co mask cho '{map_name}' - cho load_map tu Web"))
            mask_yaml = ""
        actions.append(Node(
            package="nav2_map_server", executable="map_server", name=mask_server, output="screen",
            parameters=[PARAMS, {"yaml_filename": mask_yaml, "use_sim_time": use_sim_time}],
        ))
        actions.append(Node(
            package="nav2_map_server", executable="costmap_filter_info_server", name=info_server,
            output="screen", parameters=[PARAMS, {"use_sim_time": use_sim_time}],
        ))
        managed += [mask_server, info_server]

    actions.append(Node(
        package="nav2_lifecycle_manager", executable="lifecycle_manager",
        name="lifecycle_manager_costmap_filters", output="screen",
        parameters=[{"use_sim_time": use_sim_time, "autostart": True, "node_names": managed}],
    ))
    return actions


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument("map_name", description="Ten map trong robot/maps (khong can .yaml)"),
        DeclareLaunchArgument("use_sim_time", default_value="false"),
        OpaqueFunction(function=_launch_setup),
    ])
