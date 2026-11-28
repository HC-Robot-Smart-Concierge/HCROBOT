/**
 * Chặng 1 chỉ đường (robot -> thang máy) trên CHÍNH map SLAM mà Nav2 đang nạp.
 *
 * Chỉ ĐỌC dữ liệu, không gửi lệnh / không đổi gì phía robot:
 *  - Vị trí: (map -> odom từ /tf) ∘ (odom -> base_link từ /odom), giống tab Physical Map.
 *  - Map: .yaml/.pgm qua /api/v1/map/layouts (resolution + origin y như map_server).
 *  - Đích: waypoint tên "Thang máy" của map đó (/api/v1/map/waypoints).
 * Thiếu bất kỳ phần nào => trả về null, FloorMap dùng lại map khách sạn + đường cố định cũ.
 */
import { useEffect, useState } from 'react';
import { RosbridgeClient, ROS_TOPICS, ROS_MSG_TYPES, quaternionToYaw } from './rosbridgeService.js';
import { composeMapPose } from '../pages/admin/tabs/physicalMapNavigation.js';
import { listMapLayouts, fetchWaypoints } from './workflowApi.js';
import { fetchGuestNavLayout } from './guestNavLayoutApi.js';
import { findLayoutElevator } from '../components/robot/guestNavSymbols.jsx';

const ROSBRIDGE_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';
// Map dùng khi backend không báo được Nav2 đang nạp map nào
const FALLBACK_MAP_ID = import.meta.env.VITE_GUEST_NAV_MAP || 'mapchinh';
const POSE_STALE_MS = 3000;
const MIN_MOVE_M = 0.05; // bỏ rung nhỏ (1 ô map) để đường không vẽ lại liên tục
const ELEVATOR_NAME = /thang\s*m[áa]y|elevator|\blift\b/i;

const stripSlash = (frame) => String(frame || '').replace(/^\//, '');

// ---------------------------------------------------------------------------
// Toạ độ: mét (frame map) <-> ô ảnh PGM (hàng 0 là đỉnh ảnh), đúng quy ước map_server
// ---------------------------------------------------------------------------
export const worldToCell = (pt, map) => ({
  x: (pt.x - map.originX) / map.resolution,
  y: map.height - (pt.y - map.originY) / map.resolution,
});

// ---------------------------------------------------------------------------
// PGM -> lưới chiếm chỗ + ảnh hiển thị
// ---------------------------------------------------------------------------
export const parsePgm = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  const tokens = [];
  while (tokens.length < 4 && pos < bytes.length) {
    while (pos < bytes.length && /\s/.test(String.fromCharCode(bytes[pos]))) pos += 1;
    if (bytes[pos] === 0x23) {
      while (pos < bytes.length && bytes[pos] !== 0x0a) pos += 1;
      continue;
    }
    let tok = '';
    while (pos < bytes.length && !/\s/.test(String.fromCharCode(bytes[pos]))) tok += String.fromCharCode(bytes[pos++]);
    tokens.push(tok);
  }
  pos += 1;
  const [magic, w, h] = tokens;
  const width = Number(w);
  const height = Number(h);
  if (magic !== 'P5' || !width || !height || bytes.length < pos + width * height) throw new Error('PGM không hợp lệ');
  return { width, height, pixels: bytes.slice(pos, pos + width * height) };
};

// trinary map_server: 254 = trống, 0 = vật cản, 205 = chưa biết
const isFreePixel = (v) => v >= 250;

/**
 * Ảnh cho khách: vẽ phóng to (RENDER_SCALE px / ô), sàn màu kem, tường nét tròn mượt,
 * bỏ chấm nhiễu lẻ, cắt sát vùng đã quét. Trả về { url, bbox } theo toạ độ ô.
 */
const RENDER_SCALE = 10;
export const renderGuestImage = ({ width, height, pixels }, opts = {}) => {
  const { floorColor = '#FBF9F4', wallColor = '#57534E', minCluster = 2, erased = null } = opts;
  // Ô bị Admin tẩy => coi như "chưa biết" (không vẽ). Chỉ ảnh hưởng hiển thị, không ảnh hưởng tính đường.
  const erasedSet = erased && erased.length ? new Set(erased) : null;
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 205;
    const i = y * width + x;
    return erasedSet && erasedSet.has(i) ? 205 : pixels[i];
  };
  const isWall = (x, y) => at(x, y) < 100;
  // Bỏ cụm tường nhỏ (nhiễu LiDAR): giữ cụm 8-hướng có >= minCluster ô
  const keep = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    if (seen[i] || !isWall(i % width, Math.floor(i / width))) continue;
    const comp = [i];
    seen[i] = 1;
    for (let k = 0; k < comp.length; k += 1) {
      const cx = comp[k] % width;
      const cy = Math.floor(comp[k] / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          const ni = ny * width + nx;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && !seen[ni] && isWall(nx, ny)) { seen[ni] = 1; comp.push(ni); }
        }
      }
    }
    if (comp.length >= minCluster) for (const c of comp) keep[c] = 1;
  }
  const wall = (x, y) => x >= 0 && y >= 0 && x < width && y < height && keep[y * width + x] === 1;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isFreePixel(at(x, y)) || wall(x, y)) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = width - 1; y1 = height - 1; }
  const bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  const S = RENDER_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = bbox.w * S;
  canvas.height = bbox.h * S;
  const ctx = canvas.getContext('2d');
  ctx.translate(-bbox.x * S, -bbox.y * S);

  // Sàn: ô trống, nới nhẹ để không lộ khe giữa các ô
  if (floorColor) {
    ctx.fillStyle = floorColor;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (isFreePixel(at(x, y))) ctx.fillRect(x * S - 1, y * S - 1, S + 2, S + 2);
      }
    }
  }
  // Tường: nối các ô tường kề nhau bằng nét tròn => cạnh mượt thay vì răng cưa
  ctx.strokeStyle = wallColor;
  ctx.fillStyle = wallColor;
  ctx.lineWidth = S * 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!wall(x, y)) continue;
      const cx = (x + 0.5) * S;
      const cy = (y + 0.5) * S;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        if (wall(x + dx, y + dy)) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * S, cy + dy * S);
        }
      }
    }
  }
  ctx.stroke();
  return { url: canvas.toDataURL('image/png'), bbox };
};

/** Đường gấp khúc -> path SVG bo tròn góc (bán kính r theo đơn vị ô). */
export const roundedPath = (pts, r = 3) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const p = pts[i];
    const a = pts[i - 1];
    const b = pts[i + 1];
    const la = Math.hypot(p.x - a.x, p.y - a.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const k = Math.min(r, la / 2, lb / 2);
    const s1 = { x: p.x + ((a.x - p.x) / la) * k, y: p.y + ((a.y - p.y) / la) * k };
    const s2 = { x: p.x + ((b.x - p.x) / lb) * k, y: p.y + ((b.y - p.y) / lb) * k };
    d += ` L ${s1.x.toFixed(2)} ${s1.y.toFixed(2)} Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
};

// ---------------------------------------------------------------------------
// Tìm đường A* trên lưới (8 hướng), nở vật cản để đường không sát tường
// ---------------------------------------------------------------------------
export const buildWalkableGrid = ({ width, height, pixels }, inflateCells = 2) => {
  const blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isFreePixel(pixels[y * width + x])) continue;
      for (let dy = -inflateCells; dy <= inflateCells; dy += 1) {
        for (let dx = -inflateCells; dx <= inflateCells; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && dx * dx + dy * dy <= inflateCells * inflateCells) {
            blocked[ny * width + nx] = 1;
          }
        }
      }
    }
  }
  return { width, height, blocked };
};

const nearestFree = (grid, cx, cy, maxR = 12) => {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let r = 0; r <= maxR; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = x0 + dx;
        const y = y0 + dy;
        if (x >= 0 && y >= 0 && x < grid.width && y < grid.height && !grid.blocked[y * grid.width + x]) return { x, y };
      }
    }
  }
  return null;
};

/**
 * Khoảng cách (ô) từ mỗi ô tới ô cấm gần nhất — chamfer 2 lượt (1, √2). Lưu cache trên grid.
 * Dùng để đường đi ưu tiên giữa hành lang / giữa khe cửa thay vì lướt sát mép tường.
 */
export const distanceField = (grid) => {
  if (grid.dist) return grid.dist;
  const { width: W, height: H, blocked } = grid;
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i += 1) d[i] = blocked[i] ? 0 : INF;
  const R2 = Math.SQRT2;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + R2);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + R2);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y -= 1) {
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + R2);
        if (x > 0) v = Math.min(v, d[i + W - 1] + R2);
      }
      d[i] = v;
    }
  }
  grid.dist = d;
  return d;
};

// Đoạn thẳng a->b đi được nếu không chạm ô cấm và luôn cách tường >= minDist ô
const lineClear = (grid, a, b, minDist = 0) => {
  const dist = minDist > 0 ? distanceField(grid) : null;
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2) || 1;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
    const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
    const k = y * grid.width + x;
    if (grid.blocked[k]) return false;
    if (dist && dist[k] < minDist) return false;
  }
  return true;
};

/**
 * Trả về danh sách điểm (toạ độ ô) từ start tới goal, hoặc null nếu không có đường.
 * opts.preferCells: khoảng cách "dễ chịu" tới tường (ô). Ô gần tường hơn mức này bị phạt chi phí,
 * nên đường đi giữa hành lang; bước làm thẳng cũng không được cắt sát tường.
 */
export const findGridPath = (grid, start, goal, opts = {}) => {
  const prefer = Math.max(1, opts.preferCells ?? 6);
  const dist = distanceField(grid);
  const WALL_PENALTY = 4;
  const nearWall = (i) => (dist[i] >= prefer ? 0 : WALL_PENALTY * ((prefer - dist[i]) / prefer) ** 2);
  const s = nearestFree(grid, start.x, start.y);
  const g = nearestFree(grid, goal.x, goal.y);
  if (!s || !g) return null;
  const W = grid.width;
  const idx = (x, y) => y * W + x;
  const gScore = new Float64Array(W * grid.height).fill(Infinity);
  const came = new Int32Array(W * grid.height).fill(-1);
  const closed = new Uint8Array(W * grid.height);
  const h = (x, y) => Math.hypot(x - g.x, y - g.y);
  // Hàng đợi ưu tiên (binary heap) theo f = g + h
  const heap = [];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (heap[pi][0] <= heap[i][0]) break;
      [heap[pi], heap[i]] = [heap[i], heap[pi]];
      i = pi;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  push([h(s.x, s.y), s.x, s.y]);
  gScore[idx(s.x, s.y)] = 0;
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const [, x, y] = pop();
    const ci = idx(x, y);
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (x === g.x && y === g.y) {
      const raw = [];
      for (let k = ci; k !== -1; k = came[k]) raw.push({ x: k % W, y: Math.floor(k / W) });
      raw.reverse();
      // Rút gọn: bỏ điểm thừa khi nhìn thẳng được mà vẫn giữ khoảng cách với tường
      // (không đòi cách xa hơn chính các điểm gốc — để vẫn qua được khe cửa hẹp)
      const minAlong = (p, q) => Math.min(prefer * 0.7, dist[p.y * W + p.x], dist[q.y * W + q.x]);
      const out = [raw[0]];
      let anchor = raw[0];
      for (let i = 2; i < raw.length; i += 1) {
        if (!lineClear(grid, anchor, raw[i], minAlong(anchor, raw[i]) - 0.01)) {
          anchor = raw[i - 1];
          out.push(anchor);
        }
      }
      if (raw.length > 1) out.push(raw[raw.length - 1]);
      return out;
    }
    for (const [dx, dy, cost] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= grid.height) continue;
      const ni = idx(nx, ny);
      if (grid.blocked[ni] || closed[ni]) continue;
      // Không cắt góc chéo qua vật cản
      if (dx && dy && (grid.blocked[idx(x + dx, y)] || grid.blocked[idx(x, y + dy)])) continue;
      const tentative = gScore[ci] + cost * (1 + nearWall(ni));
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        came[ni] = ci;
        push([tentative + h(nx, ny), nx, ny]);
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Nạp map Nav2 đang dùng + waypoint thang máy
// ---------------------------------------------------------------------------
async function resolveActiveMapId() {
  try {
    const res = await fetch('/api/v1/map/ros2/runtime');
    if (res.ok) {
      const d = await res.json();
      if (d?.active_map) return d.active_map;
    }
  } catch {
    // backend chưa chạy -> dùng map mặc định
  }
  return FALLBACK_MAP_ID;
}

export async function loadGuideMap() {
  const mapId = await resolveActiveMapId();
  const layout = (await listMapLayouts()).find((m) => m.map_id === mapId);
  if (!layout) throw new Error(`Không tìm thấy map "${mapId}"`);
  const res = await fetch(`/api/v1/map/layouts/${encodeURIComponent(mapId)}/image`);
  if (!res.ok) throw new Error(`Không tải được ảnh map "${mapId}"`);
  const pgm = parsePgm(await res.arrayBuffer());
  // Layout vẽ tay (nếu có) + đích thang máy: ưu tiên icon Thang máy trong layout, sau đó waypoint
  const navLayout = await fetchGuestNavLayout(mapId).catch(() => null);
  let elevator = findLayoutElevator(navLayout);
  if (!elevator) {
    const waypoints = await fetchWaypoints(mapId).catch(() => []);
    const wp = (waypoints || []).find((w) => w.map_id === mapId && ELEVATOR_NAME.test(w.name || ''));
    elevator = wp ? { name: wp.name, x: wp.x, y: wp.y } : null;
  }
  const map = {
    mapId,
    width: pgm.width,
    height: pgm.height,
    resolution: layout.resolution,
    originX: layout.origin_x,
    originY: layout.origin_y,
  };
  return {
    map,
    image: renderGuestImage(pgm, { erased: navLayout?.erased }),
    grid: buildWalkableGrid(pgm, Math.max(1, Math.round(0.1 / layout.resolution))),
    elevator,
    navLayout,
  };
}

/** Hook: dữ liệu map Nav2 (nạp 1 lần khi bật). null nếu không dùng được. */
export function useGuideMap(enabled = true) {
  const [guide, setGuide] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadGuideMap()
      .then((g) => {
        if (!alive) return;
        if (!g.elevator) {
          console.warn(`[GuideMap] Map "${g.map.mapId}" chưa có waypoint "Thang máy" -> dùng bản đồ cố định.`);
          setGuide(null);
          return;
        }
        setGuide(g);
      })
      .catch((e) => {
        console.warn('[GuideMap] Không dùng được map Nav2:', e.message);
        if (alive) setGuide(null);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return guide;
}

/** Hook: vị trí robot (mét, frame map) từ /tf + /odom; null khi chưa có hoặc mất tín hiệu. */
export function useRobotMapPose(enabled = true) {
  const [pose, setPose] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setPose(null);
      return undefined;
    }
    let active = true;
    let mapToOdom = null;
    let odom = null;
    let last = null;
    const client = new RosbridgeClient(ROSBRIDGE_URL, { autoReconnect: true });

    const update = () => {
      const now = Date.now();
      if (!mapToOdom || !odom || now - mapToOdom.receivedAt > POSE_STALE_MS || now - odom.receivedAt > POSE_STALE_MS) return;
      const p = composeMapPose(mapToOdom, odom);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const moved = !last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_MOVE_M || Math.abs(p.yaw - last.yaw) > 0.2;
      if (last) last.seenAt = now;
      if (!moved) return;
      last = { x: p.x, y: p.y, yaw: p.yaw, seenAt: now };
      if (active) setPose({ x: p.x, y: p.y, yaw: p.yaw, updatedAt: now });
    };

    client.subscribe('/tf', 'tf2_msgs/TFMessage', (msg) => {
      for (const t of msg?.transforms || []) {
        if (stripSlash(t?.header?.frame_id) !== 'map' || stripSlash(t?.child_frame_id) !== 'odom') continue;
        const tr = t.transform?.translation;
        const rot = t.transform?.rotation;
        mapToOdom = { x: tr?.x ?? 0, y: tr?.y ?? 0, yaw: quaternionToYaw(rot?.z ?? 0, rot?.w ?? 1), receivedAt: Date.now() };
        update();
      }
    });
    client.subscribe(ROS_TOPICS.ODOM, ROS_MSG_TYPES.ODOMETRY, (msg) => {
      const pos = msg?.pose?.pose?.position;
      const ori = msg?.pose?.pose?.orientation;
      if (!pos || stripSlash(msg?.header?.frame_id) !== 'odom') return;
      odom = { x: pos.x, y: pos.y, yaw: quaternionToYaw(ori?.z ?? 0, ori?.w ?? 1), receivedAt: Date.now() };
      update();
    }, { throttleRate: 200 });
    client.connect();

    const staleTimer = setInterval(() => {
      if (last && Date.now() - last.seenAt > POSE_STALE_MS) {
        last = null;
        if (active) setPose(null);
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(staleTimer);
      client.disconnect();
    };
  }, [enabled]);

  return pose;
}
