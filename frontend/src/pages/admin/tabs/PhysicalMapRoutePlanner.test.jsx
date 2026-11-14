import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { PhysicalMapRoutePlanner } from './PhysicalMapRoutePlanner';

describe('Workflow route setup on a physical map', () => {
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
