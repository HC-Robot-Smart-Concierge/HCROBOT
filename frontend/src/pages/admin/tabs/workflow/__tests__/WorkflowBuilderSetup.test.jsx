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
  it('shows the nearest-charger note instead of the waypoint form', () => {
    const workflow = { id: 'wf', name: 'P', execution_config: { execution_mode: 'ROBOT' }, steps: [
      { step_id: 'go', type: 'MOVE', title: 'Về trạm sạc gần nhất', params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER' } }] };
    const html = renderToStaticMarkup(<WorkflowBuilderModal isOpen workflow={workflow} />);
    expect(html).toContain('Trạm sạc gần nhất được chọn lúc chạy');
    expect(html).not.toContain('Khi gặp khách');
  });
});
