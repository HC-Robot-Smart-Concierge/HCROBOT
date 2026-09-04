import os
from glob import glob
from setuptools import find_packages, setup

package_name = 'hc_robot_client'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name] if os.path.exists('resource/' + package_name) else []),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/config',
            ['../../config/settings.yaml'] if os.path.exists('../../config/settings.yaml') else []),
    ],

    install_requires=['setuptools', 'httpx', 'pyyaml'],
    zip_safe=true,
    maintainer='HC-Robot Team',
    maintainer_email='admin@hcrobot.com',
    description='ROS 2 Python client package for Raspberry Pi 5 connecting to HC-Robot Laptop Backend',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'ai_bridge_node = hc_robot_client.nodes.ai_bridge_node:main',
            'telemetry_node = hc_robot_client.nodes.telemetry_node:main',
            'motor_driver_node = hc_robot_client.nodes.motor_driver_node:main',
        ],
    },

)
