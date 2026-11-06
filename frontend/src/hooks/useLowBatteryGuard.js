import { useEffect, useRef, useState } from 'react';
import {
  BATTERY_MODE,
  GUARD_ACTION,
  INITIAL_GUARD_STATE,
  decideBatteryAction,
  nextBatteryMode,
} from '../utils/batteryPolicy';

/**
 * Applies the low-battery rules in utils/batteryPolicy on one screen. The Studio
 * simulator and the robot screen both use it; each passes how to start the
 * charge routine, how to cut a guest session short and how to call staff.
 */
export function useLowBatteryGuard({
  percent,
  routine,
  isRoutineRunning,
  isServingGuest,
  startRoutine,
  interruptGuest,
  onChargeNeeded,
}) {
  const [mode, setMode] = useState(BATTERY_MODE.OK);
  const [isWaitingForCharge, setIsWaitingForCharge] = useState(false);
  const guardStateRef = useRef(INITIAL_GUARD_STATE);
  const latestRef = useRef({});
  latestRef.current = { percent, routine, startRoutine, interruptGuest, onChargeNeeded };

  useEffect(() => {
    setMode((prev) => nextBatteryMode(percent, prev));
  }, [percent]);

  useEffect(() => {
    const { action, state } = decideBatteryAction(
      mode,
      { isRoutineRunning, isServingGuest },
      guardStateRef.current
    );
    guardStateRef.current = state;
    setIsWaitingForCharge(state.waitingForCharge);

    const latest = latestRef.current;
    if (action === GUARD_ACTION.INTERRUPT_AND_START) latest.interruptGuest?.();
    if (action === GUARD_ACTION.INTERRUPT_AND_START || action === GUARD_ACTION.START_ROUTINE) {
      latest.startRoutine?.(latest.routine);
    }
    if (action === GUARD_ACTION.ARRIVED) latest.onChargeNeeded?.(latest.percent);
  }, [mode, isRoutineRunning, isServingGuest]);

  return {
    mode,
    isWaitingForCharge,
    canStartGuestSession: mode === BATTERY_MODE.OK,
  };
}
