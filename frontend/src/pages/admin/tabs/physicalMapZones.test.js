import { describe, it, expect } from 'vitest';
import {
  MIN_ZONE_SIZE_M,
  endpointPlacementViolation,
  endpointZoneViolation,
  isPointInZone,
  resizeZoneFromCorner,
  speedZoneStatus,
  zoneCorners,
  zoneEndpointConflict,
  zoneFromCorners,
} from './physicalMapZones';

describe('vung cam dung/cam vao va endpoint loai tru nhau', () => {
  const noStop = { id: 'n', name: 'Hành lang', type: 'NO_STOP', x: 1, y: 1, width: 1, height: 1 };
  const keepOut = { id: 'k', name: 'Kho', type: 'KEEP_OUT', x: 4, y: 1, width: 1, height: 1 };
  const slow = { id: 's', name: 'Cửa', type: 'SPEED_ZONE', x: 1, y: 3, width: 1, height: 1 };
  const eps = [
    { id: 'a', name: 'Bàn A', x: 1.2, y: 0.9 },
    { id: 'b', name: 'Bàn B', x: 1.4, y: 1.3 },
    { id: 'c', name: 'Cửa C', x: 1.0, y: 3.0 },
  ];

  it('refuses to place an endpoint inside a no-stop or keep-out zone', () => {
    expect(endpointPlacementViolation({ x: 1.1, y: 1.1 }, [noStop, keepOut, slow])).toMatch(/cấm dừng “Hành lang”/);
    expect(endpointPlacementViolation({ x: 4, y: 1 }, [noStop, keepOut, slow])).toMatch(/cấm vào “Kho”/);
  });

  it('allows endpoints in speed zones and outside zones', () => {
    expect(endpointPlacementViolation({ x: 1, y: 3 }, [noStop, keepOut, slow])).toBeNull();
    expect(endpointPlacementViolation({ x: 9, y: 9 }, [noStop, keepOut, slow])).toBeNull();
  });

  it('refuses a no-stop zone drawn over endpoints and names every one to delete', () => {
    const c = zoneEndpointConflict(noStop, eps);
    expect(c.endpoints.map((e) => e.id)).toEqual(['a', 'b']);
    expect(c.message).toContain('Bàn A');
    expect(c.message).toContain('Bàn B');
    expect(c.message).toMatch(/xóa/i);
  });

  it('has no conflict for speed zones or zones that cover no endpoint', () => {
    expect(zoneEndpointConflict(slow, eps)).toBeNull();
    expect(zoneEndpointConflict(keepOut, eps)).toBeNull();
    expect(zoneEndpointConflict(noStop, [])).toBeNull();
  });
});

describe('speedZoneStatus (dong ho toc do + huy hieu vung giam toc khi demo)', () => {
  const slow = { id: 's', name: 'Cửa ra vào', type: 'SPEED_ZONE', x: 1, y: 0, width: 1, height: 0.6, speed_limit: 0.12 };
  const health = (extra = {}) => ({ speed_limit_mps: null, speed_limit_below_motor_floor: false,
    motor_min_linear_speed_mps: 0.1225, ...extra });

  it('is idle outside every zone with no Nav2 limit', () => {
    const s = speedZoneStatus({ x: 3, y: 0 }, [slow], health());
    expect(s.active).toBe(false);
    expect(s.zone).toBeNull();
    expect(s.warning).toBe('');
  });

  it('shows the limit Nav2 actually applies and which zone the robot is in', () => {
    const s = speedZoneStatus({ x: 1, y: 0 }, [slow], health({ speed_limit_mps: 0.12 }));
    expect(s.active).toBe(true);
    expect(s.zone.id).toBe('s');
    expect(s.label).toContain('0.12 m/s');
    expect(s.label).toContain('Cửa ra vào');
  });

  it('explains when the zone is below what the motors can do', () => {
    const s = speedZoneStatus({ x: 1, y: 0 }, [slow], health({ speed_limit_mps: 0.08, speed_limit_below_motor_floor: true }));
    expect(s.warning).toMatch(/chậm nhất ~0.12 m\/s/);
  });

  it('flags a zone Nav2 is not applying, but not right at the edge', () => {
    const deep = speedZoneStatus({ x: 1, y: 0 }, [slow], health());
    expect(deep.active).toBe(false);
    expect(deep.warning).toMatch(/Nav2 chưa áp/);
    // sat mep (cach mep 5 cm): Nav2 xet tam xe + 1 Hz tre => chua bao loi
    expect(speedZoneStatus({ x: 1.45, y: 0 }, [slow], health()).warning).toBe('');
  });

  it('works without health data', () => {
    expect(speedZoneStatus({ x: 1, y: 0 }, [slow], null).active).toBe(false);
  });
});

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
