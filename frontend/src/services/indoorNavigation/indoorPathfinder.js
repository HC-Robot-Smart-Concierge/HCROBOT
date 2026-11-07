/**
 * indoorPathfinder.js
 * Wall-aware indoor routing engine with obstacle avoidance, line-of-sight shortcut smoothing,
 * configurable wall clearance, and SVG path formatting (HC-Robot Indoor Navigation).
 */

import {
  DEFAULT_NAVIGATION_CLEARANCE,
  getFloorGeometry,
} from './floorGeometry.js';
import {
  segmentsIntersect,
  segmentIntersectsBox,
  validateNavigationRoute,
} from './routeValidator.js';

/**
 * Checks if line segment between p1 and p2 has an unobstructed line of sight
 */
export const isLineOfSightClear = (p1, p2, floorGeometry, clearance = 0) => {
  const walls = floorGeometry?.walls || [];
  const obstacles = floorGeometry?.obstacles || [];

  // Check walls
  for (const w of walls) {
    if (segmentsIntersect(p1, p2, w.p1, w.p2)) {
      return false;
    }
  }

  // Check obstacles
  for (const obs of obstacles) {
    if (segmentIntersectsBox(p1, p2, obs, clearance)) {
      return false;
    }
  }

  return true;
};

/**
 * Connects an arbitrary point to reachable nodes in the navigation roadmap
 */
export const findReachableNodes = (pt, floorGeometry, clearance = 0) => {
  const nodes = floorGeometry?.walkableNodes || {};
  const reachable = [];
  const nodeKeys = Object.keys(nodes);

  for (const key of nodeKeys) {
    const target = nodes[key];
    if (isLineOfSightClear(pt, target, floorGeometry, clearance)) {
      const dist = Math.hypot(pt.x - target.x, pt.y - target.y);
      reachable.push({ key, pt: target, dist });
    }
  }

  // If no direct line of sight with clearance, try without clearance
  if (reachable.length === 0 && clearance > 0) {
    for (const key of nodeKeys) {
      const target = nodes[key];
      if (isLineOfSightClear(pt, target, floorGeometry, 0)) {
        const dist = Math.hypot(pt.x - target.x, pt.y - target.y);
        reachable.push({ key, pt: target, dist });
      }
    }
  }

  // If still none, snap to closest node
  if (reachable.length === 0 && nodeKeys.length > 0) {
    let closestKey = nodeKeys[0];
    let minDist = Infinity;
    for (const key of nodeKeys) {
      const target = nodes[key];
      const dist = Math.hypot(pt.x - target.x, pt.y - target.y);
      if (dist < minDist) {
        minDist = dist;
        closestKey = key;
      }
    }
    reachable.push({ key: closestKey, pt: nodes[closestKey], dist: minDist });
  }

  return reachable;
};

/**
 * Executes Dijkstra shortest path search on the navigation graph
 */
export const dijkstraSearch = (startKey, goalKey, nodes, edges) => {
  const adj = {};
  for (const k of Object.keys(nodes)) {
    adj[k] = [];
  }

  for (const [u, v] of edges) {
    if (nodes[u] && nodes[v]) {
      const d = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y);
      adj[u].push({ node: v, dist: d });
      adj[v].push({ node: u, dist: d });
    }
  }

  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(nodes));

  for (const k of Object.keys(nodes)) {
    dist[k] = Infinity;
  }
  dist[startKey] = 0;

  while (unvisited.size > 0) {
    let curr = null;
    let minD = Infinity;
    for (const n of unvisited) {
      if (dist[n] < minD) {
        minD = dist[n];
        curr = n;
      }
    }

    if (!curr || minD === Infinity || curr === goalKey) {
      break;
    }

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

  const path = [];
  let curr = goalKey;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  if (path[0] !== startKey) {
    return null; // unreachable
  }

  return path;
};

/**
 * String-pulling (shortcut) smoothing: eliminates redundant waypoints
 * while strictly guaranteeing that every shortcut maintains obstacle clearance.
 */
export const smoothPathWithClearance = (rawPoints, floorGeometry, clearance) => {
  if (rawPoints.length <= 2) return rawPoints;

  const smoothed = [rawPoints[0]];
  let i = 0;

  while (i < rawPoints.length - 1) {
    let furthest = i + 1;
    // Look ahead from the end of the path backwards
    for (let j = rawPoints.length - 1; j > i + 1; j--) {
      if (isLineOfSightClear(smoothed[smoothed.length - 1], rawPoints[j], floorGeometry, clearance)) {
        furthest = j;
        break;
      }
    }
    smoothed.push(rawPoints[furthest]);
    i = furthest;
  }

  return smoothed;
};

/**
 * Formats an array of points into an SVG path string (with optional rounded fillet corners)
 */
export const formatSvgPath = (points, options = {}) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const roundCorners = options.roundCorners !== false;
  const radius = options.cornerRadius || 20;

  if (!roundCorners || points.length === 2) {
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
  }

  // Smooth fillet corner formatting using Quadratic Bezier (Q)
  let d = `M ${Math.round(points[0].x)} ${Math.round(points[0].y)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const dPrev = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y);
    const dNext = Math.hypot(pNext.x - pCurr.x, pNext.y - pCurr.y);

    const cornerR = Math.min(radius, dPrev / 2, dNext / 2);

    if (cornerR < 4) {
      d += ` L ${Math.round(pCurr.x)} ${Math.round(pCurr.y)}`;
      continue;
    }

    // Point before corner
    const startX = pCurr.x - ((pCurr.x - pPrev.x) / dPrev) * cornerR;
    const startY = pCurr.y - ((pCurr.y - pPrev.y) / dPrev) * cornerR;

    // Point after corner
    const endX = pCurr.x + ((pNext.x - pCurr.x) / dNext) * cornerR;
    const endY = pCurr.y + ((pNext.y - pCurr.y) / dNext) * cornerR;

    d += ` L ${Math.round(startX)} ${Math.round(startY)}`;
    d += ` Q ${Math.round(pCurr.x)} ${Math.round(pCurr.y)}, ${Math.round(endX)} ${Math.round(endY)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${Math.round(last.x)} ${Math.round(last.y)}`;
  return d;
};

/**
 * Calculates a complete indoor navigation route between two points or node keys on a specific floor
 * @param {string|{x: number, y: number}} from - start node key or point
 * @param {string|{x: number, y: number}} to - destination node key or point
 * @param {string|number} floorId - hotel floor id
 * @param {object} options - clearance, smoothing, etc.
 * @returns {{ points: Array<{x: number, y: number}>, pathString: string, distanceMeters: number, isValid: boolean }}
 */
export const calculateFloorRoute = (from, to, floorId, options = {}) => {
  const floorGeometry = getFloorGeometry(floorId);
  const clearance = options.clearance !== undefined ? options.clearance : DEFAULT_NAVIGATION_CLEARANCE;

  // Resolve start and goal coordinates
  const nodes = { ...(floorGeometry.walkableNodes || {}) };
  const edges = [...(floorGeometry.walkableEdges || [])];

  const startPt = typeof from === 'string' && nodes[from] ? nodes[from] : from;
  const goalPt = typeof to === 'string' && nodes[to] ? nodes[to] : to;

  if (!startPt || !goalPt) {
    return { points: [], pathString: '', distanceMeters: 0, isValid: false, error: 'Invalid start or goal' };
  }

  // Fast path: direct unobstructed line of sight
  if (isLineOfSightClear(startPt, goalPt, floorGeometry, clearance)) {
    const rawPoints = [startPt, goalPt];
    const pathString = formatSvgPath(rawPoints, options);
    const distPx = Math.hypot(goalPt.x - startPt.x, goalPt.y - startPt.y);
    const distMeters = Math.round(distPx * 0.08); // scale ~12.5 px per meter
    return {
      points: rawPoints,
      pathString,
      distanceMeters: distMeters,
      isValid: true,
    };
  }

  // Augment graph with START and GOAL
  nodes['__START__'] = startPt;
  nodes['__GOAL__'] = goalPt;

  const startEdges = findReachableNodes(startPt, floorGeometry, clearance);
  const goalEdges = findReachableNodes(goalPt, floorGeometry, clearance);

  for (const se of startEdges) {
    edges.push(['__START__', se.key]);
  }
  for (const ge of goalEdges) {
    edges.push([ge.key, '__GOAL__']);
  }

  const keyPath = dijkstraSearch('__START__', '__GOAL__', nodes, edges);

  if (!keyPath || keyPath.length < 2) {
    // Fallback: direct connection if graph search failed
    return {
      points: [startPt, goalPt],
      pathString: formatSvgPath([startPt, goalPt], options),
      distanceMeters: Math.round(Math.hypot(goalPt.x - startPt.x, goalPt.y - startPt.y) * 0.08),
      isValid: false,
      error: 'Unreachable route destination',
    };
  }

  const rawPoints = keyPath.map((k) => nodes[k]);
  const cleanRaw = [];
  for (const pt of rawPoints) {
    if (cleanRaw.length === 0 || Math.hypot(pt.x - cleanRaw[cleanRaw.length - 1].x, pt.y - cleanRaw[cleanRaw.length - 1].y) > 2) {
      cleanRaw.push(pt);
    }
  }
  const smoothedPoints = smoothPathWithClearance(cleanRaw, floorGeometry, clearance);
  const finalPoints = [];
  for (const pt of smoothedPoints) {
    if (finalPoints.length === 0 || Math.hypot(pt.x - finalPoints[finalPoints.length - 1].x, pt.y - finalPoints[finalPoints.length - 1].y) > 2) {
      finalPoints.push(pt);
    }
  }
  const pathString = formatSvgPath(finalPoints, options);

  // Calculate route distance
  let distPx = 0;
  for (let i = 0; i < finalPoints.length - 1; i++) {
    distPx += Math.hypot(finalPoints[i + 1].x - finalPoints[i].x, finalPoints[i + 1].y - finalPoints[i].y);
  }
  const distanceMeters = Math.max(10, Math.round(distPx * 0.08));

  // Run validation
  const validation = validateNavigationRoute(finalPoints, floorGeometry, { clearance });

  return {
    points: finalPoints,
    pathString,
    distanceMeters,
    isValid: validation.isValid,
    validation,
  };
};
