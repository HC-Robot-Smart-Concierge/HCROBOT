import { describe, expect, it } from 'vitest';
import { buildCostmapImage, costmapCellColor, pathMsgToPoints } from './physicalMapCostmap';

describe('costmapCellColor', () => {
  it('free and unknown cells are transparent', () => {
    expect(costmapCellColor(0)[3]).toBe(0);
    expect(costmapCellColor(-1)[3]).toBe(0);
  });

  it('lethal cells are red, inflation is weaker orange', () => {
    expect(costmapCellColor(100)).toEqual([239, 68, 68, 150]);
    expect(costmapCellColor(99)[0]).toBe(239);
    const low = costmapCellColor(10)[3];
    const high = costmapCellColor(90)[3];
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });
});

describe('buildCostmapImage', () => {
  it('flips rows so grid row 0 (bottom) becomes the last image row', () => {
    // 2x2: o (0,0) duoi-trai = 100, con lai trong
    const img = buildCostmapImage({
      info: { width: 2, height: 2, resolution: 0.05, origin: { position: { x: -1, y: -2 } } },
      data: [100, 0, 0, 0],
    });
    expect(img.originX).toBe(-1);
    expect(img.originY).toBe(-2);
    // hang cuoi anh, cot 0 => index (1*2+0)*4 = 8
    expect(img.rgba[8 + 3]).toBe(150);
    expect(img.rgba[0 + 3]).toBe(0);
  });

  it('rejects malformed messages', () => {
    expect(buildCostmapImage(null)).toBeNull();
    expect(buildCostmapImage({ info: { width: 3, height: 3 }, data: [0] })).toBeNull();
  });
});

describe('pathMsgToPoints', () => {
  it('downsamples but always keeps the goal', () => {
    const poses = Array.from({ length: 10 }, (_, i) => ({ pose: { position: { x: i, y: 0 } } }));
    const pts = pathMsgToPoints({ poses }, 4);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([9, 0]);
  });
});
