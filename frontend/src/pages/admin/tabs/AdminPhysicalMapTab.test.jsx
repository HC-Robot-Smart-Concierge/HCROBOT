import { describe, it, expect } from 'vitest';
import {
  LAYOUT2_CONFIG,
  DEFAULT_LAB_WAYPOINTS,
  DEFAULT_LAB_ZONES,
  ZONE_TEMPLATES,
  DEFAULT_SAFE_SPEED_PERCENT,
  DEFAULT_SAFE_LINEAR_SPEED,
  LAB_GEOMETRIC_OBSTACLES,
  transformWorldToCanvas,
  transformCanvasToWorld,
} from './AdminPhysicalMapTab';

describe('AdminPhysicalMapTab - Physical Lab Map (layout2)', () => {
  it('correctly loads layout2 configuration matching layout2.yaml parameters', () => {
    expect(LAYOUT2_CONFIG.mapId).toBe('layout2');
    expect(LAYOUT2_CONFIG.resolution).toBe(0.05);
    expect(LAYOUT2_CONFIG.widthCells).toBe(111);
    expect(LAYOUT2_CONFIG.heightCells).toBe(71);
    expect(LAYOUT2_CONFIG.widthMeters).toBeCloseTo(5.55, 2);
    expect(LAYOUT2_CONFIG.heightMeters).toBeCloseTo(3.55, 2);
    expect(LAYOUT2_CONFIG.originX).toBe(-0.711);
    expect(LAYOUT2_CONFIG.originY).toBe(-1.765);
  });

  it('defines optimal safe lidar scanning velocity constants', () => {
    expect(DEFAULT_SAFE_SPEED_PERCENT).toBe(25);
    expect(DEFAULT_SAFE_LINEAR_SPEED).toBe(0.12);
  });

  it('contains valid default lab waypoints synced with layout2.json within map physical boundaries', () => {
    expect(DEFAULT_LAB_WAYPOINTS.length).toBe(6);
    const minX = LAYOUT2_CONFIG.originX;
    const maxX = LAYOUT2_CONFIG.originX + LAYOUT2_CONFIG.widthMeters;
    const minY = LAYOUT2_CONFIG.originY;
    const maxY = LAYOUT2_CONFIG.originY + LAYOUT2_CONFIG.heightMeters;

    DEFAULT_LAB_WAYPOINTS.forEach((wp) => {
      expect(wp.id).toBeDefined();
      expect(wp.name).toBeDefined();
      expect(wp.type).toBeDefined();
      expect(wp.x).toBeGreaterThanOrEqual(minX);
      expect(wp.x).toBeLessThanOrEqual(maxX);
      expect(wp.y).toBeGreaterThanOrEqual(minY);
      expect(wp.y).toBeLessThanOrEqual(maxY);
    });
  });

  it('contains valid default lab functional zones with proper boundaries and types', () => {
    expect(DEFAULT_LAB_ZONES.length).toBe(3);
    const minX = LAYOUT2_CONFIG.originX;
    const maxX = LAYOUT2_CONFIG.originX + LAYOUT2_CONFIG.widthMeters;
    const minY = LAYOUT2_CONFIG.originY;
    const maxY = LAYOUT2_CONFIG.originY + LAYOUT2_CONFIG.heightMeters;

    DEFAULT_LAB_ZONES.forEach((z) => {
      expect(['KEEP_OUT', 'SPEED_ZONE', 'NO_STOP']).toContain(z.type);
      expect(z.id).toBeDefined();
      expect(z.name).toBeDefined();
      expect(z.width).toBeGreaterThan(0);
      expect(z.height).toBeGreaterThan(0);

      // Bounding box of zone must reside inside map
      const halfW = z.width / 2;
      const halfH = z.height / 2;
      expect(z.x - halfW).toBeGreaterThanOrEqual(minX - 0.5);
      expect(z.x + halfW).toBeLessThanOrEqual(maxX + 0.5);
      expect(z.y - halfH).toBeGreaterThanOrEqual(minY - 0.5);
      expect(z.y + halfH).toBeLessThanOrEqual(maxY + 0.5);
    });
  });

  it('provides all 3 standard functional zone templates', () => {
    expect(ZONE_TEMPLATES.length).toBe(3);
    const types = ZONE_TEMPLATES.map((t) => t.type);
    expect(types).toContain('KEEP_OUT');
    expect(types).toContain('SPEED_ZONE');
    expect(types).toContain('NO_STOP');
  });

  it('defines geometric obstacles that reside strictly inside the lab room bounds', () => {
    expect(LAB_GEOMETRIC_OBSTACLES.length).toBeGreaterThan(0);
    const minX = LAYOUT2_CONFIG.originX;
    const maxX = LAYOUT2_CONFIG.originX + LAYOUT2_CONFIG.widthMeters;
    const minY = LAYOUT2_CONFIG.originY;
    const maxY = LAYOUT2_CONFIG.originY + LAYOUT2_CONFIG.heightMeters;

    LAB_GEOMETRIC_OBSTACLES.forEach((obs) => {
      expect(obs.x).toBeGreaterThanOrEqual(minX);
      expect(obs.x + obs.width).toBeLessThanOrEqual(maxX);
      expect(obs.y).toBeGreaterThanOrEqual(minY);
      expect(obs.y + obs.height).toBeLessThanOrEqual(maxY);
    });
  });

  it('performs accurate coordinate transformations between world (meters) and canvas (pixels)', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;

    // Test dock station at (0.0, 0.0)
    const worldPoint = { x: 0.0, y: 0.0 };
    const canvasPoint = transformWorldToCanvas(
      worldPoint.x,
      worldPoint.y,
      canvasWidth,
      canvasHeight,
      LAYOUT2_CONFIG
    );

    expect(canvasPoint.x).toBeGreaterThan(0);
    expect(canvasPoint.y).toBeGreaterThan(0);
    expect(canvasPoint.scale).toBeGreaterThan(0);

    // Roundtrip back to world coordinates
    const roundtrip = transformCanvasToWorld(
      canvasPoint.x,
      canvasPoint.y,
      canvasWidth,
      canvasHeight,
      LAYOUT2_CONFIG
    );

    expect(roundtrip.worldX).toBeCloseTo(worldPoint.x, 3);
    expect(roundtrip.worldY).toBeCloseTo(worldPoint.y, 3);
  });

  it('properly maps map corners to canvas bounds with padding', () => {
    const canvasWidth = 1000;
    const canvasHeight = 700;

    const originCorner = transformWorldToCanvas(
      LAYOUT2_CONFIG.originX,
      LAYOUT2_CONFIG.originY,
      canvasWidth,
      canvasHeight,
      LAYOUT2_CONFIG
    );

    const maxCorner = transformWorldToCanvas(
      LAYOUT2_CONFIG.originX + LAYOUT2_CONFIG.widthMeters,
      LAYOUT2_CONFIG.originY + LAYOUT2_CONFIG.heightMeters,
      canvasWidth,
      canvasHeight,
      LAYOUT2_CONFIG
    );

    expect(maxCorner.x).toBeGreaterThan(originCorner.x);
    expect(maxCorner.y).toBeLessThan(originCorner.y);
  });
});
