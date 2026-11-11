import json, math, time
import rclpy
from geometry_msgs.msg import Twist, PoseStamped, PoseWithCovarianceStamped
from nav_msgs.msg import Odometry, Path
from rcl_interfaces.msg import Log
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy
rclpy.init()
n = rclpy.create_node('navigation_diagnostics')
data = {'odom': [], 'cmd': [], 'logs': [], 'goal': []}
def pose(p):
    q=p.orientation
    return [round(p.position.x,3),round(p.position.y,3),round(math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.y*q.y+q.z*q.z)),3)]
last={}
def odom(m):
    if time.monotonic()-last.get('odom',0)>1:
        data['odom'].append(pose(m.pose.pose));last['odom']=time.monotonic()
def cmd(m):
    if time.monotonic()-last.get('cmd',0)>.4:
        data['cmd'].append([round(m.linear.x,3),round(m.angular.z,3)]);last['cmd']=time.monotonic()
def log(m):
    if m.level>=30 or ('bt_navigator' in m.name):
        data['logs'].append([m.name,m.msg])
def goal(m): data['goal'].append([m.header.frame_id,pose(m.pose)])
def amcl(m): data['amcl'] = pose(m.pose.pose);data['covariance'] = [m.pose.covariance[i] for i in (0,7,35)]
def plan(m): data['plan']={'frame':m.header.frame_id,'count':len(m.poses),'first':pose(m.poses[0].pose) if m.poses else None,'last':pose(m.poses[-1].pose) if m.poses else None}
n.create_subscription(Odometry,'/odom',odom,10)
n.create_subscription(Twist,'/cmd_vel',cmd,10)
n.create_subscription(Log,'/rosout',log,100)
n.create_subscription(PoseStamped,'/goal_pose',goal,QoSProfile(depth=1,durability=DurabilityPolicy.TRANSIENT_LOCAL,reliability=ReliabilityPolicy.RELIABLE))
n.create_subscription(PoseWithCovarianceStamped,'/amcl_pose',amcl,QoSProfile(depth=1,durability=DurabilityPolicy.TRANSIENT_LOCAL,reliability=ReliabilityPolicy.RELIABLE))
n.create_subscription(Path,'/plan',plan,10)
start=time.monotonic()
while time.monotonic()-start<12:rclpy.spin_once(n,timeout_sec=.2)
data['cmd_publishers']=[x.node_name for x in n.get_publishers_info_by_topic('/cmd_vel')]
data['logs']=data['logs'][-30:]
print(json.dumps(data,ensure_ascii=False,indent=2),flush=True)
n.destroy_node();rclpy.shutdown()
