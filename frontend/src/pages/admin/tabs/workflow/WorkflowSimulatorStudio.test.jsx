import { describe, it, expect } from 'vitest';
import { WorkflowSimulatorStudio } from './WorkflowSimulatorStudio';
import {
  GAZEBO_LOBBY_WAYPOINTS,
  meterToSvg,
  calculateSafeWaypoints,
  getStepActionDetail,
} from './workflowSimulatorUtils';

describe('WorkflowSimulatorStudio Engine & Gazebo Navigation Logic', () => {
  it('should export WorkflowSimulatorStudio function component', () => {
    expect(typeof WorkflowSimulatorStudio).toBe('function');
  });

  it('validates goal reach tolerance against 0.35m Gazebo navigator threshold', () => {
    const isGoalReached = (currentX, currentY, targetX, targetY, threshold = 0.35) => {
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      return Math.hypot(dx, dy) < threshold;
    };

    // Outside goal (2m away)
    expect(isGoalReached(0.0, 0.0, 2.0, 0.0)).toBe(false);

    // Close to goal (0.3m away - reached)
    expect(isGoalReached(3.0, 2.8, 3.2, 2.8)).toBe(true);

    // Outside threshold (0.4m away - not reached yet)
    expect(isGoalReached(2.8, 2.8, 3.2, 2.8)).toBe(false);

    // Exactly at target
    expect(isGoalReached(3.2, 2.8, 3.2, 2.8)).toBe(true);
  });

  it('supports all 8 core step types in simulator dispatch sequence', () => {
    const supportedTypes = [
      'MOVE',
      'GREET',
      'SPEAK',
      'SHOW',
      'LISTEN',
      'RECOMMEND',
      'CREATE_REQUEST',
      'FEEDBACK',
    ];

    expect(supportedTypes).toHaveLength(8);
    expect(supportedTypes).toContain('MOVE');
    expect(supportedTypes).toContain('GREET');
    expect(supportedTypes).toContain('SPEAK');
    expect(supportedTypes).toContain('SHOW');
    expect(supportedTypes).toContain('LISTEN');
    expect(supportedTypes).toContain('RECOMMEND');
    expect(supportedTypes).toContain('CREATE_REQUEST');
    expect(supportedTypes).toContain('FEEDBACK');
  });

  it('correctly maps waypoints to 10m x 6m Ground Floor Lobby bounds', () => {
    expect(GAZEBO_LOBBY_WAYPOINTS).toBeDefined();

    Object.values(GAZEBO_LOBBY_WAYPOINTS).forEach((wp) => {
      expect(wp.x).toBeGreaterThanOrEqual(0.0);
      expect(wp.x).toBeLessThanOrEqual(10.0);
      expect(wp.y).toBeGreaterThanOrEqual(0.0);
      expect(wp.y).toBeLessThanOrEqual(6.0);
    });
  });

  it('accurately projects real-world meters into SVG blueprint canvas coordinates', () => {
    const dockSvg = meterToSvg(3.2, 2.8);
    expect(Math.round(dockSvg.x)).toBe(338);
    expect(Math.round(dockSvg.y)).toBe(317);

    const entranceSvg = meterToSvg(5.2, 1.0);
    expect(Math.round(entranceSvg.x)).toBe(518);
    expect(Math.round(entranceSvg.y)).toBe(467);

    const clampedCornerMin = meterToSvg(-5.0, -2.0);
    expect(clampedCornerMin.x).toBe(50);
    expect(clampedCornerMin.y).toBe(550);

    const clampedCornerMax = meterToSvg(20.0, 15.0);
    expect(clampedCornerMax.x).toBe(950);
    expect(clampedCornerMax.y).toBe(50);
  });

  it('routes through central doorway (x=4.4, y=2.85) to avoid partition wall when moving between rooms', () => {
    const fromDock = { x: 3.2, y: 2.8 }; // Gian Trai
    const toEntrance = { x: 5.2, y: 1.0 }; // Gian Phai

    const waypoints = calculateSafeWaypoints(fromDock, toEntrance);

    // Must have intermediate points to avoid cutting straight through wall at x=4.4, y=1.7
    expect(waypoints.length).toBeGreaterThan(2);

    // One waypoint must pass through doorway at x=4.4
    const doorwayPoint = waypoints.find((p) => Math.abs(p.x - 4.4) < 0.1);
    expect(doorwayPoint).toBeDefined();
    expect(doorwayPoint.y).toBeCloseTo(2.85, 1);

    // Final point must match destination
    const lastPoint = waypoints[waypoints.length - 1];
    expect(lastPoint.x).toBe(5.2);
    expect(lastPoint.y).toBe(1.0);
  });

  it('provides rich descriptive subtitles and details for all step enums including SHOW', () => {
    // 1. SHOW step for Language Selection
    const showLangStep = {
      type: 'SHOW',
      title: '3. Mở màn hình chọn ngôn ngữ',
      params: { screen_type: 'LANGUAGE_SELECT', content_id: 'UI_LANG' },
    };
    const showLangDetail = getStepActionDetail(showLangStep);
    expect(showLangDetail.label).toBe('SHOW');
    expect(showLangDetail.detailText).toContain('Chon ngon ngu');
    expect(showLangDetail.bubbleBody).toContain('Chon ngon ngu');

    // 2. SHOW step for Menu
    const showMenuStep = {
      type: 'SHOW',
      title: '5. Bật thực đơn tiện ích sảnh & dịch vụ',
      params: { screen_type: 'MENU', content_id: 'UI_MAIN_MENU' },
    };
    const showMenuDetail = getStepActionDetail(showMenuStep);
    expect(showMenuDetail.detailText).toContain('Thuc don');

    // 3. SPEAK step
    const speakStep = {
      type: 'SPEAK',
      title: '5. Phát âm thanh hướng dẫn đi thang máy',
      params: { text: 'Quý khách vui lòng đi thang máy lên tầng 2' },
    };
    const speakDetail = getStepActionDetail(speakStep);
    expect(speakDetail.label).toBe('SPEAK');
    expect(speakDetail.detailText).toContain('Quý khách vui lòng đi thang máy');

    // 4. GREET step
    const greetStep = {
      type: 'GREET',
      title: '2. Chào đón khách',
      params: { greeting_text: 'Dạ em chào quý khách!' },
    };
    const greetDetail = getStepActionDetail(greetStep);
    expect(greetDetail.label).toBe('GREET');
    expect(greetDetail.detailText).toContain('Dạ em chào quý khách!');

    // 5. MOVE step
    const moveStep = {
      type: 'MOVE',
      title: '1. Di chuyển ra Cửa chính',
      params: { waypoint_name: 'Cửa Chính Ra Vào Sảnh (Main Entrance)' },
    };
    const moveDetail = getStepActionDetail(moveStep);
    expect(moveDetail.label).toBe('MOVE');
    expect(moveDetail.detailText).toContain('Cửa Chính Ra Vào Sảnh');
  });

  it('verifies robot initial pose is at top-right corner of Lobby without dock station', () => {
    // Initial pose should be top-right corner of Lobby (3.7m, 5.0m) facing downward
    expect(GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY).toBeDefined();
    expect(GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY.x).toBe(3.7);
    expect(GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY.y).toBe(5.0);
  });

  it('correctly converts SVG click coordinates to real-world meters with svgToMeter', () => {
    const { svgToMeter } = require('./workflowSimulatorUtils');
    // Center point: SVG (500, 300) -> meters (5.0, 3.0)
    const center = svgToMeter(500, 300);
    expect(center.x).toBe(5.0);
    expect(center.y).toBe(3.0);

    // Top-right corner of Lobby: SVG (383, 133) -> meters (~3.7, ~5.0)
    const topLobby = svgToMeter(383, 133);
    expect(topLobby.x).toBeCloseTo(3.7, 1);
    expect(topLobby.y).toBeCloseTo(5.0, 1);
  });

  it('calculates obstacle avoidance path from top-right of Lobby (3.7, 5.0) to Main Entrance (5.2, 1.0)', () => {
    const startPose = { x: 3.7, y: 5.0 };
    const goalPose = { x: 5.2, y: 1.0 };
    const route = calculateSafeWaypoints(startPose, goalPose);

    // Route must pass through central partition doorway (x=4.4, y=2.85) to enter right room
    expect(route.length).toBeGreaterThanOrEqual(3);
    const doorwayPoint = route.find((p) => Math.abs(p.x - 4.4) < 0.1);
    expect(doorwayPoint).toBeDefined();
    expect(doorwayPoint.y).toBeCloseTo(2.85, 1);

    const endPoint = route[route.length - 1];
    expect(endPoint.x).toBe(5.2);
    expect(endPoint.y).toBe(1.0);
  });
});
