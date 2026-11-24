import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkflowExecutionSettings } from '../WorkflowExecutionSettings';

describe('Physical workflow configuration', () => {
  it('offers explicit robot mode and explains readiness and busy-slot behavior', () => {
    const html = renderToStaticMarkup(<WorkflowExecutionSettings workflow={{
      trigger_type: 'MANUAL', execution_config: { execution_mode: 'ROBOT' }, steps: [],
    }} onChange={() => {}} />);
    expect(html).toContain('Điều khiển xe thật');
    expect(html).toContain('định vị và encoder');
    expect(html).toContain('Robot bận sẽ bỏ qua lịch');
    expect(html).toContain('Vận tốc theo cấu hình Nav2');
    expect(html).not.toContain('Chưa tự phát lệnh theo giờ');
  });

  it('keeps legacy screen mode visibly separate from movement', () => {
    const html = renderToStaticMarkup(<WorkflowExecutionSettings workflow={{}} onChange={() => {}} />);
    expect(html).toContain('Chế độ màn hình không điều khiển xe');
  });
});
