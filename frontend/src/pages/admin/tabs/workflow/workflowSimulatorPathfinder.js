import { FRONT_DOOR_APPROACH } from './workflowSimulatorZones';

const LOBBY_OBSTACLES = [
  // Wall segments leave the west entrance (y=6.25) and east exit (y=3.53) clear.
  { id: 'WEST_SOUTH', minX: 0, maxX: 0.25, minY: 0, maxY: 5.75 },
  { id: 'WEST_NORTH', minX: 0, maxX: 0.25, minY: 6.75, maxY: 12.60 },
  { id: 'EAST_SOUTH', minX: 19.35, maxX: 19.60, minY: 0, maxY: 3.00 },
  { id: 'EAST_NORTH', minX: 19.35, maxX: 19.60, minY: 4.06, maxY: 12.60 },
  { id: 'RECEPTION', minX: 9.70, maxX: 13.10, minY: 4.00, maxY: 8.65 },
  { id: 'PLANT_POT', minX: 5.60, maxX: 7.45, minY: 5.35, maxY: 7.15 },
  { id: 'PART_TOP',  minX: 12.50, maxX: 12.85, minY: 11.00, maxY: 12.60 },
  { id: 'PART_BOT',  minX: 12.60, maxX: 12.95, minY: 0.00, maxY: 1.45 },
  { id: 'SOFA_TL',   minX: 0.00, maxX: 2.30, minY: 8.30, maxY: 12.60 },
  { id: 'SOFA_BL',   minX: 0.00, maxX: 4.70, minY: 0.00, maxY: 1.60 },
  { id: 'SOFA_TR',   minX: 15.30, maxX: 19.60, minY: 7.60, maxY: 10.00 },
  { id: 'ELEV_EXIT', minX: 17.80, maxX: 19.60, minY: 4.06, maxY: 7.80 },
  { id: 'WC_EAST',   minX: 17.80, maxX: 19.60, minY: 0.00, maxY: 3.00 },
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
  W_ENTRY:     FRONT_DOOR_APPROACH,
  E_EXIT:      { x: 17.30, y: 3.53 },
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
  ['W_ENTRY', 'W_MID_L'],
  ['E_EXIT', 'E_SOUTH'],
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

