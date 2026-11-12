"""Opt-in round trip through real MapServer, SpeedFilter and Foxglove markers.

ROS_DOMAIN_ID=88 HCROBOT_RUN_SPEED_SMOKE=1 python3 -m unittest discover \
    -s robot/tests -p test_speed_filter_smoke.py -v
No cmd_vel publishers, motor bridges or hardware are started.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest


@unittest.skipUnless(os.getenv('HCROBOT_RUN_SPEED_SMOKE') == '1'
                     and os.getenv('ROS_DOMAIN_ID') == '88', 'requires isolated ROS domain 88')
class TestSpeedFilterRoundTrip(unittest.TestCase):
    def test_enter_exit_and_remove_speed_zone(self):
        import rclpy
        from geometry_msgs.msg import TransformStamped
        from lifecycle_msgs.srv import ChangeState
        from nav_msgs.msg import OccupancyGrid
        from nav2_msgs.msg import CostmapFilterInfo, SpeedLimit
        from nav2_msgs.srv import LoadMap
        from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
        from std_msgs.msg import String
        from tf2_ros import TransformBroadcaster
        from visualization_msgs.msg import Marker, MarkerArray

        root = Path(__file__).resolve().parents[2]
        sys.path.insert(0, str(root / 'backend'))
        from app.services.hardware.ros2_runtime_service import Ros2RuntimeService

        rclpy.init()
        node = rclpy.create_node('isolated_speed_filter_test')
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                            reliability=ReliabilityPolicy.RELIABLE)
        map_pub = node.create_publisher(OccupancyGrid, '/map', latched)
        info_pub = node.create_publisher(CostmapFilterInfo, '/speed_filter_info', latched)
        tf = TransformBroadcaster(node)
        position = [0.2, 1.0]
        limits, markers, states, masks = [], [], [], []
        node.create_subscription(SpeedLimit, '/speed_limit', limits.append, 10)
        node.create_subscription(MarkerArray, '/speed_zone_markers', markers.append, latched)
        node.create_subscription(String, '/speed_zones/state', lambda msg: states.append(json.loads(msg.data)), latched)
        node.create_subscription(OccupancyGrid, '/speed_filter_mask', masks.append, latched)

        def broadcast():
            msg = TransformStamped()
            msg.header.stamp = node.get_clock().now().to_msg()
            msg.header.frame_id, msg.child_frame_id = 'map', 'base_link'
            msg.transform.translation.x, msg.transform.translation.y = position
            msg.transform.rotation.w = 1.0
            tf.sendTransform(msg)

        node.create_timer(0.05, broadcast)

        def wait_until(predicate, seconds=6):
            deadline = time.monotonic() + seconds
            while not predicate() and time.monotonic() < deadline:
                rclpy.spin_once(node, timeout_sec=0.05)
            self.assertTrue(predicate(), 'Timed out waiting for ROS result')

        def call(path, service_type, request):
            client = node.create_client(service_type, path)
            self.assertTrue(client.wait_for_service(timeout_sec=6), path)
            future = client.call_async(request)
            wait_until(future.done)
            response = future.result()
            node.destroy_client(client)
            return response

        def activate(name):
            for transition in (1, 3):
                req = ChangeState.Request()
                req.transition.id = transition
                self.assertTrue(call(f'/{name}/change_state', ChangeState, req).success)

        with tempfile.TemporaryDirectory(prefix='speed-zone-smoke-') as temp:
            temp = Path(temp)
            maps = temp / 'robot' / 'maps'
            maps.mkdir(parents=True)
            (maps / 'room.pgm').write_bytes(b'P5\n60 40\n255\n' + bytes([254]) * 2400)
            (maps / 'room.yaml').write_text('image: room.pgm\nresolution: 0.1\norigin: [0, 0, 0]\n')
            service = Ros2RuntimeService(project_root=temp)
            zone = dict(type='SPEED_ZONE', x=1, y=1, width=0.6, height=0.6, speed_limit=0.18)
            service.write_speed_mask('room', [zone], margin_m=0)
            mask_path = service.speed_mask_paths('room')[0]
            params = temp / 'costmap.yaml'
            params.write_text('''/**:
  ros__parameters:
    global_frame: map
    robot_base_frame: base_link
    update_frequency: 10.0
    publish_frequency: 5.0
    resolution: 0.1
    width: 6
    height: 4
    robot_radius: 0.1
    plugins: [static_layer]
    static_layer:
      plugin: nav2_costmap_2d::StaticLayer
      map_topic: /map
      map_subscribe_transient_local: true
    filters: [speed_filter]
    speed_filter:
      plugin: nav2_costmap_2d::SpeedFilter
      filter_info_topic: /speed_filter_info
      speed_limit_topic: /speed_limit
''')
            processes = []
            with tempfile.TemporaryFile(mode='w+') as log:
                def start(command):
                    processes.append(subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True))
                try:
                    config = root / 'robot' / 'ros2_configs'
                    start(['ros2', 'run', 'nav2_map_server', 'map_server', '--ros-args',
                           '-r', '__node:=speed_mask_server', '--params-file', str(config / 'nav2' / 'zone_filter_params.yaml'),
                           '-p', f'yaml_filename:={mask_path}'])
                    start(['ros2', 'run', 'nav2_costmap_2d', 'nav2_costmap_2d', '--ros-args',
                           '-r', '__node:=speed_test_costmap', '--params-file', str(params)])
                    start(['python3', str(config / 'speed_zone_visualizer.py')])
                    activate('speed_mask_server')
                    grid = OccupancyGrid()
                    grid.header.frame_id = 'map'
                    grid.info.width, grid.info.height, grid.info.resolution = 60, 40, 0.1
                    grid.info.origin.orientation.w = 1.0
                    grid.data = [0] * 2400
                    map_pub.publish(grid)
                    # Keep update bounds nonempty in this static-only fixture.
                    # Production also has ObstacleLayer's footprint/scan bounds.
                    node.create_timer(0.2, lambda: map_pub.publish(grid))
                    info = CostmapFilterInfo()
                    info.type, info.base, info.multiplier = 2, 0.0, 0.01
                    info.filter_mask_topic = '/speed_filter_mask'
                    info_pub.publish(info)
                    activate('speed_test_costmap')
                    wait_until(lambda: bool(masks and markers and states))
                    self.assertEqual(set(masks[-1].data), {0, 18}, 'MapServer must preserve raw mask values')
                    self.assertTrue(any(m.type == Marker.TEXT_VIEW_FACING and '0.18' in m.text
                                        for m in markers[-1].markers))
                    position[0] = 1.0
                    wait_until(lambda: bool(limits) and abs(limits[-1].speed_limit-0.18) < 1e-6)
                    self.assertFalse(limits[-1].percentage)
                    wait_until(lambda: (states[-1].get('limit') or {}).get('speed_limit') == limits[-1].speed_limit)
                    position[0] = 2.0
                    wait_until(lambda: limits[-1].speed_limit == 0)
                    position[0] = 1.0
                    wait_until(lambda: abs(limits[-1].speed_limit-0.18) < 1e-6)
                    service.write_speed_mask('room', [], margin_m=0)
                    request = LoadMap.Request()
                    request.map_url = str(mask_path)
                    self.assertEqual(call('/speed_mask_server/load_map', LoadMap, request).result, 0)
                    wait_until(lambda: limits[-1].speed_limit == 0 and states[-1]['regions'] == 0)
                    wait_until(lambda: len(markers[-1].markers) == 1
                               and markers[-1].markers[0].action == Marker.DELETEALL)
                    print('SpeedFilter round trip: raw mask 18 -> 0.18 m/s; exit/delete -> 0; markers cleared.')
                except Exception:
                    log.seek(0)
                    print(log.read()[-10000:])
                    raise
                finally:
                    for process in processes:
                        if process.poll() is None:
                            os.killpg(process.pid, signal.SIGINT)
                    for process in processes:
                        try:
                            process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            os.killpg(process.pid, signal.SIGKILL)
                            process.wait()
                    node.destroy_node()
                    rclpy.shutdown()


if __name__ == '__main__':
    unittest.main()
