// x/y = centre (map metres), width/height = local dimensions, yaw = CCW degrees.
// Missing yaw means zero for existing zones; backend and robot use the same convention.
//   KEEP_OUT   : Nav2 KeepoutFilter -> planner tu di duong vong; khong nhan endpoint ben trong.
//   SPEED_ZONE : Nav2 SpeedFilter -> /speed_limit (m/s) khi xe o trong vung.
//   NO_STOP    : duoc di ngang qua, KHONG duoc dung => khong nhan endpoint ben trong.

export const MIN_ZONE_SIZE_M = 0.2;
export const MAX_ZONE_VERTICES = 64;
export const isPolygonZone = (zone) => Array.isArray(zone?.vertices);

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const EPS = 1e-9;

export function closestPointOnSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function segmentDistance(p, a, b) {
  const nearest = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - nearest.x, p.y - nearest.y);
}

// Use canvas coordinates here so the clickable edge width stays constant when zooming.
export function polygonEdgeAtPoint(points, point, tolerance = 8) {
  let nearest = null;
  points.forEach((a, edgeIndex) => {
    const projected = closestPointOnSegment(point, a, points[(edgeIndex + 1) % points.length]);
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (distance <= tolerance && (!nearest || distance < nearest.distance)) {
      nearest = { edgeIndex, point: projected, distance };
    }
  });
  return nearest;
}

function segmentsIntersect(a, b, c, d) {
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS))
    && ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))) return true;
  return [[ac, c, a, b], [ad, d, a, b], [ca, a, c, d], [cb, b, c, d]]
    .some(([turn, p, u, v]) => Math.abs(turn) <= EPS && segmentDistance(p, u, v) <= EPS);
}

export function polygonValidationError(points) {
  if (!Array.isArray(points) || points.length < 3 || points.length > MAX_ZONE_VERTICES) return 'Đa giác cần từ 3 đến 64 đỉnh.';
  if (!points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return 'Tọa độ đỉnh không hợp lệ.';
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= EPS) return 'Các đỉnh không được trùng nhau.';
    if (Math.abs(cross(a, b, c)) <= EPS && (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y) > EPS) {
      return 'Các cạnh không được chồng lên nhau.';
    }
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % n])) return 'Các cạnh không được cắt hoặc chạm nhau. Hãy chỉnh lại đỉnh.';
    }
  }
  const area2 = points.slice(1, -1).reduce((sum, p, i) => sum + cross(points[0], p, points[i + 2]), 0);
  return Math.abs(area2) < 0.02 ? 'Diện tích vùng phải từ 0.01 m².' : null;
}

// Bounding box metadata only; vertices are the authoritative polygon shape.
export function zoneFromVertices(vertices) {
  const b = zoneBounds({ vertices });
  return { vertices, x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2,
    width: b.maxX - b.minX, height: b.maxY - b.minY, yaw: 0 };
}

export function removeZoneVertex(zone, index) {
  if (!isPolygonZone(zone) || !Number.isInteger(index) || index < 0 || index >= zone.vertices.length) {
    return { error: 'Hãy chọn một đỉnh trên vùng đa giác.' };
  }
  if (zone.vertices.length <= 3) return { error: 'Đa giác phải giữ ít nhất 3 đỉnh. Không thể xóa thêm đỉnh của tam giác.' };
  // Removing a vertex joins its two neighbours, including the first/last pair.
  const vertices = zone.vertices.filter((_, i) => i !== index);
  const error = polygonValidationError(vertices);
  return error ? { error } : { zone: { ...zone, ...zoneFromVertices(vertices) } };
}

export function insertZoneVertex(zone, edgeIndex, point) {
  if (!isPolygonZone(zone) || !Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= zone.vertices.length) {
    return { error: 'Hãy chọn một cạnh trên vùng đa giác.' };
  }
  if (zone.vertices.length >= MAX_ZONE_VERTICES) return { error: 'Đa giác tối đa 64 đỉnh. Hãy xóa bớt đỉnh trước khi thêm.' };
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return { error: 'Tọa độ đỉnh không hợp lệ.' };
  // Snap to the edge: inserting alone must not expand or shrink the zone.
  const projected = closestPointOnSegment(point, zone.vertices[edgeIndex], zone.vertices[(edgeIndex + 1) % zone.vertices.length]);
  const vertexIndex = edgeIndex + 1;
  const vertices = [...zone.vertices.slice(0, vertexIndex), projected, ...zone.vertices.slice(vertexIndex)];
  const error = polygonValidationError(vertices);
  return error ? { error } : { zone: { ...zone, ...zoneFromVertices(vertices) }, vertexIndex };
}

export function translateZone(zone, dx, dy) {
  return isPolygonZone(zone)
    ? { ...zone, ...zoneFromVertices(zone.vertices.map((p) => ({ x: p.x + dx, y: p.y + dy }))) }
    : { ...zone, x: zone.x + dx, y: zone.y + dy };
}

export function polygonEdgeDistance(point, vertices) {
  return Math.min(...vertices.map((a, i) => segmentDistance(point, a, vertices[(i + 1) % vertices.length])));
}

const round2 = (v) => Math.round(v * 100) / 100;
export const normalizeZoneYaw = (value) => ((Number(value) || 0) % 360 + 540) % 360 - 180;

export function zoneLocalPoint(zone, point) {
  const a = normalizeZoneYaw(zone.yaw) * Math.PI / 180;
  const dx = point.x - Number(zone.x || 0), dy = point.y - Number(zone.y || 0);
  return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a) };
}

export function zoneWorldPoint(zone, point) {
  const a = normalizeZoneYaw(zone.yaw) * Math.PI / 180;
  return { x: Number(zone.x || 0) + point.x * Math.cos(a) - point.y * Math.sin(a),
    y: Number(zone.y || 0) + point.x * Math.sin(a) + point.y * Math.cos(a) };
}

export function zoneBounds(zone) {
  const points = isPolygonZone(zone) ? zone.vertices : Object.values(zoneCorners(zone));
  return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
}

export function zoneCorners(zone) {
  const w = Number(zone.width || 0) / 2, h = Number(zone.height || 0) / 2;
  return {
    nw: zoneWorldPoint(zone, { x: -w, y: h }),
    ne: zoneWorldPoint(zone, { x: w, y: h }),
    sw: zoneWorldPoint(zone, { x: -w, y: -h }),
    se: zoneWorldPoint(zone, { x: w, y: -h }),
  };
}

export function zoneRotationHandle(zone, offsetM) {
  return zoneWorldPoint(zone, { x: 0, y: Number(zone.height) / 2 + offsetM });
}

export function rotateZoneFromPointer(zone, start, point, snap = false) {
  const startAngle = Math.atan2(start.y - zone.y, start.x - zone.x);
  const angle = Math.atan2(point.y - zone.y, point.x - zone.x);
  const yaw = normalizeZoneYaw(Number(zone.yaw || 0) + (angle - startAngle) * 180 / Math.PI);
  return { yaw: normalizeZoneYaw(snap ? Math.round(yaw / 15) * 15 : Math.round(yaw * 10) / 10) };
}

export function isPointInZone(x, y, zone) {
  if (isPolygonZone(zone)) {
    const points = zone.vertices;
    let inside = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if (segmentDistance({ x, y }, a, b) <= EPS) return true;
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  const p = zoneLocalPoint(zone, { x, y });
  return Math.abs(p.x) <= Number(zone.width) / 2 + 1e-9 && Math.abs(p.y) <= Number(zone.height) / 2 + 1e-9;
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
  const p = zoneLocalPoint(zone, point);
  const sx = corner.includes('e') ? 1 : -1, sy = corner.includes('n') ? 1 : -1;
  const anchor = { x: -sx * Number(zone.width) / 2, y: -sy * Number(zone.height) / 2 };
  const width = Math.max(minSize, sx * (p.x - anchor.x));
  const height = Math.max(minSize, sy * (p.y - anchor.y));
  const centre = zoneWorldPoint(zone, { x: anchor.x + sx * width / 2, y: anchor.y + sy * height / 2 });
  return { x: centre.x, y: centre.y, width, height, yaw: normalizeZoneYaw(zone.yaw) };
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
    const p = zoneLocalPoint(zone, pose);
    const depth = isPolygonZone(zone) ? polygonEdgeDistance(pose, zone.vertices)
      : Math.min(Number(zone.width) / 2 - Math.abs(p.x), Number(zone.height) / 2 - Math.abs(p.y));
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
