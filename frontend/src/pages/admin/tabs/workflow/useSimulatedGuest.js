import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advanceSimulatedGuest, createSimulatedGuest, departSimulatedGuest,
  guestActivity, hasSimulatedGuest, updateGuestActivity,
} from './simulatorGuestModel';

export function useSimulatedGuest(options) {
  const latest = useRef(options);
  latest.current = options;
  const actor = useRef(null);
  const [guest, setGuest] = useState(null);
  const publish = useCallback(() => {
    const current = actor.current;
    setGuest(current ? { ...current, pose: { ...current.pose }, route: [...current.route] } : null);
  }, []);

  const reset = useCallback(() => {
    actor.current = null;
    latest.current.onPresenceChange(false);
    setGuest(null);
  }, []);

  const arrive = useCallback(() => {
    const current = latest.current;
    if (!current.isPlaying || current.isPaused || current.isCharging ||
        guestActivity(current.workflow, current.step, current.endpoints) === 'leaving') return;
    actor.current = createSimulatedGuest(current);
    current.onPresenceChange(true);
    publish();
  }, [publish]);

  const leave = useCallback(() => {
    const current = latest.current;
    departSimulatedGuest(actor.current, current.robot, current.workflow?.id);
    current.onPresenceChange(false);
    publish();
  }, [publish]);

  const reply = useCallback(() => {
    const current = actor.current;
    if (!current || ['leaving', 'approaching', 'catching-up', 'following'].includes(current.mode)) return;
    current.reply = current.activity;
    current.replySeconds = 4;
    publish();
  }, [publish]);

  const { workflow, runId, isPlaying, isPaused, step, stepRun, isCharging } = options;
  const previous = useRef({});
  useEffect(() => {
    const key = `${workflow?.id}:${runId}`;
    const before = previous.current;
    previous.current = { key, isPlaying };
    if (before.key !== key || (isPlaying && !before.isPlaying)) {
      reset();
      if (isPlaying && hasSimulatedGuest(workflow, latest.current.chargeRoutineId)) arrive();
    } else if (!isPlaying && before.isPlaying) {
      leave();
    }
  }, [workflow?.id, runId, isPlaying, arrive, leave, reset]);

  useEffect(() => {
    if (!isPlaying || !actor.current) return;
    updateGuestActivity(actor.current, latest.current);
    if (actor.current.mode === 'leaving') latest.current.onPresenceChange(false);
    publish();
  }, [step?.step_id, stepRun, isPlaying, publish]);

  const visible = Boolean(guest);
  useEffect(() => {
    if (!visible || isPaused) return;
    let frame;
    let previousTime = performance.now();
    let lastRender = previousTime;
    const tick = (now) => {
      const current = latest.current;
      const elapsed = Math.min((now - previousTime) / 1000, 0.1) * (current.simSpeed || 1);
      previousTime = now;
      if (!actor.current) return;
      if (!advanceSimulatedGuest(actor.current, current.robot, elapsed)) {
        reset();
        return;
      }
      if (now - lastRender >= 50) {
        publish();
        lastRender = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, isPaused, publish, reset]);

  return { guest, arrive, leave, reply, reset, disabled: !isPlaying || isPaused || isCharging,
    canArrive: guestActivity(workflow, step, options.endpoints) !== 'leaving' };
}
