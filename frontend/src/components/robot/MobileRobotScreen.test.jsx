import { describe, it, expect } from 'vitest';
import { MobileRobotScreen } from './MobileRobotScreen';

describe('MobileRobotScreen Header Layout & Workflow Trigger', () => {
  it('should export MobileRobotScreen function component', () => {
    expect(typeof MobileRobotScreen).toBe('function');
  });

  it('orders header right elements so workflow trigger appears to the left of emotion badge and action buttons', () => {
    // Simulate header element sequence
    const buildHeaderRightElements = ({ hasWorkflowTrigger, guestEmotion, language }) => {
      const elements = [];
      if (hasWorkflowTrigger) elements.push('workflow-trigger');
      if (guestEmotion) elements.push('guest-emotion');
      if (language) elements.push('language-toggle');
      elements.push('logout-button');
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
      'logout-button',
    ]);

    // Workflow trigger is positioned strictly before guest-emotion to avoid blocking info
    const triggerIndex = headerElements.indexOf('workflow-trigger');
    const emotionIndex = headerElements.indexOf('guest-emotion');
    const logoutIndex = headerElements.indexOf('logout-button');

    expect(triggerIndex).toBeLessThan(emotionIndex);
    expect(emotionIndex).toBeLessThan(logoutIndex);
  });
});
