import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { PhysicalMapRoutePlanner } from './PhysicalMapRoutePlanner';
import { newMapRoute, routePoint, closeRoutePoints } from '../../../utils/physicalMapRoute';

describe('Workflow route setup on a physical map', () => {
  it('shows endpoint roles and an explicit loop control for free map positions', () => {
    const draft = newMapRoute('map_a');
    draft.execution_config.route.points = [routePoint(0, 0), routePoint(1, 1), routePoint(2, 0)];
    const html = renderToStaticMarkup(<PhysicalMapRoutePlanner mapId="map_a" endpoints={[]} draft={draft} onDraftChange={() => {}} />);
    expect(html).toContain('Điểm đầu');
    expect(html).toContain('Điểm cuối');
    expect(html).toContain('Khép kín tuyến');
    expect(html).toContain('Bấm lại điểm đầu');
    draft.execution_config.route.points = closeRoutePoints(draft.execution_config.route.points);
    const loop = renderToStaticMarkup(<PhysicalMapRoutePlanner mapId="map_a" endpoints={[]} draft={draft} onDraftChange={() => {}} />);
    expect(loop).toContain('Điểm đầu / cuối');
    expect(loop).toContain('Quay về điểm đầu');
    expect(loop).toContain('Mở tuyến');
    expect(loop).not.toContain('aria-label="Xóa điểm 4"');
  });
  it('offers workflow and step parameter setup without requiring a preexisting route', () => {
    const html = renderToStaticMarkup(<PhysicalMapRoutePlanner mapId="map_a" endpoints={[]} draft={null}
      onDraftChange={() => {}} onBindingChange={() => {}} />);
    expect(html).toContain('Workflow cần cấu hình tuyến');
    expect(html).toContain('Có thể để trống tuyến khi lưu bản nháp');
    expect(html).toContain('map_a');
  });
  it('keeps the embedded builder map focused on its already-selected workflow step', () => {
    const html = renderToStaticMarkup(<PhysicalMapRoutePlanner mapId="map_a" endpoints={[]} draft={null}
      onDraftChange={() => {}} onRouteSaved={() => {}} />);
    expect(html).not.toContain('aria-label="Workflow cần cấu hình tuyến"');
  });
});
