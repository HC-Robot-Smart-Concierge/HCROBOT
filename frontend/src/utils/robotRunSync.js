/**
 * Robot screen <-> real-robot run (ROBOT_RUN_STATUS from the backend, guest reports back).
 * The screen never drives the vehicle: it only tells the backend a guest is engaged.
 */
export const RUN_STALE_MS = 25000;
export const GUEST_PING_MS = 3000;

export const withReceivedAt = (payload, now) => ({ ...payload, received_at: now });

/** A status not refreshed for 25 s is dropped (the backend re-sends every 10 s while running). */
export function freshRun(run, now) {
  return run && now - run.received_at <= RUN_STALE_MS ? run : null;
}

export function guestModeActive(run, now) {
  const current = freshRun(run, now);
  return Boolean(current && current.status === 'RUNNING' && current.guest_mode
    && !['CHARGING', 'DONE'].includes(current.phase));
}

/**
 * Keep holding the robot only for a guest the screen engaged with, while the conversation
 * is busy (robot speaking/thinking, guest speaking) or there was an interaction within the
 * idle timeout. Just standing in front of the camera does not hold the robot.
 */
export function shouldPing({ run, engaged, busy, lastInteractionAt, now }) {
  if (!engaged || !guestModeActive(run, now)) return false;
  const idleMs = (run.guest_idle_timeout_sec ?? 20) * 1000;
  return Boolean(busy) || now - lastInteractionAt < idleMs;
}

export function phaseLabel(run) {
  if (!run) return null;
  switch (run.phase) {
    case 'MOVING': return `Đang tuần tra · bước ${(run.step_index ?? 0) + 1}/${run.total_steps ?? 0}`;
    case 'RETRYING': return 'Đang thử lại…';
    case 'GUEST_HOLD': return 'Dừng chờ khách';
    case 'CHARGING': return 'Đang về trạm sạc';
    default: return null;
  }
}

export function patrolAdsActive(run, guestPresent, now) {
  const current = freshRun(run, now);
  return Boolean(current && current.status === 'RUNNING' && ['MOVING', 'RETRYING'].includes(current.phase)
    && !guestPresent);
}

export const NOT_ENGAGED = Object.freeze({ engaged: false, since: 0 });
export const PATROL_AD_DISMISS_MS = 60000;

/**
 * Guest engagement as a tiny state machine; each call returns the next state and the
 * report to send (or null). The camera re-signals "approached" every few seconds while a
 * person stays close: only the first approach counts, so presence alone never extends a hold.
 */
export function engagementOnApproach(state, run, now) {
  if (state.engaged || !guestModeActive(run, now)) return { state, report: null };
  return { state: { engaged: true, since: now }, report: { state: 'ENGAGED', idleMs: 0 } };
}

export function engagementOnLeft(state) {
  if (!state.engaged) return { state, report: null };
  return { state: NOT_ENGAGED, report: { state: 'DONE' } };
}

/** Periodic renewal. Idle past the timeout: stop renewing and let the backend hold lapse. */
export function engagementTick(state, { run, busy, lastInteractionAt, now }) {
  if (!state.engaged) return { state, report: null };
  const last = busy ? now : Math.max(lastInteractionAt || 0, state.since);
  if (shouldPing({ run, engaged: true, busy, lastInteractionAt: last, now })) {
    return { state, report: { state: 'ENGAGED', idleMs: now - last } };
  }
  return { state: NOT_ENGAGED, report: null };
}

/** Patrol ads hide for an engaged guest, and for a minute after someone touched them. */
export function patrolAdsVisible({ run, guestPresent, engaged, dismissedUntil, now }) {
  return patrolAdsActive(run, guestPresent, now) && !engaged && now >= (dismissedUntil || 0);
}
