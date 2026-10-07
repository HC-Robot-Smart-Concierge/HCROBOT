"""Jazzy Nav2 planners/controllers; velocity output feeds twist_mux."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.actions import GroupAction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.actions import PushRosNamespace
from nav2_common.launch import RewrittenYaml


def generate_launch_description():
    share = get_package_share_directory('articubot_one')
    sim_time = LaunchConfiguration('use_sim_time')
    namespace = LaunchConfiguration('namespace')
    configured_params = RewrittenYaml(
        source_file=LaunchConfiguration('params_file'), root_key=namespace,
        param_rewrites={'use_sim_time': sim_time}, convert_types=True)
    servers = [('nav2_controller', 'controller_server'),
               ('nav2_planner', 'planner_server'),
               ('nav2_behaviors', 'behavior_server'),
               ('nav2_bt_navigator', 'bt_navigator'),
               ('nav2_waypoint_follower', 'waypoint_follower')]
    remap = [('/tf', 'tf'), ('/tf_static', 'tf_static'), ('odom', '/diff_cont/odom')]
    return LaunchDescription([
        DeclareLaunchArgument('namespace', default_value=''),
        DeclareLaunchArgument('use_sim_time', default_value='false'),
        DeclareLaunchArgument('autostart', default_value='true'),
        DeclareLaunchArgument('params_file', default_value=os.path.join(
            share, 'config', 'nav2_params.yaml')),
        GroupAction([
            PushRosNamespace(namespace),
            *[Node(package=package, executable=name, name=name, output='screen',
                   parameters=[configured_params], remappings=remap) for package, name in servers],
            Node(package='nav2_lifecycle_manager', executable='lifecycle_manager',
                 name='lifecycle_manager_navigation', output='screen',
                 parameters=[{'use_sim_time': sim_time,
                              'autostart': LaunchConfiguration('autostart'),
                              'node_names': [name for _, name in servers]}]),
        ]),
    ])
