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
