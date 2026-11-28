import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkflowBuilderModal } from '../WorkflowBuilderModal';
import { WorkflowMetaPanel } from '../WorkflowMetaPanel';
import { WorkflowTriggerPanel } from '../WorkflowTriggerPanel';
import { ADDABLE_OTTO_STEP_TYPES, OTTO_STEP_TYPES } from '../workflowConstants';
import { PhoneCameraWorkflowTest, supportsPhoneCameraWorkflow } from '../../../../../components/robot/PhoneCameraWorkflowTest';

describe('Workflow builder selected-step layout', () => {
  it('offers conversation while retaining definitions for saved interaction steps', () => {
    const addable = ADDABLE_OTTO_STEP_TYPES.map(({ type }) => type);
    const known = OTTO_STEP_TYPES.map(({ type }) => type);

    expect(addable).toContain('COMMUNICATE');
    for (const type of ['CREATE_REQUEST', 'CHOICE', 'LISTEN', 'SPEAK']) {
      expect(addable).not.toContain(type);
      expect(known).toContain(type);
    }
  });

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
  it('offers a guest wait on kiosk ads and treats the legacy detection trigger as manual', () => {
    const workflow = { id: 'promo', name: 'Quảng cáo', trigger_type: 'AUTO_DETECT', steps: [
      { step_id: 'ad', type: 'SHOW', title: 'Quảng cáo', params: { screen_mode: 'ACTIVE_ADS', wait_for_guest: true } },
      { step_id: 'talk', type: 'COMMUNICATE', title: 'Giao tiếp', params: {} },
    ] };
    const html = renderToStaticMarkup(<WorkflowBuilderModal isOpen workflow={workflow} />);
    expect(html).toContain('Phát quảng cáo đến khi có khách');
    const triggerSelect = renderToStaticMarkup(<WorkflowTriggerPanel workflow={workflow} />);
    expect(triggerSelect).toContain('value="MANUAL" selected');
    expect(triggerSelect).toContain('value="SCHEDULE"');
    expect(triggerSelect).not.toContain('AUTO_DETECT');
    expect(triggerSelect).not.toContain('Thêm lịch');
  });

  it('puts existing schedules on the Trigger instead of workflow information', () => {
    const workflow = { name: 'Quảng cáo', is_active: true, trigger_type: 'SCHEDULE', execution_config: {
      schedules: [{ time: '14:30', days: [0], timezone: 'Asia/Ho_Chi_Minh', enabled: true }],
    } };
    const trigger = renderToStaticMarkup(<WorkflowTriggerPanel workflow={workflow} />);
    const metadata = renderToStaticMarkup(<WorkflowMetaPanel workflow={workflow} />);
    expect(trigger).toContain('value="SCHEDULE" selected');
    expect(trigger).toContain('value="14:30"');
    expect(trigger).toContain('Thêm lịch');
    expect(metadata).not.toContain('Cách khởi chạy');
    expect(metadata).not.toContain('Kích hoạt bởi');
  });
});

it('requires an enabled kiosk workflow with the saved ad-to-conversation link in the phone test', () => {
  const ad = { step_id: 'ad', type: 'SHOW', params: { screen_mode: 'ACTIVE_ADS', wait_for_guest: true, next_step_id: 'talk' } };
  const talk = { step_id: 'talk', type: 'COMMUNICATE', params: { next_step_id: 'ad' } };
  const workflow = { is_active: true, execution_config: { execution_mode: 'SCREEN' }, steps: [ad, talk] };
  expect(supportsPhoneCameraWorkflow(workflow)).toBe(true);
  expect(supportsPhoneCameraWorkflow({ ...workflow, is_active: false })).toBe(false);
  expect(supportsPhoneCameraWorkflow({ ...workflow, execution_config: { execution_mode: 'ROBOT' } })).toBe(false);
  ad.params.next_step_id = 'END';
  expect(supportsPhoneCameraWorkflow(workflow)).toBe(false);
});

it('offers an explicit start before opening the phone camera', () => {
  const html = renderToStaticMarkup(<PhoneCameraWorkflowTest workflowId="wf-quang-cao-tiep-khach" active={false} canStart />);
  expect(html).toContain('Thử bằng camera trước');
  expect(html).toContain('Đang tải workflow đã lưu');
  expect(html).not.toContain('Dừng thử');
  expect(html).toMatch(/<video[^>]*hidden/);
});
