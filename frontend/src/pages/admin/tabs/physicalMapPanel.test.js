import { describe, it, expect, beforeEach } from 'vitest';
import {
  PANEL_SECTIONS,
  PANEL_STORAGE_KEY,
  fitCanvasSize,
  loadPanelState,
  nextPanelState,
  savePanelState,
} from './physicalMapPanel';

describe('thanh icon ben phai (Physical Map)', () => {
  it('lists every section of the old side panel, tabs marked', () => {
    expect(PANEL_SECTIONS.map((s) => s.key)).toEqual(['telemetry', 'nav2', 'pose', 'WAYPOINTS', 'ZONES', 'TELEOP']);
    expect(PANEL_SECTIONS.filter((s) => s.tab).map((s) => s.key)).toEqual(['WAYPOINTS', 'ZONES', 'TELEOP']);
  });

  it('opens the panel on the clicked section and closes it when the same icon is clicked again', () => {
    const closed = { open: false, section: 'nav2' };
    expect(nextPanelState(closed, 'ZONES')).toEqual({ open: true, section: 'ZONES' });
    expect(nextPanelState({ open: true, section: 'ZONES' }, 'WAYPOINTS')).toEqual({ open: true, section: 'WAYPOINTS' });
    expect(nextPanelState({ open: true, section: 'ZONES' }, 'ZONES')).toEqual({ open: false, section: 'ZONES' });
  });

  it('toggle button only opens/closes and keeps the section', () => {
    expect(nextPanelState({ open: true, section: 'pose' }, null)).toEqual({ open: false, section: 'pose' });
    expect(nextPanelState({ open: false, section: 'pose' }, null)).toEqual({ open: true, section: 'pose' });
  });
});

describe('fitCanvasSize (map gian theo khung)', () => {
  it('uses the full host size in whole pixels', () => {
    expect(fitCanvasSize(1234.7, 701.2)).toEqual({ width: 1234, height: 701 });
  });

  it('never collapses to an unusable size (hidden tab, first render)', () => {
    expect(fitCanvasSize(0, 0)).toEqual({ width: 320, height: 240 });
    expect(fitCanvasSize(NaN, 500)).toEqual({ width: 320, height: 500 });
  });
});

describe('ghi nho trang thai panel', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    };
  });

  it('defaults to an open panel on the telemetry section', () => {
    expect(loadPanelState()).toEqual({ open: true, section: 'telemetry' });
  });

  it('round-trips and ignores unknown or broken values', () => {
    savePanelState({ open: false, section: 'ZONES' });
    expect(loadPanelState()).toEqual({ open: false, section: 'ZONES' });
    localStorage.setItem(PANEL_STORAGE_KEY, '{"open":false,"section":"nope"}');
    expect(loadPanelState()).toEqual({ open: false, section: 'telemetry' });
    localStorage.setItem(PANEL_STORAGE_KEY, '{broken');
    expect(loadPanelState()).toEqual({ open: true, section: 'telemetry' });
  });

  it('works when storage is unavailable (private window)', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(loadPanelState()).toEqual({ open: true, section: 'telemetry' });
    expect(() => savePanelState({ open: false, section: 'nav2' })).not.toThrow();
  });
});
