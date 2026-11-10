#!/usr/bin/env python3
"""Tự khám phá (frontier exploration) bằng SLAM Toolbox + Nav2.

Vòng lặp: đọc /map -> tìm cụm frontier -> chọn chỗ đứng THOÁNG gần frontier (cách vật
cản >= goal_clearance_m) -> gửi NavigateToPose -> tới nơi thì đứng yên settle_sec cho
LiDAR/SLAM cập nhật -> xét frontier còn hay không -> lặp lại tới khi hết frontier.
Hết frontier thì (tuỳ chọn) lưu map bằng map_saver_cli.

Chống kẹt (xe thật: sonar trên Pi chặn lệnh khi sát vật cản, Nav2 không biết):
- Đích luôn ở chỗ thoáng; không bao giờ lao thẳng vào ô frontier (thường sát vật cản).
- Tới gần đích (reach_radius_m) là tự dừng, khỏi chờ Nav2 xoay đúng hướng đích.
- Ghi đường đi bằng odom; quét xong/kẹt trong khe thì lùi theo đường cũ về chỗ rộng.
- Quay/rẽ qua kiểm tra vùng quét của LiDAR + local costmap; vướng thì chọn đường khác.
- Thiếu cảm biến/costmap kéo dài: dừng tự hành và báo lý do.

Kết thúc (xong / không tới được frontier nào / bị dừng): phát kết quả JSON lên /explore/status
(latched) rồi THOÁT tiến trình sau vài giây => backend chuyển về MAPPING (SLAM vẫn chạy, giữ
map) và Web hiện bảng đặt tên + lưu map.

Chạy (đã có SLAM Toolbox + Nav2 slam:=true):
  python3 frontier_explorer.py --ros-args -p use_sim_time:=true -p save_map_name:=map_ao
"""

import json
import math
import os
import subprocess
import sys
import threading
import time

import rclpy
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from rclpy.time import Time
from nav_msgs.msg import OccupancyGrid
from nav2_msgs.action import NavigateToPose
from geometry_msgs.msg import PoseStamped, Twist
from sensor_msgs.msg import LaserScan
from std_msgs.msg import Empty, String
from tf2_ros import Buffer, TransformListener

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frontier_logic import (  # noqa: E402
    FrontierMemory, MotionWatchdog, choose_frontier, choose_unstick_direction, exploration_result,
    find_frontiers, frontier_still_open, safe_goal, scan_to_points,
)

# Phat ket qua roi cho them chut cho rosbridge/Web nhan truoc khi thoat tien trinh.
EXIT_DELAY_SEC = 3.0
from robot_status import lidar_clearances  # noqa: E402
from retreat_logic import (  # noqa: E402
    RetreatTrail, ReverseFollower, body_scan, turn_clear,
)
from recovery_costmap import CostmapGrid, grid_sweep_clear, scan_sweep_clear  # noqa: E402
from robot_geometry import TURN_CLEARANCE_RADIUS_M  # noqa: E402


def _yaw_from_quat(q):
    return math.atan2(2.0 * (q.w * q.z + q.x * q.y), 1.0 - 2.0 * (q.y * q.y + q.z * q.z))


class FrontierExplorer(Node):
    def __init__(self):
        super().__init__("frontier_explorer")
        p = self.declare_parameter
        self.min_cluster_cells = int(p("min_cluster_cells", 8).value)
        # Chỉ chặn trường hợp đi rất lâu mà vẫn nhúc nhích; kẹt thì stuck_timeout_sec lo.
        self.goal_timeout_sec = float(p("goal_timeout_sec", 60.0).value)
        self.done_checks = int(p("done_checks", 3).value)
        self.save_map_name = str(p("save_map_name", "").value)
        self.memory = FrontierMemory(int(p("max_goal_failures", 2).value))
        # Het cho de di ma van con frontier: mo lai cac cho da bo, thu them toi da N vong.
        self.max_retry_rounds = int(p("max_retry_rounds", 2).value)
        self.retry_rounds = 0
        # Measured 33 x 17 cm body + 4 cm padding (~24.1 cm turning radius).
        # Nav2 and recovery check the actual swept body before changing heading.
        self.goal_clearance_m = float(p("goal_clearance_m", TURN_CLEARANCE_RADIUS_M).value)
        self.goal_search_radius_m = float(p("goal_search_radius_m", 1.5).value)
        # Cho dung thoang gan nhat ma cach xe < muc nay => xe dang dung o cho nhin tot nhat.
        self.min_travel_m = float(p("min_travel_m", 0.35).value)
        # Toi gan dich trong ban kinh nay la tinh toi noi (> xy_goal_tolerance 0.25 cua Nav2).
        self.reach_radius_m = float(p("reach_radius_m", 0.30).value)
        # Toi noi: dung yen cho LiDAR/SLAM cap nhat roi moi xet frontier con hay khong.
        self.settle_sec = float(p("settle_sec", 2.0).value)
        self.stuck_timeout_sec = float(p("stuck_timeout_sec", 8.0).value)
        self.unstick_dist_m = float(p("unstick_dist_m", 0.15).value)
        self.unstick_speed = float(p("unstick_speed", 0.12).value)
        self.retreat_speed = float(p("retreat_speed", 0.08).value)
        self.turn_radius_m = float(p("retreat_turn_radius_m", TURN_CLEARANCE_RADIUS_M).value)
        self.scan_timeout_sec = float(p("retreat_scan_timeout_sec", 0.8).value)
        self.trail = RetreatTrail(max_length=float(p("retreat_history_m", 8.0).value))
        self.scan_received_at = None
        self.recovery_blocked = False
        self.retreat_retry_after = 0.0
        self.last_frontier = None
        self.costmap_msg = None
        self.costmap_received_at = None
        # Dang chay ma frontier dich da duoc LiDAR quet lo ra thi doi dich (kiem tra moi N giay).
        self.replan_check_sec = float(p("replan_check_sec", 2.0).value)
        # BT rieng cho kham pha: khong Wait 5 s / Spin (Pi chan xoay sat tuong), chi lui ra.
        self.bt_xml = str(p(
            "bt_xml", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nav2", "explore_navigate.xml")
        ).value)
        self.map_dir = str(p(
            "map_dir", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "maps"))
        ).value)

        self.map_msg = None
        self.scan_msg = None
        self.goal_handle = None
        self.result_future = None
        self.goal_point = None
        self.goal_frontier = None  # diem frontier goc (goal_point la cho dung thoang gui Nav2)
        self.last_replan_check = 0.0
        self.goal_seq = 0
        self.goal_started = 0.0
        self.busy = False
        # Sau khi huy goal: cho goal cu ket thuc han roi moi gui goal moi / tu lai xe.
        self.draining_future = None
        self.draining_deadline = 0.0
        self.pending_unstick = False
        self.settle = None  # (frontier, het_gio)
        self.maneuver = None  # thoat ket: {"dir", "start", "until"}
        self.watchdog = MotionWatchdog(self.stuck_timeout_sec)
        self.empty_checks = 0
        self.finished = False
        self.visited = 0
        self.stuck_count = 0

        map_qos = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL,
                             reliability=ReliabilityPolicy.RELIABLE)
        self.create_subscription(OccupancyGrid, "/map", self._on_map, map_qos)
        self.create_subscription(OccupancyGrid, "/local_costmap/costmap", self._on_costmap, map_qos)
        self.create_subscription(LaserScan, "/scan", self._on_scan,
                                 QoSProfile(depth=1, reliability=ReliabilityPolicy.BEST_EFFORT))
        self.cmd_pub = self.create_publisher(Twist, "/cmd_vel", 10)
        # Ket qua phien tu quet cho Web (latched: Web ket noi muon van nhan duoc).
        self.status_pub = self.create_publisher(String, "/explore/status", map_qos)
        self.exit_at = None  # time.monotonic() luc thoat tien trinh sau khi bao ket qua
        self.exit_requested = False
        self.create_subscription(Empty, "/robot/nav_cancel", self._on_stop, 10)
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.nav = ActionClient(self, NavigateToPose, "navigate_to_pose")
        self.create_timer(1.0, self._tick)
        self.create_timer(0.1, self._maneuver_step)
        self.create_timer(0.5, self._exit_check)
        self._publish_status({"state": "EXPLORING", "message": "Robot đang tự quét map."})
        self.get_logger().info(
            f"🧭 Frontier explorer sẵn sàng (đích cách vật cản ≥ {self.goal_clearance_m:.2f} m, "
            f"đứng yên {self.stuck_timeout_sec:.0f} s là thoát kẹt), chờ /map và Nav2..."
        )

    def _publish_status(self, result):
        self.status_pub.publish(String(data=json.dumps(result, ensure_ascii=False)))

    def _report_and_exit(self, result):
        """Bao ket qua len Web roi thoat: backend thay explorer tat => MAPPING => Web hoi ten luu map."""
        self._publish_status(result)
        self.get_logger().info(
            f"📣 /explore/status = {result['state']}; thoát explorer sau {EXIT_DELAY_SEC:.0f} s "
            "(SLAM vẫn chạy, lưu map trên Web hoặc save_ros2_map.sh)"
        )
        self.exit_at = time.monotonic() + EXIT_DELAY_SEC

    def _exit_check(self):
        if self.exit_at is not None and time.monotonic() >= self.exit_at:
            self.exit_requested = True

    # ------------------------------------------------------------------ tiện ích
    def _now(self):
        # Dong ho cua node: use_sim_time:=true thi la gio MO PHONG. Gazebo trong WSL
        # thuong chi chay ~0.3x, dem bang gio that thi xe chua kip toi da bi huy dich.
        return self.get_clock().now().nanoseconds * 1e-9

    def _on_map(self, msg):
        self.map_msg = msg

    def _on_costmap(self, msg):
        self.costmap_msg = msg
        self.costmap_received_at = self._now()

    def _costmap_snapshot(self, now):
        msg = self.costmap_msg
        if msg is None or self.costmap_received_at is None:
            return None
        stamp = msg.header.stamp.sec + msg.header.stamp.nanosec * 1e-9
        if not (0 <= now - self.costmap_received_at <= 1.5 and 0 <= now - stamp <= 1.5):
            return None
        if msg.header.frame_id == "odom":
            pose = self._odom_pose()
        else:
            tf = self._lookup(msg.header.frame_id, "base_link")
            if tf is None:
                return None
            tf_stamp = tf.header.stamp.sec + tf.header.stamp.nanosec * 1e-9
            if not 0 <= now - tf_stamp <= 1.0:
                return None
            tr = tf.transform.translation
            pose = (tr.x, tr.y, _yaw_from_quat(tf.transform.rotation))
        if pose is None:
            return None
        origin = msg.info.origin
        grid = CostmapGrid(msg.info.width, msg.info.height, msg.info.resolution,
                           (origin.position.x, origin.position.y, _yaw_from_quat(origin.orientation)), msg.data)
        return grid, pose

    def _motion_allowed(self, vx, wz, points, coverage, snapshot, rotation=None):
        grid, pose = snapshot
        # Account for the real motor's PWM floor, rather than assuming it travels
        # at the smaller velocity requested by the recovery controller.
        if abs(vx) > 1e-6:
            ratio = max(1.0, 0.18 / abs(vx))
            check_vx, check_wz, duration = vx * ratio, wz * ratio, 0.6
        else:
            check_vx, check_wz = 0.0, math.copysign(0.8, wz)
            duration = max(0.5, (abs(rotation or 0.0) + 0.18) / 0.8)
        return (scan_sweep_clear(points, coverage, check_vx, check_wz, duration)
                and grid_sweep_clear(grid, pose, check_vx, check_wz, duration))

    def _on_stop(self, _msg):
        self.finished = True
        self.pending_unstick = False
        self.maneuver = None
        self.busy = False
        if self.goal_handle is not None:
            self.goal_handle.cancel_goal_async()
        self._publish_vx(0.0)
        self.get_logger().info("Đã dừng tự quét và lùi thoát khe theo yêu cầu")
        if self.exit_at is None:
            self._report_and_exit(exploration_result(self.visited, self.stuck_count, [], stopped=True))

    def _on_scan(self, msg):
        self.scan_msg = msg
        self.scan_received_at = self._now()

    def _retreat_scan(self, now):
        s = self.scan_msg
        if s is None or self.scan_received_at is None:
            return [], False
        stamp = s.header.stamp.sec + s.header.stamp.nanosec * 1e-9
        if not (0 <= now - self.scan_received_at <= self.scan_timeout_sec
                and 0 <= now - stamp <= self.scan_timeout_sec):
            return [], False
        return body_scan(s.angle_min, s.angle_increment, s.ranges, s.range_min, s.range_max)

    def _needs_retreat(self):
        if self._now() < self.retreat_retry_after:
            return False
        points, coverage = self._retreat_scan(self._now())
        return (coverage and not turn_clear(points, coverage, self.turn_radius_m)
                and bool(self.trail.route(self._odom_pose())))

    def _lookup(self, parent, child):
        try:
            return self.tf_buffer.lookup_transform(parent, child, Time())
        except Exception:
            return None

    def _robot_xy(self):
        t = self._lookup("map", "base_link")
        return None if t is None else (t.transform.translation.x, t.transform.translation.y)

    def _odom_pose(self):
        """Pose theo odom (encoder/IMU): đo xe có nhúc nhích không, không bị SLAM chỉnh nhảy."""
        t = self._lookup("odom", "base_link")
        if t is None:
            return None
        stamp = t.header.stamp.sec + t.header.stamp.nanosec * 1e-9
        if not 0 <= self._now() - stamp <= 1.0:
            return None
        tr = t.transform.translation
        return (tr.x, tr.y, _yaw_from_quat(t.transform.rotation))

    def _clearances(self):
        """Khoảng hở (cm) từ mép xe tới vật cản 4 phía theo /scan mới nhất."""
        s = self.scan_msg
        if s is None:
            return {}
        return lidar_clearances(scan_to_points(s.angle_min, s.angle_increment, s.ranges))

    def _frontiers(self):
        info = self.map_msg.info
        return find_frontiers(
            self.map_msg.data, info.width, info.height, info.resolution,
            (info.origin.position.x, info.origin.position.y), self.min_cluster_cells,
        )

    def _safe_goal(self, frontier_goal, robot):
        info = self.map_msg.info
        return safe_goal(
            self.map_msg.data, info.width, info.height, info.resolution,
            (info.origin.position.x, info.origin.position.y), frontier_goal, robot,
            clearance_m=self.goal_clearance_m, search_radius_m=self.goal_search_radius_m,
        )

    def _cancel_current(self, now):
        """Huy goal dang chay va doi no ket thuc truoc khi gui goal moi / tu lai xe."""
        if self.goal_handle is not None:
            self.goal_handle.cancel_goal_async()
        self.draining_future = self.result_future
        self.draining_deadline = now + 3.0

    # ------------------------------------------------------------------ vòng chính
    def _tick(self):
        if self.finished or self.recovery_blocked or self.maneuver is not None:
            return
        now = self._now()
        if self.draining_future is not None:
            # Never race a still-running Nav2 action with our reverse publisher.
            if not self.draining_future.done():
                if now >= self.draining_deadline:
                    self.get_logger().error("Chờ Nav2 xác nhận dừng; chưa cho phép tự lùi")
                    self.draining_deadline = now + 5.0
                return
            self.draining_future = None
        if self.pending_unstick:
            self.pending_unstick = False
            if self._start_unstick(now):
                return
        if self.settle is not None:
            spot, until = self.settle
            if now < until:
                return
            self.settle = None
            self._judge_reached(spot)
            if self._needs_retreat():
                self.pending_unstick = True
                return
        if self.busy:
            self._watch_goal(now)
            return
        if self._needs_retreat():
            self._start_unstick(now)
            return
        if self.map_msg is None:
            self.get_logger().warn("Chờ /map từ SLAM; chưa gửi đích tự quét", throttle_duration_sec=5.0)
            return
        if not self.nav.server_is_ready():
            self.get_logger().warn("Chờ Nav2 active (navigate_to_pose); chưa gửi đích tự quét", throttle_duration_sec=5.0)
            return
        robot = self._robot_xy()
        if robot is None:
            return

        frontiers = self._frontiers()
        goal = None
        while True:
            target = choose_frontier(frontiers, robot, self.memory.blacklist())
            if target is None:
                break
            goal = self._safe_goal(target.goal, robot)
            if goal is None:
                # Không có chỗ đứng thoáng gần frontier này (khe hẹp, góc chật): tạm bỏ.
                self.get_logger().warn(
                    f"Bỏ frontier ({target.goal[0]:.2f}, {target.goal[1]:.2f}): không có chỗ đứng cách "
                    f"vật cản ≥ {self.goal_clearance_m:.2f} m trong {self.goal_search_radius_m:.1f} m"
                )
                self.memory.give_up(target.goal)
                continue
            if math.hypot(goal[0] - robot[0], goal[1] - robot[1]) < self.min_travel_m:
                self._mark_blind(target.goal)
                goal = None
                continue
            break
        if target is None:
            if frontiers and self.retry_rounds < self.max_retry_rounds:
                reopened = self.memory.retry_round()
                if reopened:
                    self.retry_rounds += 1
                    self.empty_checks = 0
                    self.get_logger().info(
                        f"🔁 Hết chỗ để đi nhưng còn {len(frontiers)} cụm frontier: thử lại {reopened} chỗ "
                        f"đã bỏ (vòng {self.retry_rounds}/{self.max_retry_rounds})"
                    )
                    return
            self.empty_checks += 1
            if self.empty_checks >= self.done_checks:
                self._finish(frontiers)
            return
        self.empty_checks = 0
        self._send_goal(goal, target.goal, robot, len(frontiers))

    def _watch_goal(self, now):
        # 1. Tới gần đích: tự dừng (khỏi chờ Nav2 xoay đúng hướng đích - sát tường Pi chặn xoay).
        robot = self._robot_xy()
        if (robot is not None and self.goal_point is not None
                and math.hypot(self.goal_point[0] - robot[0], self.goal_point[1] - robot[1]) <= self.reach_radius_m):
            self._cancel_current(now)
            self._goal_finished(success=True, seq=self.goal_seq)
            return
        # 2. Đứng yên quá lâu dù đang có đích: Pi chặn lệnh / vướng => huỷ, thoát kẹt, chọn chỗ khác.
        if self.goal_handle is not None and self.watchdog.is_stuck(now, self._odom_pose()):
            self.stuck_count += 1
            c = self._clearances()
            self.get_logger().warn(
                f"⛔ Xe đứng yên {self.stuck_timeout_sec:.0f} s dù có đích (Pi chặn lệnh hoặc vướng). "
                f"Khoảng hở LiDAR(cm) trước {self._cm(c.get('front'))} sau {self._cm(c.get('rear'))} "
                f"trái {self._cm(c.get('left'))} phải {self._cm(c.get('right'))} -> huỷ, thoát kẹt, thử chỗ khác"
            )
            self._cancel_current(now)
            self.pending_unstick = True
            self._goal_finished(success=False, seq=self.goal_seq)
            return
        # 3. Quá lâu (vẫn nhúc nhích nhưng không tới).
        if now - self.goal_started > self.goal_timeout_sec and self.goal_handle:
            self.get_logger().warn("⏱️ Quá thời gian tới frontier, huỷ và thử chỗ khác")
            self._cancel_current(now)
            self.pending_unstick = True
            self._goal_finished(success=False, seq=self.goal_seq)
            return
        # 4. LiDAR đã quét lộ frontier đích từ xa: đổi đích (tick sau, khi goal cũ đã dừng).
        if (self.goal_handle is None or self.map_msg is None
                or now - self.last_replan_check < self.replan_check_sec):
            return
        self.last_replan_check = now
        if frontier_still_open(self._frontiers(), self.goal_frontier):
            return
        self.get_logger().info("👀 Frontier đích đã quét xong từ xa, chuyển sang frontier kế tiếp")
        self._cancel_current(now)
        self._goal_finished(success=True, seq=self.goal_seq, vanished=True)

    @staticmethod
    def _cm(v):
        return "-" if v is None else f"{v:.0f}"

    # ------------------------------------------------------------------ goal Nav2
    def _send_goal(self, goal, frontier, robot, n_frontiers):
        pose = PoseStamped()
        pose.header.frame_id = "map"
        pose.header.stamp = self.get_clock().now().to_msg()
        pose.pose.position.x, pose.pose.position.y = goal
        yaw = math.atan2(goal[1] - robot[1], goal[0] - robot[0])
        pose.pose.orientation.z = math.sin(yaw / 2.0)
        pose.pose.orientation.w = math.cos(yaw / 2.0)

        msg = NavigateToPose.Goal()
        msg.pose = pose
        if self.bt_xml and os.path.isfile(self.bt_xml):
            msg.behavior_tree = self.bt_xml
        self.busy = True
        self.goal_seq += 1
        seq = self.goal_seq
        self.goal_point = goal
        self.goal_frontier = frontier
        self.goal_handle = None
        self.result_future = None
        self.goal_started = self._now()
        self.last_replan_check = self.goal_started
        self.watchdog.reset(self.goal_started, self._odom_pose())
        self.get_logger().info(
            f"➡️ Tới chỗ quét ({goal[0]:.2f}, {goal[1]:.2f}) cho frontier ({frontier[0]:.2f}, {frontier[1]:.2f})"
            f" - còn {n_frontiers} cụm, đã thăm {self.visited}"
        )
        self.nav.send_goal_async(msg).add_done_callback(lambda f: self._on_goal_response(f, seq))

    def _on_goal_response(self, future, seq):
        handle = future.result()
        if seq != self.goal_seq or not self.busy:
            # Dich da bi bo (timeout / toi noi / thay the) truoc khi Nav2 kip nhan: huy no luon.
            if handle.accepted:
                handle.cancel_goal_async()
            return
        if not handle.accepted:
            self.get_logger().warn("Nav2 từ chối đích, bỏ qua frontier này")
            self._goal_finished(success=False, seq=seq)
            return
        self.goal_handle = handle
        self.result_future = handle.get_result_async()
        self.result_future.add_done_callback(
            lambda f: self._on_nav_result(f, seq)
        )

    def _on_nav_result(self, future, seq):
        # Nav2 co the ABORT truoc watchdog 8 s (khong tim duoc quy dao / xoay bi chan).
        # Neu chi doi frontier, moi goal moi lai reset watchdog va xe khong bao gio lui.
        # Ket qua goal cu / goal da huy khong duoc kich hoat thoat ket cho goal moi.
        if not self.busy or seq != self.goal_seq:
            return
        status = future.result().status
        if status == 6:  # action_msgs/GoalStatus.STATUS_ABORTED
            self.get_logger().warn("Nav2 báo thất bại: thử thoát kẹt thẳng trước khi chọn đích khác")
            self.pending_unstick = True
        self._goal_finished(success=(status == 4), seq=seq)

    def _goal_finished(self, success, seq=None, vanished=False):
        if not self.busy or (seq is not None and seq != self.goal_seq):
            return
        spot = self.goal_frontier
        self.last_frontier = spot
        self.busy = False
        self.goal_handle = None
        self.goal_point = None
        self.goal_frontier = None
        if spot is None:
            return
        if vanished:
            self.visited += 1
            self.memory.mark_done(spot)
            if self._needs_retreat():
                self.pending_unstick = True
        elif success:
            self.visited += 1
            # Đứng yên cho LiDAR/SLAM cập nhật rồi mới xét (xem _judge_reached).
            self.settle = (spot, self._now() + self.settle_sec)
        elif self.memory.record_failure(spot):
            self.get_logger().warn(
                f"Bỏ frontier ({spot[0]:.2f}, {spot[1]:.2f}) sau {self.memory.max_attempts} lần chưa tới được"
            )
        else:
            self.get_logger().warn("Chưa tới được chỗ quét, sẽ thử lại sau")

    def _judge_reached(self, spot):
        if self.map_msg is not None and frontier_still_open(self._frontiers(), spot):
            self._mark_blind(spot)
        else:
            self.memory.mark_done(spot)

    def _mark_blind(self, spot):
        # Đã đứng ở chỗ nhìn tốt nhất mà vẫn chưa biết: kính, đồ màu đen, gầm tủ, khe xe không vào được.
        self.get_logger().info(
            f"🙈 Đứng ở chỗ nhìn tốt nhất mà frontier ({spot[0]:.2f}, {spot[1]:.2f}) vẫn còn "
            "(điểm mù LiDAR / khe hẹp): bỏ qua"
        )
        self.memory.mark_blind(spot)

    # ------------------------------------------------------------------ thoát kẹt
    def _recovery_missing(self, now, pose, coverage, snapshot):
        missing = []
        if pose is None:
            missing.append("TF odom->base_link thiếu hoặc cũ hơn 1.0 s")
        if not coverage:
            s = self.scan_msg
            if s is None or self.scan_received_at is None:
                missing.append("chưa nhận /scan")
            else:
                stamp = s.header.stamp.sec + s.header.stamp.nanosec * 1e-9
                receive_age, scan_age = now - self.scan_received_at, now - stamp
                if not (0 <= receive_age <= self.scan_timeout_sec and 0 <= scan_age <= self.scan_timeout_sec):
                    missing.append(f"scan chưa mới: nhận {receive_age:.2f} s, timestamp {scan_age:.2f} s "
                                   f"(giới hạn {self.scan_timeout_sec:.2f} s)")
                else:
                    missing.append("scan chưa đủ 24 vùng góc")
        if snapshot is None:
            missing.append("local costmap chưa sẵn sàng/mới trong 1.5 s")
        return "; ".join(missing)

    def _start_unstick(self, now):
        points, coverage = self._retreat_scan(now)
        start = self._odom_pose()
        snapshot = self._costmap_snapshot(now)
        missing = self._recovery_missing(now, start, coverage, snapshot)
        if missing:
            # Just after canceling a turn, the bridge may still be suppressing
            # distorted scans. Hold still and let fresh scans/TF arrive first.
            self.maneuver = {"awaiting_sensors": True, "blocked_since": now}
            self._publish_vx(0.0)
            self.get_logger().warn(f"Chờ dữ liệu mới trước khi thoát kẹt: {missing}")
            return True
        route = self.trail.route(start)
        if route and not turn_clear(points, coverage, self.turn_radius_m):
            self.maneuver = {
                "follower": ReverseFollower(route, self.retreat_speed),
                "start": start, "until": now + 120.0,
                "watchdog": MotionWatchdog(5.0, min_move_m=0.025, min_turn_rad=10.0),
                "turn_watchdog": MotionWatchdog(6.0, min_move_m=0.025, min_turn_rad=0.08),
            }
            self.maneuver["watchdog"].reset(now, start)
            self.maneuver["turn_watchdog"].reset(now, start)
            self.get_logger().info(
                f"↩️ Thoát theo {len(route)} mốc đường cũ; quay/chỉnh hướng theo LiDAR + costmap xe thật"
            )
            return True
        c = self._clearances()
        direction = choose_unstick_direction(c.get("front"), c.get("rear"),
                                             min_front_cm=24.0, min_rear_cm=20.0)
        if direction is None or start is None:
            self.get_logger().warn(
                f"Kẹt cả trước (≈{self._cm(c.get('front'))} cm) lẫn sau (≈{self._cm(c.get('rear'))} cm): "
                "không tự thoát, thử chỗ khác (nếu vẫn kẹt hãy dời xe ra chỗ thoáng)"
            )
            return False
        self.maneuver = {"dir": direction, "start": start, "until": now + 4.0}
        self.get_logger().info(
            f"↩️ Thoát kẹt: {'tiến' if direction == 'forward' else 'lùi'} thẳng {self.unstick_dist_m:.2f} m "
            f"(trước {self._cm(c.get('front'))} cm, sau {self._cm(c.get('rear'))} cm)"
        )
        return True

    def _publish_vx(self, vx):
        self._publish_motion(vx, 0.0)

    def _publish_motion(self, vx, wz):
        t = Twist()
        t.linear.x = float(vx)
        t.angular.z = float(wz)
        self.cmd_pub.publish(t)

    def _stop_recovery(self, reason):
        self._publish_vx(0.0)
        self.maneuver = None
        self.recovery_blocked = True
        self.get_logger().error(f"⛔ Tạm dừng tự hành: {reason}. Kiểm tra/lái tay ra chỗ rộng rồi khởi động lại tự quét.")

    def _retry_navigation(self, now, reason):
        self._publish_vx(0.0)
        self.maneuver = None
        self.pending_unstick = False
        self.retreat_retry_after = now + 8.0
        if self.last_frontier is not None:
            self.memory.give_up(self.last_frontier)
        self.get_logger().warn(f"Đổi đường/đích quét: {reason}; giao lại Nav2 với costmap")

    def _wait_recovery(self, now, reason, fatal=False):
        self._publish_vx(0.0)
        m = self.maneuver
        since = m.setdefault("blocked_since", now)
        self.get_logger().warn(reason, throttle_duration_sec=2.0)
        if now - since >= (5.0 if fatal else 2.0):
            if fatal:
                self._stop_recovery(reason)
            else:
                self._retry_navigation(now, reason)

    def _maneuver_step(self):
        m = self.maneuver
        now = self._now()
        pose = self._odom_pose()
        points, coverage = self._retreat_scan(now)
        if m is None:
            if not self.recovery_blocked and coverage and pose is not None:
                # Preserve valid anchors through a brief scan/TF gap. record()
                # still rejects an odometry jump once observations resume.
                self.trail.record(pose, turn_clear(points, coverage, self.turn_radius_m))
            return
        snapshot = self._costmap_snapshot(now)
        if m.get("awaiting_sensors"):
            self._publish_vx(0.0)
            missing = self._recovery_missing(now, pose, coverage, snapshot)
            if missing:
                m.pop("ready_since", None)
                self._wait_recovery(now, f"Chờ dữ liệu mới trước khi thoát kẹt: {missing}", fatal=True)
            elif now - m.setdefault("ready_since", now) >= 0.3:
                self.maneuver = None
                self.get_logger().info("LiDAR, odom và costmap đã sẵn sàng ổn định; tiếp tục thoát kẹt")
                self._start_unstick(now)
            return
        if pose is None or not coverage:
            missing = self._recovery_missing(now, pose, coverage, snapshot)
            self._wait_recovery(now, f"Chờ dữ liệu để thoát khe: {missing}", fatal=True)
            return
        if snapshot is None:
            self._wait_recovery(now, "Chờ local costmap xe thật (quá 1.5 s hoặc chưa nhận)", fatal=True)
            return
        if "follower" in m:
            vx, wz, reason = m["follower"].command(pose)
            if reason == "arrived":
                self._publish_vx(0.0)
                self.maneuver = None
                self.trail.points.clear()
                if not turn_clear(points, coverage, self.turn_radius_m):
                    self._retry_navigation(now, "Đã về mốc cũ; để Nav2 chọn hướng qua costmap hiện tại")
                else:
                    self.get_logger().info("↩️ Đã lùi ra chỗ đủ rộng, tiếp tục chọn frontier")
                return
            if reason == "path_lost":
                self._retry_navigation(now, m["follower"].diagnostic)
                return
            if reason == "align":
                m["watchdog"].reset(now, pose)
                if m["turn_watchdog"].is_stuck(now, pose):
                    self._retry_navigation(now, "Quay không tiến triển (sonar hoặc motor chặn)")
                    return
                # Try in-place alignment, then a short reverse/forward arc if its
                # complete swept footprint fits. A large angle alone is no veto.
                sign = math.copysign(1.0, wz)
                candidates = [(0.0, wz), (-self.retreat_speed, sign * self.retreat_speed * 2),
                              (self.retreat_speed, sign * self.retreat_speed * 2)]
                for vx_try, wz_try in candidates:
                    if self._motion_allowed(vx_try, wz_try, points, coverage, snapshot,
                                            rotation=m["follower"].heading_error):
                        m.pop("blocked_since", None)
                        if not m.get("align_logged"):
                            self.get_logger().info(f"↪️ {m['follower'].diagnostic}; vùng quay đã kiểm tra bằng costmap + LiDAR")
                            m["align_logged"] = True
                        self._publish_motion(vx_try, wz_try)
                        return
                self._wait_recovery(now, "Vùng quay/rẽ đang vướng vật cản; thử đường khác")
                return
            m["turn_watchdog"].reset(now, pose)
            m.pop("align_logged", None)
            if now > m["until"] or m["watchdog"].is_stuck(now, pose):
                self._retry_navigation(now, "Lùi không có tiến triển hoặc quá thời gian")
                return
            if not self._motion_allowed(vx, wz, points, coverage, snapshot):
                self._wait_recovery(now, "Vật cản trên đường lùi theo costmap/LiDAR")
                return
            m.pop("blocked_since", None)
            self._publish_motion(vx, wz)
            return
        vx = self.unstick_speed if m["dir"] == "forward" else -self.unstick_speed
        if not self._motion_allowed(vx, 0.0, points, coverage, snapshot):
            self._wait_recovery(now, "Vật cản trên đoạn thoát kẹt ngắn theo costmap/LiDAR")
            return
        moved = 0.0 if pose is None else math.hypot(pose[0] - m["start"][0], pose[1] - m["start"][1])
        side = "front" if m["dir"] == "forward" else "rear"
        gap = self._clearances().get(side)
        too_close = gap is not None and gap < (22.0 if side == "front" else 16.0)
        if moved >= self.unstick_dist_m or now > m["until"] or too_close:
            for _ in range(3):
                self._publish_vx(0.0)
            self.maneuver = None
            self.get_logger().info(f"↩️ Thoát kẹt xong: đã đi {moved:.2f} m")
            return
        m.pop("blocked_since", None)
        self._publish_vx(vx)

    # ------------------------------------------------------------------ kết thúc
    def _finish(self, frontiers):
        self.finished = True
        left = ", ".join(f"({f.goal[0]:.2f}, {f.goal[1]:.2f})" for f in frontiers[:6])
        result = exploration_result(self.visited, self.stuck_count, frontiers)
        if self.visited == 0:
            # Chưa tới được điểm nào: gần như chắc chắn Nav2/TF/motor có lỗi chứ không
            # phải đã quét xong. Không lưu để khỏi ghi đè bằng một map gần như trống.
            self.get_logger().error(
                f"❌ Dừng khám phá: chưa tới được frontier nào ({len(frontiers)} cụm còn lại: {left}). "
                "Kiểm tra log Nav2 (controller_server/bt_navigator) và motor. KHÔNG lưu map."
            )
            self._report_and_exit(result)
            return
        self.get_logger().info(
            f"🎉 Khám phá xong: đã thăm {self.visited} chỗ, thoát kẹt {self.stuck_count} lần, "
            f"còn {len(frontiers)} cụm không tới/không thấy được" + (f": {left}" if left else "")
        )
        if self.save_map_name:
            self._save_map(result)  # bao ket qua + thoat sau khi luu xong
        else:
            self._report_and_exit(result)

    def _save_map(self, result):
        """Lưu /map bằng map_saver_cli (danh sách đối số, không qua shell).

        Không dùng /slam_toolbox/save_map: SLAM Toolbox ghép đường dẫn vào lệnh shell
        không có ngoặc kép, thư mục dự án có dấu cách + ngoặc => lệnh vỡ, không ra file.
        """
        path = os.path.join(self.map_dir, self.save_map_name)
        os.makedirs(self.map_dir, exist_ok=True)
        logger = self.get_logger()

        def worker():
            cmd = [
                "ros2", "run", "nav2_map_server", "map_saver_cli", "-f", path,
                "--ros-args", "-p", "map_subscribe_transient_local:=true",
            ]
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                ok = proc.returncode == 0 and os.path.isfile(path + ".yaml") and os.path.isfile(path + ".pgm")
                detail = " | ".join((proc.stderr or proc.stdout or "").strip().splitlines()[-3:])
            except (OSError, subprocess.TimeoutExpired) as exc:
                ok, detail = False, str(exc)
            if ok:
                logger.info(f"💾 Đã lưu map: {path}.yaml / .pgm")
                result["saved_map"] = self.save_map_name
                result["message"] += f" Đã tự lưu map '{self.save_map_name}'."
            else:
                logger.error(f"❌ Lưu map thất bại {path}: {detail}")
                result["message"] += f" Tự lưu map '{self.save_map_name}' thất bại, hãy lưu trên Web."
            self._report_and_exit(result)

        threading.Thread(target=worker, daemon=True).start()


def main():
    rclpy.init()
    node = FrontierExplorer()
    try:
        # Quet xong / bi dung => node tu dat exit_requested (sau khi bao /explore/status)
        while rclpy.ok() and not node.exit_requested:
            rclpy.spin_once(node, timeout_sec=0.2)
        if node.exit_requested:
            node.get_logger().info("👋 Thoát frontier explorer (SLAM vẫn chạy để lưu map)")
    except KeyboardInterrupt:
        pass
    finally:
        try:
            node._publish_vx(0.0)
        except Exception:  # context da tat (Ctrl+C) - khong con gi de dung
            pass
        node.destroy_node()
        rclpy.try_shutdown()


if __name__ == "__main__":
    main()
