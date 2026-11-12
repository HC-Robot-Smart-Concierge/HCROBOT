import { describe, expect, it } from 'vitest';
import { selectedStepIndex, stepSetup } from '../workflowStepSetup';

describe('Workflow step setup and stable selection', () => {
  it('keeps the same step selected after reorder and falls back when deleted', () => {
    const a = { step_id: 'a' }, b = { step_id: 'b' };
    expect(selectedStepIndex([a, b], 'a')).toBe(0);
    expect(selectedStepIndex([b, a], 'a')).toBe(1);
    expect(selectedStepIndex([b], 'a')).toBe(0);
    expect(selectedStepIndex([], 'a')).toBe(-1);
  });
  it('marks missing or disabled routes and invalid repeats as incomplete', () => {
    const route = { id: 'r', name: 'Lobby', is_active: true, execution_config: { route: { points: [] } } };
    const step = { type: 'FOLLOW_ROUTE', params: { route_id: 'r', repeat_count: 2 } };
    expect(stepSetup(step, [route])).toMatchObject({ ready: true, summary: 'Lobby · 2 vòng' });
    expect(stepSetup(step, []).ready).toBe(false);
    expect(stepSetup(step, [{ ...route, is_active: false }]).ready).toBe(false);
    expect(stepSetup({ ...step, params: { ...step.params, repeat_count: 0 } }, [route]).ready).toBe(false);
  });
  it('accepts origin coordinates but rejects empty targets and invalid speeds', () => {
    expect(stepSetup({ type: 'MOVE', params: { target_x: 0, target_y: 0 } }).ready).toBe(true);
    expect(stepSetup({ type: 'MOVE', params: { target_x: '', target_y: '' } }).ready).toBe(false);
    expect(stepSetup({ type: 'MOVE', params: { target_value: 'FRONT_DESK', speed: -1 } }).ready).toBe(false);
  });
  it('updates text and choice configuration status as values are filled', () => {
    expect(stepSetup({ type: 'SPEAK', params: { speech_text: '   ' } }).ready).toBe(false);
    expect(stepSetup({ type: 'SPEAK', params: { speech_text: 'Hello' } })).toMatchObject({ ready: true, summary: 'Hello' });
    expect(stepSetup({ type: 'CHOICE', params: { options: [{ label: 'Yes' }, { label: '' }] } }).ready).toBe(false);
    expect(stepSetup({ type: 'CHOICE', params: { options: [{ label: 'Yes' }, { label: 'No' }] } }).ready).toBe(true);
  });
});
