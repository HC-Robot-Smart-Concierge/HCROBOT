import rclpy
from rclpy.node import Node
from slam_toolbox.srv import Reset
from std_msgs.msg import Empty

def main():
    rclpy.init()
    node = Node('cli_reset_slam')

    # 1. Phát topic /robot/reset_map để bridge xóa robot_path và đồng bộ TF về 0
    reset_pub = node.create_publisher(Empty, '/robot/reset_map', 10)
    reset_pub.publish(Empty())

    # 2. Gọi service /slam_toolbox/reset
    client = node.create_client(Reset, '/slam_toolbox/reset')
    if client.wait_for_service(timeout_sec=2.0):
        req = Reset.Request()
        req.pause_new_measurements = False
        future = client.call_async(req)
        rclpy.spin_until_future_complete(node, future, timeout_sec=2.0)
        print("✅ Đã gọi /slam_toolbox/reset thành công!")
    else:
        print("⚠️ Service /slam_toolbox/reset không phản hồi.")

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
