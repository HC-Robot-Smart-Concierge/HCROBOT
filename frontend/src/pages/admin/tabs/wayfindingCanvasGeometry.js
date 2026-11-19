import { fitFloorElement, floorPolygonPoints, getFloorElementPadding, normalizeFloorPolygon, rotateMapOffset } from '../../../services/wayfindingGeometry';

export const GRID_SIZE = 20;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export function snapEditorPoint({ x, y }, floor, grid = 0) {
  const step = grid || 1;
  return {
    x: clamp(Math.round(x / step) * step, 0, floor.width),
    y: clamp(Math.round(y / step) * step, 0, floor.height),
  };
}

export function getPastedElementBounds(element, floor, lastPosition = element) {
  const sourcePadding = getFloorElementPadding(element);
  const scale = Math.min(1, floor.width / (element.width + 2 * sourcePadding.x), floor.height / (element.height + 2 * sourcePadding.y));
  const width = Math.min(floor.width, element.width * scale);
  const height = Math.min(floor.height, element.height * scale);
  const padding = getFloorElementPadding({ ...element, width, height });

  const offset = (source, last, limit) => {
    const origin = clamp(source, 0, limit);
    const current = clamp(last, 0, limit);
    const direction = limit - origin >= GRID_SIZE || origin <= limit / 2 ? 1 : -1;
    if (direction === 1 && current === limit) return 0;
    if (direction === -1 && current === 0) return limit;
    return clamp(current + direction * GRID_SIZE, 0, limit);
  };

  return {
    x: padding.x + offset(element.x - padding.x, lastPosition.x - padding.x, Math.max(0, floor.width - width - 2 * padding.x)),
    y: padding.y + offset(element.y - padding.y, lastPosition.y - padding.y, Math.max(0, floor.height - height - 2 * padding.y)),
    width,
    height,
  };
}

export function rotateFloorElement(floor, element, degrees) {
  const rotation = ((degrees % 360) + 360) % 360;
  const bounds = fitFloorElement({ ...element, rotation }, floor);
  return bounds ? { ...bounds, rotation } : null;
}

function rotateEditedBounds(floor, element, bounds) {
  const oldX = element.x + element.width / 2;
  const oldY = element.y + element.height / 2;
  const shift = rotateMapOffset(bounds.x + bounds.width / 2 - oldX, bounds.y + bounds.height / 2 - oldY, element.rotation);
  const rotated = { ...bounds, x: oldX + shift.x - bounds.width / 2, y: oldY + shift.y - bounds.height / 2 };
  const position = fitFloorElement({ ...rotated, rotation: element.rotation }, floor);
  return position ? { ...rotated, ...position } : null;
}

function snapAxis(value, offsets, targets, tolerance, minimum, maximum, enabled) {
  let position = clamp(value, minimum, maximum);
  if (!enabled) return { position };

  let guide;
  let distance = tolerance;
  for (const target of targets) {
    for (const offset of offsets) {
      const candidate = target - offset;
      const gap = Math.abs(candidate - value);
      if (candidate >= minimum && candidate <= maximum && gap <= distance) {
        position = candidate;
        guide = target;
        distance = gap;
      }
    }
  }
  if (guide === undefined) position = clamp(Math.round(value / GRID_SIZE) * GRID_SIZE, minimum, maximum);
  return { position, guide };
}

export function positionFloorElement(floor, element, delta, corner, snapping, tolerance) {
  const rotation = element.rotation || 0;
  const siblings = floor.elements.filter((item) => item.id !== element.id);
  const xEdges = siblings.flatMap((item) => [item.x, item.x + item.width]);
  const yEdges = siblings.flatMap((item) => [item.y, item.y + item.height]);
  if (typeof corner === 'number') {
    const points = floorPolygonPoints(element);
    const original = points[corner];
    for (const point of points) {
      if (point !== original) {
        xEdges.push(point.x);
        yEdges.push(point.y);
      }
    }
    const movement = rotation ? rotateMapOffset(delta.x, delta.y, -rotation) : delta;
    const x = snapAxis(original.x + movement.x, [0], xEdges, tolerance, 0, floor.width, snapping && !rotation);
    const y = snapAxis(original.y + movement.y, [0], yEdges, tolerance, 0, floor.height, snapping && !rotation);
    if (x.position === original.x && y.position === original.y) return null;
    points[corner] = { x: x.position, y: y.position };
    const polygon = normalizeFloorPolygon(points);
    const bounds = polygon && rotation ? rotateEditedBounds(floor, element, polygon) : polygon;
    return bounds ? { bounds, guides: { x: x.guide, y: y.guide } } : null;
  }
  if (!corner) {
    const pad = getFloorElementPadding(element);
    const x = snapAxis(element.x + delta.x, [-pad.x, element.width + pad.x], xEdges, tolerance, pad.x, floor.width - element.width - pad.x, snapping);
    const y = snapAxis(element.y + delta.y, [-pad.y, element.height + pad.y], yEdges, tolerance, pad.y, floor.height - element.height - pad.y, snapping);
    return { bounds: { x: x.position, y: y.position, width: element.width, height: element.height }, guides: { x: x.guide, y: y.guide } };
  }

  const west = corner.includes('w');
  const north = corner.includes('n');
  const anchorX = west ? element.x + element.width : element.x;
  const anchorY = north ? element.y + element.height : element.y;
  const minWidth = Math.min(element.width, 8);
  const minHeight = Math.min(element.height, 8);
  if (rotation) {
    const local = rotateMapOffset(delta.x, delta.y, -rotation);
    const width = Math.max(minWidth, element.width + (west ? -local.x : local.x));
    const height = Math.max(minHeight, element.height + (north ? -local.y : local.y));
    const bounds = rotateEditedBounds(floor, element, { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height });
    return bounds ? { bounds, guides: {} } : null;
  }
  const x = snapAxis((west ? element.x : element.x + element.width) + delta.x, [0], xEdges, tolerance,
    west ? 0 : anchorX + minWidth, west ? anchorX - minWidth : floor.width, snapping);
  const y = snapAxis((north ? element.y : element.y + element.height) + delta.y, [0], yEdges, tolerance,
    north ? 0 : anchorY + minHeight, north ? anchorY - minHeight : floor.height, snapping);
  return {
    bounds: { x: Math.min(x.position, anchorX), y: Math.min(y.position, anchorY), width: Math.abs(x.position - anchorX), height: Math.abs(y.position - anchorY) },
    guides: { x: x.guide, y: y.guide },
  };
}

export function getEditorViewport(floor, view) {
  const width = floor.width / view.zoom;
  const height = floor.height / view.zoom;
  return {
    x: clamp(view.x, 0, floor.width - width), y: clamp(view.y, 0, floor.height - height), width, height,
  };
}

export function zoomEditorViewport(floor, view, zoom, anchor) {
  const old = getEditorViewport(floor, view);
  const nextZoom = clamp(zoom, 1, 5);
  const ratio = view.zoom / nextZoom;
  const { x, y } = anchor ?? { x: old.x + old.width / 2, y: old.y + old.height / 2 };
  const next = getEditorViewport(floor, { zoom: nextZoom, x: x - (x - old.x) * ratio, y: y - (y - old.y) * ratio });
  return { zoom: nextZoom, x: next.x, y: next.y };
}
