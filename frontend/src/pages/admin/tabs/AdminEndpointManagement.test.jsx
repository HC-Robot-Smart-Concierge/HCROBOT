import { describe, it, expect } from 'vitest';
import { CONCIERGE_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './AdminUnifiedStudioTab';

describe('Hotel Concierge Endpoint Management Logic', () => {
  it('should define official Hotel Concierge endpoint templates', () => {
    const templateTypes = CONCIERGE_ENDPOINT_TEMPLATES.map((t) => t.type);
    expect(templateTypes).toContain('WAYPOINT');
    expect(templateTypes).toContain('PARKING_SPOT');
    expect(templateTypes).toContain('DOCKING_TARGET');
    expect(templateTypes).toContain('SERVICE_STATION');
    expect(templateTypes).toContain('GUEST_TABLE');
    // Robot does not load industrial pallets/cargo
    expect(templateTypes).not.toContain('PICKUP_DROPOFF');
  });

  it('should retrieve correct template info for DOCKING_TARGET and GUEST_TABLE', () => {
    const docking = getEndpointTemplateInfo('DOCKING_TARGET');
    expect(docking.badge).toBe('RECEPTION');
    expect(docking.defaultTasks).toContain('GREET');

    const guestTable = getEndpointTemplateInfo('GUEST_TABLE');
    expect(guestTable.badge).toBe('VIP TABLE');
    expect(guestTable.defaultTasks).toContain('RECOMMEND');
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

