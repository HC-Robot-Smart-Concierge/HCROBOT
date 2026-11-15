import { isPointInZone, isPolygonZone, zoneBounds } from '../physicalMapZones';

// Danh sach toa do cac diem moc Sanh Tang Tret (Ground Floor - Lobby Arena 9.80m x 6.30m)
// Robot mac dinh o vi tri truc Khu Vuc Phia Bac cua Lobby (x: 3.6, y: 4.8)
export const ROBOT_INITIAL_POSE = { x: 7.2, y: 9.6, yaw: -Math.PI / 2 };
export const FRONT_DOOR_APPROACH = { x: 0.90, y: 6.25 };

export const GAZEBO_LOBBY_WAYPOINTS = {
  ROBOT_STANDBY: {
    x: 7.2,
    y: 9.6,
    name: 'Vị Trí Chờ Robot Sảnh (Phía Bắc)',
    badge: 'Robot Sảnh',
    label: 'Vị Trí Robot Sảnh',
    role: 'standby',
    offset: 'bottom',
  },
  CHARGER_STATION: {
    x: 6.0,
    y: 9.6,
    name: 'Trạm Sạc Robot Sảnh',
    badge: 'Trạm Sạc',
    label: 'Trạm Sạc Robot Sảnh',
    role: 'charger',
    offset: 'bottom',
  },
  LOBBY_LOUNGE: {
    x: 3.6,
    y: 7.2,
    name: 'Khu Sofa Sảnh (Lobby Lounge)',
    badge: 'Khu Sofa Sảnh',
    label: 'Khu Sofa Sảnh',
    role: 'lounge',
    offset: 'top',
  },
  MAIN_ENTRANCE: {
    ...FRONT_DOOR_APPROACH,
    name: 'Cửa Chính Ra Vào Sảnh',
    badge: 'Cửa Chính Sảnh',
    label: 'Cửa Chính Ra Vào Sảnh',
    role: 'entrance',
    offset: 'top',
  },
  FRONT_DESK: {
    x: 11.44,
    y: 2.8,
    name: 'Trước Quầy Lễ Tân (Front Desk)',
    badge: 'Quầy Lễ Tân',
    label: 'Trước Quầy Lễ Tân (Front Desk)',
    role: 'facility',
    offset: 'top',
  },
  ELEVATOR: {
    x: 15.6,
    y: 6.96,
    name: 'Cụm Thang Máy Tầng 1',
    badge: 'Thang Máy',
    label: 'Cụm Thang Máy',
    role: 'facility',
    offset: 'bottom',
  },
  RESTROOMS: {
    x: 15.2,
    y: 2.4,
    name: 'Nhà Vệ Sinh Sảnh (Restrooms)',
    badge: 'Nhà Vệ Sinh (WC)',
    label: 'Nhà Vệ Sinh (WC)',
    role: 'facility',
    offset: 'bottom',
  },
  STAIRS: {
    x: 16.0,
    y: 4.8,
    name: 'Lối Thoát Hiểm Khẩn Cấp',
    badge: 'Thoát Hiểm',
    label: 'Lối Thoát Hiểm Khẩn Cấp',
    role: 'facility',
    offset: 'bottom',
  },
  STAFF_ONLY: {
    x: 11.44,
    y: 6.4,
    name: 'Trước Phòng Nội Bộ (Staff Only)',
    badge: 'Phòng Nội Bộ',
    label: 'Trước Phòng Nội Bộ (Staff Only)',
    role: 'staff',
    offset: 'bottom',
  },
  CENTRAL_LOBBY: {
    x: 8.4,
    y: 6.4,
    name: 'Khu Vực Trung Tâm Sảnh',
    badge: 'Trung Tâm Sảnh',
    label: 'Khu Vực Trung Tâm Sảnh',
    role: 'area',
    offset: 'top',
  },
  // Backward compatibility aliases
  ZONE_LOBBY: { ...FRONT_DOOR_APPROACH, badge: 'Cửa Chính Sảnh', label: 'Cửa Chính Sảnh' },
  DOCK_LOBBY: { x: 7.2, y: 9.6, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  DOCK_01: { x: 7.2, y: 9.6, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  HOTSPOT_LOBBY: { x: 8.4, y: 6.4, badge: 'Trung Tâm Sảnh', label: 'Khu Vực Trung Tâm Sảnh' },
  RESTAURANT_GATE: { x: 11.44, y: 2.8, badge: 'Quầy Lễ Tân', label: 'Quầy Lễ Tân (Front Desk)' },
  CORRIDOR_NORTH: { x: 15.2, y: 2.4, badge: 'Nhà Vệ Sinh (WC)', label: 'Nhà Vệ Sinh (WC)' },
  LOBBY_NORTHEAST: { x: 15.6, y: 6.96, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
  ELEVATOR_CLUSTER: { x: 15.6, y: 6.96, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
};

// Danh sach 8 diem moc chuan Lobby de su dung thong nhat giua Builder va Studio
export const STANDARD_LOBBY_WAYPOINTS = [
  { id: 'ROBOT_STANDBY', key: 'ROBOT_STANDBY', name: 'Vị Trí Chờ Robot Sảnh', type: 'PARK', x: 7.2, y: 9.6, floor: 'Sảnh Tầng 1' },
  { id: 'CHARGER_STATION', key: 'CHARGER_STATION', name: 'Trạm Sạc Robot Sảnh', type: 'CHARGER', x: 6.0, y: 9.6, floor: 'Sảnh Tầng 1' },
  { id: 'MAIN_ENTRANCE', key: 'MAIN_ENTRANCE', name: 'Cửa Chính Sảnh (Main Entrance)', type: 'WAYPOINT', ...FRONT_DOOR_APPROACH, floor: 'Sảnh Tầng 1' },
  { id: 'FRONT_DESK', key: 'FRONT_DESK', name: 'Trước Quầy Lễ Tân (Front Desk)', type: 'WAYPOINT', x: 11.44, y: 2.8, floor: 'Sảnh Tầng 1' },
  { id: 'STAFF_ONLY', key: 'STAFF_ONLY', name: 'Trước Phòng Nội Bộ (Staff Only)', type: 'WAYPOINT', x: 11.44, y: 6.4, floor: 'Sảnh Tầng 1' },
  { id: 'ELEVATOR', key: 'ELEVATOR', name: 'Cụm Thang Máy Tầng 1', type: 'WAYPOINT', x: 15.6, y: 6.96, floor: 'Sảnh Tầng 1' },
  { id: 'RESTROOMS', key: 'RESTROOMS', name: 'Nhà Vệ Sinh Sảnh (WC)', type: 'WAYPOINT', x: 15.2, y: 2.4, floor: 'Sảnh Tầng 1' },
  { id: 'STAIRS', key: 'STAIRS', name: 'Lối Thoát Hiểm Khẩn Cấp', type: 'WAYPOINT', x: 16.0, y: 4.8, floor: 'Sảnh Tầng 1' },
  { id: 'LOBBY_LOUNGE', key: 'LOBBY_LOUNGE', name: 'Khu Sofa Khách Chờ Sảnh', type: 'WAYPOINT', x: 3.6, y: 7.2, floor: 'Sảnh Tầng 1' },
];

// Danh sach 3 Vung Chuc Nang tieu chuan cho sa ban Gia lap Workflow & Gazebo (9.80m x 6.30m)
export const SIMULATOR_HOTEL_ZONES = [
  {
    id: 'zone-keepout-staff',
    name: 'Phòng Nội Bộ Quầy Lễ Tân (Khu Vực Cấm Vào)',
    type: 'KEEP_OUT',
    badge: 'KEEP OUT',
    color: '#DC2626',
    bgColor: 'rgba(220, 38, 38, 0.16)',
    borderColor: '#DC2626',
    x: 11.44,
    y: 6.4,
    width: 2.80,
    height: 3.60,
    speed_limit: 0.0,
    description: 'Khu vực quầy lễ tân nội bộ, robot tuyệt đối không đi vào hay nhận điểm đến.',
  },
  {
    id: 'zone-speed-frontdesk',
    name: 'Hành Lang Tiếp Tân (Giới Hạn Tốc Độ)',
    type: 'SPEED_ZONE',
    badge: 'SPEED ZONE: 0.2m/s',
    color: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.16)',
    borderColor: '#D97706',
    x: 11.44,
    y: 2.8,
    width: 4.80,
    height: 2.40,
    speed_limit: 0.20,
    description: 'Khu vực tiếp đón khách, tốc độ robot tự động hạ tối đa 0.20 m/s để đảm bảo an toàn.',
  },
  {
    id: 'zone-nostop-doorway',
    name: 'Lối Cửa Thông Sảnh (Khu Vực Cấm Dừng)',
    type: 'NO_STOP',
    badge: 'NO STOP',
    color: '#E11D48',
    bgColor: 'rgba(225, 29, 72, 0.16)',
    borderColor: '#E11D48',
    x: 12.84,
    y: 9.8,
    width: 2.40,
    height: 2.80,
    speed_limit: 0.30,
    description: 'Lối đi huyết mạch giữa 2 gian sảnh, robot chỉ được phép đi qua, tuyệt đối cấm dừng/chờ.',
  },
];

export const isPointInSimulatorZone = (x, y, zone) => {
  if (!zone) return false;
  return isPointInZone(x, y, zone);
};

export const getActiveSimulatorZone = (x, y, zones = SIMULATOR_HOTEL_ZONES) => {
  if (!Array.isArray(zones) || zones.length === 0) return null;
  const priority = { KEEP_OUT: 3, NO_STOP: 2, SPEED_ZONE: 1, SLOW_SPEED: 1 };
  const active = zones.filter((z) => isPointInSimulatorZone(x, y, z));
  if (active.length === 0) return null;
  active.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));

  // Neu co nhieu SPEED_ZONE chong lan, ap dung van toc nho nhat de dam bao an toan
  const speedZones = active.filter((z) => z.type === 'SPEED_ZONE' || z.type === 'SLOW_SPEED');
  if (speedZones.length > 1 && (active[0].type === 'SPEED_ZONE' || active[0].type === 'SLOW_SPEED')) {
    const minSpeed = Math.min(...speedZones.map((z) => Number(z.speed_limit) || 0.2));
    return {
      ...active[0],
      speed_limit: minSpeed,
    };
  }

  return active[0];
};

export const zoneToSvgRect = (zone) => {
  const bounds = isPolygonZone(zone) ? zoneBounds(zone) : {
    minX: Number(zone.x || 0) - Number(zone.width || 2) / 2,
    maxX: Number(zone.x || 0) + Number(zone.width || 2) / 2,
    minY: Number(zone.y || 0) - Number(zone.height || 2) / 2,
    maxY: Number(zone.y || 0) + Number(zone.height || 2) / 2,
  };
  const zw = bounds.maxX - bounds.minX, zh = bounds.maxY - bounds.minY;
  const minX = bounds.minX, maxY = bounds.maxY;
  // Dong bo ti le 1:1 voi 19.60m x 12.60m sang canvas 490x315 px (25 px/m) + padding 35px
  const svgX = 35 + minX * 25;
  const svgY = 35 + (12.60 - maxY) * 25;
  const svgWidth = zw * 25;
  const svgHeight = zh * 25;

  return {
    x: svgX,
    y: svgY,
    width: svgWidth,
    height: svgHeight,
  };
};

// Targets written by earlier stock templates for the old 10 x 6 m lobby.
// A MOVE step that still holds one of these exact points was never re-targeted,
// so it runs at today's waypoint. (0, 0) is an unset placeholder for every key.
// Mirrors upgrade_legacy_move_step in backend default_workflows.py.
const LEGACY_TARGET_ALIASES = { DOCK_LOBBY: 'ROBOT_STANDBY', DOCK_01: 'ROBOT_STANDBY', 'wp-reception': 'FRONT_DESK' };
const LEGACY_TARGET_POINTS = {
  MAIN_ENTRANCE: [[5.2, 1.0]],
  FRONT_DESK: [[6.4, 2.0], [5.2, 2.0]],
  ELEVATOR: [[7.7, 4.2], [7.8, 4.5]],
  CENTRAL_LOBBY: [[4.8, 2.5]],
  ROBOT_STANDBY: [[3.2, 2.8]],
};

const findLegacyMoveTarget = (params, x, y) => {
  const rawKey = params.target_waypoint_id || params.target_value;
  const key = LEGACY_TARGET_ALIASES[rawKey] || rawKey;
  if (!LEGACY_TARGET_POINTS[key] && !(key in GAZEBO_LOBBY_WAYPOINTS)) return null;
  const oldPoints = [...(LEGACY_TARGET_POINTS[key] || []), [0, 0]];
  const isOld = oldPoints.some(([ox, oy]) => Math.abs(x - ox) < 0.005 && Math.abs(y - oy) < 0.005);
  return isOld ? GAZEBO_LOBBY_WAYPOINTS[key] : null;
};

const isChargerEndpoint = (e) => ['CHARGER', 'DOCKING_TARGET'].includes(String(e?.type || '').toUpperCase());

export function resolveMoveTarget(step, endpoints = []) {
  const params = step?.params || {};
  // Going to charge follows the charging station shown on the map, wherever it was placed.
  if (String(params.target_type || '').toUpperCase() === 'CHARGER') {
    const charger = Array.isArray(endpoints) ? endpoints.find(isChargerEndpoint) : null;
    if (charger && Number.isFinite(Number(charger.x)) && Number.isFinite(Number(charger.y))) {
      return { x: Number(charger.x), y: Number(charger.y) };
    }
  }
  const x = parseFloat(params.target_x);
  const y = parseFloat(params.target_y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const legacy = findLegacyMoveTarget(params, x, y);
    return legacy ? { x: legacy.x, y: legacy.y } : { x, y };
  }
  const key = params.target_value || params.target_waypoint_id;
  const endpoint = key && endpoints?.find(e => [e.id, e.key, e.name].includes(key));
  return endpoint || GAZEBO_LOBBY_WAYPOINTS[key] || GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
}

export const validateWorkflowStepZone = (step, zones = SIMULATOR_HOTEL_ZONES, customEndpoints = null) => {
  if (!step) return { valid: true };
  const stepType = step.type || '';

  if (stepType === 'MOVE') {
    const { x: targetX, y: targetY } = resolveMoveTarget(step, customEndpoints);

    const zone = getActiveSimulatorZone(targetX, targetY, zones);
    if (zone && zone.type === 'KEEP_OUT') {
      return {
        valid: false,
        error: `Điểm đích bước "${step.title || 'MOVE'}" nằm trong Vùng cấm vào "${zone.name}"! Robot không được phép di chuyển vào đây.`,
        zone,
      };
    }
    if (zone && zone.type === 'NO_STOP') {
      return {
        valid: true,
        warning: `Điểm đến nằm trong Vùng cấm dừng "${zone.name}". Robot chỉ được phép đi qua, không nên kết thúc hành trình tại đây.`,
        zone,
      };
    }
  }

  return { valid: true };
};

/**
 * Tinh toan diem thoat an toan xuyen qua Vung cam dung (NO_STOP).
 * Robot khong duoc phep dung lai trong Vung cam dung (vi du Cua thong sanh chinh x=4.4m).
 * Neu muc tieu hoac diem click nam trong vung nay, ham se tu dong chieu vec-to di chuyen
 * de dua robot di xuyen qua vung den vi tri an toan ke tiep o gian phong doi dien.
 */
export const resolveNoStopPassthrough = (fromPt, targetPt, zones = SIMULATOR_HOTEL_ZONES) => {
  if (!targetPt || typeof targetPt.x !== 'number' || typeof targetPt.y !== 'number') {
    return { isNoStop: false, safePoint: targetPt, zone: null };
  }

  const activeZone = getActiveSimulatorZone(targetPt.x, targetPt.y, zones);
  if (!activeZone || activeZone.type !== 'NO_STOP') {
    return { isNoStop: false, safePoint: targetPt, zone: null };
  }

  const zw = Number(activeZone.width) || 1.20;
  const zh = Number(activeZone.height) || 1.40;
  const zx = Number(activeZone.x) || 12.84;
  const zy = Number(activeZone.y) || 9.80;

  const minX = zx - zw / 2;
  const maxX = zx + zw / 2;
  const minY = zy - zh / 2;
  const maxY = zy + zh / 2;

  const fromX = typeof fromPt?.x === 'number' ? fromPt.x : zx + 1.0;
  const fromY = typeof fromPt?.y === 'number' ? fromPt.y : zy;

  const dx = targetPt.x - fromX;
  const dy = targetPt.y - fromY;

  const clearance = 0.50; // Khoang dem thoat khoi vung (m)
  let safeX = targetPt.x;
  let safeY = targetPt.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (fromX >= zx) {
      safeX = Number((minX - clearance).toFixed(2));
      safeY = Number(Math.max(minY, Math.min(maxY, targetPt.y)).toFixed(2));
    } else {
      safeX = Number((maxX + clearance).toFixed(2));
      safeY = Number(Math.max(minY, Math.min(maxY, targetPt.y)).toFixed(2));
    }
  } else {
    if (fromY >= zy) {
      safeY = Number((minY - clearance).toFixed(2));
      safeX = Number(Math.max(minX, Math.min(maxX, targetPt.x)).toFixed(2));
    } else {
      safeY = Number((maxY + clearance).toFixed(2));
      safeX = Number(Math.max(minX, Math.min(maxX, targetPt.x)).toFixed(2));
    }
  }

  safeX = Number(Math.max(0.8, Math.min(18.0, safeX)).toFixed(2));
  safeY = Number(Math.max(0.8, Math.min(11.2, safeY)).toFixed(2));

  const keepOutCheck = getActiveSimulatorZone(safeX, safeY, zones);
  if (keepOutCheck && keepOutCheck.type === 'KEEP_OUT') {
    safeX = 4.2;
    safeY = 4.9;
  }

  return {
    isNoStop: true,
    safePoint: { x: safeX, y: safeY },
    zone: activeZone,
    originalPoint: { x: Number(targetPt.x.toFixed(2)), y: Number(targetPt.y.toFixed(2)) },
  };
};

// Chuyen toa do Met (ROS: X 0..9.80m, Y 0..6.30m) sang Toa do SVG Canvas (490x315 px + padding 35px, 50 px/m)
export const meterToSvg = (mx, my) => {
  const safeX = typeof mx === 'number' && !isNaN(mx) ? mx : 7.2;
  const safeY = typeof my === 'number' && !isNaN(my) ? my : 9.6;
  const clampedX = Math.max(0, Math.min(19.60, safeX));
  const clampedY = Math.max(0, Math.min(12.60, safeY));
  // Dong bo ti le 1:1 voi Gazebo 19.60m x 12.60m va ban do SVG 490x315
  // San X: 35 -> 525 (rong 490px = 19.60m * 25 px/m)
  // San Y: 35 -> 350 (cao 315px = 12.60m * 25 px/m)
  const svgX = 35 + clampedX * 25;
  const svgY = 35 + (12.60 - clampedY) * 25;
  return { x: svgX, y: svgY };
};

// Chuyen nguoc tu Toa do SVG Canvas sang Toa do Met (ROS: X 0..19.60m, Y 0..12.60m)
export const svgToMeter = (svgX, svgY) => {
  const clampedSvgX = Math.max(35, Math.min(525, svgX));
  const clampedSvgY = Math.max(35, Math.min(350, svgY));
  const mx = (clampedSvgX - 35) / 25;
  const my = (350 - clampedSvgY) / 25;
  return {
    x: Number(mx.toFixed(2)),
    y: Number(my.toFixed(2)),
  };
};

// ========================================================
// THUAT TOAN DINH TUYEN NE TUONG VA VAT CAN TRONG SANH 19.60m x 12.60m
// Graph-based roadmap + Line-of-sight collision checking + String-pulling shortcut smoothing
// ========================================================
