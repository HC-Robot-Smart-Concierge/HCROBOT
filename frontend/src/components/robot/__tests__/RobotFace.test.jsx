import React from 'react';
import { describe, it, expect } from 'vitest';
import { RobotFace } from '../RobotFace';

describe('RobotFace Component UI rendering tests', () => {
  it('renders sleeping mode with visible non-zero height classes across sizes', () => {
    const mobileElement = RobotFace({ mode: 'sleeping', size: 'mobile' });
    expect(mobileElement).toBeDefined();
    expect(mobileElement.props.className).toContain('min-h-[140px]');

    // Closed eyes children
    const eyeContainer = mobileElement.props.children;
    const eyes = eyeContainer.props.children;
    expect(eyes).toHaveLength(2);
    expect(eyes[0].props.className).toContain('h-[7px]');
    expect(eyes[0].props.className).toContain('w-[135px]');
    expect(eyes[1].props.className).toContain('h-[7px]');
    expect(eyes[1].props.className).toContain('w-[135px]');

    const defaultElement = RobotFace({ mode: 'sleeping' });
    const defaultEyes = defaultElement.props.children.props.children;
    expect(defaultEyes[0].props.className).toContain('h-[8px]');
    expect(defaultEyes[0].props.className).toContain('w-[170px]');

    const compactElement = RobotFace({ mode: 'sleeping', compact: true });
    const compactEyes = compactElement.props.children.props.children;
    expect(compactEyes[0].props.className).toContain('h-[6px]');
    expect(compactEyes[0].props.className).toContain('w-[105px]');
  });

  it('renders welcome mode with svg eyes', () => {
    const welcomeElement = RobotFace({ mode: 'welcome', size: 'mobile' });
    expect(welcomeElement.props['data-testid']).toBe('robot-face-welcome');
  });

  it('renders processing mode with svg spinner', () => {
    const processingElement = RobotFace({ mode: 'processing', size: 'mobile' });
    expect(processingElement.props['data-testid']).toBe('robot-face-processing');
  });
});

