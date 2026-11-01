import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../context/LanguageContext';
import { formatRobotControlText } from '../../../context/RobotControlLanguage';
import { AdminRobotControlTab } from './AdminRobotControlTab';
import { AdminPortal } from '../AdminPortal';

let storedLanguage;

beforeEach(() => {
  storedLanguage = null;
  vi.stubGlobal('localStorage', {
    getItem: (key) => key === 'aurora_language' ? storedLanguage : null,
    setItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    location: { search: '?tab=Robot+Control', pathname: '/admin' },
  });
});

afterEach(() => vi.unstubAllGlobals());

const render = (view = 'lidar') => renderToStaticMarkup(
  <LanguageProvider><AdminRobotControlTab subTabProp={view} /></LanguageProvider>,
);

describe('Unified Robot Control presentation', () => {
  it('defaults to English and exposes both views with one telemetry panel', () => {
    const html = render();
    expect(html).toContain('Control &amp; SLAM');
    expect(html).toContain('Live Camera');
    expect(html).toContain('Manual control');
    expect(html).toContain('Drive speed');
    expect(html).toContain('Hold to move · Release to stop');
    expect(html).toContain('Forward (W / Up arrow)');
    expect(html.match(/class="robot-manual-controls /g)).toHaveLength(1);
    expect(html).not.toContain('robot-slam-controls');
    expect(html).toContain('Pi offline');
    expect(html.match(/class="robot-telemetry /g)).toHaveLength(1);
    expect(html).not.toContain('LỆNH ĐIỀU KHIỂN');
    expect(html).not.toContain('MẤT KẾT NỐI PI');
  });

  it('keeps telemetry and camera tools together when opening the camera view', () => {
    const html = render('camera');
    expect(html).toMatch(/id="robot-slam-panel"[^>]*hidden=""/);
    expect(html).toMatch(/id="robot-camera-panel"[^>]*class="robot-camera-panel"/);
    expect(html).toContain('Drive speed');
    expect(html).toContain('Take snapshot');
    expect(html).toContain('EMERGENCY STOP');
    expect(html).toContain('4-wheel encoders (ESP32)');
    expect(html.match(/class="robot-manual-controls /g)).toHaveLength(1);
    expect(html).not.toContain('robot-slam-controls');
  });

  it('uses Vietnamese only when it was explicitly selected in Settings', () => {
    storedLanguage = 'VI';
    const html = render('camera');
    expect(html).toContain('Điều khiển thủ công');
    expect(html).toContain('Tốc độ xe');
    expect(html).toContain('Chụp ảnh');
    expect(html).toContain('MẤT KẾT NỐI PI');
    expect(html).not.toContain('Drive speed');
    storedLanguage = 'unrecognized';
    expect(render('camera')).toContain('Drive speed');
  });

  it('has one sidebar entry for control and camera and retains other robot sections', () => {
    const html = renderToStaticMarkup(<LanguageProvider><AdminPortal /></LanguageProvider>);
    expect(html).toContain('Control &amp; Camera');
    expect(html).toContain('Physical Lab Map (layout2)');
    expect(html).toContain('Workflow Step Management');
    expect(html).not.toContain('Live Camera FPV');
    expect(html).not.toContain('Control &amp; Odometry SLAM');
  });

  it('preserves interpolated telemetry values in either language', () => {
    expect(formatRobotControlText('EN', 'Speed changed: {0}%', [0])).toBe('Speed changed: 0%');
    expect(formatRobotControlText('VI', 'Speed changed: {0}%', [75])).toBe('Đổi tốc độ: 75%');
    expect(formatRobotControlText('EN', 'Map loaded: {0}', ['phong_lam_viec'])).toBe('Map loaded: phong_lam_viec');
  });
});
