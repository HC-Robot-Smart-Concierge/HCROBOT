import { describe, it, expect } from 'vitest';
import {
  calculateSafeWaypoints,
  GAZEBO_LOBBY_WAYPOINTS,
  STANDARD_LOBBY_WAYPOINTS,
  getStepActionDetail,
  resolveNoStopPassthrough,
} from './workflowSimulatorUtils';

describe('Waypoint Locations - In Front of Facilities', () => {
  it('FRONT_DESK should be located in front of the front desk counter', () => {
    const wp = GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
    expect(wp.x).toBe(11.44);
    expect(wp.y).toBe(2.8);
    expect(wp.name).toContain('Trước Quầy Lễ Tân');
  });

  it('STAFF_ONLY should be located in front of the staff only room', () => {
    const wp = GAZEBO_LOBBY_WAYPOINTS.STAFF_ONLY;
    expect(wp.x).toBe(11.44);
    expect(wp.y).toBe(6.4);
    expect(wp.name).toContain('Trước Phòng Nội Bộ');
  });
});

describe('calculateSafeWaypoints - Obstacle Avoidance between Front Desk and Staff Only', () => {
  it('should navigate into Staff Only room via entrance doorway when moving from FRONT_DESK', () => {
    const fromFrontDesk = { x: 11.44, y: 2.8 };
    const toStaffOnly = { x: 11.44, y: 6.4 };

    const waypoints = calculateSafeWaypoints(fromFrontDesk, toStaffOnly);

    expect(waypoints.length).toBeGreaterThanOrEqual(3);
    const hasDoor = waypoints.some((p) => Math.abs(p.x - 11.44) < 0.1 && Math.abs(p.y - 4.20) < 0.1);
    expect(hasDoor).toBe(true);

    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(11.44);
    expect(lastPoint.y).toBe(6.4);
  });

  it('should navigate out of Staff Only room via entrance doorway when moving to FRONT_DESK', () => {
    const fromStaffOnly = { x: 11.44, y: 6.4 };
    const toFrontDesk = { x: 11.44, y: 2.8 };

    const waypoints = calculateSafeWaypoints(fromStaffOnly, toFrontDesk);

    expect(waypoints.length).toBeGreaterThanOrEqual(3);
    const hasDoor = waypoints.some((p) => Math.abs(p.x - 11.44) < 0.1 && Math.abs(p.y - 4.20) < 0.1);
    expect(hasDoor).toBe(true);

    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(11.44);
    expect(lastPoint.y).toBe(2.8);
  });

  it('should navigate through central lobby doorway from Standby to Elevator', () => {
    const fromStandby = { x: 7.2, y: 9.6 };
    const toElevator = { x: 15.6, y: 6.96 };

    const waypoints = calculateSafeWaypoints(fromStandby, toElevator);

    const hasDoorway = waypoints.some((p) => Math.abs(p.x - 12.84) < 0.1);
    expect(hasDoorway).toBe(true);
  });
});

describe('STANDARD_LOBBY_WAYPOINTS and getStepActionDetail', () => {
  it('should include standard lobby waypoints with id, name and standard types', () => {
    expect(STANDARD_LOBBY_WAYPOINTS.length).toBe(9);
    const ids = STANDARD_LOBBY_WAYPOINTS.map((w) => w.id);
    expect(ids).toContain('FRONT_DESK');
    expect(ids).toContain('STAFF_ONLY');
    expect(ids).toContain('MAIN_ENTRANCE');
    expect(ids).toContain('ROBOT_STANDBY');
    expect(ids).toContain('CHARGER_STATION');
  });

  it('should format route detailText as From A to B when from_waypoint is provided', () => {
    const stepWithRoute = {
      type: 'MOVE',
      title: '1. Di chuyển đón khách',
      params: {
        from_waypoint: 'ROBOT_STANDBY',
        from_waypoint_name: 'Vị Trí Chờ Robot Sảnh',
        target_value: 'MAIN_ENTRANCE',
        waypoint_name: 'Cửa Chính Ra Vào Sảnh',
      },
    };

    const detail = getStepActionDetail(stepWithRoute);
    expect(detail.label).toBe('MOVE');
    expect(detail.detailText).toContain('Lộ trình:');
    expect(detail.detailText).toContain('➔');
    expect(detail.bubbleTitle).toBe('LỘ TRÌNH ĐIỂM MỐC (MOVE)');
  });

  it('should format detailText as direct navigation when from_waypoint is CURRENT', () => {
    const stepCurrent = {
      type: 'MOVE',
      title: '1. Di chuyển đón khách',
      params: {
        from_waypoint: 'CURRENT',
        target_value: 'FRONT_DESK',
        waypoint_name: 'Trước Quầy Lễ Tân (Front Desk)',
      },
    };

    const detail = getStepActionDetail(stepCurrent);
    expect(detail.label).toBe('MOVE');
    expect(detail.detailText).toContain('Điều hướng né vật cản đến:');
  });
});

describe('resolveNoStopPassthrough - Smart Auto-Passthrough for NO_STOP Zones', () => {
  it('should detect when target lies inside a NO_STOP zone and project passthrough exit point', () => {
    const robotStart = { x: 14.8, y: 9.80 };
    const targetInsideDoor = { x: 12.84, y: 9.80 };

    const result = resolveNoStopPassthrough(robotStart, targetInsideDoor);
    expect(result.isNoStop).toBe(true);
    expect(result.zone.type).toBe('NO_STOP');
    expect(result.safePoint.x).toBeLessThan(12.84);
    expect(result.safePoint.x).toBeGreaterThan(2.0);
  });

  it('should project passthrough exit to East side when moving from West to East', () => {
    const robotStart = { x: 8.4, y: 9.80 };
    const targetInsideDoor = { x: 12.84, y: 9.80 };

    const result = resolveNoStopPassthrough(robotStart, targetInsideDoor);
    expect(result.isNoStop).toBe(true);
    expect(result.safePoint.x).toBeGreaterThan(12.84);
    expect(result.safePoint.x).toBeLessThan(18.0);
  });

  it('should return isNoStop false when target is in a safe area', () => {
    const robotStart = { x: 7.2, y: 9.6 };
    const safeTarget = { x: 8.4, y: 2.0 };

    const result = resolveNoStopPassthrough(robotStart, safeTarget);
    expect(result.isNoStop).toBe(false);
    expect(result.safePoint).toEqual(safeTarget);
  });

  it('should route through doorway when navigating from East side to West side', () => {
    const fromEast = { x: 15.6, y: 9.80 };
    const toSofa = { x: 3.6, y: 7.2 };

    const waypoints = calculateSafeWaypoints(fromEast, toSofa);

    const hasDoorway = waypoints.some((p) => Math.abs(p.x - 12.84) < 0.1);
    expect(hasDoorway).toBe(true);

    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(3.6);
    expect(lastPoint.y).toBe(7.2);
  });
});
