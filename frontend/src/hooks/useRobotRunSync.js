import { useCallback, useEffect, useRef, useState } from 'react';
import { reportGuest } from '../services/robotRunApi';
import {
  GUEST_PING_MS, NOT_ENGAGED, PATROL_AD_DISMISS_MS, engagementOnApproach, engagementOnLeft, engagementTick,
  freshRun, patrolAdsVisible, withReceivedAt,
} from '../utils/robotRunSync';

/**
 * Keeps the robot screen in step with a real-robot run: status for the status bar,
 * ads while patrolling, and guest engagement reports that make the vehicle stop.
 */
export function useRobotRunSync({ guestPresent, busy = false, lastInteractionRef }) {
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [engagement, setEngagement] = useState(NOT_ENGAGED);
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const runRef = useRef(null);
  const engagementRef = useRef(NOT_ENGAGED);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const handleRunStatus = useCallback((payload) => {
    const at = Date.now();
    const next = withReceivedAt(payload, at);
    runRef.current = next;
    setRun(next);
    setNow(at);
  }, []);

  const apply = useCallback(({ state, report }) => {
    if (state !== engagementRef.current) {
      engagementRef.current = state;
      setEngagement(state);
    }
    const current = runRef.current;
    if (report && current) reportGuest(report.state, report.idleMs || 0, current.robot_id).catch(() => {});
  }, []);

  const onGuestApproached = useCallback(() => {
    apply(engagementOnApproach(engagementRef.current, runRef.current, Date.now()));
  }, [apply]);

  const onGuestLeft = useCallback(() => apply(engagementOnLeft(engagementRef.current)), [apply]);

  const dismissPatrolAds = useCallback(() => setDismissedUntil(Date.now() + PATROL_AD_DISMISS_MS), []);

  useEffect(() => {
    const timer = setInterval(() => {
      // No run: nothing to refresh, so the (large) robot screen is not re-rendered.
      if (!runRef.current) return;
      const at = Date.now();
      setNow(at);
      apply(engagementTick(engagementRef.current, {
        run: runRef.current, busy: busyRef.current, lastInteractionAt: lastInteractionRef?.current, now: at,
      }));
    }, GUEST_PING_MS);
    return () => clearInterval(timer);
  }, [apply, lastInteractionRef]);

  return {
    run: freshRun(run, now),
    handleRunStatus,
    onGuestApproached,
    onGuestLeft,
    dismissPatrolAds,
    patrolAds: patrolAdsVisible({ run, guestPresent, engaged: engagement.engaged, dismissedUntil, now }),
  };
}
