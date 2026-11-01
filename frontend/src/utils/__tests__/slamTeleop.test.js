import { describe, expect, it } from 'vitest';
import { DEFAULT_SLAM_SPEED, getSlamTeleopMotion } from '../slamTeleop';

describe('SLAM manual speed selection', () => {
  it('preserves the existing mapping speeds before the operator changes the slider', () => {
    expect(DEFAULT_SLAM_SPEED).toBe(30);
    expect(getSlamTeleopMotion('forward')).toEqual({ linear: 0.1, angular: 0, speed: 30 });
    expect(getSlamTeleopMotion('backward')).toEqual({ linear: -0.1, angular: 0, speed: 30 });
    expect(getSlamTeleopMotion('left')).toEqual({ linear: 0, angular: 0.3, speed: 38 });
    expect(getSlamTeleopMotion('right')).toEqual({ linear: 0, angular: -0.3, speed: 38 });
  });

  it('applies the selected speed to ROS motion and the existing Pi teleop payload', () => {
    const forward = getSlamTeleopMotion('forward', 60);
    const turn = getSlamTeleopMotion('left', 60);
    expect(forward).toEqual({ linear: 0.2, angular: 0, speed: 60 });
    expect(turn).toEqual({ linear: 0, angular: 0.6, speed: 76 });
  });

  it('keeps stop stationary at every preset and caps motor power at 100%', () => {
    for (const speed of [20, 30, 50, 75, 100]) {
      expect(getSlamTeleopMotion('stop', speed)).toEqual({ linear: 0, angular: 0, speed });
      expect(getSlamTeleopMotion('left', speed).speed).toBeLessThanOrEqual(100);
    }
    expect(getSlamTeleopMotion('forward', 200).speed).toBe(100);
    expect(getSlamTeleopMotion('forward', -20).speed).toBe(20);
    expect(getSlamTeleopMotion('forward', NaN)).toEqual(getSlamTeleopMotion('forward'));
  });
});
