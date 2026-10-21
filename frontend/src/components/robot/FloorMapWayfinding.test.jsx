import { describe, it, expect } from 'vitest';
import { HOTEL_DESTINATIONS, HOTEL_FLOORS, getMobileGuestMapUrl } from './FloorMap';

describe('FloorMap Wayfinding Logic & Contract Tests', () => {
  it('does not contain any emoji characters in destination names or step instructions', () => {
    const destinations = Object.values(HOTEL_DESTINATIONS);
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    destinations.forEach((dest) => {
      expect(emojiRegex.test(dest.name)).toBe(false);
      expect(emojiRegex.test(dest.icon || '')).toBe(false);
      expect(emojiRegex.test(dest.step1Text)).toBe(false);
      expect(emojiRegex.test(dest.step2Text)).toBe(false);
      expect(emojiRegex.test(dest.floorLevel)).toBe(false);
    });
  });

  it('verifies all hotel floors have clean naming without emojis', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    HOTEL_FLOORS.forEach((floor) => {
      expect(emojiRegex.test(floor.name)).toBe(false);
      expect(emojiRegex.test(floor.level)).toBe(false);
    });
  });

  it('generates a valid, mobile-optimized standalone QR map URL for guest handoff', () => {
    const url = getMobileGuestMapUrl('infinity_pool');
    expect(url).toBeDefined();
    expect(url).toContain('map.html?t=');
  });

  it('ensures each destination has complete multi-step routing attributes', () => {
    Object.values(HOTEL_DESTINATIONS).forEach((dest) => {
      expect(dest.id).toBeDefined();
      expect(dest.name).toBeDefined();
      expect(dest.floorLevel).toBeDefined();
      expect(dest.coords).toBeDefined();
      expect(dest.coords.x).toBeGreaterThan(0);
      expect(dest.coords.y).toBeGreaterThan(0);
      expect(dest.time).toBeDefined();
      expect(dest.distance).toBeDefined();

      if (dest.isDifferentFloor) {
        expect(dest.step1Text).toContain('Thang máy');
        expect(dest.routeTarget).toBeDefined();
      }
    });
  });

  it('ensures FloorMap source code does not contain bounce animation or zoom buttons', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const code = fs.readFileSync(path.resolve('src/components/robot/FloorMap.jsx'), 'utf8');

    // Không còn animation giật nảy
    expect(code).not.toContain('animate-bounce');

    // Không còn nút phóng to thu nhỏ zoom
    expect(code).not.toContain('handleZoomIn');
    expect(code).not.toContain('handleZoomOut');
    expect(code).not.toContain('handleResetZoom');
  });

  it('provides a complete key facilities list for quick switching without emojis', async () => {
    const { HOTEL_KEY_FACILITIES } = await import('./FloorMap');
    expect(Array.isArray(HOTEL_KEY_FACILITIES)).toBe(true);
    expect(HOTEL_KEY_FACILITIES.length).toBeGreaterThanOrEqual(7);

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    HOTEL_KEY_FACILITIES.forEach((fac) => {
      expect(fac.key).toBeDefined();
      expect(fac.name).toBeDefined();
      expect(fac.floor).toBeDefined();
      expect(emojiRegex.test(fac.name)).toBe(false);
      expect(emojiRegex.test(fac.floor)).toBe(false);
      expect(HOTEL_DESTINATIONS[fac.key]).toBeDefined();
    });
  });
});

