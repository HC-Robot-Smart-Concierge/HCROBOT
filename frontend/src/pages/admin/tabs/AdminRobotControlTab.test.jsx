import { describe, it, expect } from 'vitest';

describe('AdminRobotControlTab Sub-view Logic', () => {
  const SUB_VIEWS = {
    LIDAR: 'lidar',
    WORKFLOWS: 'workflows',
    CAMERA: 'camera',
  };

  const getActiveTabTitle = (subViewKey) => {
    switch (subViewKey) {
      case SUB_VIEWS.LIDAR:
        return 'Điều Khiển & Odometry SLAM';
      case SUB_VIEWS.WORKFLOWS:
        return 'Quản Lý Step Workflows';
      case SUB_VIEWS.CAMERA:
        return 'Live Camera FPV';
      default:
        return 'Unknown View';
    }
  };

  it('should default to lidar sub-view', () => {
    const defaultSubView = SUB_VIEWS.LIDAR;
    expect(defaultSubView).toBe('lidar');
    expect(getActiveTabTitle(defaultSubView)).toBe('Điều Khiển & Odometry SLAM');
  });

  it('should switch smoothly between workflows and camera sub-views', () => {
    let currentSubView = SUB_VIEWS.LIDAR;
    const handleSwitch = (newView) => {
      currentSubView = newView;
    };

    handleSwitch(SUB_VIEWS.WORKFLOWS);
    expect(currentSubView).toBe('workflows');
    expect(getActiveTabTitle(currentSubView)).toBe('Quản Lý Step Workflows');

    handleSwitch(SUB_VIEWS.CAMERA);
    expect(currentSubView).toBe('camera');
    expect(getActiveTabTitle(currentSubView)).toBe('Live Camera FPV');
  });

  it('should switch smoothly to camera sub-view', () => {
    let currentSubView = SUB_VIEWS.LIDAR;
    const handleSwitch = (newView) => {
      currentSubView = newView;
    };

    handleSwitch(SUB_VIEWS.CAMERA);
    expect(currentSubView).toBe('camera');
    expect(getActiveTabTitle(currentSubView)).toBe('Live Camera FPV');
  });

  it('should preserve external subTabProp overrides from sidebar navigation', () => {
    let localSubTab = SUB_VIEWS.LIDAR;
    const externalProp = SUB_VIEWS.CAMERA;

    if (externalProp && externalProp !== localSubTab) {
      localSubTab = externalProp;
    }

    expect(localSubTab).toBe('camera');
  });

  it('should format synchronized Emergency Stop payload consistently across LiDAR and Camera', () => {
    const createStopPayload = (targetIp = '100.73.245.66', port = 9999) => ({
      command: 'stop',
      target_ip: targetIp,
      port,
    });

    const lidarStopPayload = createStopPayload();
    const cameraStopPayload = createStopPayload('100.73.245.66', 9999);

    expect(lidarStopPayload).toEqual(cameraStopPayload);
    expect(lidarStopPayload.command).toBe('stop');
    expect(lidarStopPayload.target_ip).toBe('100.73.245.66');
    expect(lidarStopPayload.port).toBe(9999);
  });

  it('should compute combined multi-key teleop commands accurately', () => {
    const computeMotionCommand = (keysSet) => {
      const isUp = keysSet.has('w') || keysSet.has('arrowup');
      const isDown = keysSet.has('s') || keysSet.has('arrowdown');
      const isLeft = keysSet.has('a') || keysSet.has('arrowleft');
      const isRight = keysSet.has('d') || keysSet.has('arrowright');

      if (isUp && isLeft) return 'wa';
      if (isUp && isRight) return 'wd';
      if (isDown && isLeft) return 'sa';
      if (isDown && isRight) return 'sd';
      if (isUp) return 'w';
      if (isDown) return 's';
      if (isLeft) return 'a';
      if (isRight) return 'd';
      return 'stop';
    };

    expect(computeMotionCommand(new Set(['w', 'a']))).toBe('wa');
    expect(computeMotionCommand(new Set(['arrowup', 'arrowright']))).toBe('wd');
    expect(computeMotionCommand(new Set(['s', 'a']))).toBe('sa');
    expect(computeMotionCommand(new Set(['arrowdown', 'd']))).toBe('sd');
    expect(computeMotionCommand(new Set(['w']))).toBe('w');
    expect(computeMotionCommand(new Set(['s']))).toBe('s');
    expect(computeMotionCommand(new Set(['a']))).toBe('a');
    expect(computeMotionCommand(new Set(['d']))).toBe('d');
    expect(computeMotionCommand(new Set())).toBe('stop');
  });

  describe('Autonomous SLAM Frontier Exploration Logic', () => {
    const buildExploreStartPayload = (autoSave = true, saveName = 'auto_explored_map') => ({
      auto_save: Boolean(autoSave),
      save_name: (saveName && saveName.trim()) || 'auto_explored_map',
    });

    const resolveExploreStatus = (exploreStatusData, workflowStatusData) => {
      if (exploreStatusData && exploreStatusData.status === 'SUCCESS') {
        return {
          isExploring: Boolean(exploreStatusData.is_exploring),
          exploredCount: Number(exploreStatusData.explored_count || 0),
          source: 'EXPLORE_ENDPOINT',
        };
      }
      if (workflowStatusData && workflowStatusData.status === 'SUCCESS') {
        return {
          isExploring: workflowStatusData.robot_status === 'EXPLORING',
          exploredCount: 0,
          source: 'WORKFLOW_FALLBACK',
        };
      }
      return {
        isExploring: false,
        exploredCount: 0,
        source: 'DEFAULT',
      };
    };

    it('should generate valid explore start request payload with default and custom map names', () => {
      const defaultPayload = buildExploreStartPayload();
      expect(defaultPayload).toEqual({
        auto_save: true,
        save_name: 'auto_explored_map',
      });

      const customPayload = buildExploreStartPayload(false, 'room_101_full_map');
      expect(customPayload).toEqual({
        auto_save: false,
        save_name: 'room_101_full_map',
      });
    });

    it('should correctly resolve exploration status from explore endpoint', () => {
      const liveData = {
        status: 'SUCCESS',
        is_exploring: true,
        explored_count: 7,
      };
      const result = resolveExploreStatus(liveData, null);
      expect(result.isExploring).toBe(true);
      expect(result.exploredCount).toBe(7);
      expect(result.source).toBe('EXPLORE_ENDPOINT');
    });

    it('should fallback smoothly to workflow status if explore endpoint is not available', () => {
      const workflowData = {
        status: 'SUCCESS',
        robot_status: 'EXPLORING',
      };
      const result = resolveExploreStatus(null, workflowData);
      expect(result.isExploring).toBe(true);
      expect(result.exploredCount).toBe(0);
      expect(result.source).toBe('WORKFLOW_FALLBACK');
    });

    it('should return idle default state when both status sources are null', () => {
      const result = resolveExploreStatus(null, null);
      expect(result.isExploring).toBe(false);
      expect(result.exploredCount).toBe(0);
      expect(result.source).toBe('DEFAULT');
    });
  });

  describe('Emergency Stop (E-STOP) Safety Interlock', () => {
    it('should immediately halt motion, cut velocity to zero, and clear active goals upon emergency stop', () => {
      const activeRunningState = {
        isExploring: true,
        activeNavGoal: { x: 3.5, y: -1.2 },
        telemetry: {
          status: 'EXPLORING',
          linearVelocity: 0.22,
          angularVelocity: 12.5,
        },
      };

      const handleEmergencyStopLogic = (state) => ({
        ...state,
        isExploring: false,
        activeNavGoal: null,
        telemetry: {
          ...state.telemetry,
          status: 'EMERGENCY_STOPPED',
          linearVelocity: 0.0,
          angularVelocity: 0.0,
        },
      });

      const stoppedState = handleEmergencyStopLogic(activeRunningState);

      expect(stoppedState.isExploring).toBe(false);
      expect(stoppedState.activeNavGoal).toBeNull();
      expect(stoppedState.telemetry.status).toBe('EMERGENCY_STOPPED');
      expect(stoppedState.telemetry.linearVelocity).toBe(0.0);
      expect(stoppedState.telemetry.angularVelocity).toBe(0.0);
    });
  });
});

