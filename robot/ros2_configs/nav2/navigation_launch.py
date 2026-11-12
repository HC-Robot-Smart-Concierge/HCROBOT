"""HC-Robot Nav2 launch for ROS 2 Jazzy.

- slam:=false (mac dinh): map tinh + AMCL (map_server nap file YAML, AMCL dinh vi).
- slam:=true: dung cung SLAM Toolbox (SLAM phat /map va TF map->odom), nen KHONG
  chay map_server/AMCL. Dung cho tu kham pha (frontier exploration) luc dang quet.
"""

import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

NAV_NODES = [
    ("nav2_controller", "controller_server"),
    ("nav2_planner", "planner_server"),
    ("nav2_behaviors", "behavior_server"),
    ("nav2_bt_navigator", "bt_navigator"),
    ("nav2_waypoint_follower", "waypoint_follower"),
]


def _launch_setup(context, *args, **kwargs):
    params_file = LaunchConfiguration("params_file")
    map_yaml = LaunchConfiguration("map")
    use_sim_time = LaunchConfiguration("use_sim_time")
    autostart = LaunchConfiguration("autostart")
    with_slam = LaunchConfiguration("slam").perform(context).strip().lower() in ("true", "1", "yes")
    simulation = LaunchConfiguration("simulation").perform(context).strip().lower() in ("true", "1", "yes")

    common_params = [params_file, {"use_sim_time": use_sim_time}]
    if with_slam:
        # Mapping has no selected static map/keepout mask. Keep filters enabled
        # for normal navigation, where start_wsl_navigation.sh starts mask servers.
        common_params.insert(1, os.path.join(os.path.dirname(__file__), "mapping_filter_overrides.yaml"))
    else:
        common_params.insert(1, os.path.join(os.path.dirname(__file__), "physical_navigation_overrides.yaml"))
        if simulation:
            common_params.insert(2, os.path.join(os.path.dirname(__file__), "sim_navigation_overrides.yaml"))
    actions = []
    managed_nodes = []

    if not with_slam:
        actions.append(Node(
            package="nav2_map_server",
            executable="map_server",
            name="map_server",
            output="screen",
            parameters=[params_file, {"yaml_filename": map_yaml, "use_sim_time": use_sim_time}],
        ))
        actions.append(Node(
            package="nav2_amcl",
            executable="amcl",
            name="amcl",
            output="screen",
            parameters=common_params,
        ))
        managed_nodes += ["map_server", "amcl"]

    for package, name in NAV_NODES:
        node_params = common_params
        if name == "bt_navigator" and not with_slam:
            # Xe that theo map da luu: recovery lui-thoat-ket + khong huy goal khi TF nghen
            # (xem physical_navigate.xml). Tu quet (slam) van dung BT mac dinh/explore.
            node_params = common_params + [{
                "default_nav_to_pose_bt_xml": os.path.join(os.path.dirname(__file__), "physical_navigate.xml"),
            }]
        actions.append(Node(
            package=package,
            executable=name,
            name=name,
            output="screen",
            parameters=node_params,
        ))
        managed_nodes.append(name)

    actions.append(Node(
        package="nav2_lifecycle_manager",
        executable="lifecycle_manager",
        name="lifecycle_manager_hc_robot",
        output="screen",
        parameters=[{
            "use_sim_time": use_sim_time,
            "autostart": autostart,
            "node_names": managed_nodes,
        }],
    ))
    return actions


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument("map", default_value=""),
        DeclareLaunchArgument("params_file"),
        DeclareLaunchArgument("use_sim_time", default_value="false"),
        DeclareLaunchArgument("autostart", default_value="true"),
        DeclareLaunchArgument("slam", default_value="false"),
        DeclareLaunchArgument("simulation", default_value="false"),
        OpaqueFunction(function=_launch_setup),
    ])
