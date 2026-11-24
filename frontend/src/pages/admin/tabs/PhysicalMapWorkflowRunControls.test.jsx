import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { PhysicalMapWorkflowRunControls } from './PhysicalMapWorkflowRunControls';

const workflow = { name: 'Tuần tra', is_active: false, execution_config: { execution_mode: 'SCREEN' } };
const render = (props = {}) => renderToStaticMarkup(<PhysicalMapWorkflowRunControls workflow={workflow} {...props} />);

describe('Physical Map workflow start controls', () => {
  it('always shows start and activation controls for a saved screen-mode draft', () => {
    const html = render();
    expect(html).toContain('Kích hoạt workflow trên xe thật');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Bắt đầu workflow/);
  });
  it('allows starting an activated physical workflow', () => {
    const html = render({ workflow: { ...workflow, is_active: true, execution_config: { execution_mode: 'ROBOT' } } });
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Bắt đầu workflow');
    expect(html).not.toContain('>Kích hoạt workflow trên xe thật');
  });
  it('blocks starting unsaved routes and explains incomplete step configuration', () => {
    const html = render({ needsSave: true, issue: 'Còn bước chưa có tuyến.' });
    expect(html).toContain('Lưu tuyến &amp; gán vào bước trước khi chạy');
    expect(html).toContain('Còn bước chưa có tuyến.');
    expect((html.match(/disabled=""/g) || []).length).toBe(2);
  });
  it('explains that activation also enables the existing schedule', () => {
    expect(render({ workflow: { ...workflow, trigger_type: 'SCHEDULE' } })).toContain('bật lịch chạy đã lưu');
  });
  it('keeps activation results visible next to the start control', () => {
    const html = render({ feedback: 'Không kích hoạt được workflow: lỗi kết nối' });
    expect(html).toContain('role="status"');
    expect(html).toContain('Không kích hoạt được workflow: lỗi kết nối');
  });
});
