import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { KioskChoicePrompt } from '../KioskChoicePrompt';

const findAll = (node, predicate, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  if (predicate(node)) out.push(node);
  findAll(node.props?.children, predicate, out);
  return out;
};

const textOf = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
};

const step = {
  step_id: 'pick',
  type: 'CHOICE',
  params: {
    prompt: 'Xem bản đồ hay để em dẫn đường?',
    options: [
      { id: 'map', label: 'Xem bản đồ', next_step_id: 'show-map' },
      { id: 'guide', label: 'Dẫn tới thang máy', next_step_id: 'go' },
    ],
  },
};

describe('KioskChoicePrompt', () => {
  it('renders one button per option plus cancel and reports the picked option', () => {
    const onChoose = vi.fn();
    const onCancel = vi.fn();
    const tree = KioskChoicePrompt({ step, remainingSec: 12, onChoose, onCancel });
    const buttons = findAll(tree, (n) => n.type === 'button');

    expect(buttons.map(textOf)).toEqual(['Xem bản đồ', 'Dẫn tới thang máy', 'Hủy']);
    buttons[1].props.onClick();
    expect(onChoose).toHaveBeenCalledWith('guide');
    buttons[2].props.onClick();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).toContain('Tự chuyển tiếp sau 12 giây');
    expect(textOf(tree)).toContain(step.params.prompt);
  });

  it('disables every button while the simulation is paused', () => {
    const tree = KioskChoicePrompt({ step, disabled: true });
    const buttons = findAll(tree, (n) => n.type === 'button');
    expect(buttons.every((b) => b.props.disabled)).toBe(true);
  });
});
