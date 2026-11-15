import { isPointInZone, isPolygonZone, zoneCorners, segmentDistance, segmentsIntersect } from '../physicalMapZones';
import { calculateSafeWaypoints, LOBBY_OBSTACLES } from './workflowSimulatorUtils';

const CLEARANCE = 0.2;
const GRID = 0.2;
const WIDTH = 19.6, HEIGHT = 12.6;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const pointAt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const insideMap = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= CLEARANCE && p.x <= WIDTH - CLEARANCE && p.y >= CLEARANCE && p.y <= HEIGHT - CLEARANCE;

function vertices(zone) {
  if (isPolygonZone(zone)) return zone.vertices;
  const { nw, ne, se, sw } = zoneCorners(zone);
  return [nw, ne, se, sw];
}

export function simulatorGoalViolation(target, zones, language = 'EN') {
  const vi = language === 'VI';
  if (!insideMap(target)) return vi ? 'Chọn điểm bên trong sảnh.' : 'Choose a point inside the lobby.';
  for (const type of ['KEEP_OUT', 'NO_STOP']) {
    const zone = zones.find((z) => z.type === type && isPointInZone(target.x, target.y, z));
    if (zone) return type === 'KEEP_OUT'
      ? (vi ? `Điểm đến nằm trong vùng cấm vào "${zone.name}".` : `The destination is inside keep-out zone "${zone.name}".`)
      : (vi ? `Vùng "${zone.name}" cấm dừng: chọn điểm ngoài vùng để robot đi xuyên qua.` : `No stopping in "${zone.name}". Choose a destination beyond the zone to travel through it.`);
  }
  return null;
}

function collisionChecker(zones) {
  const obstacles = [
    ...LOBBY_OBSTACLES.map((box) => ({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2,
      width: box.maxX - box.minX, height: box.maxY - box.minY })),
    ...zones.filter((z) => z.type === 'KEEP_OUT'),
  ].map((zone) => ({ zone, points: vertices(zone) }));
  return (a, b) => insideMap(a) && insideMap(b) && !obstacles.some(({ zone, points }) => {
    if (isPointInZone(a.x, a.y, zone) || isPointInZone(b.x, b.y, zone)) return true;
    return points.some((p, i) => {
      const q = points[(i + 1) % points.length];
      return segmentsIntersect(a, b, p, q) || Math.min(
        segmentDistance(a, p, q), segmentDistance(b, p, q),
        segmentDistance(p, a, b), segmentDistance(q, a, b),
      ) < CLEARANCE - 1e-8;
    });
  });
}

export function isSimulatorRouteClear(path, zones = []) {
  const clear = collisionChecker(zones);
  return path.length > 0 && clear(path[0], path[0]) && path.slice(1).every((p, i) => clear(path[i], p));
}

// Use the existing lobby route if clear, then search a small grid around edited zones.
// Check whole segments (and clearance), not just waypoints, including concave polygons.
export function planSimulatorRoute(start, goal, zones = []) {
  const clear = collisionChecker(zones);
  if (!clear(start, start) || !clear(goal, goal)) return null;
  const original = calculateSafeWaypoints(start, goal);
  if (original.slice(1).every((p, i) => clear(original[i], p))) return original;

  const cols = Math.round(WIDTH / GRID) + 1, rows = Math.round(HEIGHT / GRID) + 1;
  const position = (id) => ({ x: (id % cols) * GRID, y: Math.floor(id / cols) * GRID });
  const valid = new Map();
  const isOpen = (id) => {
    if (!valid.has(id)) valid.set(id, clear(position(id), position(id)));
    return valid.get(id);
  };
  const nearest = (p) => {
    const cx = Math.round(p.x / GRID), cy = Math.round(p.y / GRID);
    for (let radius = 0; radius <= 3; radius++) {
      const candidates = [];
      for (let y = Math.max(0, cy - radius); y <= Math.min(rows - 1, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x <= Math.min(cols - 1, cx + radius); x++) {
          const id = y * cols + x;
          if (isOpen(id) && clear(p, position(id))) candidates.push(id);
        }
      }
      if (candidates.length) return candidates.sort((a, b) => distance(p, position(a)) - distance(p, position(b)))[0];
    }
    return null;
  };
  const first = nearest(start), last = nearest(goal);
  if (first === null || last === null) return null;
  const open = new Set([first]), closed = new Set(), cameFrom = new Map(), costs = new Map([[first, 0]]);
  const scores = new Map([[first, distance(position(first), goal)]]);
  while (open.size) {
    let current = null, lowest = Infinity;
    for (const id of open) if (scores.get(id) < lowest) { lowest = scores.get(id); current = id; }
    if (current === last) {
      const path = [goal];
      for (let id = current; id !== undefined; id = cameFrom.get(id)) path.push(position(id));
      path.push(start);
      path.reverse();
      const smooth = [start];
      for (let index = 0; index < path.length - 1;) {
        let next = path.length - 1;
        while (next > index + 1 && !clear(path[index], path[next])) next--;
        if (!clear(path[index], path[next])) return null;
        if (distance(smooth[smooth.length - 1], path[next]) > 1e-8) smooth.push(path[next]);
        index = next;
      }
      return smooth;
    }
    open.delete(current); closed.add(current);
    const x = current % cols, y = Math.floor(current / cols), from = position(current);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
      const next = (y + dy) * cols + x + dx;
      if (closed.has(next) || !isOpen(next) || !clear(from, position(next))) continue;
      const cost = costs.get(current) + Math.hypot(dx, dy) * GRID;
      if (cost >= (costs.get(next) ?? Infinity)) continue;
      costs.set(next, cost); cameFrom.set(next, current);
      scores.set(next, cost + distance(position(next), goal)); open.add(next);
    }
  }
  return null;
}

// Split at exact zone boundaries so even a thin speed zone cannot be skipped by a frame.
export function buildSimulatorMotion(path, zones = [], cruiseSpeed = 0.35) {
  const base = Number.isFinite(cruiseSpeed) && cruiseSpeed > 0 ? cruiseSpeed : 0.35;
  const speeds = zones.filter((z) => ['SPEED_ZONE', 'SLOW_SPEED'].includes(z.type));
  const segments = [];
  let duration = 0, totalDistance = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], direction = subtract(b, a), cuts = [0, 1];
    if (distance(a, b) < 1e-8) continue;
    for (const zone of speeds) {
      const points = vertices(zone);
      points.forEach((p, j) => {
        const edge = subtract(points[(j + 1) % points.length], p), den = cross(direction, edge);
        if (Math.abs(den) < 1e-10) return;
        const offset = subtract(p, a), t = cross(offset, edge) / den, u = cross(offset, direction) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      });
    }
    cuts.sort((x, y) => x - y);
    for (let j = 1; j < cuts.length; j++) {
      if (cuts[j] - cuts[j - 1] < 1e-9) continue;
      const from = pointAt(a, b, cuts[j - 1]), to = pointAt(a, b, cuts[j]);
      const mid = pointAt(from, to, 0.5), length = distance(from, to);
      const speed = speeds.filter((z) => isPointInZone(mid.x, mid.y, z)).reduce((limit, z) => {
        const value = Number(z.speed_limit);
        return Math.min(limit, value > 0 && Number.isFinite(value) ? value : 0.2);
      }, base);
      segments.push({ from, to, speed, length, startTime: duration, endTime: duration + length / speed,
        startDistance: totalDistance, yaw: Math.atan2(to.y - from.y, to.x - from.x) });
      duration += length / speed; totalDistance += length;
    }
  }
  return { segments, duration, totalDistance, destination: path[path.length - 1] };
}

export function sampleSimulatorMotion(motion, seconds) {
  const segment = motion.segments.find((s) => seconds < s.endTime);
  if (!segment) return { ...motion.destination, yaw: motion.segments.at(-1)?.yaw || 0, speed: 0, progress: 100 };
  const t = Math.max(0, (seconds - segment.startTime) / (segment.endTime - segment.startTime));
  return { ...pointAt(segment.from, segment.to, t), yaw: segment.yaw, speed: segment.speed,
    progress: 100 * (segment.startDistance + segment.length * t) / motion.totalDistance };
}
