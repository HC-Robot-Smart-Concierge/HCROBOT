/**
 * Tính đường đi trên layout vẽ tay (tầng khách sạn không có map Nav2).
 * Tường + nội thất lớn -> ô cấm, nở thêm khoảng cách an toàn, cửa -> mở khe, rồi A*.
 * Toạ độ layout: mét, gốc (0,0) ở góc dưới-trái tầng, y hướng lên (giống frame map ROS).
 */
import { buildWalkableGrid, findGridPath, roundedPath } from './robotFloorPose.js';
import { metersToCell } from '../components/robot/guestNavSymbols.jsx';

export const FLOOR_GRID_RES = 0.1; // 10 cm / ô
export const DEFAULT_FLOOR_SIZE = { width: 30, height: 20 };
const CLEARANCE_M = 0.15;
// Nội thất coi là vật cản khi tính đường (vật nhỏ như ghế, cây, nhãn thì bỏ qua)
export const OBSTACLE_TYPES = new Set(['reception', 'table_rect', 'table_round', 'sofa_l', 'counter_l', 'stairs', 'escalator']);

export const floorLayoutKey = (floorId) => `floor-${floorId}`;
export const isFloorLayoutKey = (key) => /^floor-/.test(String(key || ''));

/** "map" ảo cho tầng không có Nav2, cùng dạng với map Nav2 để dùng chung code vẽ. */
export const floorMapFromLayout = (layout, key = 'floor') => {
  const W = layout?.width || DEFAULT_FLOOR_SIZE.width;
  const H = layout?.height || DEFAULT_FLOOR_SIZE.height;
  return {
    mapId: key,
    width: Math.ceil(W / FLOOR_GRID_RES),
    height: Math.ceil(H / FLOOR_GRID_RES),
    resolution: FLOOR_GRID_RES,
    originX: 0,
    originY: 0,
    virtual: true,
  };
};

// Ô (cx, cy) có nằm trong hộp xoay của vật thể không (toạ độ ô)
const insideBox = (cx, cy, obj, map, grow = 0) => {
  const c = metersToCell(obj.x, obj.y, map);
  const rad = ((obj.rotation || 0) * Math.PI) / 180; // màn hình xoay -rotation => quay ngược lại
  const dx = cx - c.x;
  const dy = cy - c.y;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) <= obj.w / map.resolution / 2 + grow && Math.abs(ly) <= obj.h / map.resolution / 2 + grow;
};

const forBoxCells = (obj, map, grow, fn) => {
  const c = metersToCell(obj.x, obj.y, map);
  const r = Math.hypot(obj.w, obj.h) / map.resolution / 2 + grow + 1;
  for (let y = Math.max(0, Math.floor(c.y - r)); y <= Math.min(map.height - 1, Math.ceil(c.y + r)); y += 1) {
    for (let x = Math.max(0, Math.floor(c.x - r)); x <= Math.min(map.width - 1, Math.ceil(c.x + r)); x += 1) {
      if (insideBox(x + 0.5, y + 0.5, obj, map, grow)) fn(x, y);
    }
  }
};

/** Lưới đi được từ layout. Trả về { width, height, blocked } như buildWalkableGrid. */
export const rasterizeLayout = (layout, map) => {
  const { width, height } = map;
  const pixels = new Uint8Array(width * height).fill(254);
  const block = (x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = 0;
  };
  for (const wall of layout?.walls || []) {
    const half = Math.max(0.5, (wall.thickness || 0.08) / map.resolution / 2);
    const pts = wall.points.map(([x, y]) => metersToCell(x, y, map));
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2) || 1;
      for (let s = 0; s <= steps; s += 1) {
        const px = a.x + ((b.x - a.x) * s) / steps;
        const py = a.y + ((b.y - a.y) * s) / steps;
        for (let y = Math.floor(py - half); y <= Math.ceil(py + half); y += 1) {
          for (let x = Math.floor(px - half); x <= Math.ceil(px + half); x += 1) {
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= half + 0.5) block(x, y);
          }
        }
      }
    }
  }
  for (const obj of layout?.objects || []) {
    if (OBSTACLE_TYPES.has(obj.type)) forBoxCells(obj, map, 0, block);
  }
  const grid = buildWalkableGrid({ width, height, pixels }, Math.max(1, Math.round(CLEARANCE_M / map.resolution)));
  // Cửa: mở khe qua tường (cả vùng nở an toàn)
  const wallGrow = Math.round((0.12 + CLEARANCE_M) / map.resolution);
  for (const obj of layout?.objects || []) {
    if (obj.type !== 'door' && obj.type !== 'double_door') continue;
    forBoxCells(obj, map, wallGrow, (x, y) => { grid.blocked[y * width + x] = 0; });
  }
  return grid;
};

/** Đường từ start -> goal (mét). null nếu không có đường. */
export const routeOnGrid = (grid, map, startM, goalM) => {
  const start = metersToCell(startM.x, startM.y, map);
  const goal = metersToCell(goalM.x, goalM.y, map);
  // Ưu tiên cách tường ~0.6 m (giữa hành lang); qua khe hẹp thì tự chấp nhận gần hơn
  const cells = findGridPath(grid, start, goal, { preferCells: Math.round(0.6 / map.resolution) });
  if (!cells) return null;
  const pts = [start, ...cells.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 })), goal];
  const r = Math.max(2, 0.4 / map.resolution);
  return {
    start,
    goal,
    points: pts,
    pathString: roundedPath(pts, r),
    lengthM: pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) * map.resolution,
  };
};

/** Điểm đến trong layout theo mã (vd: room_301). */
export const findLayoutDestination = (layout, destKey) =>
  (layout?.objects || []).find((o) => o.type === 'destination' && o.destKey === destKey) || null;
