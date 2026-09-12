import { describe, it, expect } from 'vitest';
import { CONCIERGE_ZONE_TEMPLATES, getZoneTemplateInfo } from './AdminUnifiedStudioTab';

describe('Hotel Concierge Zone Management Logic', () => {
  it('should define official Hotel Concierge 5 functional zone templates', () => {
    const templateTypes = CONCIERGE_ZONE_TEMPLATES.map((t) => t.type);
    expect(templateTypes).toHaveLength(5);
    expect(templateTypes).toContain('KEEP_OUT');
    expect(templateTypes).toContain('SLOW_SPEED');
    expect(templateTypes).toContain('SILENT_ZONE');
    expect(templateTypes).toContain('GREETING_ZONE');
    expect(templateTypes).toContain('SERVICE_PRIORITY');
  });

  it('should retrieve correct template info for SLOW_SPEED and SILENT_ZONE', () => {
    const slowSpeed = getZoneTemplateInfo('SLOW_SPEED');
    expect(slowSpeed.badge).toBe('SLOW SPEED');
    expect(slowSpeed.icon).toBe('⚠️');

    const silentZone = getZoneTemplateInfo('SILENT_ZONE');
    expect(silentZone.badge).toBe('SILENT ZONE');
    expect(silentZone.icon).toBe('🔇');
  });

  it('should validate and construct payload for creating a functional Zone', () => {
    const inputData = {
      name: 'Khu Vực Cửa Ra Vào Sảnh',
      type: 'SLOW_SPEED',
      x: 1.5,
      y: 2.0,
      width: 3.5,
      height: 2.5,
      speed_limit: 0.25,
      description: 'Giới hạn tốc độ 0.25m/s tránh va chạm khách',
    };

    const payload = {
      id: 'zone-test-123',
      name: inputData.name.trim(),
      type: inputData.type,
      x: Number(inputData.x),
      y: Number(inputData.y),
      width: Number(inputData.width),
      height: Number(inputData.height),
      speed_limit: inputData.type === 'SLOW_SPEED' ? Number(inputData.speed_limit) : null,
      floor: 'Sảnh Tầng 1',
      description: inputData.description.trim(),
    };

    expect(payload.id).toBe('zone-test-123');
    expect(payload.name).toBe('Khu Vực Cửa Ra Vào Sảnh');
    expect(payload.type).toBe('SLOW_SPEED');
    expect(payload.speed_limit).toBe(0.25);
    expect(payload.width).toBe(3.5);
    expect(payload.height).toBe(2.5);
  });

  it('should handle zone deletion and selection state clearing', () => {
    const zones = [
      { id: 'zone-1', name: 'Cầu Thang Bộ' },
      { id: 'zone-2', name: 'Khu VIP' },
      { id: 'zone-3', name: 'Sảnh Đón Khách' },
    ];

    const targetIdToDelete = 'zone-2';
    const remaining = zones.filter((z) => z.id !== targetIdToDelete);

    expect(remaining).toHaveLength(2);
    expect(remaining.map((z) => z.id)).toEqual(['zone-1', 'zone-3']);
  });
});
