import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkflowBuilderModal } from '../WorkflowBuilderModal';

describe('Workflow builder selected-step layout', () => {
  it('lists all steps but mounts only the selected step editor', () => {
    const workflow = { id: 'wf', name: 'Patrol', steps: [
      { step_id: 'route', type: 'FOLLOW_ROUTE', title: 'Go around', params: {} },
      { step_id: 'speech', type: 'SPEAK', title: 'Announcement', params: { speech_text: 'SECOND_STEP_TEXT' } },
    ] };
    const html = renderToStaticMarkup(<WorkflowBuilderModal isOpen workflow={workflow} />);
    expect(html).toContain('Sơ đồ workflow');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Cấu hình bước 1');
    expect(html).toContain('Cấu hình tuyến trên map');
    expect(html).not.toContain('value="SECOND_STEP_TEXT"');
    expect(html).toContain('Cần hoàn thiện');
    expect(html).toContain('Lưu bản nháp · cấu hình tuyến sau');
    expect(html).toContain('sang Physical Map');
  });
  it('renders the empty state without accessing a missing step', () => {
    const html = renderToStaticMarkup(<WorkflowBuilderModal isOpen workflow={{ id: 'new', name: 'New', steps: [] }} />);
    expect(html).toContain('Chưa có bước');
    expect(html).not.toContain('Cấu hình bước 1');
  });
});
