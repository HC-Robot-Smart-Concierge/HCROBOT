import { describe, it, expect } from 'vitest';
import { navigationBlockingReason } from './physicalMapNavigation';

describe('Physical robot encoder gate', () => {
  const state = {
    connected: true, runtime: { mode: 'NAVIGATION', activeMap: 'lab' }, mapId: 'lab',
    physical: true, localized: true, poseAt: 10000, costmapAt: 10000, healthAt: 10000, now: 10000,
    health: { pi_ws_connected: true, lidar_live: true, encoder_packets: 20, last_encoder_age_sec: 0.01 },
  };
  it('blocks new goals even when faulty encoder packets are arriving freshly', () => {
    expect(navigationBlockingReason({ ...state, health: { ...state.health, encoder_valid: false, encoder_fault: 'ENCODER_M1_IMPOSSIBLE_SPEED' } })).toContain('ENCODER_M1');
  });
  it('accepts clean encoder data and preserves compatibility with older telemetry', () => {
    expect(navigationBlockingReason(state)).toBeNull();
    expect(navigationBlockingReason({ ...state, health: { ...state.health, encoder_valid: true } })).toBeNull();
  });
});
