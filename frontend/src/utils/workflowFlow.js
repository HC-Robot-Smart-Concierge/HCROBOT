/**
 * Step-to-step decisions shared by the Studio simulator and the robot screen.
 *
 * A workflow is a flat list of steps that runs in order. Any step may set
 * params.next_step_id to jump when it finishes: a step_id, FLOW_END to close
 * the session, or empty for the next step in order. A CHOICE step waits for
 * the guest and follows the picked option's next_step_id. If the guest does
 * not answer it follows timeout_next_step_id, and if they cancel it follows
 * cancel_next_step_id. Both default to FLOW_END, and a missing timeout target
 * falls back to the cancel target.
 */

export const FLOW_END = 'END';
export const DEFAULT_CHOICE_TIMEOUT_SEC = 30;

export const OUTCOME = {
  DONE: 'DONE',
  CHOSEN: 'CHOSEN',
  TIMEOUT: 'TIMEOUT',
  CANCEL: 'CANCEL',
};

const CANCEL_PHRASES = ['huy bo', 'cancel', 'khong can nua', 'thoi khong can'];

export const foldText = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

export function getChoiceOptions(step) {
  const raw = step?.params?.options;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => o && (o.id || o.label))
    .map((o, i) => ({ ...o, id: String(o.id || `option-${i + 1}`), label: o.label || String(o.id) }));
}

export function getChoiceTimeoutSec(step) {
  const sec = Number(step?.params?.timeout_sec);
  return Number.isFinite(sec) && sec > 0 ? sec : DEFAULT_CHOICE_TIMEOUT_SEC;
}

// Index of the step a link points to, -1 to end. Unknown ids end the session
// rather than guess a step; findBrokenFlowLinks reports them to the editor.
const followLink = (steps, target, fallbackIndex) => {
  if (target === undefined || target === null || target === '') {
    return fallbackIndex < steps.length ? fallbackIndex : -1;
  }
  if (target === FLOW_END) return -1;
  return steps.findIndex((s) => s?.step_id === target);
};

/**
 * Index of the step to run after steps[currentIndex] finished with outcome,
 * or -1 when the session ends. outcome is { type, optionId? }; anything else
 * counts as DONE.
 */
export function resolveNextStepIndex(steps, currentIndex, outcome) {
  const list = Array.isArray(steps) ? steps : [];
  const step = list[currentIndex];
  if (!step) return -1;
  const params = step.params || {};
  const type = outcome && typeof outcome === 'object' ? outcome.type : OUTCOME.DONE;
  const sequential = currentIndex + 1;

  if (step.type !== 'CHOICE') return followLink(list, params.next_step_id, sequential);

  if (type === OUTCOME.CHOSEN) {
    const option = getChoiceOptions(step).find((o) => o.id === outcome.optionId);
    if (option) return followLink(list, option.next_step_id, sequential);
  }
  const cancelTarget = params.cancel_next_step_id ?? FLOW_END;
  if (type === OUTCOME.CANCEL) return followLink(list, cancelTarget, sequential);
  // Timeout, an operator skip or an unknown option: the guest made no decision.
  return followLink(list, params.timeout_next_step_id ?? cancelTarget, sequential);
}

/** The option a guest named, or null when nothing or more than one option matched. */
export function matchChoiceFromSpeech(step, transcript) {
  const heard = foldText(transcript);
  if (!heard) return null;
  const hits = getChoiceOptions(step).filter((o) =>
    [o.label, o.label_en, ...(Array.isArray(o.keywords) ? o.keywords : [])]
      .map(foldText)
      .filter((k) => k.length >= 2)
      .some((k) => heard.includes(k))
  );
  return hits.length === 1 ? hits[0].id : null;
}

export const isCancelSpeech = (transcript) => {
  const heard = foldText(transcript);
  return Boolean(heard) && CANCEL_PHRASES.some((p) => heard.includes(p));
};

/** Links that point at a step id that is not in the workflow. */
export function findBrokenFlowLinks(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const ids = new Set(list.map((s) => s?.step_id).filter(Boolean));
  const broken = [];
  const check = (index, field, target) => {
    if (target && target !== FLOW_END && !ids.has(target)) broken.push({ index, field, target });
  };
  list.forEach((step, index) => {
    const params = step?.params || {};
    check(index, 'next_step_id', params.next_step_id);
    if (step?.type === 'CHOICE') {
      check(index, 'timeout_next_step_id', params.timeout_next_step_id);
      check(index, 'cancel_next_step_id', params.cancel_next_step_id);
      getChoiceOptions(step).forEach((o) => check(index, `options.${o.id}`, o.next_step_id));
    }
  });
  return broken;
}
