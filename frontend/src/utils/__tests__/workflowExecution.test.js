import { describe, expect, it } from 'vitest';
import { executionConfig, executionError, executionSummary } from '../workflowExecution';

describe('Workflow execution settings', () => {
  it('keeps legacy workflows manual with one round and independent schedules', () => {
    const first = executionConfig();
    first.schedules.push({ time: '08:00' });
    expect(executionConfig().schedules).toEqual([]);
    expect(executionSummary({ trigger_type: 'MANUAL' })).toBe('1 vòng / lượt');
    expect(executionError({ trigger_type: 'MANUAL' })).toBe('');
  });

  it('requires an enabled schedule for scheduled workflows', () => {
    expect(executionError({ trigger_type: 'SCHEDULE' })).toContain('ít nhất');
    expect(executionError({ trigger_type: 'SCHEDULE', execution_config: { schedules: [
      { time: '08:00', days: [0], timezone: 'UTC', enabled: false },
    ] } })).toContain('ít nhất');
  });

  it('rejects overlapping days at the same time but allows separate weekdays', () => {
    const item = { time: '08:00', days: [0, 1], timezone: 'Asia/Ho_Chi_Minh', enabled: true };
    const workflow = { trigger_type: 'SCHEDULE', execution_config: { schedules: [item, { ...item, days: [1, 2] }] } };
    expect(executionError(workflow)).toContain('trùng');
    workflow.execution_config.schedules[1].days = [2];
    expect(executionError(workflow)).toBe('');
  });

  it('rejects cleared and fractional numeric inputs instead of silently changing them', () => {
    for (const repeat_count of ['', 0, 1.5, 1001]) {
      expect(executionError({ execution_config: { repeat_count } })).toContain('Số vòng');
    }
    expect(executionError({ execution_config: { interval_seconds: -1 } })).toContain('Thời gian nghỉ');
  });
});
