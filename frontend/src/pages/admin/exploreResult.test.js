import { describe, it, expect } from 'vitest';
import { defaultMapName, describeExploreResult, piRequestErrorMessage } from './exploreResult';

describe('piRequestErrorMessage (bam Quet ma Pi khong tra loi)', () => {
  it('turns a network failure into instructions to start main.py on the Pi', () => {
    for (const err of [new TypeError('Failed to fetch'), Object.assign(new Error('x'), { name: 'TimeoutError' })]) {
      const msg = piRequestErrorMessage(err, '100.99.72.51');
      expect(msg).toContain('100.99.72.51:8000');
      expect(msg).toContain('sudo python3 main.py');
    }
  });

  it('keeps a real error message from the Pi', () => {
    expect(piRequestErrorMessage(new Error('RPLiDAR không phát dữ liệu scan.'), 'pi')).toBe('RPLiDAR không phát dữ liệu scan.');
  });
});

describe('describeExploreResult (popup luu map sau khi tu quet)', () => {
  it('reports a finished scan with the explorer message', () => {
    const r = describeExploreResult({ state: 'DONE', message: 'Đã quét xong: thăm 7 chỗ.' });
    expect(r.tone).toBe('success');
    expect(r.title).toMatch(/quét xong/);
    expect(r.detail).toContain('7 chỗ');
  });

  it('warns when the robot could not reach anything', () => {
    const r = describeExploreResult({ state: 'FAILED', message: 'Robot chưa tới được điểm khám phá nào' });
    expect(r.tone).toBe('warning');
    expect(r.detail).toContain('chưa tới được');
  });

  it('reports a manual stop', () => {
    expect(describeExploreResult({ state: 'STOPPED', message: 'Đã dừng' }).title).toMatch(/dừng/i);
  });

  it('falls back to a generic message when the result never arrived', () => {
    for (const missing of [null, undefined, { state: 'EXPLORING' }]) {
      const r = describeExploreResult(missing);
      expect(r.tone).toBe('neutral');
      expect(r.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('defaultMapName', () => {
  it('uses local date and time so names sort and stay unique per minute', () => {
    expect(defaultMapName(new Date(2026, 10, 8, 9, 5))).toBe('map_2026_11_08_0905');
  });
});
