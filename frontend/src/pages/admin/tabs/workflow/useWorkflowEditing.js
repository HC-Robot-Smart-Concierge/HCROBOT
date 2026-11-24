import { useCallback } from 'react';
import { OTTO_STEP_TYPES } from './workflowConstants';
import { executionConfig } from '../../../../utils/workflowExecution';
import { removeStep as removeGraphStep } from '../../../../utils/workflowGraph';

const newWorkflow = () => ({
  id: `wf-${Date.now().toString(36)}`,
  name: 'Kịch bản phục vụ khách mới',
  description: 'Mô tả chu trình hoạt động của robot...',
  trigger_type: 'MANUAL',
  execution_config: executionConfig(),
  is_active: true,
  steps: [
    { step_id: `step-${Date.now()}-1`, type: 'MOVE', title: 'Di chuyển lại gần khách tại Sảnh', params: { ...OTTO_STEP_TYPES[0].defaultParams } },
    { step_id: `step-${Date.now()}-2`, type: 'GREET', title: 'Chào hỏi và biểu cảm', params: { ...OTTO_STEP_TYPES[1].defaultParams } },
    { step_id: `step-${Date.now()}-3`, type: 'SPEAK', title: 'Phát âm thanh giới thiệu', params: { ...OTTO_STEP_TYPES[2].defaultParams } },
  ],
});

const newRouteWorkflow = () => ({
  id: `wf-${Date.now().toString(36)}`, name: 'Chạy tuyến trên xe thật', description: '',
  trigger_type: 'MANUAL', is_active: false,
  execution_config: { ...executionConfig(), execution_mode: 'ROBOT' },
  steps: [
    { step_id: 'route', type: 'FOLLOW_ROUTE', title: 'Đi theo tuyến', params: { route_id: '', repeat_count: 1 } },
    { step_id: 'wait', type: 'WAIT', title: 'Chờ tại điểm cuối', params: { duration_sec: 5 } },
  ],
});

/** Editor actions of the workflow tab (moved out of AdminWorkflowTab, same behavior). */
export function useWorkflowEditing(setEditingWorkflow, setIsEditorOpen) {
  const open = useCallback((workflow) => { setEditingWorkflow(workflow); setIsEditorOpen(true); }, [setEditingWorkflow, setIsEditorOpen]);
  const openCreate = useCallback(() => open(newWorkflow()), [open]);
  const openEdit = useCallback((wf) => open(JSON.parse(JSON.stringify(wf))), [open]);
  const openRouteWorkflow = useCallback(() => open(newRouteWorkflow()), [open]);

  const replaceWorkflow = useCallback((next) => setEditingWorkflow(next), [setEditingWorkflow]);

  // Removing a step also clears every link that pointed at it (canvas links are explicit).
  const removeStep = useCallback((index) => setEditingWorkflow((prev) =>
    removeGraphStep(prev, prev.steps[index]?.step_id)), [setEditingWorkflow]);

  // Functional update: one edit may change several params in a row (e.g. picking a MOVE target)
  const changeStepParam = useCallback((stepIndex, paramKey, val) => setEditingWorkflow((prev) => {
    const steps = [...prev.steps];
    steps[stepIndex] = { ...steps[stepIndex], params: { ...(steps[stepIndex].params || {}), [paramKey]: val } };
    return { ...prev, steps };
  }), [setEditingWorkflow]);

  const changeMeta = useCallback((key, val) => setEditingWorkflow((prev) => ({ ...prev, [key]: val })), [setEditingWorkflow]);

  return { openCreate, openEdit, openRouteWorkflow, replaceWorkflow, removeStep, changeStepParam, changeMeta };
}
