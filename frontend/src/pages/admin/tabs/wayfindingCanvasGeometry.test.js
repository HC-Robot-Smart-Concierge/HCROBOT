import { describe, expect, it } from 'vitest';
import { floorPolygonPoints, normalizeFloorPolygon } from '../../../services/wayfindingGeometry';
import { getEditorViewport, getPastedElementBounds, positionFloorElement, rotateFloorElement, snapEditorPoint, zoomEditorViewport } from './wayfindingCanvasGeometry';

const element = { id: 'room_1', x: 10, y: 30, width: 100, height: 50 };
const floor = { width: 600, height: 400, elements: [element, { id: 'room_2', x: 220, y: 120, width: 80, height: 100 }] };

describe('wayfinding canvas geometry', () => {
  it('snaps moving edges to adjacent objects before falling back to the grid', () => {
    expect(positionFloorElement(floor, element, { x: 108, y: 37 }, null, true, 7)).toEqual({
      bounds: { x: 120, y: 70, width: 100, height: 50 }, guides: { x: 220, y: 120 },
    });
    expect(positionFloorElement(floor, element, { x: 34, y: 18 }, null, true, 4).bounds)
      .toEqual({ x: 40, y: 40, width: 100, height: 50 });
    expect(positionFloorElement(floor, element, { x: 108, y: 37 }, null, false, 7).bounds)
      .toEqual({ x: 118, y: 67, width: 100, height: 50 });
  });

  it('keeps the opposite corner anchored and respects both map bounds and thin wall sizes', () => {
    expect(positionFloorElement(floor, element, { x: 500, y: -90 }, 'ne', false, 7).bounds)
      .toEqual({ x: 10, y: 0, width: 590, height: 80 });
    expect(positionFloorElement(floor, element, { x: 200, y: 200 }, 'nw', false, 7).bounds)
      .toEqual({ x: 102, y: 72, width: 8, height: 8 });
    const wall = { ...element, height: 3 };
    expect(positionFloorElement(floor, wall, { x: 0, y: -10 }, 'se', false, 7).bounds.height).toBe(3);
  });

  it('keeps an anchored zoom in map coordinates and clamps panning', () => {
    const view = zoomEditorViewport(floor, { zoom: 1, x: 0, y: 0 }, 2, { x: 200, y: 100 });
    expect(view).toEqual({ zoom: 2, x: 100, y: 50 });
    expect(getEditorViewport(floor, { ...view, x: 900, y: -10 })).toEqual({ x: 300, y: 0, width: 300, height: 200 });
    expect(zoomEditorViewport(floor, view, 0.5)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it('stores an L-shaped room as one outline and rejects a corner that crosses its edges', () => {
    const points = [[100, 100], [400, 100], [400, 200], [200, 200], [200, 400], [100, 400]]
      .map(([x, y]) => ({ x, y }));
    const area = { ...normalizeFloorPolygon(points), id: 'area_1' };
    expect(floorPolygonPoints(area)).toEqual(points);
    const areaFloor = { width: 600, height: 600, elements: [area] };
    const moved = positionFloorElement(areaFloor, area, { x: 30, y: 20 }, 3, false, 0);
    expect(floorPolygonPoints({ ...area, ...moved.bounds })[3]).toEqual({ x: 230, y: 220 });
    expect(positionFloorElement(areaFloor, area, { x: 250, y: -150 }, 3, false, 0)).toBeNull();
    expect(normalizeFloorPolygon([points[0], points[2], points[1], points[5]])).toBeNull();
    expect(normalizeFloorPolygon([points[0], points[1], points[0]])).toBeNull();
  });

  it('offsets successive copies and keeps copies inside the current floor', () => {
    const first = getPastedElementBounds(element, floor);
    expect(first).toEqual({ x: 30, y: 50, width: 100, height: 50 });
    expect(getPastedElementBounds(element, floor, first)).toEqual({ x: 50, y: 70, width: 100, height: 50 });
    expect(getPastedElementBounds({ ...element, x: 493, y: 345 }, floor))
      .toEqual({ x: 473, y: 325, width: 100, height: 50 });
    expect(getPastedElementBounds({ x: 300, y: 400, width: 1000, height: 500 }, floor))
      .toEqual({ x: 0, y: 80, width: 600, height: 300 });
  });

  it('rotates in place when there is room and keeps rotated objects inside the floor', () => {
    expect(rotateFloorElement(floor, element, -15)?.rotation).toBe(345);
    const rotated = rotateFloorElement(floor, { ...element, x: 0, y: 0 }, 90);
    expect(rotated).toMatchObject({ x: 0, y: 25, rotation: 90 });
    const nudged = positionFloorElement(floor, { ...element, ...rotated }, { x: 0, y: -10 }, null, false, 0);
    expect(nudged.bounds.y).toBe(25);
    expect(rotateFloorElement({ width: 600, height: 90 }, element, 90)).toBeNull();

    const resized = positionFloorElement(floor, { ...element, x: 100, y: 100, rotation: 90 }, { x: 0, y: 20 }, 'se', false, 0);
    expect(resized.bounds.width).toBeCloseTo(120);
    expect(resized.bounds.height).toBeCloseTo(50);
  });

  it('uses the same snapping for placement and dragging, and clamps at the floor edge', () => {
    const bounds = { width: 593, height: 387 };
    expect(snapEditorPoint({ x: 109.8, y: 111.4 }, bounds, 20)).toEqual({ x: 100, y: 120 });
    expect(snapEditorPoint({ x: 109.8, y: 111.4 }, bounds)).toEqual({ x: 110, y: 111 });
    expect(snapEditorPoint({ x: 605, y: -25 }, bounds, 20)).toEqual({ x: 593, y: 0 });
  });
});
