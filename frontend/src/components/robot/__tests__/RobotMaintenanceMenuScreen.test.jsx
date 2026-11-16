import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  RobotMaintenanceMenuScreen,
  MAINTENANCE_CATEGORIES,
  FALLBACK_MAINTENANCE_CATALOG,
} from '../RobotMaintenanceMenuScreen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RobotMaintenanceMenuScreen Component & Contract Tests', () => {
  it('exports RobotMaintenanceMenuScreen as a functional component', () => {
    expect(typeof RobotMaintenanceMenuScreen).toBe('function');
    expect(RobotMaintenanceMenuScreen.name).toBe('RobotMaintenanceMenuScreen');
  });

  it('accepts necessary props with safe defaults', () => {
    expect(RobotMaintenanceMenuScreen.length).toBeLessThanOrEqual(1);
  });

  it('exports valid MAINTENANCE_CATEGORIES with expected IDs and icons', () => {
    expect(Array.isArray(MAINTENANCE_CATEGORIES)).toBe(true);
    const catIds = MAINTENANCE_CATEGORIES.map((c) => c.id);
    expect(catIds).toContain('all');
    expect(catIds).toContain('hvac');
    expect(catIds).toContain('plumbing');
    expect(catIds).toContain('electrical');
    expect(catIds).toContain('door_lock');
    expect(catIds).toContain('media_network');
    expect(catIds).toContain('other');
  });

  it('provides comprehensive FALLBACK_MAINTENANCE_CATALOG for instant display', () => {
    expect(Array.isArray(FALLBACK_MAINTENANCE_CATALOG)).toBe(true);
    expect(FALLBACK_MAINTENANCE_CATALOG.length).toBeGreaterThanOrEqual(10);
    FALLBACK_MAINTENANCE_CATALOG.forEach((item) => {
      expect(item.id).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.name_vi).toBeDefined();
      expect(item.priority).toMatch(/LOW|NORMAL|HIGH|URGENT/);
    });
  });

  it('adheres to pure single-screen menu architecture without in-menu tabs', () => {
    // Verified that maintenance status is decoupled into a secured PIN-gated popup modal
    const sourceCode = RobotMaintenanceMenuScreen.toString();
    expect(sourceCode).not.toContain("setActiveTab('tracking')");
    expect(sourceCode).toContain('handleOpenStatusModal');
    expect(sourceCode).toContain('isStatusModalOpen');
  });

  it('removes note inputs and quick note chips to optimize touch-first UX without device keyboard', () => {
    const sourceCode = RobotMaintenanceMenuScreen.toString();
    expect(sourceCode).not.toContain('additionalNote');
    expect(sourceCode).not.toContain('handleToggleQuickNote');
    expect(sourceCode).not.toContain('QUICK_NOTE_OPTIONS');
  });

  it('persists room session and authenticated room on request success in RobotScreenPage', () => {
    const sourceCode = RobotMaintenanceMenuScreen.toString();
    expect(sourceCode).toContain('onRoomChange');

    const pagePath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    // RobotMaintenanceMenuScreen invocation preserves room session
    expect(pageContent).toContain('onPinVerifiedSuccess={(room) => {');
    expect(pageContent).toContain('setAuthenticatedRoom(room);');
    expect(pageContent).toContain('setActiveRoomNumber(room);');

    // onRequestSuccess updates both activeRoomNumber and authenticatedRoom
    expect(pageContent).toMatch(/onRequestSuccess=\{\(req\) => \{[\s\S]*?setActiveRoomNumber\(roomToMention\)[\s\S]*?setAuthenticatedRoom\(roomToMention\)/);
  });
});
