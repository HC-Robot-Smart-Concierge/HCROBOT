/**
 * routeValidator.js
 * Validates indoor navigation routes against floor geometry, walls, obstacles,
 * doorways, and clearance constraints (HC-Robot Indoor Navigation Audit).
 */

import { DEFAULT_NAVIGATION_CLEARANCE } from './floorGeometry.js';

/**
 * Orientation test: counterclockwise order of 3 points
 */
export const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

/**
 * Checks if segment AB intersects segment CD
 */
export const segmentsIntersect = (A, B, C, D) => {
  return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
};

/**
 * Calculates exact intersection point between segment AB and segment CD (if any)
 */
export const getSegmentIntersection = (A, B, C, D) => {
  const d = (A.x - B.x) * (C.y - D.y) - (A.y - B.y) * (C.x - D.x);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((A.x - C.x) * (C.y - D.y) - (A.y - C.y) * (C.x - D.x)) / d;
  const u = -((A.x - B.x) * (A.y - C.y) - (A.y - B.y) * (A.x - C.x)) / d;
  if (t >= -1e-4 && t <= 1 + 1e-4 && u >= -1e-4 && u <= 1 + 1e-4) {
    return {
      x: A.x + t * (B.x - A.x),
      y: A.y + t * (B.y - A.y),
    };
  }
  return null;
};

/**
 * Distance from point P to line segment AB
 */
export const pointToSegmentDistance = (P, A, B) => {
  const l2 = (B.x - A.x) ** 2 + (B.y - A.y) ** 2;
  if (l2 === 0) return Math.hypot(P.x - A.x, P.y - A.y);
  let t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = A.x + t * (B.x - A.x);
  const projY = A.y + t * (B.y - A.y);
  return Math.hypot(P.x - projX, P.y - projY);
};

/**
 * Checks if line segment AB intersects an axis-aligned box (with optional clearance inflation)
 */
export const segmentIntersectsBox = (A, B, box, clearance = 0) => {
  const minX = box.minX - clearance;
  const maxX = box.maxX + clearance;
  const minY = box.minY - clearance;
  const maxY = box.maxY + clearance;

  // If both points are entirely on one side of the box, no intersection
  if (
    (A.x < minX && B.x < minX) ||
    (A.x > maxX && B.x > maxX) ||
    (A.y < minY && B.y < minY) ||
    (A.y > maxY && B.y > maxY)
  ) {
    return false;
  }

  // If either point is strictly inside the inflated box
  if (
    (A.x > minX && A.x < maxX && A.y > minY && A.y < maxY) ||
    (B.x > minX && B.x < maxX && B.y > minY && B.y < maxY)
  ) {
    return true;
  }

  // Check 4 edges of the box
  const tl = { x: minX, y: maxY };
  const tr = { x: maxX, y: maxY };
  const bl = { x: minX, y: minY };
  const br = { x: maxX, y: minY };

  return (
    segmentsIntersect(A, B, tl, tr) ||
    segmentsIntersect(A, B, tr, br) ||
    segmentsIntersect(A, B, br, bl) ||
    segmentsIntersect(A, B, bl, tl)
  );
};

/**
 * Check if a point is close to any declared doorway opening
 */
export const isPointNearDoorway = (pt, doorways = [], tolerance = 60) => {
  for (const door of doorways) {
    const d = Math.hypot(pt.x - door.position.x, pt.y - door.position.y);
    const doorRadius = Math.max(tolerance, (door.width || 80) / 2 + 10);
    if (d <= doorRadius) {
      return true;
    }
  }
  return false;
};

/**
 * Parses an SVG path string into an array of {x, y} coordinate points
 */
export const parseSvgPathToPoints = (pathString) => {
  if (!pathString || typeof pathString !== 'string') return [];
  const points = [];
  // Matches command and numbers: M 1715 560 L 1510 560 ...
  const regex = /([MLCQSZ])([^MLCQSZ]*)/gi;
  let match;
  while ((match = regex.exec(pathString)) !== null) {
    const cmd = match[1].toUpperCase();
    const numbers = match[2].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i < numbers.length; i += 2) {
        if (i + 1 < numbers.length) {
          points.push({ x: numbers[i], y: numbers[i + 1] });
        }
      }
    } else if (cmd === 'C') {
      // Cubic bezier: (x1, y1, x2, y2, x, y) -> endpoint is (x, y)
      for (let i = 0; i < numbers.length; i += 6) {
        if (i + 5 < numbers.length) {
          points.push({ x: numbers[i + 4], y: numbers[i + 5] });
        }
      }
    } else if (cmd === 'Q') {
      // Quadratic bezier: (x1, y1, x, y) -> endpoint is (x, y)
      for (let i = 0; i < numbers.length; i += 4) {
        if (i + 3 < numbers.length) {
          points.push({ x: numbers[i + 2], y: numbers[i + 3] });
        }
      }
    }
  }
  return points;
};

/**
 * Validates a navigation route against floor geometry constraints
 * @param {Array<{x: number, y: number}>|string} route - points array or SVG path string
 * @param {object} floorGeometry - geometry configuration of the floor
 * @param {object} options - validation options
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export const validateNavigationRoute = (route, floorGeometry, options = {}) => {
  const errors = [];
  const warnings = [];

  const points = Array.isArray(route) ? route : parseSvgPathToPoints(route);
  const clearance = options.clearance !== undefined ? options.clearance : DEFAULT_NAVIGATION_CLEARANCE;
  const allowDoorwayExceptions = options.allowDoorwayExceptions !== false;

  // 1. Coordinate Validation
  if (!points || points.length === 0) {
    errors.push('Route contains no valid points');
    return { isValid: false, errors, warnings };
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.x !== 'number' || typeof p.y !== 'number' || isNaN(p.x) || isNaN(p.y)) {
      errors.push(`Invalid coordinate at point index ${i}: (${p.x}, ${p.y})`);
      return { isValid: false, errors, warnings };
    }
  }

  // 2. Walkable Region Check (canvas bounds)
  const mapW = floorGeometry?.dimensions?.width || 1840;
  const mapH = floorGeometry?.dimensions?.height || 1174;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < 0 || p.x > mapW || p.y < 0 || p.y > mapH) {
      errors.push(`Point ${i} (${p.x}, ${p.y}) is outside walkable bounds [0..${mapW}, 0..${mapH}]`);
    }
  }

  // 3. Route Continuity Check
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist === 0) {
      warnings.push(`Duplicate point detected at segment ${i} -> ${i + 1}`);
    }
    if (dist > mapW) {
      errors.push(`Discontinuous jump of ${dist.toFixed(0)}px between point ${i} and ${i + 1}`);
    }
  }

  // 4. Wall Collision Check
  const walls = floorGeometry?.walls || [];
  const doorways = floorGeometry?.doorways || [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const w of walls) {
      if (segmentsIntersect(p1, p2, w.p1, w.p2)) {
        // Check if intersection occurs through an authorized doorway
        let isDoorwayAllowed = false;
        if (allowDoorwayExceptions) {
          const isPt1Near = isPointNearDoorway(p1, doorways);
          const isPt2Near = isPointNearDoorway(p2, doorways);
          const ixPt = getSegmentIntersection(p1, p2, w.p1, w.p2);
          const isIxNear = ixPt ? isPointNearDoorway(ixPt, doorways) : false;
          isDoorwayAllowed = isPt1Near || isPt2Near || isIxNear;
        }

        if (!isDoorwayAllowed) {
          errors.push(
            `Segment ${i}->${i + 1} (${p1.x},${p1.y})->(${p2.x},${p2.y}) intersects wall '${w.id}'`
          );
        }
      }
    }
  }

  // 5. Obstacle Collision & Clearance Check
  const obstacles = floorGeometry?.obstacles || [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const obs of obstacles) {
      // If segment is entering destination inside this room, permit endpoint
      const isStartNearDoor = allowDoorwayExceptions && isPointNearDoorway(p1, doorways);
      const isEndNearDoor = allowDoorwayExceptions && isPointNearDoorway(p2, doorways);

      if (segmentIntersectsBox(p1, p2, obs, 0)) {
        if (!isStartNearDoor && !isEndNearDoor) {
          errors.push(
            `Segment ${i}->${i + 1} penetrates solid obstacle '${obs.id}'`
          );
        }
      } else if (clearance > 0 && segmentIntersectsBox(p1, p2, obs, clearance)) {
        warnings.push(
          `Segment ${i}->${i + 1} violates minimum clearance (${clearance}px) to obstacle '${obs.id}'`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};
