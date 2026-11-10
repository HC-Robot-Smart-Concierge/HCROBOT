import math,time,json
import rclpy
from rclpy.action import ActionClient
from nav2_msgs.action import NavigateToPose
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist
rclpy.init()
n=rclpy.create_node('sim_navigation_check')
n.set_parameters([rclpy.parameter.Parameter('use_sim_time',value=True)])
client=ActionClient(n,NavigateToPose,'/navigate_to_pose')
data={'max_linear_command':0.0}
def odom(m):
    p=m.pose.pose.position
    data.setdefault('start',[p.x,p.y]);data['end']=[p.x,p.y]
def cmd(m):data['max_linear_command']=max(data['max_linear_command'],abs(m.linear.x))
n.create_subscription(Odometry,'/odom',odom,10)
n.create_subscription(Twist,'/cmd_vel',cmd,10)
if not client.wait_for_server(timeout_sec=5):raise RuntimeError('Nav2 unavailable')
g=NavigateToPose.Goal();g.pose.header.frame_id='map'
g.pose.header.stamp=n.get_clock().now().to_msg()
g.pose.pose.position.x=1.0;g.pose.pose.position.y=0.4;g.pose.pose.orientation.w=1.0
future=client.send_goal_async(g)
start=time.monotonic()
while not future.done() and time.monotonic()-start<10:rclpy.spin_once(n,timeout_sec=.2)
handle=future.result()
if handle is None or not handle.accepted:raise RuntimeError('Goal not accepted')
print('Test goal accepted: map (1.0, 0.4), yaw=0',flush=True)
result=handle.get_result_async();last=time.monotonic()
while not result.done() and time.monotonic()-start<90:
    rclpy.spin_once(n,timeout_sec=.2)
    if time.monotonic()-last>15:print(json.dumps(data),flush=True);last=time.monotonic()
if result.done():data['status']=result.result().status
else:
    f=handle.cancel_goal_async()
    deadline=time.monotonic()+5
    while not f.done() and time.monotonic()<deadline:rclpy.spin_once(n,timeout_sec=.2)
    data['status']='timeout_cancelled'
if 'start' in data and 'end' in data:data['distance_m']=math.dist(data['start'],data['end'])
print(json.dumps(data),flush=True)
n.destroy_node();rclpy.shutdown()
