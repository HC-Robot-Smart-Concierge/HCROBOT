import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reportGuest } from '../services/robotRunApi';
import {
  GUEST_PING_MS, activeParallelRun, adPlaylist, isGuestTalkStep, laneOfWorkflow, laneWorkflow, nextLaneAction, showsAds,
} from '../utils/workflowParallelRun';

const NEW_HOLD = Object.freeze({ started: false, done: false });

/**
 * Plays the screen lane and guest branch of a parallel run through the normal workflow runner.
 * If this screen closes or loses the backend, the vehicle's own timeout lets it continue.
 */
export function useParallelWorkflowRun({
  activeWorkflow, activeStep, isWorkflowRunning, currentStepIndex, stepRun,
  startWorkflow, stopWorkflow, nextStep, canStart, busy, activeAds, lastInteractionRef,
  onEnterPatrol, onBeginTalk, onEndTalk,
}) {
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const holdRef = useRef({ ...NEW_HOLD });
  const checkpointRef = useRef(0);
  const previousRef = useRef({ phase: null, runId: null });

  const current = activeParallelRun(run, now);
  const phase = current?.phase || null;
  const lane = isWorkflowRunning ? laneOfWorkflow(activeWorkflow?.id) : null;
  const talkStep = phase === 'GUEST_HOLD' && isWorkflowRunning && isGuestTalkStep(activeWorkflow, activeStep) ? activeStep : null;
  const isTalking = Boolean(talkStep);

  // Timers and late callbacks always read the newest values without restarting.
  const latest = useRef({});
  latest.current = {
    run, current, phase, lane, isTalking, busy, nextStep, onEnterPatrol, onBeginTalk, onEndTalk,
  };

  const handleRunStatus = useCallback((payload) => {
    if (!payload?.parallel) return;
    const at = Date.now();
    setRun({ ...payload, received_at: at });
    setNow(at);
  }, []);

  useEffect(() => {
    const previous = previousRef.current;
    const runId = current?.run_id || null;
    if (runId !== previous.runId) {
      checkpointRef.current = 0;
      holdRef.current = { ...NEW_HOLD };
      if (runId) latest.current.onEnterPatrol?.();
    }
    if (previous.phase === 'GUEST_HOLD' && phase !== 'GUEST_HOLD') {
      holdRef.current = { ...NEW_HOLD };
      latest.current.onEndTalk?.();
    }
    previousRef.current = { phase, runId };

    const hold = holdRef.current;
    const action = nextLaneAction({
      phase, isRunning: isWorkflowRunning, lane, guestStarted: hold.started, doneReported: hold.done, canStart,
    });
    if (action === 'STOP') {
      stopWorkflow();
    } else if (action === 'START_SCREEN') {
      const index = checkpointRef.current;
      checkpointRef.current = 0;
      startWorkflow(laneWorkflow(current, 'screen'), index);
    } else if (action === 'START_GUEST') {
      if (lane === 'screen') checkpointRef.current = currentStepIndex;
      hold.started = true;
      startWorkflow(laneWorkflow(current, 'guest'));
    } else if (action === 'REPORT_DONE') {
      hold.done = true;
      latest.current.onEndTalk?.();
      reportGuest('DONE', 0, current.robot_id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.run_id, phase, isWorkflowRunning, activeWorkflow?.id, canStart]);

  useEffect(() => {
    if (talkStep) latest.current.onBeginTalk?.(talkStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkStep?.step_id, stepRun]);

  const hasRun = Boolean(run);
  useEffect(() => {
    if (!hasRun) return undefined;
    let lastPing = 0;
    const timer = setInterval(() => {
      const state = latest.current;
      const at = Date.now();
      // Re-render only when the status goes stale, not on every tick of this large page.
      if (state.current && !activeParallelRun(state.run, at)) setNow(at);
      const idleMs = state.isTalking && !state.busy ? Math.max(0, at - (lastInteractionRef?.current || at)) : 0;
      const limitMs = (state.current?.no_interaction_sec ?? 20) * 1000;
      if (state.isTalking && idleMs >= limitMs) {
        state.nextStep();
        return;
      }
      if (state.phase === 'GUEST_HOLD' && state.lane === 'guest' && !holdRef.current.done && at - lastPing >= GUEST_PING_MS) {
        lastPing = at;
        reportGuest('ENGAGED', idleMs, state.current.robot_id).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [hasRun, lastInteractionRef]);

  const requestGuest = useCallback(() => {
    const state = latest.current;
    if (state.phase === 'MOVING') reportGuest('REQUEST', 0, state.current.robot_id).catch(() => {});
  }, []);

  const finishTalk = useCallback(() => {
    if (latest.current.isTalking) latest.current.nextStep();
  }, []);

  const playlistStep = lane === 'screen' ? activeStep : null;
  const ads = useMemo(() => adPlaylist(playlistStep, activeAds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playlistStep?.step_id, activeAds]);

  return {
    active: Boolean(current), phase, lane, isTalking,
    workflowId: current?.workflow_id, workflowName: current?.workflow_name,
    showAds: Boolean(current) && showsAds(phase, playlistStep),
    ads, handleRunStatus, requestGuest, finishTalk,
  };
}
