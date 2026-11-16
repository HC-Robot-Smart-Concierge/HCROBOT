import { describe, it, expect } from 'vitest';
import {
  calculateFloorRoute,
  validateNavigationRoute,
  segmentsIntersect,
  getSegmentIntersection,
  segmentIntersectsBox,
  pointToSegmentDistance,
  isPointNearDoorway,
  parseSvgPathToPoints,
  formatSvgPath,
  smoothPathWithClearance,
  dijkstraSearch,
  getFloorGeometry,
  ALL_FLOOR_GEOMETRIES,
  DEFAULT_NAVIGATION_CLEARANCE,
  ROUTE_GROUND_TO_ELEVATOR,
} from '../index.js';
import { HOTEL_DESTINATIONS, HOTEL_FLOORS } from '../../../components/robot/FloorMap.jsx';

describe('Indoor Navigation Pathfinding Engine & Validation Tests', () => {

  // 1. Direct Unobstructed Line of Sight
  it('Scenario 1: validates direct line of sight when no obstacles or walls intervene', () => {
    const floorGeo = getFloorGeometry('3'); // Floor 1 Lobby
    const ptA = { x: 350, y: 580 };
    const ptB = { x: 350, y: 700 }; // Straight line along west open area

    const route = calculateFloorRoute(ptA, ptB, '3');
    expect(route.isValid).toBe(true);
    expect(route.points.length).toBe(2);
    expect(route.points[0]).toEqual(ptA);
    expect(route.points[1]).toEqual(ptB);
  });

  // 2. Wall Intersection Detection
  it('Scenario 2: flags route that intersects solid wall segment as invalid', () => {
    const floorGeo = getFloorGeometry('7'); // Floor 5
    // Segment cutting directly through the solid dividing wall at y=300 (dividing wall is x=758, y=0..590)
    const cuttingPath = [
      { x: 300, y: 300 },
      { x: 1200, y: 300 },
    ];

    const validation = validateNavigationRoute(cuttingPath, floorGeo, { allowDoorwayExceptions: false });
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('DIVIDING_WALL_TOP'))).toBe(true);
  });

  // 3. Obstacle Collision Detection
  it('Scenario 3: flags route that cuts directly through a solid obstacle box', () => {
    const floorGeo = getFloorGeometry('3'); // Floor 1 Lobby
    // Center plant obstacle is at [520..700, 490..670]
    const cuttingThroughPlant = [
      { x: 350, y: 580 },
      { x: 800, y: 580 }, // Passes directly through center plant box
    ];

    const validation = validateNavigationRoute(cuttingThroughPlant, floorGeo);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('CENTER_PLANT'))).toBe(true);
  });

  // 4. Doorway Traversal Allowance
  it('Scenario 4: permits route segments that traverse through an authorized doorway opening', () => {
    const floorGeo = getFloorGeometry('7'); // Floor 5
    // Double doors are at { x: 758, y: 745 } with opening y=665..825
    const crossingThroughDoor = [
      { x: 700, y: 745 },
      { x: 820, y: 745 },
    ];

    const validation = validateNavigationRoute(crossingThroughDoor, floorGeo, { allowDoorwayExceptions: true });
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  // 5. Clearance Distance Verification
  it('Scenario 5: verifies minimum clearance constraint against obstacles', () => {
    const floorGeo = getFloorGeometry('3'); // Floor 1
    // Reception desk is at [920..1220, 370..770]
    // Point at x=910 (10px from desk) violates 24px clearance
    const p1 = { x: 910, y: 300 };
    const p2 = { x: 910, y: 800 };

    const validation = validateNavigationRoute([p1, p2], floorGeo, { clearance: DEFAULT_NAVIGATION_CLEARANCE });
    expect(validation.warnings.some((w) => w.includes('clearance'))).toBe(true);
  });

  // 6. Multi-Floor Navigation Sequence
  it('Scenario 6: verifies multi-floor navigation contract (Chặng 1 -> Chặng 2)', () => {
    // Chặng 1: Lobby Standby -> Elevator A
    const step1Route = calculateFloorRoute('STANDBY', 'ELEVATOR_A', '3');
    expect(step1Route.isValid).toBe(true);
    expect(step1Route.points[0].x).toBe(350);
    expect(step1Route.points[step1Route.points.length - 1].x).toBe(1715);

    // Chặng 2: Target floor Elevator -> Destination (e.g. Gym on Floor 5)
    const step2Route = calculateFloorRoute('ELEVATOR', { x: 1450, y: 880 }, '7');
    expect(step2Route.isValid).toBe(true);
    expect(step2Route.points[0].x).toBe(1715);
    expect(step2Route.points[step2Route.points.length - 1]).toEqual({ x: 1450, y: 880 });
  });

  // 7. Coordinate Round-Trip & Path Parsing
  it('Scenario 7: accurately parses SVG path strings to coordinates and formats them with fillets', () => {
    const rawPath = 'M 350 580 L 350 860 L 1330 860 L 1715 560';
    const parsed = parseSvgPathToPoints(rawPath);
    expect(parsed.length).toBe(4);
    expect(parsed[0]).toEqual({ x: 350, y: 580 });
    expect(parsed[3]).toEqual({ x: 1715, y: 560 });

    const formatted = formatSvgPath(parsed, { roundCorners: true, cornerRadius: 20 });
    expect(formatted).toContain('Q'); // Fillet bezier curve generated
    expect(formatted.startsWith('M 350 580')).toBe(true);
  });

  // 8. Geometry Definition Integrity for All Floors
  it('Scenario 8: ensures all 8 hotel floor geometries are properly defined with dimensions and elevators', () => {
    const floorIds = ['1', '2', '3', '4', '5', '6', '7', '8'];
    for (const fid of floorIds) {
      const geo = getFloorGeometry(fid);
      expect(geo).toBeDefined();
      expect(geo.floorId).toBe(fid);
      expect(geo.dimensions.width).toBe(1840);
      expect(geo.dimensions.height).toBe(1174);
      expect(geo.elevator).toBeDefined();
      expect(geo.elevator.x).toBeGreaterThan(0);
      expect(geo.elevator.y).toBeGreaterThan(0);
      expect(Array.isArray(geo.walls)).toBe(true);
      expect(Array.isArray(geo.doorways)).toBe(true);
      expect(Object.keys(geo.walkableNodes).length).toBeGreaterThan(0);
    }
  });

  // 9. All 29 Hotel Destinations Produce Valid, Wall-Cleared Routes
  it('Scenario 9: guarantees 100% of HOTEL_DESTINATIONS routes pass geometric validation', () => {
    const destinations = Object.values(HOTEL_DESTINATIONS);
    expect(destinations.length).toBeGreaterThanOrEqual(25);

    for (const dest of destinations) {
      // Validate Chặng 2 routeTarget
      const validation = validateNavigationRoute(dest.routeTarget, getFloorGeometry(dest.floorId));
      expect(validation.isValid, `Destination '${dest.id}' (${dest.name}) failed validation: ${validation.errors.join('; ')}`).toBe(true);
      expect(validation.errors.length).toBe(0);
    }
  });

  // 10. Chặng 1 Route (ROUTE_GROUND_TO_ELEVATOR) Validation
  it('Scenario 10: guarantees ROUTE_GROUND_TO_ELEVATOR is 100% valid and avoids central plant pot', () => {
    const lobbyGeo = getFloorGeometry('3');
    const validation = validateNavigationRoute(ROUTE_GROUND_TO_ELEVATOR, lobbyGeo);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Verify distance from central plant pot [520..700, 490..670]
    const points = parseSvgPathToPoints(ROUTE_GROUND_TO_ELEVATOR);
    for (let i = 0; i < points.length - 1; i++) {
      const plantBox = lobbyGeo.obstacles.find((o) => o.id === 'CENTER_PLANT');
      expect(segmentIntersectsBox(points[i], points[i + 1], plantBox, 0)).toBe(false);
    }
  });

  // 11. Mathematical Utilities (Segments Intersect, Point-to-Segment, Box Intersection)
  it('Scenario 11: tests core computational geometry helper functions', () => {
    // Intersecting segments (X pattern)
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    // Parallel non-intersecting segments
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);

    // Exact intersection point
    const ix = getSegmentIntersection({ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 0 }, { x: 5, y: 10 });
    expect(ix).toEqual({ x: 5, y: 5 });

    // Point to segment distance
    const dist = pointToSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(dist).toBe(5);
  });

  // 12. Mobile Safari Re-render & Responsive ViewBox Contract
  it('Scenario 12: ensures FloorMap has responsive dimensions and image key for Mobile Safari', () => {
    HOTEL_FLOORS.forEach((floor) => {
      expect(floor.width).toBe(1840);
      expect(floor.height).toBe(1174);
      expect(floor.image).toBeDefined();
    });
  });

  // 13. Floor 5 & 6 Doorway Clearance & Room Entry Precision
  it('Scenario 13: strictly guarantees Floor 5 Infinity Pool route passes through double doors and pool door without cutting walls', () => {
    const floor5Geo = getFloorGeometry('7');
    const poolRoute = HOTEL_DESTINATIONS.infinity_pool.routeTarget;
    const validation = validateNavigationRoute(poolRoute, floor5Geo);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    const points = parseSvgPathToPoints(poolRoute);
    // Path should have points passing west of central wall
    const minX = Math.min(...points.map((p) => p.x));
    expect(minX).toBeLessThanOrEqual(380);

    // Verify dynamic route calculation also passes through pool door
    const dynamicRoute = calculateFloorRoute('ELEVATOR', { x: 380, y: 230 }, '7');
    expect(dynamicRoute.isValid).toBe(true);
    expect(dynamicRoute.points.some((p) => p.x === 600 && p.y === 458)).toBe(true);
  });
});

