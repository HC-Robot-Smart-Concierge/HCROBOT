import { createGoalPoseMsg, ROS_MSG_TYPES, ROS_TOPICS } from '../../../services/rosbridgeService';

export function composeMapPose(mapToOdom, odom) {
  if (!mapToOdom || !odom) return null;
  const c = Math.cos(mapToOdom.yaw);
  const s = Math.sin(mapToOdom.yaw);
  return {
    x: mapToOdom.x + c * odom.x - s * odom.y,
    y: mapToOdom.y + s * odom.x + c * odom.y,
    yaw: mapToOdom.yaw + odom.yaw,
    linearVelocity: odom.linearVelocity || 0,
    angularVelocity: odom.angularVelocity || 0,
  };
}

// parseLaserScan supplies degrees + distance; the laser is 8 cm ahead of base_link.
export function laserPointToMap(point, pose) {
  if (!Number.isFinite(point.distance) || !Number.isFinite(point.angle)) return null;
  const angle = pose.yaw + point.angle * Math.PI / 180;
  return {
    x: pose.x + 0.08 * Math.cos(pose.yaw) + point.distance * Math.cos(angle),
    y: pose.y + 0.08 * Math.sin(pose.yaw) + point.distance * Math.sin(angle),
  };
}

export function navigationBlockingReason({ connected, runtime, mapId, physical, localized,
  poseAt = 0, costmapAt = 0, health, healthAt = 0, now = Date.now() }) {
  if (!connected) return 'Chưa kết nối Nav2 trên laptop. Bấm “Bật Nav2 với map này”.';
  if (runtime.mode !== 'NAVIGATION') return `Nav2 chưa sẵn sàng (${runtime.mode}). Bật Navigation với map đang chọn trước.`;
  if (runtime.activeMap !== mapId) return 'Map Nav2 chưa khớp map đang chọn. Bật Nav2 với map này.';
  if (physical && !localized) return 'Hãy đặt vị trí ban đầu bằng “Chọn trên map” hoặc “Đặt tại Dock”, rồi đợi AMCL xác nhận.';
  if (!poseAt || now - poseAt > 2000) return 'Chưa có vị trí robot mới trong hệ tọa độ map. Kiểm tra AMCL/TF.';
  if (!costmapAt || now - costmapAt > 3000) return 'Chưa nhận costmap Nav2 mới. Đợi Navigation khởi động xong.';
  if (physical && (!healthAt || now - healthAt > 3000 || !health?.pi_ws_connected || !health?.lidar_live
    || !(health.encoder_packets > 0) || !Number.isFinite(health.last_encoder_age_sec) || health.last_encoder_age_sec > 1.5)) {
    return 'Pi/LiDAR/encoder chưa sẵn sàng. Kiểm tra kết nối xe thật với bridge.';
  }
  return null;
}

export function sendNav2Endpoint(client, state, target, config, costmap) {
  const reason = navigationBlockingReason({ ...state, connected: !!client?.isConnected });
  if (reason) throw new Error(reason);
  if (![target.x, target.y, target.yaw].every(Number.isFinite)) throw new Error('Tọa độ endpoint không hợp lệ.');
  if (target.x < config.originX || target.y < config.originY
      || target.x >= config.originX + config.widthMeters || target.y >= config.originY + config.heightMeters) {
    throw new Error('Endpoint nằm ngoài bản đồ đang chọn.');
  }
  if (!costmap || String(costmap.header?.frame_id).replace(/^\//, '') !== 'map') {
    throw new Error('Costmap chưa ở hệ tọa độ map.');
  }
  const { width, height, resolution, origin } = costmap.info;
  const yaw = 2 * Math.atan2(origin.orientation?.z || 0, origin.orientation?.w ?? 1);
  const dx = target.x - origin.position.x;
  const dy = target.y - origin.position.y;
  const cx = Math.floor((Math.cos(yaw) * dx + Math.sin(yaw) * dy) / resolution);
  const cy = Math.floor((-Math.sin(yaw) * dx + Math.cos(yaw) * dy) / resolution);
  const value = costmap.data?.[cy * width + cx];
  if (cx < 0 || cy < 0 || cx >= width || cy >= height || !Number.isFinite(value) || value < 0 || value >= 99) {
    throw new Error('Endpoint nằm trong vật cản, vùng cấm hoặc vùng chưa đi được. Chọn điểm trống khác.');
  }
  if (!client.publish(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED,
    createGoalPoseMsg(target.x, target.y, target.yaw))) {
    throw new Error('Mất kết nối khi gửi endpoint tới Nav2.');
  }
}
