#!/usr/bin/env python3
"""Tự khám phá (frontier exploration) bằng SLAM Toolbox + Nav2.

Vòng lặp: đọc /map -> tìm cụm frontier -> gửi NavigateToPose cho Nav2 -> chờ
xong/lỗi/timeout -> đánh dấu điểm đã thử -> lặp lại tới khi hết frontier.
Hết frontier thì (tuỳ chọn) gọi /slam_toolbox/save_map để lưu map.

Chạy (đã có SLAM Toolbox + Nav2 slam:=true):
  python3 frontier_explorer.py --ros-args -p use_sim_time:=true -p save_map_name:=map_ao
"""

import math
import os
import sys

import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from rclpy.time import Time
from nav_msgs.msg import OccupancyGrid
from nav2_msgs.action import NavigateToPose
from geometry_msgs.msg import PoseStamped
from tf2_ros import Buffer, TransformListener

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frontier_logic import GoalFailureTracker, choose_frontier, find_frontiers  # noqa: E402

try:
    from slam_toolbox.srv import SaveMap
except ImportError:  # slam_toolbox chưa cài: vẫn khám phá được, chỉ không tự lưu
    SaveMap = None


class FrontierExplorer(Node):
    def __init__(self):
        super().__init__("frontier_explorer")
        self.min_cluster_cells = int(self.declare_parameter("min_cluster_cells", 8).value)
        self.goal_timeout_sec = float(self.declare_parameter("goal_timeout_sec", 60.0).value)
        self.done_checks = int(self.declare_parameter("done_checks", 3).value)
        self.save_map_name = str(self.declare_parameter("save_map_name", "").value)
        # Thu lai mot cho toi da N lan truoc khi bo (loi tam thoi cua Nav2 tren xe that)
        self.failures = GoalFailureTracker(int(self.declare_parameter("max_goal_failures", 3).value))
        self.map_dir = str(self.declare_parameter(
            "map_dir", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "maps"))
        ).value)

        self.map_msg = None
        self.blacklist = []
        self.goal_handle = None
        self.goal_point = None
        self.goal_seq = 0
        self.goal_started = 0.0
        self.busy = False
        self.empty_checks = 0
        self.finished = False
        self.visited = 0

        qos = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                         reliability=ReliabilityPolicy.RELIABLE)
        self.create_subscription(OccupancyGrid, "/map", self._on_map, qos)
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.nav = ActionClient(self, NavigateToPose, "navigate_to_pose")
        self.save_client = self.create_client(SaveMap, "/slam_toolbox/save_map") if SaveMap else None
        self.create_timer(1.0, self._tick)
        self.get_logger().info("🧭 Frontier explorer sẵn sàng, chờ /map và Nav2...")

    def _now(self):
        # Dong ho cua node: use_sim_time:=true thi la gio MO PHONG. Gazebo trong WSL
        # thuong chi chay ~0.3x, dem bang gio that thi xe chua kip toi da bi huy dich.
        return self.get_clock().now().nanoseconds * 1e-9

    def _on_map(self, msg):
        self.map_msg = msg

    def _robot_xy(self):
        try:
            t = self.tf_buffer.lookup_transform("map", "base_link", Time())
        except Exception:
            return None
        return (t.transform.translation.x, t.transform.translation.y)

    def _tick(self):
        if self.finished:
            return
        if self.busy:
            if self._now() - self.goal_started > self.goal_timeout_sec and self.goal_handle:
                self.get_logger().warn("⏱️ Quá thời gian tới frontier, huỷ và thử chỗ khác")
                self.goal_handle.cancel_goal_async()
                self._goal_finished(success=False, seq=self.goal_seq)
            return
        if self.map_msg is None or not self.nav.server_is_ready():
            return
        robot = self._robot_xy()
        if robot is None:
            return

        info = self.map_msg.info
        frontiers = find_frontiers(
            self.map_msg.data, info.width, info.height, info.resolution,
            (info.origin.position.x, info.origin.position.y), self.min_cluster_cells,
        )
        target = choose_frontier(frontiers, robot, self.blacklist)
        if target is None:
            self.empty_checks += 1
            if self.empty_checks >= self.done_checks:
                self._finish(len(frontiers))
            return
        self.empty_checks = 0
        self._send_goal(target.goal, robot, len(frontiers))

    def _send_goal(self, goal, robot, n_frontiers):
        pose = PoseStamped()
        pose.header.frame_id = "map"
        pose.header.stamp = self.get_clock().now().to_msg()
        pose.pose.position.x, pose.pose.position.y = goal
        yaw = math.atan2(goal[1] - robot[1], goal[0] - robot[0])
        pose.pose.orientation.z = math.sin(yaw / 2.0)
        pose.pose.orientation.w = math.cos(yaw / 2.0)

        msg = NavigateToPose.Goal()
        msg.pose = pose
        self.busy = True
        self.goal_seq += 1
        seq = self.goal_seq
        self.goal_point = goal
        self.goal_started = self._now()
        self.get_logger().info(
            f"➡️ Frontier ({goal[0]:.2f}, {goal[1]:.2f}) - còn {n_frontiers} cụm, đã thăm {self.visited}"
        )
        self.nav.send_goal_async(msg).add_done_callback(lambda f: self._on_goal_response(f, seq))

    def _on_goal_response(self, future, seq):
        handle = future.result()
        if seq != self.goal_seq:
            return  # đích cũ đã bị timeout/thay thế
        if not handle.accepted:
            self.get_logger().warn("Nav2 từ chối đích, bỏ qua frontier này")
            self._goal_finished(success=False, seq=seq)
            return
        self.goal_handle = handle
        handle.get_result_async().add_done_callback(
            lambda f: self._goal_finished(success=(f.result().status == 4), seq=seq)  # 4 = SUCCEEDED
        )

    def _goal_finished(self, success, seq=None):
        if not self.busy or (seq is not None and seq != self.goal_seq):
            return
        if self.goal_point is not None:
            if success:
                self.blacklist.append(self.goal_point)  # tới rồi thì không nhắm lại
            elif self.failures.record_failure(self.goal_point):
                self.get_logger().warn(
                    f"Bỏ frontier ({self.goal_point[0]:.2f}, {self.goal_point[1]:.2f}) sau "
                    f"{self.failures.max_failures} lần Nav2 thất bại"
                )
                self.blacklist.append(self.goal_point)
            else:
                self.get_logger().warn("Nav2 chưa tới được, sẽ thử lại chỗ này")
        if success:
            self.visited += 1
        self.busy = False
        self.goal_handle = None
        self.goal_point = None

    def _finish(self, n_left):
        self.finished = True
        if self.visited == 0:
            # Chưa tới được điểm nào: gần như chắc chắn Nav2/TF/motor có lỗi chứ không
            # phải đã quét xong. Không lưu để khỏi ghi đè bằng một map gần như trống.
            self.get_logger().error(
                f"❌ Dừng khám phá: chưa tới được frontier nào ({n_left} cụm còn lại). "
                "Kiểm tra log Nav2 (controller_server/bt_navigator) và motor. KHÔNG lưu map."
            )
            return
        self.get_logger().info(
            f"🎉 Khám phá xong: đã thăm {self.visited} frontier, còn {n_left} cụm không tới được"
        )
        if self.save_map_name and self.save_client is not None:
            if not self.save_client.wait_for_service(timeout_sec=3.0):
                self.get_logger().warn("Không có /slam_toolbox/save_map, chưa lưu map")
                return
            req = SaveMap.Request()
            req.name.data = os.path.join(self.map_dir, self.save_map_name)
            self.save_client.call_async(req).add_done_callback(
                lambda f: self.get_logger().info(f"💾 Đã lưu map: {req.name.data}.yaml/.pgm")
            )


def main():
    rclpy.init()
    node = FrontierExplorer()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.try_shutdown()


if __name__ == "__main__":
    main()
