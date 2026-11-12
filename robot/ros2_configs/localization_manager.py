#!/usr/bin/env python3
"""Localization Manager - gac cong dinh vi cho Navigation tren map da luu (AMCL + Nav2).

Trang thai phat len /localization/state (std_msgs/String JSON, latched, 1 Hz):
  UNLOCALIZED        vua khoi dong / chua co vi tri / xac minh that bai
  LOCALIZING         vua co vi tri ban dau (Web, Foxglove, hoac khoi phuc pose cu) - dang so LiDAR
  LOCALIZED          AMCL du chac VA LiDAR khop map lien tuc confirm_sec => duoc tu hanh
  LOCALIZATION_LOST  dang LOCALIZED ma LiDAR het khop map lost_sec => huy goal, dung xe

- Chi LOCALIZED moi duoc tu hanh: goal navigate_to_pose nao chay khi chua LOCALIZED bi huy
  (cancel_goal) kem /robot/nav_cancel (bridge xe that dung motor). Web chi hien thi trang thai.
- Covariance nho chi noi AMCL TU TIN, khong noi DUNG => phai them diem khop LiDAR-map (xem
  localization_logic.scan_match: ti le tong + huong kem nhi trong 8 huong).
- Luu pose cuoi (robot/maps/last_pose/<map>.json) khi LOCALIZED; lan khoi dong sau dat lai pose
  do cho AMCL va XAC MINH bang LiDAR: xe bi doi cho => khong khop => UNLOCALIZED, nho dat tay.
- KHONG tu chay global localization: phong nho / doi xung (phong chu nhat xoay 180 do trong y
  het) de AMCL chac chan o cho sai, va diem khop LiDAR cung khong phan biet duoc hai cho do.

Chay:  python3 localization_manager.py --ros-args -p map_name:=phong_test
"""

import json
import math
import os
import sys
import time

import rclpy
from action_msgs.msg import GoalStatus, GoalStatusArray
from action_msgs.srv import CancelGoal
from geometry_msgs.msg import PoseWithCovarianceStamped
from lifecycle_msgs.msg import State as LifecycleState
from lifecycle_msgs.srv import GetState
from nav_msgs.msg import OccupancyGrid, Odometry
from rclpy.executors import ExternalShutdownException
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy, qos_profile_sensor_data
from rclpy.time import Time
from sensor_msgs.msg import LaserScan
from std_msgs.msg import Empty, String
from tf2_ros import Buffer, TransformListener

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from localization_logic import (  # noqa: E402
    LOCALIZED, LOST, UNLOCALIZED, LocalizationStateMachine, load_last_pose, near_wall_mask,
    save_last_pose, scan_match,
)

ACTIVE_GOAL = (GoalStatus.STATUS_ACCEPTED, GoalStatus.STATUS_EXECUTING)
LATCHED = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                     reliability=ReliabilityPolicy.RELIABLE)


def _yaw(q):
    return math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z))


class LocalizationManager(Node):
    def __init__(self):
        super().__init__("localization_manager")
        p = self.declare_parameter
        self.map_name = str(p("map_name", "").value)
        self.persist_pose = bool(p("persist_pose", True).value)
        default_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "maps", "last_pose"))
        self.pose_path = os.path.join(str(p("pose_dir", default_dir).value), f"{self.map_name or 'map'}.json")
        self.tolerance_m = float(p("match_tolerance_m", 0.12).value)
        self.input_timeout = float(p("input_timeout_sec", 1.5).value)
        self.save_period = float(p("save_period_sec", 2.0).value)
        self.sm = LocalizationStateMachine(
            good_score=float(p("good_score", 0.6).value),
            lost_score=float(p("lost_score", 0.35).value),
            min_sector_score=float(p("min_sector_score", 0.3).value),
            confirm_sec=float(p("confirm_sec", 2.0).value),
            lost_sec=float(p("lost_sec", 3.0).value),
            localize_timeout_sec=float(p("localize_timeout_sec", 20.0).value),
            max_sigma_xy=float(p("max_sigma_xy", 0.35).value),
            max_sigma_yaw=float(p("max_sigma_yaw", 0.35).value),
        )

        self.grid = None
        self.mask = None
        self.scan = None
        self.scan_at = None
        self.odom_at = None
        self.amcl = None
        self.match = None
        self.active_goals = 0
        self.pending_source = None
        self.restore_tried = not self.persist_pose
        self.last_cancel = 0.0
        self.last_save = 0.0
        self.last_publish = 0.0

        self.create_subscription(OccupancyGrid, "/map", self._on_map, LATCHED)
        self.create_subscription(LaserScan, "/scan", self._on_scan, qos_profile_sensor_data)
        self.create_subscription(Odometry, "/odom", self._on_odom, qos_profile_sensor_data)
        self.create_subscription(PoseWithCovarianceStamped, "/amcl_pose", self._on_amcl, 10)
        self.create_subscription(PoseWithCovarianceStamped, "/initialpose", self._on_initial_pose, 10)
        self.create_subscription(GoalStatusArray, "/navigate_to_pose/_action/status", self._on_goal_status, LATCHED)
        self.state_pub = self.create_publisher(String, "/localization/state", LATCHED)
        self.initial_pub = self.create_publisher(PoseWithCovarianceStamped, "/initialpose", 10)
        self.stop_pub = self.create_publisher(Empty, "/robot/nav_cancel", 10)
        self.cancel_client = self.create_client(CancelGoal, "/navigate_to_pose/_action/cancel_goal")
        # Khoi phuc pose cu chi khi AMCL da active: gui som AMCL bo qua => khong co frame map,
        # global costmap cho TF qua lau va lifecycle manager huy ca Nav2.
        self.amcl_state_client = self.create_client(GetState, "/amcl/get_state")
        self.amcl_active = False
        self.amcl_state_future = None
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.create_timer(0.5, self._tick)
        self._publish_state()
        self.get_logger().info(
            f"🧭 Localization Manager: map '{self.map_name}', khóa tự hành tới khi LiDAR khớp bản đồ "
            f"(≥ {self.sm.good_score:.0%}, hướng kém nhì ≥ {self.sm.min_sector_score:.0%})"
        )

    # ------------------------------------------------------------------ dau vao
    def _on_map(self, msg):
        info = msg.info
        self.grid = (info.width, info.height, info.resolution, info.origin.position.x, info.origin.position.y)
        self.mask = near_wall_mask(msg.data, info.width, info.height, info.resolution, self.tolerance_m)
        self.get_logger().info(f"🗺️ Nhận bản đồ {info.width}x{info.height} ô ({info.resolution} m/ô)")

    def _on_scan(self, msg):
        self.scan, self.scan_at = msg, time.monotonic()

    def _on_odom(self, _msg):
        self.odom_at = time.monotonic()

    def _on_amcl(self, msg):
        self.amcl = msg

    def _on_initial_pose(self, msg):
        source = self.pending_source or "web"
        self.pending_source = None
        self.restore_tried = True  # nguoi dung da dat tay => khong khoi phuc pose cu nua
        self.amcl = None  # sigma cu khong con dung cho vi tri moi
        self.sm.on_initial_pose(time.monotonic(), source)
        p = msg.pose.pose
        self.get_logger().info(
            f"📍 Vị trí ban đầu ({source}): ({p.position.x:.2f}, {p.position.y:.2f}, "
            f"{math.degrees(_yaw(p.orientation)):.0f}°) - đang xác minh bằng LiDAR"
        )
        self._publish_state()

    def _on_goal_status(self, msg):
        self.active_goals = sum(1 for s in msg.status_list if s.status in ACTIVE_GOAL)
        self._gate_goals()

    # ------------------------------------------------------------------ vong chinh
    def _inputs(self, now):
        if self.mask is None:
            return False, "Chờ bản đồ từ map_server..."
        if self.scan_at is None or now - self.scan_at > self.input_timeout:
            return False, "Chưa nhận LiDAR (/scan): kiểm tra Pi/RPLiDAR và bridge."
        if self.odom_at is None or now - self.odom_at > self.input_timeout:
            return False, "Chưa nhận odom (/odom): kiểm tra encoder/bridge."
        return True, "Chưa có vị trí: đặt vị trí ban đầu trên Web (Chọn trên map / Đặt tại Dock)."

    def _lookup(self, child):
        try:
            t = self.tf_buffer.lookup_transform("map", child, Time())
        except Exception:
            return None
        tr = t.transform
        return tr.translation.x, tr.translation.y, _yaw(tr.rotation)

    def _compute_match(self):
        s = self.scan
        if s is None or self.mask is None:
            return None
        laser = self._lookup(s.header.frame_id.lstrip("/"))
        if laser is None:
            return None
        return scan_match(list(s.ranges), s.angle_min, s.angle_increment, max(s.range_min, 0.05),
                          s.range_max, laser, self.mask, self.grid)

    def _sigmas(self):
        if self.amcl is None:
            return None, None
        c = self.amcl.pose.covariance
        return math.sqrt(max(c[0], c[7], 0.0)), math.sqrt(max(c[35], 0.0))

    def _try_restore(self):
        self.restore_tried = True
        saved = load_last_pose(self.pose_path, self.map_name)
        if saved is None:
            return
        msg = PoseWithCovarianceStamped()
        msg.header.frame_id = "map"
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.pose.pose.position.x, msg.pose.pose.position.y = saved["x"], saved["y"]
        msg.pose.pose.orientation.z = math.sin(saved["yaw"] / 2.0)
        msg.pose.pose.orientation.w = math.cos(saved["yaw"] / 2.0)
        msg.pose.covariance[0] = msg.pose.covariance[7] = 0.15 ** 2
        msg.pose.covariance[35] = 0.15 ** 2
        age_h = (time.time() - saved["saved_at"]) / 3600.0
        self.get_logger().info(
            f"♻️ Thử vị trí lưu lần trước ({saved['x']:.2f}, {saved['y']:.2f}), cách đây {age_h:.1f} h"
        )
        self.pending_source = "restore"
        self.initial_pub.publish(msg)

    def _amcl_is_active(self):
        if self.amcl_active:
            return True
        f = self.amcl_state_future
        if f is not None and f.done():
            res = f.result()
            self.amcl_active = res is not None and res.current_state.id == LifecycleState.PRIMARY_STATE_ACTIVE
            self.amcl_state_future = None
        elif f is None and self.amcl_state_client.service_is_ready():
            self.amcl_state_future = self.amcl_state_client.call_async(GetState.Request())
        return self.amcl_active

    def _tick(self):
        now = time.monotonic()
        inputs_ok, missing = self._inputs(now)
        if inputs_ok and self.sm.state == UNLOCALIZED and not self.restore_tried and self._amcl_is_active():
            self._try_restore()
        self.match = self._compute_match() if inputs_ok else None
        sigma_xy, sigma_yaw = self._sigmas()
        before, source = self.sm.state, self.sm.source
        if self.sm.update(now, inputs_ok, missing, self.match, sigma_xy, sigma_yaw):
            if self.sm.state == UNLOCALIZED and source == "restore":
                self.sm.reason = ("Vị trí lưu lần trước không khớp LiDAR (xe đã bị dời?). "
                                  "Đặt vị trí ban đầu trên Web.")
            # rclpy cam doi muc log o cung 1 cho goi => 2 lenh rieng (tung lam node chet).
            text = f"🔁 {before} → {self.sm.state}: {self.sm.reason}"
            if self.sm.state in (UNLOCALIZED, LOST):
                self.get_logger().warn(text)
            else:
                self.get_logger().info(text)
            if self.sm.state == LOST:
                self._cancel_goals("mất định vị")
            self._publish_state()
        self._gate_goals()
        if now - self.last_publish >= 1.0:
            self._publish_state()
        if self.sm.state == LOCALIZED and self.persist_pose and now - self.last_save >= self.save_period:
            self._save_pose()
            self.last_save = now

    def _gate_goals(self):
        if self.active_goals and self.sm.should_cancel_goals():
            self._cancel_goals(f"chưa định vị ({self.sm.state})")

    def _cancel_goals(self, why):
        now = time.monotonic()
        if now - self.last_cancel < 1.0:
            return
        self.last_cancel = now
        self.get_logger().warn(f"🛑 Hủy goal Nav2 + dừng xe: {why}")
        if self.cancel_client.service_is_ready():
            self.cancel_client.call_async(CancelGoal.Request())  # goal_info rong = huy tat ca
        self.stop_pub.publish(Empty())

    def _save_pose(self):
        pose = self._lookup("base_link")
        if pose is None or not self.map_name:
            return
        try:
            save_last_pose(self.pose_path, self.map_name, *pose)
        except OSError as exc:
            self.get_logger().warn(f"Không lưu được vị trí cuối: {exc}", throttle_duration_sec=30.0)

    def _publish_state(self):
        self.last_publish = time.monotonic()
        sigma_xy, sigma_yaw = self._sigmas()
        m = self.match
        state = {
            "state": self.sm.state,
            "reason": self.sm.reason,
            "source": self.sm.source,
            "map": self.map_name,
            "score": round(m.score, 3) if m else None,
            "weak_sector": round(m.weak_sector, 3) if m else None,
            "beams": m.beams if m else 0,
            "sigma_xy": round(sigma_xy, 3) if sigma_xy is not None else None,
            "sigma_yaw": round(sigma_yaw, 3) if sigma_yaw is not None else None,
            "good_score": self.sm.good_score,
        }
        self.state_pub.publish(String(data=json.dumps(state, ensure_ascii=False)))


def main():
    rclpy.init()
    node = LocalizationManager()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass
    except Exception:
        if rclpy.ok():
            raise  # loi that; con context da tat (Ctrl+C / SIGTERM) thi chi la dang thoat
    finally:
        if node.sm.state == LOCALIZED and node.persist_pose:
            node._save_pose()
        node.destroy_node()
        rclpy.try_shutdown()


if __name__ == "__main__":
    main()
