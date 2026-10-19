// Danh sach toa do cac diem moc Sanh Tang Tret (Ground Floor - Lobby Arena)
// Khong co tram sac robot, robot mac dinh o vi tri truc Goc Tren Ben Phai cua Lobby (x: 3.7, y: 5.0)
export const ROBOT_INITIAL_POSE = { x: 3.7, y: 5.0, yaw: -Math.PI / 2 };

export const GAZEBO_LOBBY_WAYPOINTS = {
  ROBOT_STANDBY: {
    x: 3.7,
    y: 5.0,
    name: 'Vị Trí Chờ Robot (Góc Trên Bên Phải Lobby)',
    badge: 'Robot Sảnh',
    label: 'Vị Trí Robot Sảnh',
    role: 'standby',
    offset: 'bottom',
  },
  LOBBY_LOUNGE: {
    x: 2.0,
    y: 2.8,
    name: 'Khu Sofa Sảnh (Lobby Lounge)',
    badge: 'Khu Sofa Sảnh',
    label: 'Khu Sofa Sảnh',
    role: 'lounge',
    offset: 'top',
  },
  MAIN_ENTRANCE: {
    x: 5.2,
    y: 1.0,
    name: 'Cửa Chính Ra Vào Sảnh',
    badge: 'Cửa Chính Sảnh',
    label: 'Cửa Chính Ra Vào Sảnh',
    role: 'entrance',
    offset: 'top',
  },
  FRONT_DESK: {
    x: 5.2,
    y: 2.0,
    name: 'Trước Quầy Lễ Tân (Front Desk)',
    badge: 'Quầy Lễ Tân',
    label: 'Trước Quầy Lễ Tân (Front Desk)',
    role: 'facility',
    offset: 'top',
  },
  ELEVATOR: {
    x: 7.8,
    y: 4.5,
    name: 'Cụm Thang Máy Tầng 1',
    badge: 'Thang Máy',
    label: 'Cụm Thang Máy',
    role: 'facility',
    offset: 'bottom',
  },
  RESTROOMS: {
    x: 6.6,
    y: 4.5,
    name: 'Nhà Vệ Sinh Sảnh (Restrooms)',
    badge: 'Nhà Vệ Sinh (WC)',
    label: 'Nhà Vệ Sinh (WC)',
    role: 'facility',
    offset: 'bottom',
  },
  STAIRS: {
    x: 8.8,
    y: 4.5,
    name: 'Cầu Thang Bộ Thoát Hiểm',
    badge: 'Cầu Thang Bộ',
    label: 'Cầu Thang Bộ',
    role: 'facility',
    offset: 'bottom',
  },
  STAFF_ONLY: {
    x: 7.85,
    y: 2.7,
    name: 'Trước Phòng Nội Bộ (Staff Only)',
    badge: 'Phòng Nội Bộ',
    label: 'Trước Phòng Nội Bộ (Staff Only)',
    role: 'staff',
    offset: 'bottom',
  },
  CENTRAL_LOBBY: {
    x: 5.2,
    y: 2.8,
    name: 'Khu Vực Trung Tâm Sảnh',
    badge: 'Trung Tâm Sảnh',
    label: 'Khu Vực Trung Tâm Sảnh',
    role: 'area',
    offset: 'top',
  },
  // Backward compatibility aliases
  ZONE_LOBBY: { x: 5.2, y: 1.0, badge: 'Cửa Chính Sảnh', label: 'Cửa Chính Sảnh' },
  DOCK_LOBBY: { x: 3.7, y: 5.0, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  DOCK_01: { x: 3.7, y: 5.0, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  HOTSPOT_LOBBY: { x: 5.2, y: 2.8, badge: 'Trung Tâm Sảnh', label: 'Khu Vực Trung Tâm Sảnh' },
  RESTAURANT_GATE: { x: 6.4, y: 2.0, badge: 'Quầy Lễ Tân', label: 'Quầy Lễ Tân (Front Desk)' },
  CORRIDOR_NORTH: { x: 6.6, y: 4.5, badge: 'Nhà Vệ Sinh (WC)', label: 'Nhà Vệ Sinh (WC)' },
  LOBBY_NORTHEAST: { x: 7.8, y: 4.5, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
  ELEVATOR_CLUSTER: { x: 7.8, y: 4.5, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
};

// Danh sach 8 diem moc chuan Lobby de su dung thong nhat giua Builder va Studio
export const STANDARD_LOBBY_WAYPOINTS = [
  { id: 'ROBOT_STANDBY', key: 'ROBOT_STANDBY', name: 'Vị Trí Chờ Robot Sảnh', x: 3.7, y: 5.0 },
  { id: 'MAIN_ENTRANCE', key: 'MAIN_ENTRANCE', name: 'Cửa Chính Sảnh (Main Entrance)', x: 5.2, y: 1.0 },
  { id: 'FRONT_DESK', key: 'FRONT_DESK', name: 'Trước Quầy Lễ Tân (Front Desk)', x: 5.2, y: 2.0 },
  { id: 'STAFF_ONLY', key: 'STAFF_ONLY', name: 'Trước Phòng Nội Bộ (Staff Only)', x: 7.85, y: 2.7 },
  { id: 'ELEVATOR', key: 'ELEVATOR', name: 'Cụm Thang Máy Tầng 1', x: 7.8, y: 4.5 },
  { id: 'RESTROOMS', key: 'RESTROOMS', name: 'Nhà Vệ Sinh Sảnh (WC)', x: 6.6, y: 4.5 },
  { id: 'STAIRS', key: 'STAIRS', name: 'Cầu Thang Bộ Thoát Hiểm', x: 8.8, y: 4.5 },
  { id: 'LOBBY_LOUNGE', key: 'LOBBY_LOUNGE', name: 'Khu Sofa Khách Chờ Sảnh', x: 2.0, y: 2.8 },
];

// Danh sach 3 Vung Chuc Nang tieu chuan cho sa ban Gia lap Workflow & Gazebo (10m x 6m)
export const SIMULATOR_HOTEL_ZONES = [
  {
    id: 'zone-keepout-staff',
    name: 'Phòng Staff Only (Khu Vực Cấm Vào)',
    type: 'KEEP_OUT',
    badge: 'KEEP OUT',
    color: '#DC2626',
    bgColor: 'rgba(220, 38, 38, 0.16)',
    borderColor: '#DC2626',
    x: 8.8,
    y: 1.5,
    width: 1.5,
    height: 2.8,
    speed_limit: 0.0,
    description: 'Khu vực nội bộ & kỹ thuật, robot tuyệt đối không đi vào hay nhận điểm đến.',
  },
  {
    id: 'zone-speed-frontdesk',
    name: 'Hành Lang Tiếp Tân (Giới Hạn Tốc Độ)',
    type: 'SPEED_ZONE',
    badge: 'SPEED ZONE: 0.2m/s',
    color: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.16)',
    borderColor: '#D97706',
    x: 5.2,
    y: 2.2,
    width: 2.6,
    height: 2.0,
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
    x: 4.4,
    y: 2.85,
    width: 1.4,
    height: 1.6,
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

  const svgX = 50 + (minX / 10.0) * 900;
  const svgY = 550 - (maxY / 6.0) * 500;
  const svgWidth = (zw / 10.0) * 900;
  const svgHeight = (zh / 6.0) * 500;

  return {
    x: svgX,
    y: svgY,
    width: svgWidth,
    height: svgHeight,
  };
};

export const validateWorkflowStepZone = (step, zones = SIMULATOR_HOTEL_ZONES) => {
  if (!step) return { valid: true };
  const stepType = step.type || '';
  const params = step.params || {};

  if (stepType === 'MOVE') {
    let targetX = parseFloat(params.target_x);
    let targetY = parseFloat(params.target_y);
    if (isNaN(targetX) || isNaN(targetY)) {
      const wp = GAZEBO_LOBBY_WAYPOINTS[params.target_value] || GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
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

  const zw = Number(activeZone.width) || 1.4;
  const zh = Number(activeZone.height) || 1.6;
  const zx = Number(activeZone.x) || 4.4;
  const zy = Number(activeZone.y) || 2.85;

  const minX = zx - zw / 2;
  const maxX = zx + zw / 2;
  const minY = zy - zh / 2;
  const maxY = zy + zh / 2;

  const fromX = typeof fromPt?.x === 'number' ? fromPt.x : zx + 0.8;
  const fromY = typeof fromPt?.y === 'number' ? fromPt.y : zy;

  const dx = targetPt.x - fromX;
  const dy = targetPt.y - fromY;

  const clearance = 0.45; // Khoang dem thoat khoi vung (m)
  let safeX = targetPt.x;
  let safeY = targetPt.y;

  // Xac dinh truc di chuyen uu tien (Ngang hoac Doc)
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Di theo truc ngang (qua cua trung tam sanh Dong <-> Tay)
    if (fromX >= zx) {
      // Robot di tu Phia Dong sang Tay -> Thoat ra phia Tay
      safeX = Number((minX - clearance).toFixed(2));
      safeY = Number(Math.max(2.4, Math.min(3.2, targetPt.y)).toFixed(2));
    } else {
      // Robot di tu Phia Tay sang Dong -> Thoat ra phia Dong
      safeX = Number((maxX + clearance).toFixed(2));
      safeY = Number(Math.max(2.4, Math.min(3.2, targetPt.y)).toFixed(2));
    }
  } else {
    // Di theo truc doc (Bac <-> Nam)
    if (fromY >= zy) {
      safeY = Number((minY - clearance).toFixed(2));
      safeX = Number(Math.max(minX, Math.min(maxX, targetPt.x)).toFixed(2));
    } else {
      safeY = Number((maxY + clearance).toFixed(2));
      safeX = Number(Math.max(minX, Math.min(maxX, targetPt.x)).toFixed(2));
    }
  }

  // Kiem tra gioi han bien mat bang san sanh
  safeX = Number(Math.max(0.8, Math.min(9.2, safeX)).toFixed(2));
  safeY = Number(Math.max(0.8, Math.min(5.2, safeY)).toFixed(2));

  // Tranh de diem an toan roi vao vung KEEP_OUT
  const keepOutCheck = getActiveSimulatorZone(safeX, safeY, zones);
  if (keepOutCheck && keepOutCheck.type === 'KEEP_OUT') {
    if (safeX > 4.4) safeX = 5.4;
    else safeX = 3.2;
    safeY = 2.85;
  }

  return {
    isNoStop: true,
    safePoint: { x: safeX, y: safeY },
    zone: activeZone,
    originalPoint: { x: Number(targetPt.x.toFixed(2)), y: Number(targetPt.y.toFixed(2)) },
  };
};

// Chuyen toa do Met (ROS: X 0..10m, Y 0..6m) sang Toa do SVG Canvas (1000 x 600)
export const meterToSvg = (mx, my) => {
  const safeX = typeof mx === 'number' && !isNaN(mx) ? mx : 3.7;
  const safeY = typeof my === 'number' && !isNaN(my) ? my : 5.0;
  const clampedX = Math.max(0, Math.min(10.0, safeX));
  const clampedY = Math.max(0, Math.min(6.0, safeY));
  const svgX = 50 + (clampedX / 10.0) * 900;
  const svgY = 550 - (clampedY / 6.0) * 500;
  return { x: svgX, y: svgY };
};

// Chuyen nguoc tu Toa do SVG Canvas sang Toa do Met (ROS: X 0..10m, Y 0..6m)
export const svgToMeter = (svgX, svgY) => {
  const clampedSvgX = Math.max(50, Math.min(950, svgX));
  const clampedSvgY = Math.max(50, Math.min(550, svgY));
  const mx = ((clampedSvgX - 50) / 900) * 10.0;
  const my = ((550 - clampedSvgY) / 500) * 6.0;
  return {
    x: Number(mx.toFixed(2)),
    y: Number(my.toFixed(2)),
  };
};

// Tinh toan lo trinh di chuyen co ban trong sanh (Tranh vach ngan trung tam x=4.4m va quay tiep tan)
const getLobbyBaseWaypoints = (from, to) => {
  const points = [];
  const fromIsLeft = from.x < 4.4;
  const toIsLeft = to.x < 4.4;

  const isEastOrBehindDesk = (pt) => pt.x >= 5.6 && pt.y <= 2.8;
  const isWestCorridor = (pt) => pt.x < 5.6 && pt.y <= 2.8;

  if (fromIsLeft && !toIsLeft) {
    // DI TU GIAN TRAI (SOFA / CHARGER) SANG GIAN PHAI (FRONT DESK / WC / STAFF)
    if (Math.abs(from.y - 2.85) > 0.3 || from.x < 3.6) {
      points.push({ x: 3.8, y: 2.85 });
    }
    points.push({ x: 4.4, y: 2.85 });
    points.push({ x: 5.1, y: 2.85 });

    if (isEastOrBehindDesk(to)) {
      // Dich den nam sau hoac ben phai quay Le Tan: Vong qua hanh lang Bac (y=2.85) roi moi xuong
      points.push({ x: 7.1, y: 2.85 });
      if (to.y < 2.4) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(to.y, 2.2)) });
      }
    } else if (isWestCorridor(to)) {
      if (to.y < 2.0) {
        points.push({ x: 5.2, y: 1.8 });
      }
    } else if (to.y > 3.6) {
      points.push({ x: 5.2, y: 4.0 });
    }
  } else if (!fromIsLeft && toIsLeft) {
    // DI TU GIAN PHAI (FRONT DESK / WC / STAFF) SANG GIAN TRAI (SOFA / LOBBY)
    if (isEastOrBehindDesk(from)) {
      // Robot dang o sau hoac ben phai quay Le Tan: Phai thoat ra phia Dong (x=7.1) roi moi len hanh lang Bac
      if (from.x < 7.0) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(from.y, 2.2)) });
      }
      points.push({ x: 7.1, y: 2.85 });
      points.push({ x: 5.1, y: 2.85 });
    } else if (isWestCorridor(from)) {
      if (from.y < 2.0) {
        points.push({ x: 5.2, y: 1.8 });
      }
      points.push({ x: 5.1, y: 2.85 });
    } else {
      if (from.y > 3.6 && from.x > 6.0) {
        points.push({ x: 5.2, y: 4.0 });
      }
      points.push({ x: 5.1, y: 2.85 });
    }

    // Qua cua thong sanh
    points.push({ x: 4.4, y: 2.85 });
    points.push({ x: 3.8, y: 2.85 });

    // Tiep can Gian Trai (tranh bo sofa giua)
    if (to.y > 3.4 && to.x < 2.0) {
      points.push({ x: 2.5, y: to.y });
    }
  } else if (!fromIsLeft && !toIsLeft) {
    // DI CHUYEN NOI BO GIAN PHAI
    const fromEast = isEastOrBehindDesk(from);
    const toEast = isEastOrBehindDesk(to);
    const fromWest = isWestCorridor(from);
    const toWest = isWestCorridor(to);

    if (fromWest && toEast) {
      // Tu phia Tay quay sang phia Dong quay: Vong qua hanh lang Bac
      points.push({ x: 5.2, y: 2.85 });
      points.push({ x: 7.1, y: 2.85 });
      if (to.y < 2.4) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(to.y, 2.2)) });
      }
    } else if (fromEast && toWest) {
      // Tu phia Dong quay sang phia Tay quay: Vong qua hanh lang Bac
      if (from.x < 7.0) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(from.y, 2.2)) });
      }
      points.push({ x: 7.1, y: 2.85 });
      points.push({ x: 5.2, y: 2.85 });
      if (to.y < 2.0) {
        points.push({ x: 5.2, y: 1.8 });
      }
    } else if (fromEast && from.y < 2.8 && to.y > 2.8) {
      // Tu trong/sau quay di len phia Bac (WC / Thang May)
      if (from.x < 7.0) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(from.y, 2.2)) });
      }
      points.push({ x: 7.1, y: 2.85 });
    } else if (from.y > 2.8 && toEast && to.y < 2.8) {
      // Tu phia Bac di xuong trong/sau quay
      points.push({ x: 7.1, y: 2.85 });
      if (to.y < 2.4) {
        points.push({ x: 7.1, y: Math.max(0.8, Math.min(to.y, 2.2)) });
      }
    } else {
      // Kiem tra vuong Quay Front Desk theo truc Doc (Nam <-> Bac o khu vuc hanh lang Tay)
      const crossesDeskY = (from.y < 2.3 && to.y > 3.5) || (from.y > 3.5 && to.y < 2.3);
      if (crossesDeskY && (from.x < 5.6 || to.x < 5.6)) {
        points.push({ x: 5.2, y: 2.85 });
      }
    }
  } else {
    // DI CHUYEN NOI BO GIAN TRAI (Tranh cac bo sofa ben trai)
    if (from.x < 1.8 || to.x < 1.8) {
      points.push({ x: 2.6, y: Number(((from.y + to.y) / 2).toFixed(2)) });
    }
  }
  return points;
};

// THUAT TOAN DINH TUYEN NE TUONG VA VAT CAN TRONG SANH (Ground Floor Lobby)
// Tranh vach ngan x=4.4m, quay tiep tan va vach tuong Phong Noi Bo Staff Only
export const calculateSafeWaypoints = (from, to) => {
  const points = [{ x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) }];

  const isInsideStaff = (pt) => pt.x >= 8.2 && pt.y <= 3.05;
  const fromStaff = isInsideStaff(from);
  const toStaff = isInsideStaff(to);

  // Diem hanh lang tiep can va tam khe cua phong Staff Only
  const staffApproach = { x: 7.85, y: 2.7 };
  const staffDoor = { x: 8.35, y: 2.65 };

  if (!fromStaff && toStaff) {
    // Di tu ngoai sanh VAO phong Staff Only: tap ket truoc cua -> xuyen qua tam cua -> vao dich
    const approachPts = getLobbyBaseWaypoints(from, staffApproach);
    points.push(...approachPts);
    points.push(staffApproach);
    points.push(staffDoor);
  } else if (fromStaff && !toStaff) {
    // Di tu trong phong Staff Only RA ngoai sanh: xuyen qua tam cua -> ra hanh lang truoc cua -> toi dich
    points.push(staffDoor);
    points.push(staffApproach);
    const leavePts = getLobbyBaseWaypoints(staffApproach, to);
    points.push(...leavePts);
  } else if (fromStaff && toStaff) {
    // Di chuyen noi bo trong phong Staff Only
  } else {
    // Di chuyen ngoai sanh binh thuong
    const lobbyPts = getLobbyBaseWaypoints(from, to);
    points.push(...lobbyPts);
  }

  // Them diem dich cuoi cung
  points.push({ x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) });

  // Loc bo cac diem trung nhau hoac qua gan (< 0.15m)
  const filtered = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const cur = points[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.15) {
      filtered.push(cur);
    }
  }

  return filtered;
};

// GIAI MA VA HIEN THI CHI TIET CHO TUNG ENUM BUOC (SHOW, SPEAK, GREET, LISTEN, v.v.)
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
