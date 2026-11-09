// Hinh hoc vung chuc nang tren map (tab Physical Map). Vung = hinh chu nhat thang truc,
// x/y la TAM (m, khung map), width/height (m) - cung quy uoc voi backend (mask Nav2).
//   KEEP_OUT   : Nav2 KeepoutFilter -> planner tu di duong vong; khong nhan endpoint ben trong.
//   SPEED_ZONE : Nav2 SpeedFilter -> /speed_limit (m/s) khi xe o trong vung.
//   NO_STOP    : duoc di ngang qua, KHONG duoc dung => khong nhan endpoint ben trong.

export const MIN_ZONE_SIZE_M = 0.2;

const round2 = (v) => Math.round(v * 100) / 100;

export function zoneBounds(zone) {
  const halfW = (Number(zone.width) || 0) / 2;
  const halfH = (Number(zone.height) || 0) / 2;
  const x = Number(zone.x) || 0;
  const y = Number(zone.y) || 0;
  return { minX: x - halfW, maxX: x + halfW, minY: y - halfH, maxY: y + halfH };
}

export function zoneCorners(zone) {
  const { minX, maxX, minY, maxY } = zoneBounds(zone);
  return {
    nw: { x: minX, y: maxY },
    ne: { x: maxX, y: maxY },
    sw: { x: minX, y: minY },
    se: { x: maxX, y: minY },
  };
}

export function isPointInZone(x, y, zone) {
  const { minX, maxX, minY, maxY } = zoneBounds(zone);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function rectFromBounds(minX, maxX, minY, maxY) {
  return {
    x: round2((minX + maxX) / 2),
    y: round2((minY + maxY) / 2),
    width: round2(maxX - minX),
    height: round2(maxY - minY),
  };
}

// Keo chuot tu a toi b (bat ky huong nao). Qua nho (bam nham) => null.
export function zoneFromCorners(a, b, minSize = MIN_ZONE_SIZE_M) {
  if (Math.abs(a.x - b.x) < minSize || Math.abs(a.y - b.y) < minSize) return null;
  return rectFromBounds(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y));
}

// Keo 1 goc ('nw' | 'ne' | 'sw' | 'se', n = phia y lon) toi point; goc doi dien dung yen.
// Khong cho lat vung hay nho hon minSize.
export function resizeZoneFromCorner(zone, corner, point, minSize = MIN_ZONE_SIZE_M) {
  let { minX, maxX, minY, maxY } = zoneBounds(zone);
  if (corner.includes('e')) maxX = Math.max(point.x, minX + minSize);
  else minX = Math.min(point.x, maxX - minSize);
  if (corner.includes('n')) maxY = Math.max(point.y, minY + minSize);
  else minY = Math.min(point.y, maxY - minSize);
  return rectFromBounds(minX, maxX, minY, maxY);
}

// Trang thai vung giam toc cho dong ho toc do tren map. Su that la gioi han Nav2 dang ap
// (health.speed_limit_mps tu bridge, null = khong gioi han); hinh hoc vung chi de biet ten vung
// va phat hien vung ve tren Web ma Nav2 chua ap (chua Luu / Nav2 chay map khac).
const SPEED_ZONE_EDGE_M = 0.1; // sat mep: Nav2 xet tam xe + tin 1 Hz => khong bao "chua ap" o day

export function speedZoneStatus(pose, zones, health) {
  const limit = Number.isFinite(health?.speed_limit_mps) ? health.speed_limit_mps : null;
  const zone = (zones || []).find((z) => z.type === 'SPEED_ZONE' && isPointInZone(pose.x, pose.y, z)) || null;
  const name = zone ? ` “${zone.name || zone.id}”` : '';
  if (limit !== null) {
    const floor = health?.motor_min_linear_speed_mps;
    const warning = health?.speed_limit_below_motor_floor && Number.isFinite(floor)
      ? `Vùng đặt ${limit.toFixed(2)} m/s thấp hơn mức xe chạy được: xe chạy chậm nhất ~${floor.toFixed(2)} m/s.`
      : '';
    return { active: true, limitMps: limit, zone, label: `VÙNG GIẢM TỐC${name} · tối đa ${limit.toFixed(2)} m/s`, warning };
  }
  let warning = '';
  if (zone) {
    const { minX, maxX, minY, maxY } = zoneBounds(zone);
    const depth = Math.min(pose.x - minX, maxX - pose.x, pose.y - minY, maxY - pose.y);
    if (depth >= SPEED_ZONE_EDGE_M) {
      warning = `Xe đang ở vùng${name} nhưng Nav2 chưa áp giới hạn tốc độ: bấm Lưu vùng, hoặc bật lại Nav2 với đúng map này.`;
    }
  }
  return { active: false, limitMps: null, zone, label: '', warning };
}

// Vung khong duoc co endpoint ben trong: cam dung (chi di ngang qua) va cam vao (khong toi duoc).
// SPEED_ZONE van cho dat endpoint. Backend (map.py) giu cung luat cho API.
export const NO_ENDPOINT_ZONE_TYPES = ['NO_STOP', 'KEEP_OUT'];
const ZONE_KIND_VI = { NO_STOP: 'cấm dừng', KEEP_OUT: 'cấm vào' };

// Dat/doi endpoint toi diem nay co hop le? null = duoc; chuoi = ly do (hien cho admin).
export function endpointPlacementViolation(point, zones) {
  const zone = (zones || []).find((z) => NO_ENDPOINT_ZONE_TYPES.includes(z.type) && isPointInZone(point.x, point.y, z));
  if (!zone) return null;
  return `Không thể đặt endpoint trong vùng ${ZONE_KIND_VI[zone.type]} “${zone.name || zone.id}”: `
    + (zone.type === 'NO_STOP' ? 'robot chỉ được đi ngang qua, không được dừng ở đây. ' : 'robot không được vào vùng này. ')
    + 'Chọn chỗ khác ngoài vùng.';
}

// Vung (moi ve / vua doi / doi loai) de len endpoint co san? null = khong; con lai = danh sach
// endpoint bi de + thong bao bat xoa endpoint truoc.
export function zoneEndpointConflict(zone, endpoints) {
  if (!NO_ENDPOINT_ZONE_TYPES.includes(zone?.type)) return null;
  const covered = (endpoints || []).filter((ep) => isPointInZone(Number(ep.x), Number(ep.y), zone));
  if (covered.length === 0) return null;
  const names = covered.map((ep) => `“${ep.name || ep.id}”`).join(', ');
  return {
    endpoints: covered,
    message: `Không thể đặt vùng ${ZONE_KIND_VI[zone.type]}${zone.name ? ` “${zone.name}”` : ''} đè lên endpoint ${names}. `
      + 'Hãy xóa endpoint đó trước (tab Điểm Mốc), rồi vẽ lại vùng.',
  };
}

// Ly do khong duoc chon endpoint nay (null = hop le). KEEP_OUT uu tien hon NO_STOP.
export function endpointZoneViolation(target, zones) {
  const inside = (zones || []).filter((z) => isPointInZone(target.x, target.y, z));
  const keepOut = inside.find((z) => z.type === 'KEEP_OUT');
  if (keepOut) {
    return `Endpoint nằm trong vùng cấm vào “${keepOut.name || keepOut.id}”. `
      + 'Chọn điểm bên ngoài vùng; robot sẽ tự đi đường vòng quanh vùng cấm.';
  }
  const noStop = inside.find((z) => z.type === 'NO_STOP');
  if (noStop) {
    return `Endpoint nằm trong vùng cấm dừng “${noStop.name || noStop.id}”: robot chỉ được đi ngang qua, `
      + 'không được dừng ở đây. Chọn điểm khác.';
  }
  return null;
}
