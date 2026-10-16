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
    expect(wp.x).toBe(5.2);
    expect(wp.y).toBe(2.0);
    expect(wp.name).toContain('Trước Quầy Lễ Tân');
  });

  it('STAFF_ONLY should be located in front of the staff only room', () => {
    const wp = GAZEBO_LOBBY_WAYPOINTS.STAFF_ONLY;
    expect(wp.x).toBe(7.85);
    expect(wp.y).toBe(2.7);
    expect(wp.name).toContain('Trước Phòng Nội Bộ');
  });
});

describe('calculateSafeWaypoints - Obstacle Avoidance between Front Desk and Staff Only', () => {
  it('should avoid the Front Desk counter when moving from FRONT_DESK to STAFF_ONLY', () => {
    const fromFrontDesk = { x: 5.2, y: 2.0 };
    const toStaffOnly = { x: 7.85, y: 2.7 };

    const waypoints = calculateSafeWaypoints(fromFrontDesk, toStaffOnly);

    // Không được nối thẳng 2 điểm vì sẽ cắt qua bàn quầy lễ tân
    expect(waypoints.length).toBeGreaterThanOrEqual(3);

    // Phải đi vòng qua hành lang phía Bắc quầy lễ tân (x: 5.2, y: 2.85)
    const hasCorridorPoint = waypoints.some((p) => Math.abs(p.x - 5.2) < 0.1 && Math.abs(p.y - 2.85) < 0.1);
    expect(hasCorridorPoint).toBe(true);

    // Điểm kết thúc phải là Trước Phòng Nội Bộ (7.85, 2.7)
    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(7.85);
    expect(lastPoint.y).toBe(2.7);
  });

  it('should avoid the Front Desk counter when moving from STAFF_ONLY to FRONT_DESK', () => {
    const fromStaffOnly = { x: 7.85, y: 2.7 };
    const toFrontDesk = { x: 5.2, y: 2.0 };

    const waypoints = calculateSafeWaypoints(fromStaffOnly, toFrontDesk);

    expect(waypoints.length).toBeGreaterThanOrEqual(3);

    // Phải đi vòng qua hành lang phía Bắc quầy lễ tân (x: 5.2, y: 2.85)
    const hasCorridorPoint = waypoints.some((p) => Math.abs(p.x - 5.2) < 0.1 && Math.abs(p.y - 2.85) < 0.1);
    expect(hasCorridorPoint).toBe(true);

    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(5.2);
    expect(lastPoint.y).toBe(2.0);
  });

  it('should navigate through central lobby doorway from Standby to Front Desk', () => {
    const fromStandby = { x: 3.7, y: 5.0 };
    const toFrontDesk = { x: 5.2, y: 2.0 };

    const waypoints = calculateSafeWaypoints(fromStandby, toFrontDesk);

    // Phải đi qua cửa thông sảnh ở giữa vách ngăn x=4.4
    const hasDoorway = waypoints.some((p) => Math.abs(p.x - 4.4) < 0.1 && Math.abs(p.y - 2.85) < 0.1);
    expect(hasDoorway).toBe(true);
  });
});

describe('STANDARD_LOBBY_WAYPOINTS and getStepActionDetail', () => {
  it('should include 8 standard lobby waypoints with id and name', () => {
    expect(STANDARD_LOBBY_WAYPOINTS.length).toBe(8);
    const ids = STANDARD_LOBBY_WAYPOINTS.map((w) => w.id);
    expect(ids).toContain('FRONT_DESK');
    expect(ids).toContain('STAFF_ONLY');
    expect(ids).toContain('MAIN_ENTRANCE');
    expect(ids).toContain('ROBOT_STANDBY');
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
    // Doorway NO_STOP zone is around x=4.4, y=2.85 (w=1.4, h=1.6) -> x in [3.7, 5.1]
    const robotStart = { x: 5.2, y: 2.85 };
    const targetInsideDoor = { x: 4.2, y: 2.85 };

    const result = resolveNoStopPassthrough(robotStart, targetInsideDoor);
    expect(result.isNoStop).toBe(true);
    expect(result.zone.type).toBe('NO_STOP');
    // Moving West, safe point should be outside doorway in Left Room (x < 3.7)
    expect(result.safePoint.x).toBeLessThan(3.7);
    expect(result.safePoint.x).toBeGreaterThan(1.0);
  });

  it('should project passthrough exit to East side when moving from West to East', () => {
    const robotStart = { x: 2.5, y: 2.85 };
    const targetInsideDoor = { x: 4.2, y: 2.85 };

    const result = resolveNoStopPassthrough(robotStart, targetInsideDoor);
    expect(result.isNoStop).toBe(true);
    // Moving East, safe point should be outside doorway in Right Room (x > 5.1)
    expect(result.safePoint.x).toBeGreaterThan(5.1);
    expect(result.safePoint.x).toBeLessThan(9.0);
  });

  it('should return isNoStop false when target is in a safe area', () => {
    const robotStart = { x: 5.2, y: 2.85 };
    const safeTarget = { x: 2.0, y: 4.0 };

    const result = resolveNoStopPassthrough(robotStart, safeTarget);
    expect(result.isNoStop).toBe(false);
    expect(result.safePoint).toEqual(safeTarget);
  });

  it('should route around Front Desk via East and North corridors when starting from behind Front Desk', () => {
    // Robot behind Front Desk: (6.1, 2.0)
    // Destination: Sofa in Left Wing: (2.06, 4.0)
    const fromBehindDesk = { x: 6.1, y: 2.0 };
    const toSofa = { x: 2.06, y: 4.0 };

    const waypoints = calculateSafeWaypoints(fromBehindDesk, toSofa);

    // Phai thoat ra hanh lang phia Dong quay le tan (x >= 7.0)
    const hasEastExit = waypoints.some((p) => p.x >= 7.0 && p.y <= 2.2);
    expect(hasEastExit).toBe(true);

    // Phai di vong qua hanh lang phia Bac quay le tan (x: 7.1, y: 2.85)
    const hasNorthCorridor = waypoints.some((p) => Math.abs(p.x - 7.1) < 0.2 && Math.abs(p.y - 2.85) < 0.2);
    expect(hasNorthCorridor).toBe(true);

    // Phai di qua cua thong sanh (x=4.4, y=2.85)
    const hasDoorway = waypoints.some((p) => Math.abs(p.x - 4.4) < 0.2 && Math.abs(p.y - 2.85) < 0.2);
    expect(hasDoorway).toBe(true);

    // Diem den cuoi cung la Sofa (2.06, 4.0)
    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(2.06);
    expect(lastPoint.y).toBe(4.0);
  });
});


