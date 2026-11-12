import time
import rclpy
from nav_msgs.msg import Odometry, OccupancyGrid
from rosgraph_msgs.msg import Clock
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
rclpy.init()
n = rclpy.create_node('explore_scan_inspector')
data = {}
def clock(m):
    data.setdefault('first_clock', m.clock.sec + m.clock.nanosec / 1e9)
    data['clock'] = m.clock.sec + m.clock.nanosec / 1e9
def odom(m):
    p = m.pose.pose.position
    data.setdefault('first_position', [p.x, p.y])
    data['position'] = [p.x, p.y]
def grid(m):
    data['map'] = {'size': [m.info.width, m.info.height], 'known': sum(v >= 0 for v in m.data), 'total': len(m.data)}
n.create_subscription(Clock, '/clock', clock, 10)
n.create_subscription(Odometry, '/odom', odom, 10)
n.create_subscription(OccupancyGrid, '/map', grid, QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL, reliability=ReliabilityPolicy.RELIABLE))
start = time.monotonic()
while time.monotonic() - start < 10:
    rclpy.spin_once(n, timeout_sec=0.2)
print(data, flush=True)
n.destroy_node()
rclpy.shutdown()
