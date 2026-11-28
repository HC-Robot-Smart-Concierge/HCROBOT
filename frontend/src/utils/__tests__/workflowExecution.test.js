import { describe, expect, it } from 'vitest';
import { executionConfig, executionError, executionSummary, isChargerMove } from '../workflowExecution';
import { isAdGuestGreetingStep, isAdGuestRecommendationStep, isAdGuestTalkStep, isGuestWaitingAd } from '../workflowFlow';

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

  it('waits for a guest only on opted-in ads and uses their linked conversation', () => {
    const ad = { step_id: 'ad', type: 'SHOW', params: { screen_mode: 'ACTIVE_ADS', wait_for_guest: true, next_step_id: 'talk' } };
    const talk = { step_id: 'talk', type: 'COMMUNICATE', params: { next_step_id: 'ad' } };
    const alternate = { ...talk, step_id: 'alternate' };
    const workflow = { steps: [ad, alternate, talk] };
    expect(isGuestWaitingAd(ad)).toBe(true);
    expect(isAdGuestTalkStep(workflow, talk)).toBe(true);
    expect(isAdGuestTalkStep(workflow, alternate)).toBe(false);
    expect(executionError(workflow)).toBe('');

    ad.params.next_step_id = 'END';
    expect(executionError(workflow)).toContain('Giao tiếp');
    ad.params.wait_for_guest = false;
    expect(isGuestWaitingAd(ad)).toBe(false);
    expect(executionError(workflow)).toBe('');
  });

  it('supports a greeting before the ad conversation and rejects a broken greeting link', () => {
    const ad = { step_id: 'ad', type: 'SHOW', params: { screen_mode: 'ACTIVE_ADS', wait_for_guest: true, next_step_id: 'greet' } };
    const greet = { step_id: 'greet', type: 'GREET', params: { next_step_id: 'talk' } };
    const talk = { step_id: 'talk', type: 'COMMUNICATE', params: { next_step_id: 'ad' } };
    const workflow = { steps: [ad, talk, greet] };

    expect(executionError(workflow)).toBe('');
    expect(isAdGuestGreetingStep(workflow, greet)).toBe(true);
    expect(isAdGuestTalkStep(workflow, talk)).toBe(true);

    greet.params.next_step_id = 'ad';
    expect(executionError(workflow)).toContain('Giao tiếp');
    expect(isAdGuestGreetingStep(workflow, greet)).toBe(false);
    expect(isAdGuestTalkStep(workflow, talk)).toBe(false);
  });

  it('saves an ad workflow with recommendations after the greeting and before conversation', () => {
    const ad = { step_id: 'ad', type: 'SHOW', params: { screen_mode: 'ACTIVE_ADS', wait_for_guest: true, next_step_id: 'greet' } };
    const greet = { step_id: 'greet', type: 'GREET', params: { next_step_id: 'recommend' } };
    const talk = { step_id: 'talk', type: 'COMMUNICATE', params: { next_step_id: 'ad' } };
    const recommend = { step_id: 'recommend', type: 'RECOMMEND', params: { next_step_id: 'talk' } };
    const workflow = { steps: [ad, greet, talk, recommend] };

    expect(executionError(workflow, { forSave: true })).toBe('');
    expect(isAdGuestGreetingStep(workflow, greet)).toBe(true);
    expect(isAdGuestRecommendationStep(workflow, recommend)).toBe(true);
    expect(isAdGuestTalkStep(workflow, talk)).toBe(true);

    ad.params.next_step_id = 'recommend';
    expect(executionError(workflow)).toBe('');
    expect(isAdGuestGreetingStep(workflow, greet)).toBe(false);
    recommend.params.next_step_id = 'greet';
    expect(executionError(workflow, { forSave: true })).toContain('Giao tiếp');
    expect(isAdGuestRecommendationStep(workflow, recommend)).toBe(false);
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

it('blocks real-robot runs with a low-battery branch or a charger step (phase 2)', () => {
  const charger = { step_id: 'go', type: 'MOVE', params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } };
  const branch = [{ event: 'LOW_BATTERY', threshold_percent: 20, next_step_id: 'go' }];
  const wf = (config) => ({ execution_config: config, steps: [{ step_id: 'w', type: 'WAIT', params: { duration_sec: 5 } }, charger] });
  expect(executionError(wf({ execution_mode: 'ROBOT', event_branches: branch })))
    .toBe('Nhánh pin yếu chưa chạy được trên xe thật (đợt 2). Gỡ nhánh để chạy.');
  expect(executionError(wf({ execution_mode: 'ROBOT' })))
    .toBe('Bước Về trạm sạc gần nhất chưa chạy được trên xe thật (đợt 2). Gỡ bước để chạy.');
  expect(executionError(wf({ execution_mode: 'SCREEN', event_branches: branch }))).toBe('');
});

it('isChargerMove only matches charger moves without coordinates', () => {
  expect(isChargerMove({ type: 'MOVE', params: { target_type: 'CHARGER' } })).toBe(true);
  expect(isChargerMove({ type: 'MOVE', params: { target_type: 'CHARGER', target_x: 1 } })).toBe(false);
  expect(isChargerMove({ type: 'WAIT', params: { target_type: 'CHARGER' } })).toBe(false);
});

it('saving a real-robot workflow keeps the low-battery branch and charger step (only runs are blocked)', () => {
  const charger = { step_id: 'go', type: 'MOVE', params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } };
  const wf = { execution_config: { execution_mode: 'ROBOT', event_branches: [{ event: 'LOW_BATTERY', threshold_percent: 20, next_step_id: 'go' }] },
    steps: [{ step_id: 'w', type: 'WAIT', params: { duration_sec: 5 } }, charger] };
  expect(executionError(wf, { forSave: true })).toBe('');
  expect(executionError({ ...wf, steps: [{ step_id: 'm', type: 'MOVE', params: { target_x: 1, target_y: 2 } }] }, { forSave: true })).toMatch('gắn map');
});
