"""Publish the URDF and transforms for fixed and wheel joints."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import Command
from launch.substitutions import FindExecutable
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    xacro_file = os.path.join(get_package_share_directory('articubot_one'),
                              'description', 'robot.urdf.xacro')
    args = {
        'use_sim_time': 'false', 'use_ros2_control': 'true',
        'enable_depth': 'false', 'serial_port': '/dev/ttyUSB0',
        'baud_rate': '57600', 'enc_counts_per_rev': '3436',
    }
    command = [FindExecutable(name='xacro'), ' ', xacro_file,
               ' sim_mode:=', LaunchConfiguration('use_sim_time')]
    for name in args:
        if name != 'use_sim_time':
            command += [' ' + name + ':=', LaunchConfiguration(name)]
    return LaunchDescription([
        *[DeclareLaunchArgument(name, default_value=value) for name, value in args.items()],
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             output='screen', parameters=[{
                 'robot_description': ParameterValue(Command(command), value_type=str),
                 'use_sim_time': LaunchConfiguration('use_sim_time'),
             }]),
    ])
