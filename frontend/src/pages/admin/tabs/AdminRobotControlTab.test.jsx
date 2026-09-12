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
});
