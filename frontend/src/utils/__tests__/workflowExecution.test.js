import { describe, expect, it } from 'vitest';
import { executionConfig, executionError, executionSummary } from '../workflowExecution';

describe('Workflow execution settings', () => {
  it('keeps legacy workflows manual with one round and independent schedules', () => {
    const first = executionConfig();
    first.schedules.push({ time: '08:00' });
    expect(executionConfig().schedules).toEqual([]);
    expect(executionSummary({ trigger_type: 'MANUAL' })).toBe('Màn hình · 1 vòng / lượt');
    expect(executionError({ trigger_type: 'MANUAL' })).toBe('');
  });

  it('requires physical map moves and keeps kiosk interactions separate', () => {
    const workflow = { execution_config: { execution_mode: 'ROBOT' }, steps: [
      { type: 'MOVE', params: { target_x: 1, target_y: 2 } },
    ] };
    expect(executionError(workflow)).toContain('gắn map');
    workflow.steps[0].params.map_id = 'room';
    expect(executionError(workflow)).toBe('');
    workflow.steps.push({ type: 'GREET', params: {} });
    expect(executionError(workflow)).toContain('giao tiếp');
  });

  it('requires an enabled schedule for scheduled workflows', () => {
    expect(executionError({ trigger_type: 'SCHEDULE' })).toContain('ít nhất');
    expect(executionError({ trigger_type: 'SCHEDULE', execution_config: { schedules: [
      { time: '08:00', days: [0], timezone: 'UTC', enabled: false },
    ] } })).toContain('ít nhất');
  });

  it('allows saving a draft before configuring schedules without enabling execution', () => {
    const flow = { trigger_type: 'SCHEDULE', is_active: false, execution_config: { execution_mode: 'ROBOT' },
      steps: [{ type: 'FOLLOW_ROUTE', params: { route_id: '', repeat_count: 1 } }] };
    expect(executionError(flow, { allowDraft: true })).toBe('');
    expect(executionError(flow)).toContain('lịch');
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

describe('charger MOVE on the real robot', () => {
  it('accepts a charger MOVE without map_id because the backend resolves the CHARGER endpoint', async () => {
    const { executionError: check } = await import('../workflowExecution');
    const wf = { trigger_type: 'MANUAL', execution_config: { execution_mode: 'ROBOT' }, steps: [
      { step_id: 'r', type: 'FOLLOW_ROUTE', params: { route_id: 'x', repeat_count: 1 } },
      { step_id: 'go', type: 'MOVE', params: { target_type: 'CHARGER', target_value: 'CHARGER_STATION' } },
    ] };
    expect(check(wf)).toBe('');
    expect(check({ ...wf, steps: [{ step_id: 'm', type: 'MOVE', params: { target_x: 1, target_y: 2 } }] })).toMatch('gắn map');
  });
});
