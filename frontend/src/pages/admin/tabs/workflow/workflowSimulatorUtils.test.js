import { describe, it, expect } from 'vitest';
import {
  calculateSafeWaypoints,
  GAZEBO_LOBBY_WAYPOINTS,
  STANDARD_LOBBY_WAYPOINTS,
  getStepActionDetail,
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
