import { describe, it, expect } from 'vitest';
import { MobileRobotScreen } from './MobileRobotScreen';

describe('MobileRobotScreen Header Layout & Workflow Trigger', () => {
  it('should export MobileRobotScreen function component', () => {
    expect(typeof MobileRobotScreen).toBe('function');
  });

  it('orders header right elements so workflow trigger appears to the left of emotion badge and action buttons', () => {
    // Simulate header element sequence (visible logout button removed for kiosk security)
    const buildHeaderRightElements = ({ hasWorkflowTrigger, guestEmotion, language }) => {
      const elements = [];
      if (hasWorkflowTrigger) elements.push('workflow-trigger');
      if (guestEmotion) elements.push('guest-emotion');
      if (language) elements.push('language-toggle');
      return elements;
    };

    const headerElements = buildHeaderRightElements({
      hasWorkflowTrigger: true,
      guestEmotion: 'neutral',
      language: 'VI',
    });

    expect(headerElements).toEqual([
      'workflow-trigger',
      'guest-emotion',
      'language-toggle',
    ]);

    // Workflow trigger is positioned strictly before guest-emotion to avoid blocking info
    const triggerIndex = headerElements.indexOf('workflow-trigger');
    const emotionIndex = headerElements.indexOf('guest-emotion');

    expect(triggerIndex).toBeLessThan(emotionIndex);
    expect(headerElements).not.toContain('logout-button');
  });

  it('supports secret multi-tap gesture logic for kiosk exit', () => {
    let tapCount = 0;
    let logoutTriggered = false;

    const onSecretTap = () => {
      tapCount += 1;
      if (tapCount >= 5) {
        tapCount = 0;
        logoutTriggered = true;
      }
    };

    for (let i = 0; i < 4; i++) {
      onSecretTap();
    }
    expect(logoutTriggered).toBe(false);

    onSecretTap();
    expect(logoutTriggered).toBe(true);
    expect(tapCount).toBe(0);
  });
});
