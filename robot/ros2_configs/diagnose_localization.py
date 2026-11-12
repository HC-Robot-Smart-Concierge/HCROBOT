#!/usr/bin/env python3
"""Read-only localization snapshot. Never publishes goals or motor commands."""
import argparse
import json
import math
import time

import rclpy
from geometry_msgs.msg import PoseWithCovarianceStamped
from nav_msgs.msg import OccupancyGrid, Odometry
from rcl_interfaces.msg import Log
from rcl_interfaces.srv import GetParameters
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy, qos_profile_sensor_data
from sensor_msgs.msg import LaserScan
from std_msgs.msg import String
from tf2_ros import Buffer, TransformListener


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds', type=float, default=12)
    args = parser.parse_args()
    rclpy.init()
    node = rclpy.create_node('hc_localization_diagnostics')
    buffer = Buffer()
    listener = TransformListener(buffer, node)
    result = {'scan_samples': [], 'amcl_samples': [], 'warnings': [], 'parameters': {}}
    state = {'map': None, 'scan': None, 'odom': None, 'scan_count': 0}
    latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                        reliability=ReliabilityPolicy.RELIABLE)

    def scan(msg):
        state['scan'] = msg
        state['scan_count'] += 1

    def amcl(msg):
        q = msg.pose.pose.orientation
        result['amcl_samples'].append({
            'stamp': msg.header.stamp.sec + msg.header.stamp.nanosec / 1e9,
            'x': msg.pose.pose.position.x, 'y': msg.pose.pose.position.y,
            'yaw_deg': math.degrees(2 * math.atan2(q.z, q.w)),
            'std_x': math.sqrt(max(0, msg.pose.covariance[0])),
            'std_y': math.sqrt(max(0, msg.pose.covariance[7])),
            'std_yaw_deg': math.degrees(math.sqrt(max(0, msg.pose.covariance[35]))),
        })

    node.create_subscription(OccupancyGrid, '/map', lambda m: state.update(map=m), latched)
    node.create_subscription(LaserScan, '/scan', scan, qos_profile_sensor_data)
    node.create_subscription(Odometry, '/odom', lambda m: state.update(odom=m), 10)
    node.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', amcl, latched)
    node.create_subscription(String, '/robot/sensor_health',
                             lambda m: result.update(health=json.loads(m.data)), 10)
    node.create_subscription(Log, '/rosout', lambda m: result['warnings'].append(
        [m.name, m.msg]) if m.level >= 30 else None, 100)

    pending = []
    for name, keys in {
        '/amcl': ['laser_model_type', 'z_hit', 'z_rand', 'sigma_hit', 'max_beams',
                  'update_min_d', 'update_min_a', 'alpha1', 'alpha2', 'alpha3',
                  'alpha4', 'set_initial_pose', 'do_beamskip', 'min_particles',
                  'max_particles', 'use_sim_time'],
        '/map_server': ['yaml_filename'],
        '/global_costmap/global_costmap': ['obstacle_layer.enabled', 'obstacle_layer.scan.topic',
                                          'obstacle_layer.scan.clearing', 'footprint_padding'],
    }.items():
        client = node.create_client(GetParameters, name + '/get_parameters')
        pending.append([name, keys, None, client])

    start = time.monotonic()
    last_sample = 0
    while time.monotonic() - start < args.seconds:
        rclpy.spin_once(node, timeout_sec=0.1)
        for entry in pending:
            if entry[2] is None and entry[3].service_is_ready():
                entry[2] = entry[3].call_async(GetParameters.Request(names=entry[1]))
        if time.monotonic() - last_sample < 1 or state['scan'] is None:
            continue
        last_sample = time.monotonic()
        msg = state['scan']
        now = node.get_clock().now().nanoseconds / 1e9
        sample = {'age_sec': round(now - msg.header.stamp.sec - msg.header.stamp.nanosec / 1e9, 3),
                  'count': state['scan_count'], 'scan_time': round(msg.scan_time, 3)}
        try:
            tf = buffer.lookup_transform('map', msg.header.frame_id,
                                          rclpy.time.Time.from_msg(msg.header.stamp))
            q = tf.transform.rotation
            yaw = 2 * math.atan2(q.z, q.w)
            tx, ty = tf.transform.translation.x, tf.transform.translation.y
            grid = state['map']
            total, inside, near = 0, 0, 0
            if grid is not None:
                res = grid.info.resolution
                oq = grid.info.origin.orientation
                oyaw = 2 * math.atan2(oq.z, oq.w)
                co, si = math.cos(oyaw), math.sin(oyaw)
                radius = math.ceil(0.15 / res)
                offsets = [(dx, dy) for dx in range(-radius, radius + 1)
                           for dy in range(-radius, radius + 1)
                           if (dx * res) ** 2 + (dy * res) ** 2 <= 0.15 ** 2]
                for i, distance in enumerate(msg.ranges):
                    if not math.isfinite(distance) or not msg.range_min <= distance < min(3.0, msg.range_max):
                        continue
                    total += 1
                    angle = yaw + msg.angle_min + i * msg.angle_increment
                    x = tx + distance * math.cos(angle) - grid.info.origin.position.x
                    y = ty + distance * math.sin(angle) - grid.info.origin.position.y
                    gx, gy = math.floor((co*x + si*y)/res), math.floor((-si*x + co*y)/res)
                    if 0 <= gx < grid.info.width and 0 <= gy < grid.info.height:
                        inside += 1
                    if any(0 <= gx+dx < grid.info.width and 0 <= gy+dy < grid.info.height
                           and grid.data[(gy+dy)*grid.info.width+gx+dx] >= 65 for dx, dy in offsets):
                        near += 1
                sample.update(hits=total, inside_map=inside,
                              fraction_near_wall=round(near / max(1, total), 3),
                              laser_map_pose=[round(tx, 3), round(ty, 3), round(math.degrees(yaw), 1)])
        except Exception as exc:
            sample['tf_error'] = str(exc)
        result['scan_samples'].append(sample)

    for name, keys, future, _ in pending:
        if future is not None and future.done() and future.result() is not None:
            result['parameters'][name] = {key: getattr(value, {
                1: 'bool_value', 2: 'integer_value', 3: 'double_value', 4: 'string_value'
            }.get(value.type, 'string_value')) for key, value in zip(keys, future.result().values)}
    if state['odom'] is not None:
        p = state['odom'].pose.pose
        result['odom'] = [p.position.x, p.position.y, math.degrees(2*math.atan2(p.orientation.z, p.orientation.w))]
    result['warnings'] = result['warnings'][-20:]
    result['scan_count'] = state['scan_count']
    print(json.dumps(result, ensure_ascii=False, indent=2))
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
