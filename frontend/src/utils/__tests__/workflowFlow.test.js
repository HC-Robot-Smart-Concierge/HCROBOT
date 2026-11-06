import { describe, it, expect } from 'vitest';
import {
  FLOW_END,
  findBrokenFlowLinks,
  getChoiceTimeoutSec,
  isCancelSpeech,
  matchChoiceFromSpeech,
  resolveNextStepIndex,
} from '../workflowFlow';

const steps = [
  { step_id: 'ask', type: 'COMMUNICATE', params: {} },
  {
    step_id: 'pick',
    type: 'CHOICE',
    params: {
      prompt: 'Xem bản đồ hay để em dẫn đường?',
      timeout_sec: 20,
      options: [
        { id: 'map', label: 'Xem bản đồ', keywords: ['bản đồ', 'map'], next_step_id: 'show-map' },
        { id: 'guide', label: 'Dẫn tới thang máy', keywords: ['dẫn đường', 'thang máy', 'guide'], next_step_id: 'go' },
      ],
      timeout_next_step_id: 'more',
      cancel_next_step_id: 'rate',
    },
  },
  { step_id: 'show-map', type: 'SHOW', params: { next_step_id: 'more' } },
  { step_id: 'go', type: 'MOVE', params: {} },
  { step_id: 'more', type: 'COMMUNICATE', params: {} },
  { step_id: 'rate', type: 'FEEDBACK', params: {} },
];
const at = (id) => steps.findIndex((s) => s.step_id === id);

describe('resolveNextStepIndex', () => {
  it('runs steps in order when nothing says otherwise', () => {
    expect(resolveNextStepIndex(steps, at('ask'))).toBe(at('pick'));
    expect(resolveNextStepIndex(steps, at('go'), { type: 'DONE' })).toBe(at('more'));
    expect(resolveNextStepIndex(steps, at('rate'))).toBe(-1);
  });

  it('follows next_step_id so a branch can rejoin the main line', () => {
    expect(resolveNextStepIndex(steps, at('show-map'))).toBe(at('more'));
  });

  it('branches on the option the guest picked', () => {
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'CHOSEN', optionId: 'map' })).toBe(at('show-map'));
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'CHOSEN', optionId: 'guide' })).toBe(at('go'));
  });

  it('uses the timeout and cancel targets when the guest does not choose', () => {
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'TIMEOUT' })).toBe(at('more'));
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'CANCEL' })).toBe(at('rate'));
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'DONE' })).toBe(at('more'));
    expect(resolveNextStepIndex(steps, at('pick'), { type: 'CHOSEN', optionId: 'nope' })).toBe(at('more'));
  });

  it('ends the session by default and on links to missing steps', () => {
    const bare = [{ step_id: 'c', type: 'CHOICE', params: { options: [{ id: 'a', label: 'A', next_step_id: 'gone' }] } }, { step_id: 'x', type: 'SHOW' }];
    expect(resolveNextStepIndex(bare, 0, { type: 'TIMEOUT' })).toBe(-1);
    expect(resolveNextStepIndex(bare, 0, { type: 'CANCEL' })).toBe(-1);
    expect(resolveNextStepIndex(bare, 0, { type: 'CHOSEN', optionId: 'a' })).toBe(-1);
    expect(resolveNextStepIndex([{ step_id: 's', params: { next_step_id: FLOW_END } }, { step_id: 't' }], 0)).toBe(-1);
  });

  it('treats an empty target as the next step in order', () => {
    const list = [{ step_id: 'c', type: 'CHOICE', params: { options: [{ id: 'a', label: 'A', next_step_id: '' }] } }, { step_id: 'x' }];
    expect(resolveNextStepIndex(list, 0, { type: 'CHOSEN', optionId: 'a' })).toBe(1);
  });

  it('accepts non-outcome arguments such as DOM events as DONE', () => {
    expect(resolveNextStepIndex(steps, at('ask'), { nativeEvent: {} })).toBe(at('pick'));
  });
});

describe('matchChoiceFromSpeech', () => {
  const pick = steps[at('pick')];
  it('matches keywords without diacritics or case', () => {
    expect(matchChoiceFromSpeech(pick, 'Cho tôi xem BẢN ĐỒ nhé')).toBe('map');
    expect(matchChoiceFromSpeech(pick, 'em dan duong giup toi')).toBe('guide');
  });
  it('returns null when nothing or more than one option matches', () => {
    expect(matchChoiceFromSpeech(pick, 'nhà hàng ở đâu')).toBeNull();
    expect(matchChoiceFromSpeech(pick, 'bản đồ hay thang máy đều được')).toBeNull();
  });
  it('recognises cancel phrases', () => {
    expect(isCancelSpeech('Thôi không cần nữa')).toBe(true);
    expect(isCancelSpeech('xem bản đồ')).toBe(false);
  });
});

describe('helpers', () => {
  it('reads the choice timeout with a default', () => {
    expect(getChoiceTimeoutSec(steps[at('pick')])).toBe(20);
    expect(getChoiceTimeoutSec({ params: {} })).toBe(30);
  });
  it('reports links to missing steps', () => {
    const list = [{ step_id: 'a', params: { next_step_id: 'zzz' } }, { step_id: 'b', type: 'CHOICE', params: { cancel_next_step_id: FLOW_END, options: [{ id: 'o', label: 'O', next_step_id: 'a' }] } }];
    expect(findBrokenFlowLinks(list)).toEqual([{ index: 0, field: 'next_step_id', target: 'zzz' }]);
    expect(findBrokenFlowLinks(steps)).toEqual([]);
  });
});
