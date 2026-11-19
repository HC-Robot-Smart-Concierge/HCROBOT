/**
 * Workflow steps <-> canvas graph (nodes/edges) for the n8n-style editor.
 *
 * A workflow stays a flat list of steps linked by next_step_id (see workflowFlow.js).
 * The canvas makes every link explicit, so steps that belong only to an error or
 * low-battery branch never "fall through" from the step listed before them.
 *
 * Source handles: 'ok' (next step), 'err' (on_error ERROR_BRANCH), 'opt:<optionId>',
 * 'timeout', 'cancel' (CHOICE). Fixed nodes: START, END, BATTERY (low-battery event) and
 * GUEST (stop for the kiosk conversation, then resume; it has no outputs).
 */
import { FLOW_END, OUTCOME, getChoiceOptions, resolveNextStepIndex } from './workflowFlow';

export const START = '__start';
export const END_NODE = '__end';
export const BATTERY = '__battery';
export const GUEST = '__guest';
export const GUEST_DEFAULTS = { idle_timeout_sec: 20, max_duration_sec: 180, cooldown_sec: 60 };
const GUEST_LIMITS = { idle_timeout_sec: [5, 120], max_duration_sec: [30, 600], cooldown_sec: [0, 600] };
export const DEFAULT_BATTERY_THRESHOLD = 20;
const COLUMN = 260;
const ROW = 140;

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const toLink = (target) => (target === END_NODE ? FLOW_END : target);
const toNode = (link) => (!link || link === FLOW_END ? END_NODE : link);

function normalized(workflow) {
  const wf = clone(workflow) || {};
  wf.steps = Array.isArray(wf.steps) ? wf.steps : [];
  wf.steps.forEach((s) => { s.params = s.params || {}; });
  wf.execution_config = wf.execution_config || {};
  return wf;
}

/** Same option ids as getChoiceOptions, keyed by the raw option object. */
function choiceOptions(step) {
  const raw = Array.isArray(step.params.options) ? step.params.options : [];
  const ids = getChoiceOptions(step);
  const kept = raw.filter((o) => o && (o.id || o.label));
  return kept.map((option, i) => ({ option, id: ids[i].id }));
}

const targetOf = (steps, index, outcome) => {
  const next = resolveNextStepIndex(steps, index, outcome);
  return next < 0 ? FLOW_END : steps[next].step_id;
};

/** Rewrite every implicit or broken link to the step it resolves to today. */
export function explicitLinks(workflow) {
  const wf = normalized(workflow);
  const source = clone(wf.steps);
  wf.steps.forEach((step, i) => {
    if (step.type !== 'CHOICE') {
      step.params.next_step_id = targetOf(source, i, { type: OUTCOME.DONE });
      return;
    }
    choiceOptions(step).forEach(({ option, id }) => {
      option.id = id;
      option.next_step_id = targetOf(source, i, { type: OUTCOME.CHOSEN, optionId: id });
    });
    step.params.timeout_next_step_id = targetOf(source, i, { type: OUTCOME.TIMEOUT });
    step.params.cancel_next_step_id = targetOf(source, i, { type: OUTCOME.CANCEL });
  });
  return wf;
}

/** The branch for one event (LOW_BATTERY or GUEST_DETECTED), or null. */
export const eventBranch = (workflow, event) =>
  (workflow?.execution_config?.event_branches || []).find((b) => b.event === event) || null;
const branchOf = (wf, event = 'LOW_BATTERY') =>
  (wf.execution_config.event_branches || []).find((b) => b.event === event) || null;

function stepOutputs(step) {
  if (step.type === 'CHOICE') {
    return [
      ...choiceOptions(step).map(({ option, id }) => ({ handle: `opt:${id}`, link: option.next_step_id, label: option.label || id })),
      { handle: 'timeout', link: step.params.timeout_next_step_id, label: 'Hết giờ' },
      { handle: 'cancel', link: step.params.cancel_next_step_id, label: 'Hủy' },
    ];
  }
  const outputs = [{ handle: 'ok', link: step.params.next_step_id }];
  const onError = step.params.on_error;
  if (onError?.action === 'ERROR_BRANCH') outputs.push({ handle: 'err', link: onError.next_step_id, error: true });
  return outputs;
}

function edgesOf(wf) {
  const edge = (source, sourceHandle, link, extra = {}) => ({
    id: `${source}:${sourceHandle}`, source, sourceHandle, target: toNode(link), ...extra,
  });
  const edges = [edge(START, 'ok', wf.steps[0]?.step_id)];
  wf.steps.forEach((step) => stepOutputs(step).forEach((out) =>
    edges.push(edge(step.step_id, out.handle, out.link, { label: out.label, data: { error: Boolean(out.error) } }))));
  const branch = branchOf(wf);
  if (branch) edges.push(edge(BATTERY, 'ok', branch.next_step_id, { data: { battery: true } }));
  return edges;
}

/** Columns by BFS depth from START (then from BATTERY for branch-only steps). */
export function autoLayout(workflow) {
  const wf = explicitLinks(workflow);
  const edges = edgesOf(wf);
  const depth = {};
  const walk = (root, base) => {
    const queue = [[root, base]];
    while (queue.length) {
      const [id, d] = queue.shift();
      edges.filter((e) => e.source === id && e.target !== END_NODE && depth[e.target] === undefined)
        .forEach((e) => { depth[e.target] = d + 1; queue.push([e.target, d + 1]); });
    }
  };
  walk(START, 0);
  const mainRows = {};
  const place = (ids, top) => {
    const rows = {};
    return Object.fromEntries(ids.map((id) => {
      const column = depth[id] ?? 1;
      rows[column] = (rows[column] ?? -1) + 1;
      mainRows[column] = Math.max(mainRows[column] ?? 0, rows[column]);
      return [id, { x: column * COLUMN, y: top + rows[column] * ROW }];
    }));
  };
  const reached = wf.steps.map((s) => s.step_id).filter((id) => depth[id] !== undefined);
  const positions = { [START]: { x: 0, y: 0 }, ...place(reached, 0) };
  const lowerTop = (Math.max(0, ...Object.values(mainRows)) + 2) * ROW;
  walk(BATTERY, 0);
  const rest = wf.steps.map((s) => s.step_id).filter((id) => !positions[id]);
  Object.assign(positions, place(rest, lowerTop));
  positions[BATTERY] = { x: 0, y: lowerTop };
  positions[GUEST] = { x: 0, y: lowerTop + 2 * ROW };
  positions[END_NODE] = { x: (Math.max(1, ...Object.values(depth)) + 1) * COLUMN, y: 0 };
  return positions;
}

export function workflowToGraph(workflow) {
  const wf = explicitLinks(workflow);
  const layout = autoLayout(wf);
  const branch = branchOf(wf);
  const nodes = [
    { id: START, type: 'start', position: layout[START], data: {}, deletable: false },
    { id: END_NODE, type: 'end', position: layout[END_NODE], data: {}, deletable: false },
    ...wf.steps.map((step, index) => ({
      id: step.step_id, type: 'step', position: step.params.ui_position || layout[step.step_id],
      data: { step, index, outputs: stepOutputs(step) },
    })),
  ];
  if (branch) {
    nodes.push({ id: BATTERY, type: 'battery', position: branch.ui_position || layout[BATTERY],
      data: { threshold: branch.threshold_percent ?? DEFAULT_BATTERY_THRESHOLD } });
  }
  const guest = branchOf(wf, 'GUEST_DETECTED');
  if (guest) {
    nodes.push({ id: GUEST, type: 'guest', position: guest.ui_position || layout[GUEST],
      data: { ...GUEST_DEFAULTS, ...guest } });
  }
  return { nodes, edges: edgesOf(wf) };
}

function writeLink(step, handle, link) {
  if (handle === 'ok') step.params.next_step_id = link;
  else if (handle === 'timeout') step.params.timeout_next_step_id = link;
  else if (handle === 'cancel') step.params.cancel_next_step_id = link;
  else if (handle === 'err') step.params.on_error = { ...(step.params.on_error || {}), action: 'ERROR_BRANCH', next_step_id: link };
  else if (handle?.startsWith('opt:')) {
    const found = choiceOptions(step).find(({ id }) => `opt:${id}` === handle);
    if (found) found.option.next_step_id = link;
  }
}

export function connect(workflow, { source, sourceHandle, target }) {
  const wf = explicitLinks(workflow);
  if (source === START) {
    const index = wf.steps.findIndex((s) => s.step_id === target);
    if (index > 0) wf.steps.unshift(...wf.steps.splice(index, 1));
    return wf;
  }
  if (source === BATTERY) {
    const branch = branchOf(wf);
    if (branch) branch.next_step_id = toLink(target);
    return wf;
  }
  const step = wf.steps.find((s) => s.step_id === source);
  if (step) writeLink(step, sourceHandle, toLink(target));
  return wf;
}

export function disconnect(workflow, { source, sourceHandle }) {
  if (source === START) return explicitLinks(workflow);
  if (sourceHandle !== 'err') return connect(workflow, { source, sourceHandle, target: END_NODE });
  const wf = explicitLinks(workflow);
  const step = wf.steps.find((s) => s.step_id === source);
  if (step) {
    const { next_step_id: _dropped, ...rest } = step.params.on_error || {};
    step.params.on_error = { ...rest, action: 'STOP' };
  }
  return wf;
}

export function removeStep(workflow, stepId) {
  if (stepId === BATTERY) return removeBatteryBranch(workflow);
  if (stepId === GUEST) return removeGuestBranch(workflow);
  const wf = explicitLinks(workflow);
  const first = wf.steps[0];
  // Removing the START step: its successor starts the flow, never a branch-only step.
  const successor = first?.step_id === stepId
    ? (first.type === 'CHOICE' ? choiceOptions(first)[0]?.option.next_step_id : first.params.next_step_id)
    : null;
  wf.steps = wf.steps.filter((s) => s.step_id !== stepId);
  const promoted = wf.steps.findIndex((s) => s.step_id === successor);
  if (promoted > 0) wf.steps.unshift(...wf.steps.splice(promoted, 1));
  const clear = (link) => (link === stepId ? FLOW_END : link);
  wf.steps.forEach((step) => {
    const p = step.params;
    p.next_step_id = clear(p.next_step_id);
    if (step.type === 'CHOICE') {
      p.timeout_next_step_id = clear(p.timeout_next_step_id);
      p.cancel_next_step_id = clear(p.cancel_next_step_id);
      choiceOptions(step).forEach(({ option }) => { option.next_step_id = clear(option.next_step_id); });
    }
    if (p.on_error?.next_step_id) p.on_error.next_step_id = clear(p.on_error.next_step_id);
  });
  wf.execution_config.event_branches = (wf.execution_config.event_branches || []).filter((b) => b.next_step_id !== stepId);
  return wf;
}

/** React Flow deletes selected nodes on Backspace/Delete: only an explicit selection counts. */
export function markSelected(nodes, selectedId) {
  return nodes.map((node) => ({ ...node, selected: Boolean(selectedId) && node.id === selectedId }));
}

/** Backend accepts a whole-number threshold from 5 to 90 %. */
export function clampThreshold(value) {
  const n = Math.round(Number(value));
  return value === '' || value === null || !Number.isFinite(n) ? DEFAULT_BATTERY_THRESHOLD : Math.min(90, Math.max(5, n));
}

export function setPosition(workflow, nodeId, position) {
  const wf = normalized(workflow);
  const pos = { x: Math.round(position.x), y: Math.round(position.y) };
  if (nodeId === BATTERY || nodeId === GUEST) {
    const branch = branchOf(wf, nodeId === GUEST ? 'GUEST_DETECTED' : 'LOW_BATTERY');
    if (branch) branch.ui_position = pos;
    return wf;
  }
  const step = wf.steps.find((s) => s.step_id === nodeId);
  if (step) step.params.ui_position = pos;
  return wf;
}

/** Add a step as a free node: existing links are frozen first, the new step ends until wired. */
export function appendStep(workflow, step, position) {
  const wf = explicitLinks(workflow);
  const added = clone(step);
  added.params = { ...(added.params || {}), next_step_id: FLOW_END };
  wf.steps.push(added);
  return position ? setPosition(wf, added.step_id, position) : wf;
}

export function addBatteryBranch(workflow, threshold = DEFAULT_BATTERY_THRESHOLD) {
  const wf = normalized(workflow);
  if (!branchOf(wf)) {
    wf.execution_config.event_branches = [
      { event: 'LOW_BATTERY', threshold_percent: threshold, next_step_id: FLOW_END },
      ...(wf.execution_config.event_branches || []),
    ];
  }
  return wf;
}

export function setBatteryThreshold(workflow, threshold) {
  const wf = normalized(workflow);
  const branch = branchOf(wf);
  if (branch) branch.threshold_percent = clampThreshold(threshold);
  return wf;
}

export function removeBatteryBranch(workflow) {
  const wf = normalized(workflow);
  wf.execution_config.event_branches = (wf.execution_config.event_branches || []).filter((b) => b.event !== 'LOW_BATTERY');
  return wf;
}

/** Stop for the kiosk conversation, resume the route afterwards (real robot only). */
export function addGuestBranch(workflow) {
  const wf = normalized(workflow);
  if (!branchOf(wf, 'GUEST_DETECTED')) {
    wf.execution_config.event_branches = [
      ...(wf.execution_config.event_branches || []), { event: 'GUEST_DETECTED', ...GUEST_DEFAULTS },
    ];
  }
  return wf;
}

export function setGuestSettings(workflow, patch) {
  const wf = normalized(workflow);
  const branch = branchOf(wf, 'GUEST_DETECTED');
  if (!branch) return wf;
  Object.entries(patch).forEach(([key, value]) => {
    const [low, high] = GUEST_LIMITS[key] || [];
    if (low === undefined) return;
    const n = Math.round(Number(value));
    branch[key] = value === '' || value === null || !Number.isFinite(n) ? GUEST_DEFAULTS[key] : Math.min(high, Math.max(low, n));
  });
  return wf;
}

export function removeGuestBranch(workflow) {
  const wf = normalized(workflow);
  wf.execution_config.event_branches = (wf.execution_config.event_branches || []).filter((b) => b.event !== 'GUEST_DETECTED');
  return wf;
}
