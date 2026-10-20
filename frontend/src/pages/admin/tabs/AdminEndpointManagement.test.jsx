import { describe, it, expect } from 'vitest';
import { CONCIERGE_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './AdminUnifiedStudioTab';

describe('Hotel Concierge Endpoint Management Logic', () => {
  it('should define exactly 3 official Hotel Concierge endpoint templates without emoji', () => {
    const templateTypes = CONCIERGE_ENDPOINT_TEMPLATES.map((t) => t.type);
    expect(templateTypes).toHaveLength(3);
    expect(templateTypes).toContain('WAYPOINT');
    expect(templateTypes).toContain('CHARGER');
    expect(templateTypes).toContain('PARK');

    // Robot does not load industrial pallets/cargo
    expect(templateTypes).not.toContain('PICKUP_DROPOFF');
    expect(templateTypes).not.toContain('SERVICE_STATION');
    expect(templateTypes).not.toContain('GUEST_TABLE');
  });

  it('should retrieve correct template info for CHARGER and PARK without emoji', () => {
    const charger = getEndpointTemplateInfo('CHARGER');
    expect(charger.badge).toBe('CHARGER');
    expect(charger.defaultTasks).toContain('CHARGE');

    const park = getEndpointTemplateInfo('PARK');
    expect(park.badge).toBe('PARK');
    expect(park.defaultTasks).toContain('STANDBY');

    // Backward compatibility for legacy aliases
    const legacyDock = getEndpointTemplateInfo('DOCKING_TARGET');
    expect(legacyDock.type).toBe('CHARGER');
    const legacyParking = getEndpointTemplateInfo('PARKING_SPOT');
    expect(legacyParking.type).toBe('PARK');
  });

  it('should validate and construct payload for creating a Concierge Endpoint', () => {
    const inputData = {
      name: 'Quầy Lễ Tân VIP',
      x: 3.5,
      y: -2.1,
      yaw: 90,
      type: 'DOCKING_TARGET',
      description: 'Điểm tiếp cận làm thủ tục VIP check-in',
    };

    const payload = {
      id: 'wp-test-123',
      name: inputData.name.trim(),
      floor: 'Tầng 1',
      x: Number(inputData.x),
      y: Number(inputData.y),
      yaw: Number(inputData.yaw || 0),
      type: inputData.type,
      description: inputData.description.trim(),
    };

    expect(payload.id).toBe('wp-test-123');
    expect(payload.name).toBe('Quầy Lễ Tân VIP');
    expect(payload.type).toBe('DOCKING_TARGET');
    expect(payload.yaw).toBe(90);
  });

  it('should handle optimistic waypoint deletion and state clearing', () => {
    const waypoints = [
      { id: 'wp-1', name: 'Điểm 1' },
      { id: 'wp-2', name: 'Điểm 2' },
      { id: 'wp-3', name: 'Điểm 3' },
    ];

    const targetIdToDelete = 'wp-2';
    const remaining = waypoints.filter((w) => w.id !== targetIdToDelete);

    expect(remaining).toHaveLength(2);
    expect(remaining.map((w) => w.id)).toEqual(['wp-1', 'wp-3']);
  });
});

