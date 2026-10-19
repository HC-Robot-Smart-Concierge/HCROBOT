import { describe, it, expect } from 'vitest';
import { WorkflowSimulatorStudio } from './WorkflowSimulatorStudio';
import {
  GAZEBO_LOBBY_WAYPOINTS,
  meterToSvg,
  calculateSafeWaypoints,
  getStepActionDetail,
  SIMULATOR_HOTEL_ZONES,
  isPointInSimulatorZone,
  getActiveSimulatorZone,
  zoneToSvgRect,
  validateWorkflowStepZone,
  resolveNoStopPassthrough,
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

  it('ensures step action details display Robot instead of Kiosk', () => {
    const showStep = {
      type: 'SHOW',
      title: 'Hiển thị bản đồ',
      params: { content: 'Bản đồ tầng 1' },
    };
    const showDetail = getStepActionDetail(showStep);
    expect(showDetail.detailText).toContain('Hien thi man hinh Robot');
    expect(showDetail.bubbleTitle).toBe('MAN HINH ROBOT (SHOW)');
    expect(showDetail.detailText).not.toContain('Kiosk');

    const touchStep = {
      type: 'LISTEN',
      title: 'Chờ khách chọn',
      params: { input_source: 'TOUCH' },
    };
    const touchDetail = getStepActionDetail(touchStep);
    expect(touchDetail.shortChip).toContain('Cham Robot');
    expect(touchDetail.shortChip).not.toContain('Kiosk');
  });

  it('defines 3 standard Hotel Functional Zones for Workflow Simulator (Keep-out, Speed, No-stop)', () => {
    expect(SIMULATOR_HOTEL_ZONES).toHaveLength(3);
    const types = SIMULATOR_HOTEL_ZONES.map((z) => z.type);
    expect(types).toContain('KEEP_OUT');
    expect(types).toContain('SPEED_ZONE');
    expect(types).toContain('NO_STOP');

    const staffKeepOut = SIMULATOR_HOTEL_ZONES.find((z) => z.type === 'KEEP_OUT');
    expect(staffKeepOut.name).toContain('Staff Only');
    expect(staffKeepOut.speed_limit).toBe(0.0);

    const speedZone = SIMULATOR_HOTEL_ZONES.find((z) => z.type === 'SPEED_ZONE');
    expect(speedZone.name).toContain('Tiếp Tân');
    expect(speedZone.speed_limit).toBe(0.20);

    const noStop = SIMULATOR_HOTEL_ZONES.find((z) => z.type === 'NO_STOP');
    expect(noStop.name).toContain('Cửa Thông Sảnh');
  });

  it('accurately identifies active zone for robot poses', () => {
    // Staff room is at x=8.8, y=1.5 (w=1.5, h=2.8) -> Inside KEEP_OUT
    const inStaffZone = getActiveSimulatorZone(8.8, 1.5, SIMULATOR_HOTEL_ZONES);
    expect(inStaffZone).not.toBeNull();
    expect(inStaffZone.type).toBe('KEEP_OUT');

    // Front Desk corridor is at x=5.2, y=2.2 (w=2.6, h=2.0) -> Inside SPEED_ZONE
    const inFrontDeskSpeed = getActiveSimulatorZone(5.2, 2.2, SIMULATOR_HOTEL_ZONES);
    expect(inFrontDeskSpeed).not.toBeNull();
    expect(inFrontDeskSpeed.type).toBe('SPEED_ZONE');
    expect(inFrontDeskSpeed.speed_limit).toBe(0.20);

    // Doorway connector is at x=4.4, y=2.85 (w=1.4, h=1.6) -> Inside NO_STOP
    const inDoorway = getActiveSimulatorZone(4.4, 2.85, SIMULATOR_HOTEL_ZONES);
    expect(inDoorway).not.toBeNull();
    expect(inDoorway.type).toBe('NO_STOP');

    // Standby location (3.7, 5.0) is in free lobby area
    const inLobby = getActiveSimulatorZone(3.7, 5.0, SIMULATOR_HOTEL_ZONES);
    expect(inLobby).toBeNull();
  });

  it('correctly resolves overlapping zones by safety hierarchy and min speed limit', () => {
    const overlappingZones = [
      { id: 'z1', name: 'Zone Toc Do 1', type: 'SPEED_ZONE', x: 5.0, y: 3.0, width: 2.0, height: 2.0, speed_limit: 0.4 },
      { id: 'z2', name: 'Zone Toc Do 2', type: 'SPEED_ZONE', x: 5.0, y: 3.0, width: 2.0, height: 2.0, speed_limit: 0.15 },
    ];
    // Khi 2 SPEED_ZONE chong nhau tai (5.0, 3.0), toc do an toan nhat phai la min = 0.15m/s
    const speedResolved = getActiveSimulatorZone(5.0, 3.0, overlappingZones);
    expect(speedResolved).not.toBeNull();
    expect(speedResolved.type).toBe('SPEED_ZONE');
    expect(speedResolved.speed_limit).toBe(0.15);

    // Khi KEEP_OUT chong len SPEED_ZONE, KEEP_OUT luon chiem uu tien cao nhat
    const keepOutOverlapping = [
      ...overlappingZones,
      { id: 'z3', name: 'Zone Cam Vao', type: 'KEEP_OUT', x: 5.0, y: 3.0, width: 2.0, height: 2.0, speed_limit: 0.0 },
    ];
    const keepOutResolved = getActiveSimulatorZone(5.0, 3.0, keepOutOverlapping);
    expect(keepOutResolved).not.toBeNull();
    expect(keepOutResolved.type).toBe('KEEP_OUT');
  });

  it('correctly maps Zone coordinates to SVG blueprint rectangle', () => {
    const keepOutZone = SIMULATOR_HOTEL_ZONES.find((z) => z.type === 'KEEP_OUT');
    const svgRect = zoneToSvgRect(keepOutZone);

    expect(svgRect.x).toBeGreaterThanOrEqual(50);
    expect(svgRect.y).toBeGreaterThanOrEqual(50);
    expect(svgRect.width).toBeGreaterThan(0);
    expect(svgRect.height).toBeGreaterThan(0);
    expect(svgRect.x + svgRect.width).toBeLessThanOrEqual(950);
    expect(svgRect.y + svgRect.height).toBeLessThanOrEqual(550);
  });

  it('rejects workflow MOVE steps targeting a KEEP_OUT zone', () => {
    const invalidStep = {
      type: 'MOVE',
      title: 'Đi vào phòng nội bộ',
      params: {
        target_x: 8.8,
        target_y: 1.5,
        waypoint_name: 'Phòng Staff Only',
      },
    };

    const result = validateWorkflowStepZone(invalidStep, SIMULATOR_HOTEL_ZONES);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Vùng cấm vào');
    expect(result.zone.type).toBe('KEEP_OUT');
  });

  it('permits workflow MOVE steps into safe areas and warns for NO_STOP', () => {
    const safeStep = {
      type: 'MOVE',
      title: 'Đón khách tại Cửa Chính',
      params: {
        target_x: 5.2,
        target_y: 1.0,
      },
    };
    const safeResult = validateWorkflowStepZone(safeStep, SIMULATOR_HOTEL_ZONES);
    expect(safeResult.valid).toBe(true);
    expect(safeResult.error).toBeUndefined();

    const noStopStep = {
      type: 'MOVE',
      title: 'Dừng ở Lối Cửa Thông Sảnh',
      params: {
        target_x: 4.4,
        target_y: 2.85,
      },
    };
    const noStopResult = validateWorkflowStepZone(noStopStep, SIMULATOR_HOTEL_ZONES);
    expect(noStopResult.valid).toBe(true);
    expect(noStopResult.warning).toContain('Vùng cấm dừng');
  });

  it('computes and clamps dragged zone position within 10m x 6m lobby bounds', () => {
    const calculateDragMove = (initialZone, deltaX, deltaY) => {
      const halfW = (Number(initialZone.width) || 2.0) / 2;
      const halfH = (Number(initialZone.height) || 2.0) / 2;
      const rawX = initialZone.x + deltaX;
      const rawY = initialZone.y + deltaY;
      const clampedX = Number(Math.max(halfW, Math.min(10.0 - halfW, rawX)).toFixed(2));
      const clampedY = Number(Math.max(halfH, Math.min(6.0 - halfH, rawY)).toFixed(2));
      return { x: clampedX, y: clampedY };
    };

    const zone = { x: 5.2, y: 2.2, width: 2.6, height: 2.0 };

    // Normal drag
    const moved = calculateDragMove(zone, 1.0, 0.5);
    expect(moved.x).toBe(6.2);
    expect(moved.y).toBe(2.7);

    // Over upper-right boundary (max X = 10 - 1.3 = 8.7, max Y = 6 - 1.0 = 5.0)
    const clampedMax = calculateDragMove(zone, 10.0, 10.0);
    expect(clampedMax.x).toBe(8.7);
    expect(clampedMax.y).toBe(5.0);

    // Under lower-left boundary (min X = 1.3, min Y = 1.0)
    const clampedMin = calculateDragMove(zone, -10.0, -10.0);
    expect(clampedMin.x).toBe(1.3);
    expect(clampedMin.y).toBe(1.0);
  });

  it('accurately computes resized zone bounds and center coordinate for all 4 corners', () => {
    const calculateResize = (initZone, handleType, deltaX, deltaY) => {
      const zw = Number(initZone.width) || 2.0;
      const zh = Number(initZone.height) || 2.0;
      const left = initZone.x - zw / 2;
      const right = initZone.x + zw / 2;
      const bottom = initZone.y - zh / 2;
      const top = initZone.y + zh / 2;

      let newLeft = left;
      let newRight = right;
      let newBottom = bottom;
      let newTop = top;

      if (handleType === 'RESIZE_SE') {
        newRight = Math.max(left + 0.6, Math.min(10.0, right + deltaX));
        newBottom = Math.min(top - 0.6, Math.max(0.0, bottom + deltaY));
      } else if (handleType === 'RESIZE_NW') {
        newLeft = Math.min(right - 0.6, Math.max(0.0, left + deltaX));
        newTop = Math.max(bottom + 0.6, Math.min(6.0, top + deltaY));
      }

      const w = Number((newRight - newLeft).toFixed(2));
      const h = Number((newTop - newBottom).toFixed(2));
      const cx = Number(((newLeft + newRight) / 2).toFixed(2));
      const cy = Number(((newBottom + newTop) / 2).toFixed(2));

      return { x: cx, y: cy, width: w, height: h };
    };

    const initial = { x: 5.0, y: 3.0, width: 2.0, height: 2.0 }; // Left 4.0, Right 6.0, Bottom 2.0, Top 4.0

    // Resize SE: deltaX = +1.0, deltaY = -0.5
    const resizedSE = calculateResize(initial, 'RESIZE_SE', 1.0, -0.5);
    expect(resizedSE.width).toBe(3.0); // 7.0 - 4.0
    expect(resizedSE.height).toBe(2.5); // 4.0 - 1.5
    expect(resizedSE.x).toBe(5.5); // (4.0 + 7.0) / 2
    expect(resizedSE.y).toBe(2.75); // (1.5 + 4.0) / 2

    // Enforces minimum size of 0.6m
    const collapsed = calculateResize(initial, 'RESIZE_SE', -5.0, 5.0);
    expect(collapsed.width).toBe(0.6);
    expect(collapsed.height).toBe(0.6);
  });

  it('supports Add, Edit, and Delete zone operations with drag-ready defaults', () => {
    // 1. ADD: Creates new zone with valid bounds and drag handles ready
    const addZone = (currentZones, type) => {
      const count = currentZones.filter((z) => z.type === type).length + 1;
      const newZone = {
        id: `zone_test_${Date.now()}`,
        name: type === 'KEEP_OUT' ? `Vùng Cấm #${count}` : type === 'SPEED_ZONE' ? `Vùng Tốc Độ #${count}` : `Vùng Cấm Dừng #${count}`,
        type,
        x: 5.0,
        y: 3.0,
        width: 2.0,
        height: 2.0,
        speed_limit: type === 'SPEED_ZONE' ? 0.2 : null,
      };
      return [...currentZones, newZone];
    };

    let zoneList = [...SIMULATOR_HOTEL_ZONES];
    const initialCount = zoneList.length;

    // Add Keep-Out
    zoneList = addZone(zoneList, 'KEEP_OUT');
    expect(zoneList).toHaveLength(initialCount + 1);
    const addedKeepOut = zoneList[zoneList.length - 1];
    expect(addedKeepOut.type).toBe('KEEP_OUT');
    expect(addedKeepOut.width).toBe(2.0);
    expect(addedKeepOut.x).toBe(5.0);

    // 2. EDIT: Update zone attributes (name, type, speed_limit)
    const updateZone = (currentZones, zoneId, updates) => {
      return currentZones.map((z) => (z.id === zoneId ? { ...z, ...updates } : z));
    };

    zoneList = updateZone(zoneList, addedKeepOut.id, {
      name: 'Khoang VIP Cấm Vào',
      x: 6.2,
      y: 4.1,
      width: 2.8,
    });
    const editedZone = zoneList.find((z) => z.id === addedKeepOut.id);
    expect(editedZone.name).toBe('Khoang VIP Cấm Vào');
    expect(editedZone.x).toBe(6.2);
    expect(editedZone.width).toBe(2.8);

    // 3. DELETE: Remove zone by ID
    const deleteZoneById = (currentZones, zoneId) => {
      return currentZones.filter((z) => z.id !== zoneId);
    };

    zoneList = deleteZoneById(zoneList, addedKeepOut.id);
    expect(zoneList).toHaveLength(initialCount);
    expect(zoneList.find((z) => z.id === addedKeepOut.id)).toBeUndefined();
  });

  it('suppresses robot navigation goal dispatch when zone edit mode is active or a zone is selected', () => {
    let dispatchedGoal = null;
    const navigateToGoal = (x, y) => {
      dispatchedGoal = { x, y };
    };

    const handleMapClickSim = (clickX, clickY, isZoneEditMode, selectedZone) => {
      // Logic in WorkflowSimulatorStudio: blocks navigation if isZoneEditMode or selectedZone
      if (isZoneEditMode || selectedZone) {
        return { handledAsZoneAction: true, dispatched: false };
      }
      navigateToGoal(clickX, clickY);
      return { handledAsZoneAction: false, dispatched: true };
    };

    // 1. Normal navigation mode: dispatches goal
    const navResult = handleMapClickSim(4.5, 3.2, false, null);
    expect(navResult.dispatched).toBe(true);
    expect(dispatchedGoal).toEqual({ x: 4.5, y: 3.2 });

    // 2. Zone Edit Mode is ON: blocks navigation, robot remains still
    dispatchedGoal = null;
    const editModeResult = handleMapClickSim(4.5, 3.2, true, null);
    expect(editModeResult.dispatched).toBe(false);
    expect(dispatchedGoal).toBeNull();

    // 3. A zone is currently selected/editing: blocks navigation
    dispatchedGoal = null;
    const selectedZoneResult = handleMapClickSim(4.5, 3.2, false, { id: 'zone_1' });
    expect(selectedZoneResult.dispatched).toBe(false);
    expect(dispatchedGoal).toBeNull();
  });

  it('manages Endpoints full lifecycle: create, rename, change type, drag and delete', () => {
    let endpointList = [
      { id: 'wp-1', name: 'Quầy Lễ Tân', type: 'WAYPOINT', x: 5.2, y: 2.0 },
      { id: 'wp-2', name: 'Trạm Sạc Sảnh', type: 'CHARGER', x: 3.7, y: 5.0 },
      { id: 'wp-3', name: 'Điểm Chờ Sảnh', type: 'PARK', x: 5.2, y: 1.0 },
    ];

    // 1. CREATE: Add new endpoint
    const newEp = {
      id: 'wp-4',
      name: 'Bàn Trà VIP Sảnh',
      type: 'WAYPOINT',
      x: 2.0,
      y: 2.8,
    };
    endpointList = [...endpointList, newEp];
    expect(endpointList).toHaveLength(4);
    expect(endpointList[3].name).toBe('Bàn Trà VIP Sảnh');

    // 2. RENAME: Đặt tên cho chỗ đó
    endpointList = endpointList.map((ep) =>
      ep.id === 'wp-4' ? { ...ep, name: 'Khu Vực Sofa VIP Cạnh Cửa' } : ep
    );
    expect(endpointList.find((e) => e.id === 'wp-4').name).toBe('Khu Vực Sofa VIP Cạnh Cửa');

    // 3. CHANGE TYPE: Đổi loại endpoint giữa WAYPOINT, CHARGER, PARK
    endpointList = endpointList.map((ep) =>
      ep.id === 'wp-4' ? { ...ep, type: 'CHARGER' } : ep
    );
    expect(endpointList.find((e) => e.id === 'wp-4').type).toBe('CHARGER');

    // 4. DRAG: Di chuyển tọa độ và clamp trong phạm vi sàn sảnh
    const dragEndpoint = (ep, dx, dy) => {
      const clampedX = Math.max(0.3, Math.min(9.7, ep.x + dx));
      const clampedY = Math.max(0.3, Math.min(5.7, ep.y + dy));
      return { ...ep, x: Number(clampedX.toFixed(2)), y: Number(clampedY.toFixed(2)) };
    };

    const movedEp = dragEndpoint(endpointList.find((e) => e.id === 'wp-4'), 1.5, -0.8);
    expect(movedEp.x).toBe(3.5);
    expect(movedEp.y).toBe(2.0);

    // 5. DELETE: Xóa endpoint
    endpointList = endpointList.filter((e) => e.id !== 'wp-4');
    expect(endpointList).toHaveLength(3);
    expect(endpointList.find((e) => e.id === 'wp-4')).toBeUndefined();
  });

  it('blocks floor navigation when an endpoint is selected or in edit mode', () => {
    let target = null;
    const handleMapClickSim = (isEditMode, selectedEp) => {
      if (isEditMode || selectedEp) {
        return { navigated: false, deselected: true };
      }
      target = { x: 5.0, y: 3.0 };
      return { navigated: true, deselected: false };
    };

    // Selected endpoint active -> dismisses selection, no robot movement
    const resSelected = handleMapClickSim(false, { id: 'wp-1' });
    expect(resSelected.navigated).toBe(false);
    expect(target).toBeNull();

    // Normal click -> moves robot
    const resNormal = handleMapClickSim(false, null);
    expect(resNormal.navigated).toBe(true);
    expect(target).toEqual({ x: 5.0, y: 3.0 });
  });

  it('hides text labels on endpoints by default and reveals only on hover or selection', () => {
    const shouldShowLabel = (epId, hoveredId, selectedId, isDragging) => {
      return isDragging || selectedId === epId || hoveredId === epId;
    };

    // Default resting state: no hover, not selected -> label hidden, only dot visible
    expect(shouldShowLabel('wp-sofa', null, null, false)).toBe(false);

    // Hover state: cursor moved over endpoint -> label visible
    expect(shouldShowLabel('wp-sofa', 'wp-sofa', null, false)).toBe(true);

    // Hover left -> label hidden again
    expect(shouldShowLabel('wp-sofa', null, null, false)).toBe(false);

    // Clicked / Selected state -> label remains visible
    expect(shouldShowLabel('wp-sofa', null, 'wp-sofa', false)).toBe(true);

    // Another endpoint hovered -> current endpoint label stays hidden
    expect(shouldShowLabel('wp-sofa', 'wp-other', null, false)).toBe(false);
  });

  it('automatically projects navigation target through NO_STOP zone to safe exit coordinate', () => {
    const doorwayZone = {
      id: 'z-door',
      name: 'Cửa Thông Sảnh Chính (Cấm Dừng)',
      type: 'NO_STOP',
      x: 4.4,
      y: 2.85,
      width: 1.4,
      height: 1.6,
    };
    const zones = [doorwayZone];

    // Robot in front desk (x=5.2) clicks inside NO_STOP doorway at (3.92, 2.67)
    const currentRobot = { x: 5.2, y: 2.85 };
    const clickedInsideDoor = { x: 3.92, y: 2.67 };

    const passthrough = resolveNoStopPassthrough(currentRobot, clickedInsideDoor, zones);
    expect(passthrough.isNoStop).toBe(true);
    // Auto-projected through the doorway into the West room safe area
    expect(passthrough.safePoint.x).toBeLessThan(3.7);
    expect(passthrough.safePoint.y).toBe(2.67);
  });

  it('selects endpoint on single click without requiring drag movement', () => {
    // Simulates click handler logic
    let selectedEndpoint = null;
    let isEndpointEditMode = false;
    let wasDragging = false;

    const handleSelectEndpoint = (ep) => {
      if (wasDragging) return;
      selectedEndpoint = ep;
      isEndpointEditMode = true;
    };

    const targetEp = { id: 'ep-sofa', name: 'Khu Sofa Khách Chờ Sảnh', x: 2.06, y: 4.0 };

    // Single click (0px drag distance)
    wasDragging = false;
    handleSelectEndpoint(targetEp);

    expect(selectedEndpoint).toEqual(targetEp);
    expect(isEndpointEditMode).toBe(true);

    // Map click on empty floor deselects
    const handleMapClick = (targetHasDataEndpoint) => {
      if (targetHasDataEndpoint) return;
      selectedEndpoint = null;
      isEndpointEditMode = false;
    };

    // Click on endpoint does NOT deselect
    handleMapClick(true);
    expect(selectedEndpoint).toEqual(targetEp);

    // Click on empty floor deselects
    handleMapClick(false);
    expect(selectedEndpoint).toBeNull();
    expect(isEndpointEditMode).toBe(false);
  });

  it('resolves custom endpoint waypoints (e.g. Toilet) and synchronizes step title', () => {
    const customEndpoints = [
      { id: 'wp-toilet', name: 'Toilet', x: 6.35, y: 4.22 },
      { id: 'LOBBY_LOUNGE', name: 'Khu Sofa Khách Chờ Sảnh', x: 1.67, y: 3.77 },
    ];

    const toKey = 'wp-toilet';
    const fromKey = 'LOBBY_LOUNGE';
    const targetWp = customEndpoints.find((e) => e.id === toKey) || GAZEBO_LOBBY_WAYPOINTS[toKey];
    const fromWp = customEndpoints.find((e) => e.id === fromKey) || GAZEBO_LOBBY_WAYPOINTS[fromKey];

    expect(targetWp).toBeDefined();
    expect(targetWp.name).toBe('Toilet');
    expect(targetWp.x).toBe(6.35);
    expect(targetWp.y).toBe(4.22);

    expect(fromWp).toBeDefined();
    expect(fromWp.name).toBe('Khu Sofa Khách Chờ Sảnh');

    const stepIdx = 0;
    const toCleanName = targetWp.name.split('(')[0].trim();
    const newTitle = `${stepIdx + 1}. Di chuyển tới ${toCleanName}`;
    expect(newTitle).toBe('1. Di chuyển tới Toilet');

    const initialStep = {
      type: 'MOVE',
      title: '1. Di chuyển ra Cửa chính đón khách',
      params: { target_value: 'MAIN_ENTRANCE', target_x: 5.2, target_y: 1.0 },
    };

    const updatedStep = {
      ...initialStep,
      title: newTitle,
      params: {
        ...initialStep.params,
        from_waypoint: fromKey,
        from_waypoint_name: fromWp.name,
        target_value: toKey,
        target_waypoint_id: toKey,
        waypoint_name: targetWp.name,
        target_x: targetWp.x,
        target_y: targetWp.y,
      },
    };

    expect(updatedStep.title).toBe('1. Di chuyển tới Toilet');
    expect(updatedStep.params.target_x).toBe(6.35);
    expect(updatedStep.params.target_y).toBe(4.22);
    expect(updatedStep.params.from_waypoint).toBe('LOBBY_LOUNGE');

    // validateWorkflowStepZone with customEndpoints
    const validationResult = validateWorkflowStepZone(updatedStep, SIMULATOR_HOTEL_ZONES, customEndpoints);
    expect(validationResult.valid).toBe(true);
  });

  it('handles Patrol Loop mode: resets to step 0 upon reaching the end when loop mode is active', () => {
    let currentStepIndex = 2;
    const totalSteps = 3;
    let isLoopMode = true;
    let isPlaying = true;
    let loopNotification = null;

    const simulateStepFinish = () => {
      const nextIdx = currentStepIndex + 1;
      if (nextIdx < totalSteps) {
        currentStepIndex = nextIdx;
      } else if (isLoopMode && totalSteps > 0) {
        loopNotification = 'Đã hết chu trình, tự động lặp lại hành trình tuần tra';
        currentStepIndex = 0;
      } else {
        isPlaying = false;
        currentStepIndex = 0;
      }
    };

    // Khi đến bước cuối và loop mode đang bật
    simulateStepFinish();
    expect(currentStepIndex).toBe(0);
    expect(isPlaying).toBe(true);
    expect(loopNotification).toContain('lặp lại hành trình tuần tra');

    // Khi loop mode tắt
    currentStepIndex = 2;
    isLoopMode = false;
    simulateStepFinish();
    expect(currentStepIndex).toBe(0);
    expect(isPlaying).toBe(false);
  });

  it('supports concurrent broadcast on MOVE step (vừa đi vừa phát quảng cáo) and assigns PATROL status', () => {
    const moveStepWithBroadcast = {
      type: 'MOVE',
      title: 'Tuần tra phát loa sảnh',
      params: {
        target_value: 'FRONT_DESK',
        target_x: 5.2,
        target_y: 2.0,
        broadcast_speech: 'Nhà hàng tầng 2 đang có ưu đãi tiệc trà chiều cho quý khách',
      },
    };

    const hasBroadcast =
      moveStepWithBroadcast.type === 'MOVE' &&
      Boolean(moveStepWithBroadcast.params?.broadcast_speech);

    expect(hasBroadcast).toBe(true);

    const isMoving = true;
    const robotStatus = (() => {
      if (isMoving && hasBroadcast) {
        return {
          code: 'PATROL',
          label: 'TUẦN TRA & PHÁT LOA',
          dotColor: '#6366F1',
          isMoving: true,
        };
      }
      return { code: 'NAV', label: 'ĐIỀU HƯỚNG', dotColor: '#262626', isMoving: true };
    })();

    expect(robotStatus.code).toBe('PATROL');
    expect(robotStatus.label).toBe('TUẦN TRA & PHÁT LOA');
    expect(robotStatus.isMoving).toBe(true);
  });

  it('handles SHOW step for Video & Image advertisement display and assigns SHOW_VIDEO / SHOW_IMAGE status', () => {
    const videoStep = {
      type: 'SHOW',
      title: 'Chiếu video giới thiệu tiện ích resort 5 sao',
      params: {
        screen_mode: 'PROMO_VIDEO',
        media_type: 'VIDEO',
        media_url: 'https://example.com/promo.mp4',
        display_banner: 'Ưu đãi kỳ nghỉ hè',
        timeout: 15,
      },
    };

    const isVideo =
      videoStep.params?.media_type === 'VIDEO' ||
      videoStep.params?.screen_mode === 'PROMO_VIDEO' ||
      /\.(mp4|webm)$/i.test(videoStep.params?.media_url);

    expect(isVideo).toBe(true);

    const getStatusForShow = (step) => {
      const isVid =
        step.params?.media_type === 'VIDEO' ||
        step.params?.screen_mode === 'PROMO_VIDEO' ||
        /\.(mp4|webm)$/i.test(step.params?.media_url);
      const isImg =
        step.params?.media_type === 'IMAGE' ||
        step.params?.screen_mode === 'PROMO_IMAGE' ||
        step.params?.screen_mode === 'PROMO_SUMMER';
      if (isVid) return { code: 'SHOW_VIDEO', label: 'CHIẾU VIDEO QUẢNG CÁO' };
      if (isImg) return { code: 'SHOW_IMAGE', label: 'CHIẾU POSTER QUẢNG CÁO' };
      return { code: 'SHOW', label: 'MÀN HÌNH QUẢNG CÁO' };
    };

    expect(getStatusForShow(videoStep).code).toBe('SHOW_VIDEO');

    const imageStep = {
      type: 'SHOW',
      title: 'Chiếu poster tiệc trà chiều hoàng gia',
      params: {
        screen_mode: 'PROMO_IMAGE',
        media_type: 'IMAGE',
        media_url: 'https://example.com/poster.jpg',
      },
    };

    expect(getStatusForShow(imageStep).code).toBe('SHOW_IMAGE');
  });

  it('supports concurrent screen media promo on MOVE step (vừa đi vừa chiếu video/poster)', () => {
    const moveWithScreenPromo = {
      type: 'MOVE',
      title: 'Tuần tra sảnh và chiếu video quảng cáo',
      params: {
        target_value: 'FRONT_DESK',
        show_media_on_move: true,
        screen_mode: 'PROMO_VIDEO',
        media_type: 'VIDEO',
      },
    };

    const hasMediaMove =
      moveWithScreenPromo.type === 'MOVE' &&
      (Boolean(moveWithScreenPromo.params?.show_media_on_move) ||
        Boolean(moveWithScreenPromo.params?.media_url) ||
        moveWithScreenPromo.params?.screen_mode === 'PROMO_VIDEO' ||
        moveWithScreenPromo.params?.screen_mode === 'PROMO_IMAGE');

    expect(hasMediaMove).toBe(true);

    const isMoving = true;
    const robotStatus = isMoving && hasMediaMove
      ? { code: 'PATROL_MEDIA', label: 'TUẦN TRA • CHIẾU QC', isMoving: true }
      : { code: 'NAV', label: 'ĐIỀU HƯỚNG', isMoving: true };

    expect(robotStatus.code).toBe('PATROL_MEDIA');
    expect(robotStatus.label).toBe('TUẦN TRA • CHIẾU QC');
  });
});




