"""Opt-in AMCL integration test with synthetic walls, isolated from the robot.

ROS_DOMAIN_ID=87 HCROBOT_RUN_AMCL_SMOKE=1 python3 -m unittest discover \
    -s robot/tests -p test_amcl_smoke.py -v
"""
import math
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest


@unittest.skipUnless(os.getenv('HCROBOT_RUN_AMCL_SMOKE') == '1'
                     and os.getenv('ROS_DOMAIN_ID') == '87', 'requires isolated ROS domain 87')
class TestAmclSmoke(unittest.TestCase):
    def test_saved_map_localization_converges_without_motion(self):
        import rclpy
        from geometry_msgs.msg import PoseWithCovarianceStamped, TransformStamped
        from lifecycle_msgs.srv import ChangeState
        from nav_msgs.msg import OccupancyGrid
        from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
        from rclpy.duration import Duration
        from sensor_msgs.msg import LaserScan
        from std_srvs.srv import Empty
        from tf2_ros import TransformBroadcaster, StaticTransformBroadcaster

        config = Path(__file__).resolve().parents[1] / 'ros2_configs' / 'nav2'
        rclpy.init()
        node = rclpy.create_node('isolated_amcl_smoke')
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                            reliability=ReliabilityPolicy.RELIABLE)
        map_pub = node.create_publisher(OccupancyGrid, '/map', latched)
        scan_pub = node.create_publisher(LaserScan, '/scan', 10)
        pose_pub = node.create_publisher(PoseWithCovarianceStamped, '/initialpose', 10)
        dynamic_tf = TransformBroadcaster(node)
        static_tf = StaticTransformBroadcaster(node)
        poses = []
        node.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', poses.append, latched)
        lifecycle = node.create_client(ChangeState, '/amcl/change_state')
        nomotion = node.create_client(Empty, '/request_nomotion_update')

        def call(client, request):
            self.assertTrue(client.wait_for_service(timeout_sec=5), client.srv_name)
            future = client.call_async(request)
            rclpy.spin_until_future_complete(node, future, timeout_sec=5)
            self.assertTrue(future.done(), client.srv_name)
            return future.result()

        grid = OccupancyGrid()
        grid.header.frame_id = 'map'
        grid.info.resolution, grid.info.width, grid.info.height = 0.05, 120, 80
        grid.info.origin.orientation.w = 1.0
        grid.data = [100 if x in (0, 119) or y in (0, 79)
                     or (55 <= x <= 63 and 25 <= y <= 50) else 0
                     for y in range(80) for x in range(120)]
        truth = (1.0, 1.0, 0.3)
        scan = LaserScan()
        scan.header.frame_id = 'laser_frame'
        scan.angle_increment = 2 * math.pi / 360
        scan.angle_max = 359 * scan.angle_increment
        scan.range_min, scan.range_max, scan.scan_time = 0.2, 12.0, 0.125
        for i in range(360):
            angle = truth[2] + i * scan.angle_increment
            distance = 0.2
            while distance < 12:
                x = truth[0] + 0.08 * math.cos(truth[2]) + distance * math.cos(angle)
                y = truth[1] + 0.08 * math.sin(truth[2]) + distance * math.sin(angle)
                gx, gy = int(x / 0.05), int(y / 0.05)
                if not (0 <= gx < 120 and 0 <= gy < 80) or grid.data[gy * 120 + gx] == 100:
                    break
                distance += 0.01
            scan.ranges.append(distance)

        with tempfile.TemporaryFile(mode='w+') as log:
            process = subprocess.Popen([
                'ros2', 'run', 'nav2_amcl', 'amcl', '--ros-args',
                '--params-file', str(config / 'nav2_params.yaml'),
                '--params-file', str(config / 'physical_navigation_overrides.yaml'),
            ], stdout=log, stderr=log, start_new_session=True)
            try:
                req = ChangeState.Request()
                req.transition.id = 1  # configure
                self.assertTrue(call(lifecycle, req).success)
                map_pub.publish(grid)
                req.transition.id = 3  # activate
                self.assertTrue(call(lifecycle, req).success)
                fixed = TransformStamped()
                fixed.header.frame_id, fixed.child_frame_id = 'base_link', 'laser_frame'
                fixed.transform.translation.x = 0.08
                fixed.transform.rotation.w = 1.0
                static_tf.sendTransform(fixed)
                start = time.monotonic()
                initialized, updates = False, 0
                next_update = start + 3
                while time.monotonic() - start < 10:
                    now = node.get_clock().now()
                    tf = TransformStamped()
                    tf.header.stamp = now.to_msg()
                    tf.header.frame_id, tf.child_frame_id = 'odom', 'base_link'
                    tf.transform.rotation.w = 1.0
                    dynamic_tf.sendTransform(tf)
                    if not initialized and time.monotonic() - start > 1:
                        self.assertEqual(poses, [], 'physical AMCL must wait for initialpose')
                        initial = PoseWithCovarianceStamped()
                        initial.header.frame_id = 'map'
                        initial.header.stamp = now.to_msg()
                        initial.pose.pose.position.x = 1.1
                        initial.pose.pose.position.y = 1.1
                        initial.pose.pose.orientation.z = math.sin(0.4 / 2)
                        initial.pose.pose.orientation.w = math.cos(0.4 / 2)
                        initial.pose.covariance[0] = initial.pose.covariance[7] = 0.0625
                        initial.pose.covariance[35] = 0.0685
                        pose_pub.publish(initial)
                        initialized = True
                    if time.monotonic() - start > 0.2:
                        scan.header.stamp = (now - Duration(seconds=0.05)).to_msg()
                        scan_pub.publish(scan)
                    if time.monotonic() > next_update and updates < 5:
                        call(nomotion, Empty.Request())
                        updates += 1
                        next_update += 0.7
                    rclpy.spin_once(node, timeout_sec=0.05)
                    time.sleep(0.03)
                self.assertTrue(poses, 'AMCL did not publish a pose')
                latest = poses[-1]
                pose = latest.pose.pose
                yaw = 2 * math.atan2(pose.orientation.z, pose.orientation.w)
                self.assertLess(math.hypot(pose.position.x-truth[0], pose.position.y-truth[1]), 0.15)
                self.assertLess(abs(yaw-truth[2]), math.radians(10))
                self.assertLess(latest.pose.covariance[35], math.radians(20) ** 2)
                print('Synthetic AMCL: position error=%.3fm, yaw error=%.1fdeg, yaw std=%.1fdeg' % (
                    math.hypot(pose.position.x-truth[0], pose.position.y-truth[1]),
                    math.degrees(abs(yaw-truth[2])), math.degrees(math.sqrt(latest.pose.covariance[35]))))
            except Exception:
                log.seek(0)
                print(log.read()[-8000:])
                raise
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGINT)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                node.destroy_node()
                rclpy.shutdown()


if __name__ == '__main__':
    unittest.main()
