"""Gazebo Harmonic, sensors and Jazzy ros2_control; optional SLAM and RViz."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.actions import IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch.substitutions import PythonExpression
from launch_ros.actions import Node


def generate_launch_description():
    share = get_package_share_directory('articubot_one')

    def include(filename, arguments=None, condition=None):
        return IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(share, 'launch', filename)),
            launch_arguments=(arguments or {}).items(), condition=condition)

    world = LaunchConfiguration('world')
    gui = LaunchConfiguration('gui')
    return LaunchDescription([
        DeclareLaunchArgument('world', default_value=os.path.join(
            share, 'worlds', 'slam_room.world'), description='Absolute SDF world path'),
        DeclareLaunchArgument('gui', default_value='true'),
        DeclareLaunchArgument('rviz', default_value='false'),
        DeclareLaunchArgument('slam', default_value='false'),
        DeclareLaunchArgument('joystick', default_value='false'),
        DeclareLaunchArgument('enable_depth', default_value='false'),
        DeclareLaunchArgument('x', default_value='0.0'),
        DeclareLaunchArgument('y', default_value='0.0'),
        DeclareLaunchArgument('yaw', default_value='0.0'),
        include('rsp.launch.py', {
            'use_sim_time': 'true', 'use_ros2_control': 'true',
            'enable_depth': LaunchConfiguration('enable_depth')}),
        include('joystick.launch.py', {'use_sim_time': 'true'},
                IfCondition(LaunchConfiguration('joystick'))),
        Node(package='twist_mux', executable='twist_mux', output='screen',
             parameters=[os.path.join(share, 'config', 'twist_mux.yaml'),
                         {'use_sim_time': True}]),
        Node(package='twist_stamper', executable='twist_stamper',
             parameters=[{'use_sim_time': True, 'frame_id': 'base_link'}],
             remappings=[('cmd_vel_in', 'cmd_vel_out'),
                         ('cmd_vel_out', 'diff_cont/cmd_vel')]),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(
                get_package_share_directory('ros_gz_sim'), 'launch', 'gz_sim.launch.py')),
            launch_arguments={
                'gz_args': [PythonExpression(["'-r -v 2 ' if '", gui,
                                             "' == 'true' else '-r -s -v 2 '"]),
                            '"', world, '"'],
                'on_exit_shutdown': 'true',
            }.items()),
        Node(package='ros_gz_sim', executable='create', output='screen',
             arguments=['-topic', 'robot_description', '-name', 'my_bot',
                        '-x', LaunchConfiguration('x'), '-y', LaunchConfiguration('y'),
                        '-z', '0.04', '-Y', LaunchConfiguration('yaw')]),
        Node(package='ros_gz_bridge', executable='parameter_bridge',
             name='gazebo_bridge', output='screen',
             parameters=[{'config_file': os.path.join(share, 'config', 'gz_bridge.yaml'),
                          'use_sim_time': True}]),
        Node(package='ros_gz_bridge', executable='parameter_bridge',
             name='depth_bridge', output='screen',
             condition=IfCondition(LaunchConfiguration('enable_depth')),
             parameters=[{'use_sim_time': True,
                          'config_file': os.path.join(share, 'config', 'gz_depth_bridge.yaml')}]),
        Node(package='controller_manager', executable='spawner', output='screen',
             arguments=['joint_broad', 'diff_cont', '--controller-manager-timeout', '60']),
        include('online_async_launch.py', {'use_sim_time': 'true'},
                IfCondition(LaunchConfiguration('slam'))),
        Node(package='rviz2', executable='rviz2', output='screen',
             condition=IfCondition(LaunchConfiguration('rviz')),
             arguments=['-d', os.path.join(share, 'config', 'main.rviz')],
             parameters=[{'use_sim_time': True}]),
    ])
