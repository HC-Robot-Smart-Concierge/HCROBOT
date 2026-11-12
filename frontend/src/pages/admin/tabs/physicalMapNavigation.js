import { createGoalPoseMsg, ROS_MSG_TYPES, ROS_TOPICS } from '../../../services/rosbridgeService';

export function amclPoseIsReliable(msg) {
  const pose = msg?.pose?.pose;
  const covariance = msg?.pose?.covariance;
  if (!pose || !Array.isArray(covariance) || covariance.length !== 36
      || ![pose.position?.x, pose.position?.y, pose.orientation?.z, pose.orientation?.w,
        covariance[0], covariance[1], covariance[6], covariance[7], covariance[35]].every(Number.isFinite)
      || covariance[0] < 0 || covariance[7] < 0 || covariance[35] < 0) return false;
  const xy = (covariance[1] + covariance[6]) / 2;
  // Bound uncertainty along the worst horizontal axis, including x/y correlation.
  const maxVariance = (covariance[0] + covariance[7]
    + Math.hypot(covariance[0] - covariance[7], 2 * xy)) / 2;
  if (xy * xy > covariance[0] * covariance[7] + 1e-12) return false;
  return maxVariance <= 0.25 ** 2 && covariance[35] <= (20 * Math.PI / 180) ** 2;
}

// Trang thai tu localization_manager.py tren robot (/localization/state, phat 1 Hz). Co tin moi
// => Web CHI hien thi trang thai nay (manager da so LiDAR voi map, khong chi covariance). Im lang
// qua lau (stack cu khong co manager) => fresh=false, Web dung kiem tra AMCL rieng.
export const LOCALIZATION_STALE_MS = 5000;

export function localizationFromManager(msg, receivedAt, now = Date.now()) {
  if (!msg || !receivedAt || now - receivedAt > LOCALIZATION_STALE_MS) {
    return { fresh: false, localized: false, label: '', reason: '', tone: 'neutral' };
  }
  const match = Number.isFinite(msg.score) ? ` · LiDAR khớp ${Math.round(msg.score * 100)}%` : '';
  const reason = msg.reason || '';
  switch (msg.state) {
    case 'LOCALIZED':
      return { fresh: true, localized: true, label: `Đã định vị${match}`, reason, tone: 'good' };
    case 'LOCALIZING':
      return { fresh: true, localized: false, label: `Đang xác minh vị trí${match}`, reason, tone: 'busy' };
    case 'LOCALIZATION_LOST':
      return { fresh: true, localized: false, label: 'Mất định vị', reason, tone: 'bad' };
    default:
      return { fresh: true, localized: false, label: 'Chưa định vị', reason, tone: 'bad' };
  }
}

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

// parseLaserScan supplies degrees + distance; LiDAR is centred on base_link.
export function laserPointToMap(point, pose) {
  if (!Number.isFinite(point.distance) || !Number.isFinite(point.angle)) return null;
  const angle = pose.yaw + point.angle * Math.PI / 180;
  return {
    // LiDAR is centred on the 33 x 17 cm body (base_link); no extra XY offset.
    x: pose.x + point.distance * Math.cos(angle),
    y: pose.y + point.distance * Math.sin(angle),
  };
}

// Xe 33 x 17 cm xoay tai cho quet vong ban kinh ~18.6 cm; Pi chi cho xoay khi sieu am ben quay
// > 11 cm (mo khoa lai tu 13 cm) => tam xe can cach tuong ~21.5 cm. Lay 25 cm (= robot_geometry
// TURN_CLEARANCE_RADIUS_M, frontier_explorer goal_clearance_m) cho ca sai so o costmap.
export const TURN_CLEARANCE_M = 0.25;

// Khoang cach (m) tu (x, y) toi TAM o vat can that (100 = tuong / vung cam han) gan nhat trong
// ban kinh radiusM; khong co o nao (hoac khong co costmap) => Infinity. O 1..99 (dem inflation)
// khong tinh: do chi la chi phi, khong phai vat can.
export function obstacleClearanceAt(costmap, x, y, radiusM) {
  if (!costmap?.info || (!Array.isArray(costmap.data) && !ArrayBuffer.isView(costmap.data))) return Infinity;
  const { width, height, resolution: res, origin } = costmap.info;
  const yaw = 2 * Math.atan2(origin.orientation?.z || 0, origin.orientation?.w ?? 1);
  const dx = x - origin.position.x;
  const dy = y - origin.position.y;
  const lx = Math.cos(yaw) * dx + Math.sin(yaw) * dy; // toa do trong khung costmap
  const ly = -Math.sin(yaw) * dx + Math.cos(yaw) * dy;
  const r = Math.ceil(radiusM / res);
  const cx = Math.floor(lx / res);
  const cy = Math.floor(ly / res);
  let best = Infinity;
  for (let j = Math.max(0, cy - r); j <= Math.min(height - 1, cy + r); j += 1) {
    for (let i = Math.max(0, cx - r); i <= Math.min(width - 1, cx + r); i += 1) {
      if (costmap.data[j * width + i] < 100) continue;
      const d = Math.hypot((i + 0.5) * res - lx, (j + 0.5) * res - ly);
      if (d <= radiusM && d < best) best = d;
    }
  }
  return best;
}

export function navigationBlockingReason({ connected, runtime, mapId, physical, localized, localizationReason,
  poseAt = 0, costmapAt = 0, health, healthAt = 0, now = Date.now() }) {
  if (!connected) return 'Chưa kết nối Nav2 trên laptop. Bấm “Bật Nav2 với map này”.';
  if (runtime.mode !== 'NAVIGATION') return `Nav2 chưa sẵn sàng (${runtime.mode}). Bật Navigation với map đang chọn trước.`;
  if (runtime.activeMap !== mapId) return 'Map Nav2 chưa khớp map đang chọn. Bật Nav2 với map này.';
  if (physical && !localized) {
    return localizationReason
      || 'Hãy đặt vị trí ban đầu bằng “Chọn trên map” hoặc “Đặt tại Dock”, rồi đợi AMCL xác nhận.';
  }
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
