/**
 * Robot-screen decisions for a parallel run. The vehicle lane runs in the ROS worker; the
 * backend streams its phase (ROBOT_RUN_STATUS) and this screen plays the other two lanes.
 */
import { foldText } from './workflowFlow';

export const RUN_STALE_MS = 25000;
export const GUEST_PING_MS = 3000;
const AD_MODES = new Set(['ACTIVE_ADS', 'PROMO_VIDEO', 'PROMO_IMAGE']);
const GOODBYES = ['tam biet', 'bye', 'xong roi', 'het roi', 'khong can nua', 'khong can gi nua'];
const THANKS = ['cam on', 'thank you', 'thanks'];
const SHORT_THANKS_WORDS = 5;

export const laneWorkflowId = (runId, lane) => `parallel-${lane}:${runId}`;

export function laneOfWorkflow(workflowId) {
  const match = /^parallel-(screen|guest):/.exec(workflowId || '');
  return match ? match[1] : null;
}

/** COMMUNICATE in the guest branch is handed to the robot's real AI conversation. */
export const isGuestTalkStep = (workflow, step) =>
  laneOfWorkflow(workflow?.id) === 'guest' && step?.type === 'COMMUNICATE';

/** The run this screen should follow, or null when it ended or its status went stale. */
export function activeParallelRun(run, now) {
  if (!run?.parallel || now - run.received_at > RUN_STALE_MS) return null;
  return run.status === 'RUNNING' && ['MOVING', 'GUEST_HOLD'].includes(run.phase) ? run : null;
}

export function laneWorkflow(run, lane) {
  return {
    id: laneWorkflowId(run.run_id, lane),
    name: run.workflow_name,
    steps: (lane === 'screen' ? run.screen_steps : run.guest_steps) || [],
  };
}

export function isAdStep(step) {
  if (step?.type !== 'SHOW') return false;
  const p = step.params || {};
  return AD_MODES.has(p.screen_mode) || Boolean(p.media_url) || ['VIDEO', 'IMAGE'].includes(p.media_type);
}

/** Ads stay up through speech and waits; another SHOW screen (e.g. a menu) replaces them. */
export const showsAds = (phase, step) => phase === 'MOVING' && (step?.type !== 'SHOW' || isAdStep(step));

export function adPlaylist(step, activeAds) {
  const p = step?.type === 'SHOW' ? step.params || {} : {};
  if (!p.media_url) return activeAds;
  const video = p.media_type === 'VIDEO' || p.screen_mode === 'PROMO_VIDEO' || /\.(mp4|webm|ogg)$/i.test(p.media_url);
  return [{
    id: step.step_id, title: step.title, media_url: p.media_url, media_type: video ? 'VIDEO' : 'IMAGE',
    duration_seconds: Number(p.slide_duration_sec) || 10,
  }];
}

/** What the screen must do next. It never interrupts a workflow that is not one of its lanes. */
export function nextLaneAction({ phase, isRunning, lane, guestStarted, doneReported, canStart }) {
  if (!phase) return lane ? 'STOP' : 'NONE';
  if (phase === 'MOVING') {
    // Low battery blocks new lanes, but the talk must still close when the vehicle moves on.
    if (lane === 'guest' && !canStart) return 'STOP';
    if (lane === 'screen' || (isRunning && lane !== 'guest') || !canStart) return 'NONE';
    return 'START_SCREEN';
  }
  if (lane === 'guest' || (isRunning && lane !== 'screen')) return 'NONE';
  if (guestStarted) return !isRunning && !doneReported ? 'REPORT_DONE' : 'NONE';
  return canStart ? 'START_GUEST' : 'NONE';
}

export function isGuestFarewell(text) {
  const heard = foldText(text);
  if (!heard) return false;
  if (GOODBYES.some((phrase) => heard.includes(phrase))) return true;
  // "Cảm ơn em" ends the talk; "cảm ơn, cho hỏi hồ bơi ở đâu" is still a question.
  return THANKS.some((phrase) => heard.includes(phrase)) && heard.split(' ').length <= SHORT_THANKS_WORDS;
}
