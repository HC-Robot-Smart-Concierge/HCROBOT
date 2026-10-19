import { describe, it, expect } from 'vitest';
import { HOTEL_FACILITIES_LIST } from './RobotFacilitiesModal';
import { HOTEL_DESTINATIONS } from './FloorMap';

describe('RobotFacilitiesModal Synchronization Logic', () => {
  it('contains valid facilities with keys matching FloorMap destinations', () => {
    expect(HOTEL_FACILITIES_LIST.length).toBeGreaterThan(0);

    HOTEL_FACILITIES_LIST.forEach((facility) => {
      expect(facility).toHaveProperty('key');
      expect(facility).toHaveProperty('name');
      expect(facility).toHaveProperty('floorLevel');
      expect(facility).toHaveProperty('category');
      expect(facility).toHaveProperty('hours');

      // Key must exist in HOTEL_DESTINATIONS to ensure seamless 2D route and QR handoff
      expect(HOTEL_DESTINATIONS).toHaveProperty(facility.key);
    });
  });

  it('correctly filters facilities by category', () => {
    const filterByCategory = (category) => {
      if (category === 'Tất cả') return HOTEL_FACILITIES_LIST;
      return HOTEL_FACILITIES_LIST.filter((f) => f.category === category);
    };

    const diningList = filterByCategory('Ẩm thực');
    expect(diningList.length).toBeGreaterThan(0);
    diningList.forEach((item) => expect(item.category).toBe('Ẩm thực'));

    const relaxList = filterByCategory('Thư giãn');
    expect(relaxList.length).toBeGreaterThan(0);
    relaxList.forEach((item) => expect(item.category).toBe('Thư giãn'));

    const allList = filterByCategory('Tất cả');
    expect(allList.length).toBe(HOTEL_FACILITIES_LIST.length);
  });

  it('identifies restaurant facility has direct food menu action', () => {
    const restaurant = HOTEL_FACILITIES_LIST.find((f) => f.key === 'restaurant');
    expect(restaurant).toBeDefined();
    expect(restaurant?.hasMenuAction).toBe(true);
  });
});
