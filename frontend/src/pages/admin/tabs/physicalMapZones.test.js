import { describe, it, expect } from 'vitest';
import {
  MIN_ZONE_SIZE_M,
  endpointZoneViolation,
  isPointInZone,
  resizeZoneFromCorner,
  zoneCorners,
  zoneFromCorners,
} from './physicalMapZones';

const keepOut = { id: 'k', name: 'Kho hàng', type: 'KEEP_OUT', x: 1, y: 1, width: 1, height: 0.5 };
const noStop = { id: 'n', name: 'Hành lang', type: 'NO_STOP', x: -1, y: 0, width: 0.6, height: 0.6 };
const speed = { id: 's', name: 'Cửa', type: 'SPEED_ZONE', x: 0, y: 0, width: 1, height: 1, speed_limit: 0.12 };

describe('isPointInZone', () => {
  it('uses x/y as the rectangle centre', () => {
    expect(isPointInZone(1.4, 1.2, keepOut)).toBe(true);
    expect(isPointInZone(1.5, 1.25, keepOut)).toBe(true); // canh vung tinh la trong vung
    expect(isPointInZone(1.6, 1.0, keepOut)).toBe(false);
    expect(isPointInZone(1.0, 0.7, keepOut)).toBe(false);
  });
});

describe('zoneFromCorners (keo chuot ve vung)', () => {
  it('gives the same rectangle whichever direction the user drags', () => {
    const a = zoneFromCorners({ x: 0.5, y: 2.0 }, { x: 1.7, y: 1.2 });
    const b = zoneFromCorners({ x: 1.7, y: 1.2 }, { x: 0.5, y: 2.0 });
    expect(a).toEqual(b);
    expect(a.x).toBeCloseTo(1.1);
    expect(a.y).toBeCloseTo(1.6);
    expect(a.width).toBeCloseTo(1.2);
    expect(a.height).toBeCloseTo(0.8);
  });

  it('ignores a click or a tiny drag', () => {
    expect(zoneFromCorners({ x: 1, y: 1 }, { x: 1.05, y: 1.5 })).toBeNull();
    expect(zoneFromCorners({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('resizeZoneFromCorner (keo goc vung)', () => {
  it('keeps the opposite corner fixed', () => {
    const r = resizeZoneFromCorner(keepOut, 'ne', { x: 2.0, y: 1.5 }); // sw = (0.5, 0.75) dung yen
    const c = zoneCorners(r);
    expect(c.sw.x).toBeCloseTo(0.5);
    expect(c.sw.y).toBeCloseTo(0.75);
    expect(c.ne.x).toBeCloseTo(2.0);
    expect(c.ne.y).toBeCloseTo(1.5);
  });

  it('never flips or shrinks below the minimum size', () => {
    const r = resizeZoneFromCorner(keepOut, 'sw', { x: 5, y: 5 }); // keo qua goc doi dien
    const c = zoneCorners(r);
    expect(c.ne.x).toBeCloseTo(1.5);
    expect(c.ne.y).toBeCloseTo(1.25);
    expect(r.width).toBeCloseTo(MIN_ZONE_SIZE_M);
    expect(r.height).toBeCloseTo(MIN_ZONE_SIZE_M);
  });
});

describe('endpointZoneViolation (bam endpoint de chay)', () => {
  const zones = [keepOut, noStop, speed];

  it('rejects an endpoint inside a keep-out zone', () => {
    const msg = endpointZoneViolation({ x: 1.2, y: 1.1 }, zones);
    expect(msg).toMatch(/cấm vào/);
    expect(msg).toContain('Kho hàng');
  });

  it('rejects an endpoint inside a no-stop zone (passing through is allowed)', () => {
    const msg = endpointZoneViolation({ x: -1.1, y: 0.1 }, zones);
    expect(msg).toMatch(/cấm dừng/);
    expect(msg).toContain('Hành lang');
  });

  it('allows endpoints in speed zones and outside every zone', () => {
    expect(endpointZoneViolation({ x: 0.1, y: -0.1 }, zones)).toBeNull();
    expect(endpointZoneViolation({ x: 3, y: 3 }, zones)).toBeNull();
    expect(endpointZoneViolation({ x: 3, y: 3 }, undefined)).toBeNull();
  });
});
