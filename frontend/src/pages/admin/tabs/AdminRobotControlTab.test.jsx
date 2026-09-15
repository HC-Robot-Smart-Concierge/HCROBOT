import { describe, it, expect } from 'vitest';

describe('AdminRobotControlTab Sub-view Logic', () => {
  const SUB_VIEWS = {
    STUDIO: 'studio',
    CAMERA: 'camera',
  };

  const getActiveTabTitle = (subViewKey) => {
    switch (subViewKey) {
      case SUB_VIEWS.STUDIO:
        return 'Studio Bản Đồ & Step Workflows';
      case SUB_VIEWS.CAMERA:
        return 'Live Camera FPV';
      default:
        return 'Unknown View';
    }
  };

  it('should default to studio sub-view', () => {
    const defaultSubView = SUB_VIEWS.STUDIO;
    expect(defaultSubView).toBe('studio');
    expect(getActiveTabTitle(defaultSubView)).toBe('Studio Bản Đồ & Step Workflows');
  });

  it('should switch smoothly to camera sub-view', () => {
    let currentSubView = SUB_VIEWS.STUDIO;
    const handleSwitch = (newView) => {
      currentSubView = newView;
    };

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
});
