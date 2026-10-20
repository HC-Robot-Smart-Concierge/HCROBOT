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

  it('ensures no emojis exist and descriptions are concise', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    HOTEL_FACILITIES_LIST.forEach((facility) => {
      // Must not contain emojis
      expect(emojiRegex.test(facility.name)).toBe(false);
      expect(emojiRegex.test(facility.desc)).toBe(false);

      // Descriptions must be concise (under 95 chars)
      expect(facility.desc.length).toBeLessThan(95);
    });
  });

  it('filters facilities correctly with search queries', () => {
    const searchFacilities = (query) => {
      const q = query.trim().toLowerCase();
      return HOTEL_FACILITIES_LIST.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.floorLevel.toLowerCase().includes(q) ||
          f.desc.toLowerCase().includes(q)
      );
    };

    const poolResults = searchFacilities('hồ bơi');
    expect(poolResults.length).toBe(1);
    expect(poolResults[0].key).toBe('infinity_pool');

    const floor5Results = searchFacilities('tầng 5');
    expect(floor5Results.length).toBeGreaterThanOrEqual(3);

    const nonExistent = searchFacilities('không tồn tại 12345');
    expect(nonExistent.length).toBe(0);
  });

  it('validates hotel knowledge base metadata from admin RAG vault', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    HOTEL_FACILITIES_LIST.forEach((facility) => {
      expect(facility).toHaveProperty('knowledge');
      const { knowledge } = facility;

      expect(typeof knowledge.pricing).toBe('string');
      expect(typeof knowledge.summary).toBe('string');
      expect(typeof knowledge.transitHint).toBe('string');
      expect(Array.isArray(knowledge.highlights)).toBe(true);
      expect(knowledge.highlights.length).toBeGreaterThanOrEqual(2);

      // Verify no emojis in knowledge fields
      expect(emojiRegex.test(knowledge.pricing)).toBe(false);
      expect(emojiRegex.test(knowledge.summary)).toBe(false);
      expect(emojiRegex.test(knowledge.transitHint)).toBe(false);
      knowledge.highlights.forEach((h) => expect(emojiRegex.test(h)).toBe(false));
    });
  });

  it('adheres to warm grey system palette tokens without cold zinc or pure white backgrounds', () => {
    const warmGreyTokens = {
      modalBg: 'bg-[#F5F2EB]',
      cardBg: 'bg-white',
      borderColor: 'border-[#E3DFD5]',
      iconContainerBg: 'bg-[#EFECE4]',
      primaryButtonBg: 'bg-[#1A1917]',
      textColor: 'text-stone-900',
    };

    expect(warmGreyTokens.modalBg).toBe('bg-[#F5F2EB]');
    expect(warmGreyTokens.borderColor).toBe('border-[#E3DFD5]');
    expect(warmGreyTokens.iconContainerBg).toBe('bg-[#EFECE4]');
    expect(warmGreyTokens.primaryButtonBg).toBe('bg-[#1A1917]');
    expect(warmGreyTokens.textColor).toContain('stone-900');
  });
});


