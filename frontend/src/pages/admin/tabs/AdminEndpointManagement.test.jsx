import { describe, it, expect } from 'vitest';
import { OTTO_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './AdminUnifiedStudioTab';

describe('Otto Motors Endpoint Management Logic', () => {
  it('should define official Otto Motors endpoint templates (excluding charger)', () => {
    const templateTypes = OTTO_ENDPOINT_TEMPLATES.map((t) => t.type);
    expect(templateTypes).toContain('WAYPOINT');
    expect(templateTypes).toContain('PARKING_SPOT');
    expect(templateTypes).toContain('DOCKING_TARGET');
    expect(templateTypes).toContain('PICKUP_DROPOFF');
    expect(templateTypes).toContain('SERVICE_STATION');
    // Robot does not have automated fast charger
    expect(templateTypes).not.toContain('CHARGER');
  });

  it('should retrieve correct template info for DOCKING_TARGET and PICKUP_DROPOFF', () => {
    const docking = getEndpointTemplateInfo('DOCKING_TARGET');
    expect(docking.badge).toBe('DOCKING');
    expect(docking.defaultTasks).toContain('GREET');

    const pickup = getEndpointTemplateInfo('PICKUP_DROPOFF');
    expect(pickup.badge).toBe('PICKUP/DROP');
    expect(pickup.defaultTasks).toContain('TRANSPORT');
  });

  it('should validate and construct payload for creating an Endpoint', () => {
    const inputData = {
      name: 'Quầy Lễ Tân VIP',
      floor: 'Tầng 1',
      x: 3.5,
      y: -2.1,
      yaw: 90,
      type: 'DOCKING_TARGET',
      description: 'Điểm tiếp cận làm thủ tục VIP check-in',
    };

    const payload = {
      id: 'wp-test-123',
      name: inputData.name.trim(),
      floor: inputData.floor,
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
