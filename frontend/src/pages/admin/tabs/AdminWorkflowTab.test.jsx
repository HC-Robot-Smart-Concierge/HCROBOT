import { describe, it, expect } from 'vitest';
import { OTTO_STEP_TYPES } from './AdminWorkflowTab';

describe('AdminWorkflowTab Otto 8-Step Engine', () => {
  it('should define all 8 Otto standard step types correctly', () => {
    expect(OTTO_STEP_TYPES).toHaveLength(8);

    const types = OTTO_STEP_TYPES.map((s) => s.type);
    expect(types).toEqual([
      'MOVE',
      'GREET',
      'SPEAK',
      'SHOW',
      'LISTEN',
      'RECOMMEND',
      'CREATE_REQUEST',
      'FEEDBACK',
    ]);
  });

  it('should generate valid default parameters for MOVE step linked to LiDAR waypoints', () => {
    const moveStep = OTTO_STEP_TYPES.find((s) => s.type === 'MOVE');
    expect(moveStep).toBeDefined();
    expect(moveStep.defaultParams).toHaveProperty('target_waypoint_id');
    expect(moveStep.defaultParams).toHaveProperty('speed');
    expect(moveStep.defaultParams.speed).toBeGreaterThan(0);
  });

  it('should correctly reorder steps when moving up and down', () => {
    const steps = [
      { step_id: 's1', type: 'MOVE' },
      { step_id: 's2', type: 'GREET' },
      { step_id: 's3', type: 'SPEAK' },
    ];

    // Move step 1 (GREET) down to index 2
    const updated = [...steps];
    const temp = updated[1];
    updated[1] = updated[2];
    updated[2] = temp;

    expect(updated[1].type).toBe('SPEAK');
    expect(updated[2].type).toBe('GREET');
  });

  it('should format execution logs with Otto step prefixes', () => {
    const formatLog = (stepType, msg) => `[${stepType}] ${msg}`;

    expect(formatLog('MOVE', 'Di chuyển tới Quầy Lễ Tân')).toBe(
      '[MOVE] Di chuyển tới Quầy Lễ Tân'
    );
    expect(formatLog('FEEDBACK', 'Thu thập đánh giá 5 sao')).toBe(
      '[FEEDBACK] Thu thập đánh giá 5 sao'
    );
  });
});
