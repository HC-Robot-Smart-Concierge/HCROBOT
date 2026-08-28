import { describe, it, expect } from 'vitest';

describe('LiDAR Occupancy Grid & Coordinate Transformation Logic', () => {
  const metadata = {
    width: 100,
    height: 100,
    resolution: 0.1, // 0.1m per cell
    origin_x: -5.0,
    origin_y: -5.0,
  };

  it('should accurately convert world meters (X, Y) to grid cell coordinates', () => {
    const worldX = 0.0;
    const worldY = 0.0;

    const gridX = (worldX - metadata.origin_x) / metadata.resolution;
    const gridY = (worldY - metadata.origin_y) / metadata.resolution;

    expect(gridX).toBe(50);
    expect(gridY).toBe(50);
  });

  it('should accurately convert grid cell coordinates to world meters (X, Y)', () => {
    const gridX = 50;
    const gridY = 50;

    const worldX = gridX * metadata.resolution + metadata.origin_x;
    const worldY = gridY * metadata.resolution + metadata.origin_y;

    expect(worldX).toBe(0.0);
    expect(worldY).toBe(0.0);
  });

  it('should handle boundary waypoint coordinates correctly', () => {
    const receptionWp = { x: 2.5, y: 4.0 };
    const gridX = (receptionWp.x - metadata.origin_x) / metadata.resolution;
    const gridY = (receptionWp.y - metadata.origin_y) / metadata.resolution;

    expect(gridX).toBe(75);
    expect(gridY).toBe(90);
  });
});
