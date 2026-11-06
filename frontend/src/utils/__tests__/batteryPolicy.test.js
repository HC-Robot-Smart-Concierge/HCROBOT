import { describe, it, expect } from 'vitest';
import {
  BATTERY_MODE as M,
  GUARD_ACTION as A,
  INITIAL_GUARD_STATE,
  FALLBACK_CHARGE_ROUTINE,
  decideBatteryAction,
  describeBatteryStatus,
  findChargeRoutine,
  nextBatteryMode,
} from '../batteryPolicy';

describe('nextBatteryMode', () => {
  it('switches at 20% and 10%', () => {
    expect(nextBatteryMode(21, M.OK)).toBe(M.OK);
    expect(nextBatteryMode(20, M.OK)).toBe(M.LOW);
    expect(nextBatteryMode(10, M.LOW)).toBe(M.CRITICAL);
    expect(nextBatteryMode(5, M.OK)).toBe(M.CRITICAL);
  });

  it('stays low until staff charge it past 80%', () => {
    expect(nextBatteryMode(50, M.LOW)).toBe(M.LOW);
    expect(nextBatteryMode(79, M.CRITICAL)).toBe(M.CRITICAL);
    expect(nextBatteryMode(15, M.CRITICAL)).toBe(M.CRITICAL);
    expect(nextBatteryMode(80, M.LOW)).toBe(M.OK);
    expect(nextBatteryMode(100, M.CRITICAL)).toBe(M.OK);
  });

  it('keeps the previous mode when the reading is unknown', () => {
    expect(nextBatteryMode(null, M.LOW)).toBe(M.LOW);
    expect(nextBatteryMode(undefined, M.OK)).toBe(M.OK);
    expect(nextBatteryMode('abc', M.CRITICAL)).toBe(M.CRITICAL);
  });
});

// Feed a sequence of observations through the guard like a screen would.
const run = (mode, observations) => {
  let state = INITIAL_GUARD_STATE;
  return observations.map((obs) => {
    const result = decideBatteryAction(mode, obs, state);
    state = result.state;
    return result.action;
  });
};

describe('decideBatteryAction', () => {
  it('does nothing while the battery is fine', () => {
    expect(run(M.OK, [{ isServingGuest: true }, {}])).toEqual([A.NONE, A.NONE]);
  });

  it('at 20% finishes the current guest, then goes to charge once and waits', () => {
    expect(
      run(M.LOW, [
        { isServingGuest: true },
        { isServingGuest: false },
        { isServingGuest: false },
        { isRoutineRunning: true },
        { isRoutineRunning: false },
        { isServingGuest: false },
      ])
    ).toEqual([A.NONE, A.START_ROUTINE, A.NONE, A.NONE, A.ARRIVED, A.NONE]);
  });

  it('at 10% interrupts the guest straight away', () => {
    expect(run(M.CRITICAL, [{ isServingGuest: true }, { isRoutineRunning: true }, {}])).toEqual([
      A.INTERRUPT_AND_START,
      A.NONE,
      A.ARRIVED,
    ]);
  });

  it('lets the running routine finish when the battery drops further', () => {
    let { state } = decideBatteryAction(M.LOW, { isRoutineRunning: true }, INITIAL_GUARD_STATE);
    const result = decideBatteryAction(M.CRITICAL, { isRoutineRunning: true }, state);
    expect(result.action).toBe(A.NONE);
    state = result.state;
    expect(decideBatteryAction(M.CRITICAL, {}, state).action).toBe(A.ARRIVED);
  });

  it('resets once the robot is charged', () => {
    const waiting = { startRequested: false, routineStarted: false, waitingForCharge: true };
    expect(decideBatteryAction(M.OK, {}, waiting).state).toEqual(INITIAL_GUARD_STATE);
  });
});

describe('charge routine and status text', () => {
  it('prefers a saved LOW_BATTERY workflow and falls back to the built-in one', () => {
    const saved = { id: 'wf-x', trigger_type: 'LOW_BATTERY', steps: [{ step_id: 'a', type: 'MOVE' }] };
    expect(findChargeRoutine([{ id: 'wf-01', steps: [] }, saved])).toBe(saved);
    expect(findChargeRoutine([])).toBe(FALLBACK_CHARGE_ROUTINE);
    expect(FALLBACK_CHARGE_ROUTINE.steps[0].params.target_type).toBe('CHARGER');
  });

  it('describes each phase', () => {
    expect(describeBatteryStatus({ mode: M.OK, percent: 90 })).toBeNull();
    expect(describeBatteryStatus({ mode: M.LOW, percent: 19.6 })).toContain('20%');
    expect(describeBatteryStatus({ mode: M.LOW, percent: 18, isRoutineRunning: true })).toContain('đang về trạm sạc');
    expect(describeBatteryStatus({ mode: M.CRITICAL, percent: 9, isWaitingForCharge: true, english: true })).toContain('Waiting');
    expect(describeBatteryStatus({ mode: M.LOW, percent: null })).toContain('?');
  });
});
