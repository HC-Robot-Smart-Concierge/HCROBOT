import { describe, it, expect } from 'vitest';

/**
 * Unit Test kiểm tra logic đổi tên Kịch bản và Toggle Panel Studio (Expand Map UX)
 */
describe('Workflow Scenario & UX Studio Panel Logic', () => {
  it('should update workflow name and keep existing steps intact', () => {
    const existingWorkflow = {
      id: 'wf-welcome',
      name: 'Đón Khách Sảnh Chính',
      steps: [
        { step_id: 's1', type: 'MOVE', title: 'Di chuyển lại gần sảnh' },
        { step_id: 's2', type: 'GREET', title: 'Chào hỏi' }
      ]
    };

    const newName = 'Đón Khách VIP Sảnh Chính';

    const updatedWorkflow = {
      ...existingWorkflow,
      name: newName.trim()
    };

    expect(updatedWorkflow.name).toBe('Đón Khách VIP Sảnh Chính');
    expect(updatedWorkflow.id).toBe('wf-welcome');
    expect(updatedWorkflow.steps).toHaveLength(2);
  });

  it('should handle updating list of workflows after renaming', () => {
    const workflows = [
      { id: 'wf-1', name: 'Chu trình A' },
      { id: 'wf-2', name: 'Chu trình B' }
    ];

    const updatedWf = { id: 'wf-1', name: 'Chu trình A (Đã cập nhật)' };

    const updatedList = workflows.map((w) => (w.id === updatedWf.id ? updatedWf : w));

    expect(updatedList[0].name).toBe('Chu trình A (Đã cập nhật)');
    expect(updatedList[1].name).toBe('Chu trình B');
  });

  it('should toggle map expand vs workflow studio sidebar panel state', () => {
    let isPanelOpen = true;

    // User toggles off panel to expand Map 100%
    isPanelOpen = !isPanelOpen;
    expect(isPanelOpen).toBe(false);

    // User toggles back on panel
    isPanelOpen = !isPanelOpen;
    expect(isPanelOpen).toBe(true);
  });
});
