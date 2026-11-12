import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VIEW,
  MAP_PAD_PX,
  MAX_ZOOM,
  clampView,
  fitWidthView,
  isDefaultView,
  mapFrame,
  panView,
  wheelZoomFactor,
  zoomViewAt,
} from './physicalMapView';

// Map doc giong map_2026_11_11_1005 (115 x 154 o, 0.05 m) tren khung rong 1200 x 700
const TALL = { widthMeters: 5.75, heightMeters: 7.7, originX: -0.479, originY: -5.235 };
const W = 1200;
const H = 700;

const worldToCanvas = (x, y, cfg) => {
  const f = mapFrame(W, H, cfg);
  return { x: f.offsetX + (x - cfg.originX) * f.scale, y: f.offsetY + (cfg.heightMeters - (y - cfg.originY)) * f.scale };
};

describe('mapFrame (khung ve map)', () => {
  it('fits and centres the map like before when there is no view', () => {
    const f = mapFrame(W, H, TALL);
    // map doc: bi gioi han boi chieu cao => rong them (thu gon sidebar) KHONG lam map to ra
    expect(f.scale).toBeCloseTo((H - 2 * MAP_PAD_PX) / 7.7, 6);
    expect(f.offsetY).toBeCloseTo(MAP_PAD_PX, 6);
    expect(f.offsetX).toBeCloseTo((W - f.roomW) / 2, 6);
    expect(mapFrame(W + 400, H, TALL).scale).toBeCloseTo(f.scale, 6);
  });

  it('zoom multiplies the scale and pan shifts the map', () => {
    const base = mapFrame(W, H, TALL);
    const f = mapFrame(W, H, { ...TALL, view: { zoom: 2, panX: 30, panY: -10 } });
    expect(f.scale).toBeCloseTo(base.scale * 2, 6);
    expect(f.offsetX).toBeCloseTo((W - f.roomW) / 2 + 30, 6);
    expect(f.offsetY).toBeCloseTo((H - f.roomH) / 2 - 10, 6);
  });
});

describe('zoomViewAt (lan chuot)', () => {
  it('keeps the world point under the cursor fixed', () => {
    const mouse = { x: 700, y: 300 };
    const before = mapFrame(W, H, TALL);
    const wx = TALL.originX + (mouse.x - before.offsetX) / before.scale;
    const wy = TALL.originY + TALL.heightMeters - (mouse.y - before.offsetY) / before.scale;
    const view = zoomViewAt(DEFAULT_VIEW, 1.5, mouse.x, mouse.y, W, H, TALL);
    expect(view.zoom).toBeCloseTo(1.5, 6);
    const p = worldToCanvas(wx, wy, { ...TALL, view });
    expect(p.x).toBeCloseTo(mouse.x, 6);
    expect(p.y).toBeCloseTo(mouse.y, 6);
  });

  it('never zooms out past "fit" nor beyond the max', () => {
    expect(zoomViewAt(DEFAULT_VIEW, 0.5, 600, 350, W, H, TALL)).toEqual(DEFAULT_VIEW);
    expect(zoomViewAt({ zoom: 7, panX: 0, panY: 0 }, 10, 600, 350, W, H, TALL).zoom).toBe(MAX_ZOOM);
  });

  it('zooming back out to 1x recentres the map', () => {
    const zoomed = zoomViewAt(DEFAULT_VIEW, 3, 100, 100, W, H, TALL);
    expect(zoomViewAt(zoomed, 1 / 3, 900, 600, W, H, TALL)).toEqual(DEFAULT_VIEW);
  });
});

describe('panView / clampView (keo map)', () => {
  it('moves by the dragged pixels', () => {
    const v = panView({ zoom: 3, panX: 0, panY: 0 }, 40, -25, W, H, TALL);
    expect(v).toEqual({ zoom: 3, panX: 40, panY: -25 });
  });

  it('cannot drag the map out of sight', () => {
    const v = panView({ zoom: 3, panX: 0, panY: 0 }, 99999, 99999, W, H, TALL);
    const f = mapFrame(W, H, { ...TALL, view: v });
    expect(f.offsetX).toBeLessThanOrEqual(MAP_PAD_PX + 1e-6); // mep trai map khong troi vao giua
    expect(f.offsetY).toBeLessThanOrEqual(MAP_PAD_PX + 1e-6);
    const back = panView(v, -99999, -99999, W, H, TALL);
    const g = mapFrame(W, H, { ...TALL, view: back });
    expect(g.offsetX + g.roomW).toBeGreaterThanOrEqual(W - MAP_PAD_PX - 1e-6);
    expect(g.offsetY + g.roomH).toBeGreaterThanOrEqual(H - MAP_PAD_PX - 1e-6);
  });

  it('returns the same object when nothing changes (no extra re-render)', () => {
    const v = { zoom: 2, panX: 10, panY: 5 };
    expect(clampView(v, W, H, TALL)).toBe(v);
  });
});

describe('fitWidthView (vua chieu ngang)', () => {
  it('makes a tall map fill the canvas width', () => {
    const view = fitWidthView(W, H, TALL);
    const f = mapFrame(W, H, { ...TALL, view });
    expect(f.roomW).toBeCloseTo(W - 2 * MAP_PAD_PX, 6);
    expect(view.zoom).toBeGreaterThan(1);
  });

  it('is plain "fit" for a wide map that already fills the width', () => {
    const wide = { widthMeters: 5.55, heightMeters: 3.55, originX: 0, originY: 0 };
    expect(fitWidthView(W, 1000, wide)).toEqual(DEFAULT_VIEW);
  });

  it('isDefaultView tells whether the reset button has anything to do', () => {
    expect(isDefaultView(DEFAULT_VIEW)).toBe(true);
    expect(isDefaultView({ zoom: 1.0000001, panX: 0, panY: 0 })).toBe(true);
    expect(isDefaultView({ zoom: 2, panX: 0, panY: 0 })).toBe(false);
  });
});

describe('wheelZoomFactor', () => {
  it('scroll up zooms in, down zooms out, one notch about 20%', () => {
    expect(wheelZoomFactor(-100, 0)).toBeGreaterThan(1.15);
    expect(wheelZoomFactor(-100, 0)).toBeLessThan(1.3);
    expect(wheelZoomFactor(100, 0)).toBeLessThan(1);
    expect(wheelZoomFactor(-100, 0) * wheelZoomFactor(100, 0)).toBeCloseTo(1, 6);
  });

  it('treats line-mode wheels (Firefox) like pixel wheels and caps huge deltas', () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-99, 0), 6);
    expect(wheelZoomFactor(-5000, 0)).toBeCloseTo(wheelZoomFactor(-120, 0), 6);
  });
});
