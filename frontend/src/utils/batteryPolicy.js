/**
 * Low-battery rules shared by the Studio simulator and the robot screen.
 *
 * The robot has no battery sensing circuit. One estimated percentage stands for
 * both the motor pack and the Pi 5 pack: they have the same capacity and staff
 * charge them together. The robot screen reads the Pi's time-based estimate
 * (robot/scripts/pi_battery_estimator.py); Studio uses its own slider.
 *
 * At BATTERY_LOW_PERCENT the robot takes no new guests, finishes the current one
 * and drives to the charging station. At BATTERY_CRITICAL_PERCENT it stops the
 * session at once. Either way it then waits there for staff to plug it in, and
 * takes guests again only from BATTERY_RESUME_PERCENT.
 */

export const BATTERY_LOW_PERCENT = 20;
export const BATTERY_CRITICAL_PERCENT = 10;
export const BATTERY_RESUME_PERCENT = 80;

export const BATTERY_MODE = { OK: 'OK', LOW: 'LOW', CRITICAL: 'CRITICAL' };
export const CHARGE_ROUTINE_TRIGGER = 'LOW_BATTERY';

export const GUARD_ACTION = {
  NONE: 'NONE',
  START_ROUTINE: 'START_ROUTINE',
  INTERRUPT_AND_START: 'INTERRUPT_AND_START',
  ARRIVED: 'ARRIVED',
};

export const INITIAL_GUARD_STATE = { startRequested: false, routineStarted: false, waitingForCharge: false };

const isKnown = (percent) => percent !== null && percent !== undefined && Number.isFinite(Number(percent));

/** Battery mode with hysteresis; an unknown reading keeps the previous mode. */
export function nextBatteryMode(percent, prevMode = BATTERY_MODE.OK) {
  if (!isKnown(percent)) return prevMode;
  const p = Number(percent);
  if (p <= BATTERY_CRITICAL_PERCENT) return BATTERY_MODE.CRITICAL;
  if (p <= BATTERY_LOW_PERCENT) return prevMode === BATTERY_MODE.CRITICAL ? prevMode : BATTERY_MODE.LOW;
  if (prevMode !== BATTERY_MODE.OK && p < BATTERY_RESUME_PERCENT) return prevMode;
  return BATTERY_MODE.OK;
}

/**
 * What the screen should do now, given the battery mode and whether the charge
 * routine is running or a guest is being served. Returns the action and the
 * guard state to keep for the next call.
 */
export function decideBatteryAction(mode, { isRoutineRunning = false, isServingGuest = false } = {}, state = INITIAL_GUARD_STATE) {
  if (mode === BATTERY_MODE.OK) return { action: GUARD_ACTION.NONE, state: INITIAL_GUARD_STATE };
  if (isRoutineRunning) {
    return { action: GUARD_ACTION.NONE, state: { ...state, startRequested: false, routineStarted: true } };
  }
  if (state.routineStarted) {
    // The routine ended, finished or stopped by an operator: wait there for staff.
    return { action: GUARD_ACTION.ARRIVED, state: { startRequested: false, routineStarted: false, waitingForCharge: true } };
  }
  if (state.waitingForCharge || state.startRequested) return { action: GUARD_ACTION.NONE, state };
  if (isServingGuest && mode === BATTERY_MODE.LOW) return { action: GUARD_ACTION.NONE, state };
  return {
    action: isServingGuest ? GUARD_ACTION.INTERRUPT_AND_START : GUARD_ACTION.START_ROUTINE,
    state: { ...state, startRequested: true },
  };
}

// Used when no saved workflow has trigger_type LOW_BATTERY. A MOVE with
// target_type CHARGER goes to the charging station shown on the map.
export const FALLBACK_CHARGE_ROUTINE = {
  id: 'wf-10-low-battery',
  name: 'Workflow 10: Pin yếu, robot về trạm sạc chờ nhân viên cắm sạc',
  description: 'Robot về trạm sạc trên sảnh và báo nhân viên tới cắm sạc tay.',
  trigger_type: CHARGE_ROUTINE_TRIGGER,
  is_active: true,
  steps: [
    {
      step_id: 'wf10-go-charger',
      type: 'MOVE',
      title: '1. Về trạm sạc',
      params: {
        target_type: 'CHARGER',
        target_value: 'CHARGER_STATION',
        waypoint_name: 'Trạm Sạc Robot Sảnh',
        speed: 0.35,
        broadcast_speech: 'Em sắp hết pin nên xin phép về trạm sạc. Quý khách cần hỗ trợ vui lòng tới quầy lễ tân ạ.',
      },
    },
    {
      step_id: 'wf10-call-staff',
      type: 'CREATE_REQUEST',
      title: '2. Báo nhân viên cắm sạc',
      params: {
        service_type: 'ROBOT_CHARGING',
        room_number: 'Trạm Sạc Robot Sảnh',
        note: 'Robot sắp hết pin và đang chờ ở trạm sạc. Nhờ nhân viên cắm sạc cả pin động cơ và pin Pi 5.',
        urgency: 'HIGH',
        target_department: 'Maintenance',
      },
    },
  ],
};

export function findChargeRoutine(workflows) {
  const list = Array.isArray(workflows) ? workflows : [];
  const hasSteps = (w) => Array.isArray(w?.steps) && w.steps.length > 0;
  return (
    list.find((w) => w?.trigger_type === CHARGE_ROUTINE_TRIGGER && hasSteps(w)) ||
    list.find((w) => w?.id === FALLBACK_CHARGE_ROUTINE.id && hasSteps(w)) ||
    FALLBACK_CHARGE_ROUTINE
  );
}

export const LOW_BATTERY_GUEST_NOTICE = {
  vi: 'Dạ em sắp hết pin nên tạm ngừng phục vụ để về sạc. Quý khách cần hỗ trợ vui lòng tới quầy lễ tân ạ.',
  en: 'My battery is low, so I am pausing service to recharge. Please visit the front desk for help.',
};

/** One-line status for banners, or null while the battery is fine. */
export function describeBatteryStatus({ mode, percent, isRoutineRunning = false, isWaitingForCharge = false, english = false }) {
  if (mode === BATTERY_MODE.OK) return null;
  const p = isKnown(percent) ? `${Math.round(Number(percent))}%` : '?';
  if (isWaitingForCharge) {
    return english
      ? `Battery ${p}. Waiting at the charging station for staff to plug in.`
      : `Pin còn ${p}. Robot đang chờ nhân viên cắm sạc tại trạm sạc.`;
  }
  if (isRoutineRunning) {
    return english ? `Battery ${p}. Heading to the charging station.` : `Pin còn ${p}. Robot đang về trạm sạc.`;
  }
  return english
    ? `Battery ${p}. I will go to charge after the current guest.`
    : `Pin còn ${p}. Robot sẽ về trạm sạc sau khi phục vụ xong khách hiện tại.`;
}
