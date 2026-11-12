import { describe, expect, it } from 'vitest';
import { appliedSpeedLabel, parseZoneSpeed, speedZoneLabel } from './speedZones';

describe('Speed zone controls', () => {
  it.each(['', 'abc', '0', '-1', 'Infinity', '1.01'])('rejects invalid limit %s', (value) => {
    expect(parseZoneSpeed(value)).toBeNull();
  });
  it('quantizes down to the same hundredth as the Nav2 mask', () => {
    expect(parseZoneSpeed('0.129')).toBe(0.12);
    expect(parseZoneSpeed('0.29')).toBe(0.29);
  });
  it('always includes the speed on named map zones', () => {
    expect(speedZoneLabel({ name: 'Hành lang', speed_limit: 0.18 })).toContain('≤ 0.18 m/s');
  });
  it('distinguishes missing data, waiting, unrestricted and applied limits', () => {
    expect(appliedSpeedLabel(null)).toContain('Chưa nhận');
    expect(appliedSpeedLabel({ mask_ready: true, limit: null })).toContain('Chờ Nav2');
    expect(appliedSpeedLabel({ mask_ready: true, limit: { speed_limit: 0 } })).toContain('Ngoài vùng');
    expect(appliedSpeedLabel({ mask_ready: true, limit: { speed_limit: 0.18, percentage: false } })).toBe('Nav2: ≤ 0.18 m/s');
    expect(appliedSpeedLabel({ mask_ready: true, limit: { speed_limit: 50, percentage: true } })).toBe('Nav2: ≤ 50%');
    expect(appliedSpeedLabel({ mask_ready: true, receivedAt: 1000 }, 5000)).toContain('Mất cập nhật');
  });
});
