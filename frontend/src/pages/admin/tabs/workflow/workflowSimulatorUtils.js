// Danh sach toa do cac diem moc Sanh Tang Tret (Ground Floor - Lobby Arena 9.80m x 6.30m)
// Robot mac dinh o vi tri truc Khu Vuc Phia Bac cua Lobby (x: 3.6, y: 4.8)
export const ROBOT_INITIAL_POSE = { x: 7.2, y: 9.6, yaw: -Math.PI / 2 };

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
    x: 8.4,
    y: 2.0,
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
  ZONE_LOBBY: { x: 8.4, y: 2.0, badge: 'Cửa Chính Sảnh', label: 'Cửa Chính Sảnh' },
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
  { id: 'MAIN_ENTRANCE', key: 'MAIN_ENTRANCE', name: 'Cửa Chính Sảnh (Main Entrance)', type: 'WAYPOINT', x: 8.4, y: 2.0, floor: 'Sảnh Tầng 1' },
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
  const halfW = (Number(zone.width) || 2.0) / 2;
  const halfH = (Number(zone.height) || 2.0) / 2;
  const zx = Number(zone.x) || 0;
  const zy = Number(zone.y) || 0;
  return x >= (zx - halfW) && x <= (zx + halfW) && y >= (zy - halfH) && y <= (zy + halfH);
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
  const zw = Number(zone.width) || 2.0;
  const zh = Number(zone.height) || 2.0;
  const zx = Number(zone.x) || 0.0;
  const zy = Number(zone.y) || 0.0;

  const minX = zx - zw / 2;
  const maxY = zy + zh / 2;

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

export const validateWorkflowStepZone = (step, zones = SIMULATOR_HOTEL_ZONES, customEndpoints = null) => {
  if (!step) return { valid: true };
  const stepType = step.type || '';
  const params = step.params || {};

  if (stepType === 'MOVE') {
    let targetX = parseFloat(params.target_x);
    let targetY = parseFloat(params.target_y);
    if (isNaN(targetX) || isNaN(targetY)) {
      const customWp = Array.isArray(customEndpoints)
        ? customEndpoints.find((e) => e.id === params.target_value || e.key === params.target_value || e.name === params.target_value)
        : null;
      const wp = customWp || GAZEBO_LOBBY_WAYPOINTS[params.target_value] || GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
      targetX = wp?.x ?? 5.2;
      targetY = wp?.y ?? 2.0;
    }

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

const LOBBY_OBSTACLES = [
  { id: 'RECEPTION', minX: 9.70, maxX: 13.10, minY: 4.00, maxY: 8.65 },
  { id: 'PLANT_POT', minX: 5.60, maxX: 7.45, minY: 5.35, maxY: 7.15 },
  { id: 'PART_TOP',  minX: 12.50, maxX: 12.85, minY: 11.00, maxY: 12.60 },
  { id: 'PART_BOT',  minX: 12.60, maxX: 12.95, minY: 0.00, maxY: 1.45 },
  { id: 'SOFA_TL',   minX: 0.00, maxX: 2.30, minY: 8.30, maxY: 12.60 },
  { id: 'SOFA_BL',   minX: 0.00, maxX: 4.70, minY: 0.00, maxY: 1.60 },
  { id: 'SOFA_TR',   minX: 15.30, maxX: 19.60, minY: 7.60, maxY: 10.00 },
  { id: 'ELEV_EXIT', minX: 17.80, maxX: 19.60, minY: 4.80, maxY: 7.80 },
  { id: 'WC_EAST',   minX: 17.80, maxX: 19.60, minY: 0.00, maxY: 3.55 },
  { id: 'WC_SOUTH',  minX: 15.30, maxX: 18.00, minY: 0.00, maxY: 1.90 },
];

const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

const segmentsIntersect = (A, B, C, D) =>
  ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

const isLineOfSightClear = (p1, p2, ignoreReception = false) => {
  for (const box of LOBBY_OBSTACLES) {
    if (ignoreReception && box.id === 'RECEPTION') continue;
    const tl = { x: box.minX, y: box.maxY };
    const tr = { x: box.maxX, y: box.maxY };
    const bl = { x: box.minX, y: box.minY };
    const br = { x: box.maxX, y: box.minY };
    if (
      segmentsIntersect(p1, p2, tl, tr) ||
      segmentsIntersect(p1, p2, tr, br) ||
      segmentsIntersect(p1, p2, br, bl) ||
      segmentsIntersect(p1, p2, bl, tl)
    ) {
      return false;
    }
  }
  return true;
};

const LOBBY_NAV_NODES = {
  W_NORTH:     { x: 7.20,  y: 9.60 },
  W_NORTH_L:   { x: 4.80,  y: 9.60 },
  W_MID_L:     { x: 4.20,  y: 7.20 },
  W_MID_POT_W: { x: 4.60,  y: 5.50 },
  W_SOUTH_L:   { x: 4.80,  y: 3.20 },
  W_SOUTH:     { x: 7.60,  y: 2.60 },
  C_NORTH_DOOR:{ x: 12.84, y: 9.80 },
  C_SOUTH_DOOR:{ x: 12.84, y: 2.60 },
  C_FRONT_DESK:{ x: 11.44, y: 2.80 },
  C_STAFF_DOOR:{ x: 11.44, y: 4.20 },
  C_STAFF_IN:  { x: 11.44, y: 6.40 },
  E_NORTH:     { x: 15.50, y: 9.80 },
  E_MID:       { x: 15.60, y: 6.50 },
  E_SOUTH:     { x: 15.50, y: 2.60 },
};

const LOBBY_NAV_EDGES = [
  ['W_NORTH', 'W_NORTH_L'],
  ['W_NORTH_L', 'W_MID_L'],
  ['W_MID_L', 'W_MID_POT_W'],
  ['W_MID_POT_W', 'W_SOUTH_L'],
  ['W_SOUTH_L', 'W_SOUTH'],
  ['W_NORTH', 'C_NORTH_DOOR'],
  ['W_SOUTH', 'C_FRONT_DESK'],
  ['W_SOUTH', 'C_SOUTH_DOOR'],
  ['C_FRONT_DESK', 'C_SOUTH_DOOR'],
  ['C_FRONT_DESK', 'C_STAFF_DOOR'],
  ['C_STAFF_DOOR', 'C_STAFF_IN'],
  ['C_NORTH_DOOR', 'E_NORTH'],
  ['C_SOUTH_DOOR', 'E_SOUTH'],
  ['E_NORTH', 'E_MID'],
  ['E_MID', 'E_SOUTH'],
];

const findRoadmapPath = (start, goal, ignoreReception = false) => {
  if (isLineOfSightClear(start, goal, ignoreReception)) {
    return [start, goal];
  }

  const nodeKeys = Object.keys(LOBBY_NAV_NODES);
  const startEdges = [];
  const goalEdges = [];

  for (const k of nodeKeys) {
    const pt = LOBBY_NAV_NODES[k];
    if (isLineOfSightClear(start, pt, ignoreReception)) {
      startEdges.push({ node: k, dist: Math.hypot(start.x - pt.x, start.y - pt.y) });
    }
    if (isLineOfSightClear(goal, pt, ignoreReception)) {
      goalEdges.push({ node: k, dist: Math.hypot(goal.x - pt.x, goal.y - pt.y) });
    }
  }

  if (startEdges.length === 0) {
    let closestK = nodeKeys[0];
    let minD = Infinity;
    for (const k of nodeKeys) {
      const d = Math.hypot(start.x - LOBBY_NAV_NODES[k].x, start.y - LOBBY_NAV_NODES[k].y);
      if (d < minD) { minD = d; closestK = k; }
    }
    startEdges.push({ node: closestK, dist: minD });
  }

  if (goalEdges.length === 0) {
    let closestK = nodeKeys[0];
    let minD = Infinity;
    for (const k of nodeKeys) {
      const d = Math.hypot(goal.x - LOBBY_NAV_NODES[k].x, goal.y - LOBBY_NAV_NODES[k].y);
      if (d < minD) { minD = d; closestK = k; }
    }
    goalEdges.push({ node: closestK, dist: minD });
  }

  // Build Adjacency list
  const adj = {};
  for (const k of nodeKeys) adj[k] = [];
  for (const [u, v] of LOBBY_NAV_EDGES) {
    const d = Math.hypot(LOBBY_NAV_NODES[u].x - LOBBY_NAV_NODES[v].x, LOBBY_NAV_NODES[u].y - LOBBY_NAV_NODES[v].y);
    adj[u].push({ node: v, dist: d });
    adj[v].push({ node: u, dist: d });
  }

  adj['START'] = startEdges;
  adj['GOAL'] = [];
  for (const ge of goalEdges) {
    adj[ge.node].push({ node: 'GOAL', dist: ge.dist });
  }

  // Dijkstra
  const allNodes = ['START', 'GOAL', ...nodeKeys];
  const dist = {};
  const prev = {};
  const unvisited = new Set(allNodes);

  for (const n of allNodes) dist[n] = Infinity;
  dist['START'] = 0;

  while (unvisited.size > 0) {
    let curr = null;
    let minD = Infinity;
    for (const n of unvisited) {
      if (dist[n] < minD) {
        minD = dist[n];
        curr = n;
      }
    }
    if (!curr || minD === Infinity || curr === 'GOAL') break;
    unvisited.delete(curr);

    for (const neighbor of adj[curr] || []) {
      if (!unvisited.has(neighbor.node)) continue;
      const alt = dist[curr] + neighbor.dist;
      if (alt < dist[neighbor.node]) {
        dist[neighbor.node] = alt;
        prev[neighbor.node] = curr;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let curr = 'GOAL';
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  if (path[0] !== 'START') {
    return [start, goal];
  }

  const rawPts = path.map((k) => {
    if (k === 'START') return start;
    if (k === 'GOAL') return goal;
    return LOBBY_NAV_NODES[k];
  });

  // String-pulling shortcut smoothing
  if (rawPts.length <= 2) return rawPts;
  const smoothed = [rawPts[0]];
  let i = 0;
  while (i < rawPts.length - 1) {
    let furthest = i + 1;
    for (let j = rawPts.length - 1; j > i + 1; j--) {
      if (isLineOfSightClear(smoothed[smoothed.length - 1], rawPts[j], ignoreReception)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(rawPts[furthest]);
    i = furthest;
  }

  return smoothed;
};

export const calculateSafeWaypoints = (from, to) => {
  const pFrom = { x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) };
  const pTo = { x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) };

  const isInsideStaff = (pt) => pt.x >= 10.04 && pt.x <= 12.82 && pt.y >= 4.40 && pt.y <= 8.40;
  const fromStaff = isInsideStaff(pFrom);
  const toStaff = isInsideStaff(pTo);

  const staffApproach = { x: 11.44, y: 2.80 };
  const staffDoor = { x: 11.44, y: 4.20 };

  let pts = [];
  if (!fromStaff && toStaff) {
    const approachRoute = findRoadmapPath(pFrom, staffApproach, false);
    pts = [...approachRoute, staffDoor, pTo];
  } else if (fromStaff && !toStaff) {
    const leaveRoute = findRoadmapPath(staffApproach, pTo, false);
    pts = [pFrom, staffDoor, staffApproach, ...leaveRoute.slice(1)];
  } else if (fromStaff && toStaff) {
    pts = [pFrom, pTo];
  } else {
    pts = findRoadmapPath(pFrom, pTo, false);
  }

  // Deduplicate points that are too close (< 0.15m)
  const filtered = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = filtered[filtered.length - 1];
    const cur = pts[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.15) {
      filtered.push({ x: Number(cur.x.toFixed(2)), y: Number(cur.y.toFixed(2)) });
    }
  }

  // Ensure last point is exactly destination
  if (Math.hypot(filtered[filtered.length - 1].x - pTo.x, filtered[filtered.length - 1].y - pTo.y) > 0.05) {
    filtered.push(pTo);
  }

  return filtered;
};

export const getStepActionDetail = (step) => {
  if (!step) {
    return {
      label: 'READY',
      shortChip: 'San sang',
      detailText: 'Robot o trang thai cho lenh',
      bubbleTitle: 'TRANG THAI',
      bubbleBody: 'San sang phuc vu tai Sanh',
    };
  }

  const type = step.type || 'UNKNOWN';
  const params = step.params || {};
  const rawTitle = (step.title || '').replace(/^\d+\.\s*/, '');

  switch (type) {
    case 'SHOW': {
      const screenType = params.screen_type || 'MENU';
      const contentId = params.content_id || '';
      let displayContent = '';
      let shortName = 'Man hinh';

      if (screenType === 'LANGUAGE_SELECT' || contentId === 'UI_LANG') {
        displayContent = 'Man hinh Chon ngon ngu (Tieng Viet / English / 中文)';
        shortName = 'Chon ngon ngu';
      } else if (contentId === 'UI_MAIN_MENU' || screenType === 'MENU') {
        displayContent = 'Thuc don Tien ich Sanh & Dich vu Khach san';
        shortName = 'Thuc don dich vu';
      } else if (contentId === 'UI_RECOMMEND_LIST') {
        displayContent = 'Danh muc Goi y Am thuc & Set Tra chieu sảnh';
        shortName = 'Goi y am thuc';
      } else if (contentId === 'UI_SERVICE_FORM') {
        displayContent = 'Bieu mau Tiep nhan Yeu cau Buong phong & Taxi';
        shortName = 'Bieu mau dich vu';
      } else if (contentId === 'UI_CONFIRMATION') {
        displayContent = 'Man hinh Thong bao Xac nhan Yeu cau Thanh cong';
        shortName = 'Xac nhan yeu cau';
      } else if (screenType === 'MAP' || contentId === 'MAP_LOBBY') {
        displayContent = 'So do Huong dan Duong di Sanh Tang tret';
        shortName = 'So do sanh';
      } else if (screenType === 'QR_CODE') {
        displayContent = 'Ma QR Quet Check-in & Thanh toan';
        shortName = 'Ma QR Check-in';
      } else {
        displayContent = rawTitle || screenType;
        shortName = rawTitle.slice(0, 16) || screenType;
      }

      return {
        label: 'SHOW',
        shortChip: `SHOW: ${shortName}`,
        detailText: `Hien thi man hinh Robot: ${displayContent}`,
        bubbleTitle: 'MAN HINH ROBOT (SHOW)',
        bubbleBody: displayContent,
      };
    }

    case 'COMMUNICATE': {
      const prompt = params.initial_prompt || params.speech_text || params.text || rawTitle || 'Đối thoại hai chiều với khách';
      const timeout = params.silence_timeout_sec || params.timeout || 30;
      const src = params.input_source === 'VOICE' ? 'Giọng nói' : params.input_source === 'TOUCH' ? 'Chạm cảm ứng' : 'Giọng nói & Chạm';
      return {
        label: 'COMMUNICATE',
        shortChip: `COMMUNICATE: Đối thoại AI (30s)`,
        detailText: `Đối thoại AI 2 chiều (${src}): "${prompt}" (Tự ngắt sau ${timeout}s im lặng)`,
        bubbleTitle: 'ĐỐI THOẠI AI 2 CHIỀU (COMMUNICATE)',
        bubbleBody: `"${prompt}"`,
      };
    }

    case 'SPEAK': {
      const speech = params.text || params.speech_text || rawTitle || 'Thong bao toi quy khach';
      return {
        label: 'SPEAK',
        shortChip: `SPEAK: Thong bao`,
        detailText: `Phat giong noi: "${speech}"`,
        bubbleTitle: 'PHAT GIONG NOI (SPEAK)',
        bubbleBody: `"${speech}"`,
      };
    }

    case 'GREET': {
      const greet = params.greeting_text || params.text || 'Dạ em chào quý khách!';
      return {
        label: 'GREET',
        shortChip: `GREET: Chao khach`,
        detailText: `Loi chao don: "${greet}"`,
        bubbleTitle: 'CHAO DON KHACH (GREET)',
        bubbleBody: `"${greet}"`,
      };
    }

    case 'LISTEN': {
      const src =
        params.input_source === 'VOICE'
          ? 'Giong noi'
          : params.input_source === 'TOUCH'
          ? 'Cham cam ung'
          : 'Giong noi / Cham cam ung';
      const prompt = rawTitle || 'Cho khach tuong tac';
      return {
        label: 'LISTEN',
        shortChip: `LISTEN: ${params.input_source === 'TOUCH' ? 'Cham Robot' : 'Giong noi'}`,
        detailText: `Tiep nhan tu khach: ${prompt} (Kenh: ${src})`,
        bubbleTitle: 'DANG LANG NGHE (LISTEN)',
        bubbleBody: `${prompt} (${src})`,
      };
    }

    case 'RECOMMEND': {
      const item =
        params.highlight_item || params.item_name || params.category || 'Mon an & Tien ich sanh';
      return {
        label: 'RECOMMEND',
        shortChip: `RECOMMEND: Goi y`,
        detailText: `Goi y thong minh: ${item}`,
        bubbleTitle: 'GOI Y THONG MINH (RECOMMEND)',
        bubbleBody: item,
      };
    }

    case 'CREATE_REQUEST': {
      const req =
        params.note ||
        `${params.service_type || 'Dich vu buong phong'} (Phong ${params.room_number || 'Sanh'})`;
      return {
        label: 'CREATE_REQUEST',
        shortChip: `REQUEST: Gui yeu cau`,
        detailText: `Tao phieu yeu cau he thong: ${req}`,
        bubbleTitle: 'TAO PHIEU YEU CAU (REQUEST)',
        bubbleBody: req,
      };
    }

    case 'FEEDBACK': {
      const q = params.question || 'Khao sat danh gia chat luong phuc vu tai sanh';
      return {
        label: 'FEEDBACK',
        shortChip: `FEEDBACK: Khao sat`,
        detailText: `Thu thap danh gia: ${q}`,
        bubbleTitle: 'KHAO SAT Y KIEN (FEEDBACK)',
        bubbleBody: q,
      };
    }

    case 'MOVE': {
      const fromWpKey = params.from_waypoint;
      const toWpKey = params.target_value || params.target_waypoint_id;
      const fromWpName =
        params.from_waypoint_name ||
        (fromWpKey && GAZEBO_LOBBY_WAYPOINTS[fromWpKey]?.name) ||
        'Vị trí hiện tại';
      const toWpName =
        params.waypoint_name ||
        (toWpKey && GAZEBO_LOBBY_WAYPOINTS[toWpKey]?.name) ||
        params.target_value ||
        'Điểm đến';

      const isCurrentStart = !fromWpKey || fromWpKey === 'CURRENT';
      const toShort = toWpName.split('(')[0].trim();
      const fromShort = fromWpName.split('(')[0].trim();

      return {
        label: 'MOVE',
        shortChip: isCurrentStart ? `MOVE: ${toShort}` : `MOVE: ${fromShort} ➔ ${toShort}`,
        detailText: isCurrentStart
          ? `Điều hướng né vật cản đến: ${toWpName}`
          : `Lộ trình: ${fromWpName} ➔ ${toWpName}`,
        bubbleTitle: isCurrentStart ? 'DI CHUYỂN NÉ VẬT CẢN (MOVE)' : 'LỘ TRÌNH ĐIỂM MỐC (MOVE)',
        bubbleBody: isCurrentStart ? `Đến: ${toWpName}` : `Từ: ${fromWpName}\nĐến: ${toWpName}`,
      };
    }

    default:
      return {
        label: type,
        shortChip: type,
        detailText: rawTitle || type,
        bubbleTitle: type,
        bubbleBody: rawTitle || type,
      };
  }
};

// DANH SACH KICH BAN MO PHONG DU PHONG (BUILT-IN FALLBACK WORKFLOWS)
// Dam bao simulator luon luon hoat dong ngay ca khi API backend chua tai xong
export const BUILTIN_SIMULATOR_WORKFLOWS = [
  {
    id: 'wf-01-welcome',
    name: 'Workflow 1: Don tiep & Chao mung khach tai Cua Sanh',
    description: 'Robot tu tram cho di chuyen ra Cua chinh don khach moi vao sanh, chao hoi va mo menu.',
    steps: [
      {
        step_id: 'wf1-step-1',
        type: 'MOVE',
        title: '1. Di chuyen ra Cua chinh don khach',
        params: {
          from_waypoint: 'ROBOT_STANDBY',
          from_waypoint_name: 'Vị Trí Chờ Robot Sảnh',
          target_type: 'LOCATION',
          target_value: 'MAIN_ENTRANCE',
          waypoint_name: 'Cửa Chính Ra Vào Sảnh (Main Entrance)',
          target_x: 5.2,
          target_y: 1.0,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf1-step-2',
        type: 'GREET',
        title: '2. Chao don khach niem no',
        params: {
          template_id: 'TPL_WELCOME',
          language: 'vi',
          expression: 'SMILE',
          greeting_text: 'Da em chao quy khach! Chao mung quy khach den voi khach san.',
        },
      },
      {
        step_id: 'wf1-step-3',
        type: 'SHOW',
        title: '3. Mo man hinh chon ngon ngu',
        params: {
          screen_type: 'LANGUAGE_SELECT',
          content_id: 'UI_LANG',
          timeout: 4,
        },
      },
      {
        step_id: 'wf1-step-4',
        type: 'COMMUNICATE',
        title: '4. Giao tiếp & xác nhận yêu cầu của khách',
        params: {
          initial_prompt: 'Dạ em chào quý khách, em có thể hỗ trợ quý khách thông tin gì ạ?',
          silence_timeout_sec: 30,
          input_source: 'BOTH',
        },
      },
      {
        step_id: 'wf1-step-5',
        type: 'SHOW',
        title: '5. Bat thuc don tien ich sanh & dich vu',
        params: {
          screen_type: 'MENU',
          content_id: 'UI_MAIN_MENU',
          timeout: 4,
        },
      },
    ],
  },
  {
    id: 'wf-04-call-staff',
    name: 'Workflow 4: Huong dan & Dan khach toi Quay Le Tan (Front Desk)',
    description: 'Dan khach tu khu sofa qua Quay Le Tan khi khach can gap nhan vien truc tiep.',
    steps: [
      {
        step_id: 'wf4-step-1',
        type: 'COMMUNICATE',
        title: '1. Thong bao huong dan & doi thoai voi khach',
        params: {
          initial_prompt: 'Xin moi quy khach di theo em toi quay tiep tan a.',
          silence_timeout_sec: 30,
        },
      },
      {
        step_id: 'wf4-step-2',
        type: 'MOVE',
        title: '2. Dan khach toi Quay Le Tan (Front Desk)',
        params: {
          from_waypoint: 'LOBBY_LOUNGE',
          from_waypoint_name: 'Khu Sofa Khách Chờ Sảnh',
          target_type: 'LOCATION',
          target_value: 'FRONT_DESK',
          waypoint_name: 'Trước Quầy Lễ Tân (Front Desk)',
          target_x: 5.2,
          target_y: 2.0,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf4-step-3',
        type: 'SHOW',
        title: '3. Man hinh ket noi nhan vien truc quay',
        params: {
          screen_type: 'QR_CODE',
          content_id: 'UI_CONFIRMATION',
          timeout: 4,
        },
      },
    ],
  },
  {
    id: 'wf-07-guide-tour',
    name: 'Workflow 7: Chi duong & Dan khach toi Cum Thang May (Elevator)',
    description: 'Dan khach tu Tram Cho sang Cum Thang May, tu dong ne vach ngan 4.4m va di qua cua thong.',
    steps: [
      {
        step_id: 'wf7-step-1',
        type: 'SHOW',
        title: '1. Bat so do ban do sanh Tang Tret',
        params: {
          screen_type: 'MAP',
          content_id: 'MAP_LOBBY',
          timeout: 3,
        },
      },
      {
        step_id: 'wf7-step-2',
        type: 'COMMUNICATE',
        title: '2. Huong dan khach di theo robot toi thang may',
        params: {
          initial_prompt: 'Da, em xin phep dan quy khach toi cum thang may de len phong a.',
          silence_timeout_sec: 30,
        },
      },
      {
        step_id: 'wf7-step-3',
        type: 'MOVE',
        title: '3. Dan duong toi Cum Thang May',
        params: {
          target_type: 'LOCATION',
          target_value: 'ELEVATOR',
          waypoint_name: 'Cum Thang May (Elevator)',
          target_x: 7.8,
          target_y: 4.5,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf7-step-4',
        type: 'COMMUNICATE',
        title: '4. Thong bao da den khu vuc thang may & giai dap them',
        params: {
          initial_prompt: 'Chung ta da den khu vuc thang may. Chuc quy khach mot ngay tot lanh! Quy khach can em giup gi them khong a?',
          silence_timeout_sec: 30,
        },
      },
    ],
  },
  {
    id: 'wf-05-feedback',
    name: 'Workflow 5: Danh gia dich vu & Robot ve Tram Sac Sanh',
    description: 'Thu thap danh gia hai long va dua robot quay ve tram sac Robot Sanh.',
    steps: [
      {
        step_id: 'wf5-step-1',
        type: 'SHOW',
        title: '1. Hien giao dien cham diem 5 sao',
        params: {
          screen_type: 'FEEDBACK',
          timeout: 3,
        },
      },
      {
        step_id: 'wf5-step-2',
        type: 'FEEDBACK',
        title: '2. Thu thap diem hai long tu khach',
        params: {
          question: 'Quy khach co hai long voi su phuc vu cua robot khong a?',
        },
      },
      {
        step_id: 'wf5-step-3',
        type: 'MOVE',
        title: '3. Robot tro ve Tram Sac Robot Sanh',
        params: {
          target_type: 'LOCATION',
          target_value: 'DOCK_LOBBY',
          waypoint_name: 'Trạm Sạc Robot Sảnh',
          target_x: 3.2,
          target_y: 2.8,
          speed: 0.35,
        },
      },
    ],
  },
];
