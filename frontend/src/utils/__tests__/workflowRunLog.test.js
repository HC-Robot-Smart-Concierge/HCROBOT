import { describe, it, expect } from 'vitest';
import { currentWorkflowRunLog } from '../workflowRunLog';

describe('New workflow runs replace the displayed old log', () => {
  const old = { id: 'old', workflow_id: 'wf-a', status: 'FAILED', events: [{ message: 'Old failure' }] };
  const current = { id: 'new', workflow_id: 'wf-a', status: 'PENDING', events: [] };
  const other = { id: 'other', workflow_id: 'wf-b', events: [] };

  it('shows only the latest run after opening the panel or reloading', () => {
    expect(currentWorkflowRunLog([current, other, old])).toEqual([current]);
    expect(currentWorkflowRunLog([other, current, old], 'wf-a')).toEqual([current]);
  });
  it('clears the previous log while the new run is not yet in a poll response', () => {
    expect(currentWorkflowRunLog([old], 'wf-a', 'new')).toEqual([]);
    expect(currentWorkflowRunLog([current, old], 'wf-a', 'new')).toEqual([current]);
    expect(currentWorkflowRunLog([current, old], undefined, 'new')).toEqual([current]);
  });
  it('shows new failures without mixing events from the previous run', () => {
    const failed = { ...current, status: 'FAILED', events: [{ message: 'New failure' }] };
    const result = currentWorkflowRunLog([failed, old], 'wf-a', 'new');
    expect(result[0].events).toEqual([{ message: 'New failure' }]);
    expect(old.events).toEqual([{ message: 'Old failure' }]);
  });
});
