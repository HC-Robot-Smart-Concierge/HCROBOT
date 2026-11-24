/**
 * Parallel workflow lanes for the editor. Mirrors backend/app/services/workflow_lanes.py:
 * the vehicle lane starts at the first step, the screen lane and guest branch at their entries.
 */
import { OUTCOME, getChoiceOptions, resolveNextStepIndex } from './workflowFlow';

export const LANE_TYPES = {
  robot: new Set(['MOVE', 'FOLLOW_ROUTE', 'WAIT']),
  screen: new Set(['SHOW', 'SPEAK', 'WAIT']),
  guest: new Set(['GREET', 'SPEAK', 'COMMUNICATE', 'LISTEN', 'CHOICE', 'SHOW', 'RECOMMEND', 'CREATE_REQUEST', 'FEEDBACK', 'WAIT']),
};
export const LANE_NAMES = { robot: 'Làn Xe', screen: 'Làn Màn hình', guest: 'Nhánh gặp khách' };

export const parallelOf = (workflow) => {
  const parallel = workflow?.execution_config?.parallel;
  return parallel?.enabled ? parallel : null;
};

function nextIndexes(steps, index) {
  const step = steps[index];
  if (step.type !== 'CHOICE') return [resolveNextStepIndex(steps, index, { type: OUTCOME.DONE })];
  return [
    ...getChoiceOptions(step).map((o) => resolveNextStepIndex(steps, index, { type: OUTCOME.CHOSEN, optionId: o.id })),
    resolveNextStepIndex(steps, index, { type: OUTCOME.TIMEOUT }),
    resolveNextStepIndex(steps, index, { type: OUTCOME.CANCEL }),
  ];
}

function reach(steps, entryId) {
  const start = steps.findIndex((s) => s.step_id === entryId);
  if (start < 0) return [];
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    nextIndexes(steps, queue.shift()).forEach((next) => {
      if (next >= 0 && !seen.has(next)) { seen.add(next); queue.push(next); }
    });
  }
  return [...seen].map((i) => steps[i].step_id);
}

/** Step ids of each lane; a step reached from two lanes is listed in both. */
export function laneMembers(workflow) {
  const parallel = parallelOf(workflow);
  const steps = workflow?.steps || [];
  if (!parallel || !steps.length) return { robot: [], screen: [], guest: [] };
  return {
    robot: reach(steps, steps[0].step_id),
    screen: parallel.screen_step_id ? reach(steps, parallel.screen_step_id) : [],
    guest: parallel.guest_step_id ? reach(steps, parallel.guest_step_id) : [],
  };
}

/** stepId -> the lane that owns it (first lane wins, conflicts are reported by laneIssues). */
export function laneMap(workflow) {
  const owner = {};
  Object.entries(laneMembers(workflow)).forEach(([lane, ids]) => ids.forEach((id) => { owner[id] ??= lane; }));
  return owner;
}

/** stepId -> problems the editor shows on that node. */
export function laneIssues(workflow) {
  const issues = {};
  const add = (id, text) => { (issues[id] ||= []).push(text); };
  const byId = Object.fromEntries((workflow?.steps || []).map((s) => [s.step_id, s]));
  const owner = {};
  Object.entries(laneMembers(workflow)).forEach(([lane, ids]) => ids.forEach((id) => {
    if (owner[id]) add(id, `Bước đang nằm trong cả ${LANE_NAMES[owner[id]]} và ${LANE_NAMES[lane]}.`);
    else owner[id] = lane;
    if (byId[id] && !LANE_TYPES[lane].has(byId[id].type)) add(id, `${LANE_NAMES[lane]} không chạy được bước ${byId[id].type}.`);
  }));
  if (parallelOf(workflow)) {
    (workflow.steps || []).filter((s) => !owner[s.step_id]).forEach((s) => add(s.step_id, 'Bước chưa nối vào làn nào.'));
  }
  return issues;
}

/** Why a parallel workflow cannot be saved (forSave) or run; empty when it can. */
export function parallelError(workflow, { forSave = false } = {}) {
  const parallel = parallelOf(workflow);
  const steps = workflow?.steps || [];
  if (!parallel || !steps.length) return '';
  const issues = laneIssues(workflow);
  const blocking = Object.values(issues).flat().find((text) => !text.startsWith('Bước chưa nối'));
  if (blocking) return blocking;
  if (forSave) return '';
  if (!parallel.screen_step_id) return 'Làn Màn hình chưa có bước nào. Nối node Làn Màn hình tới bước phát quảng cáo.';
  if (!parallel.guest_step_id) return 'Nhánh gặp khách chưa có bước nào. Nối node Khi gặp khách tới bước nói chuyện.';
  const unwired = Object.values(issues).flat().find((text) => text.startsWith('Bước chưa nối'));
  if (unwired) return 'Còn bước chưa nối vào làn nào.';
  const robot = new Set(laneMembers(workflow).robot);
  if (!steps.some((s) => robot.has(s.step_id) && s.type === 'FOLLOW_ROUTE')) return 'Làn Xe cần ít nhất một bước Đi theo tuyến.';
  return '';
}
