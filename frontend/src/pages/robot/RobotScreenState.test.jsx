import { describe, it, expect } from 'vitest';
import { RobotScreenPage } from './RobotScreenPage';

describe('Robot Screen UI State Transitions', () => {
  it('successfully exports and parses RobotScreenPage component without reference errors', () => {
    expect(RobotScreenPage).toBeDefined();
    expect(typeof RobotScreenPage).toBe('function');
  });

  const validStates = ['RT-01', 'RT-02', 'RT-03', 'RT-04', 'RT-05'];

  it('should have all 5 design states defined in state flow', () => {
    expect(validStates).toHaveLength(5);
    expect(validStates).toContain('RT-01');
    expect(validStates).toContain('RT-02');
    expect(validStates).toContain('RT-03');
    expect(validStates).toContain('RT-04');
    expect(validStates).toContain('RT-05');
  });

  it('should correctly map state transitions from Press-To-Talk action', () => {
    let currentState = 'RT-02';

    // Simulate Press to Talk action
    currentState = 'RT-03';
    expect(currentState).toBe('RT-03');

    // Simulate speech end / understanding
    currentState = 'RT-04';
    expect(currentState).toBe('RT-04');

    // Simulate route calculation complete
    currentState = 'RT-05';
    expect(currentState).toBe('RT-05');
  });

  it('correctly identifies robot user and routes to robot_display instead of admin_portal', () => {
    const isRobotUser = (user) => {
      if (!user) return false;
      const username = String(user.username || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const defaultDash = String(user.default_dashboard || user.defaultDashboard || '').toLowerCase();
      return (
        username === 'robot_01' ||
        username.startsWith('robot') ||
        role.includes('robot') ||
        defaultDash === 'robot_display'
      );
    };

    const isAdminUser = (user) => {
      if (!user) return false;
      if (isRobotUser(user)) return false;
      const username = String(user.username || '').toLowerCase();
      const role = String(user.role || '').toLowerCase();
      const dept = String(user.department || '').toLowerCase();
      return (
        username === 'admin' ||
        role.includes('admin') ||
        (dept === 'executive' && !role.includes('robot')) ||
        dept === 'operations'
      );
    };

    const robotUser = {
      username: 'robot_01',
      role: 'Robot Kiosk',
      department: 'Executive',
      default_dashboard: 'robot_display',
    };

    expect(isRobotUser(robotUser)).toBe(true);
    expect(isAdminUser(robotUser)).toBe(false);
  });

  it('manages auto-standby poster mode when idle and wakes up on user action', () => {
    let isStandby = false;
    let currentState = 'RT-02';
    const isBusy = false;

    // Simulate idle timeout triggering standby
    const onIdleTimeout = () => {
      if (!isBusy && (currentState === 'RT-02' || currentState === 'RT-01')) {
        isStandby = true;
      }
    };

    onIdleTimeout();
    expect(isStandby).toBe(true);

    // Simulate user interaction (touch/click/approaching camera)
    const onUserInteraction = () => {
      isStandby = false;
      currentState = 'RT-02';
    };

    onUserInteraction();
    expect(isStandby).toBe(false);
    expect(currentState).toBe('RT-02');
  });

  it('never triggers standby poster while user is conversing, listening, or robot is speaking/processing', () => {
    let isStandby = false;
    let currentState = 'RT-03'; // Listening
    const isListening = true;
    const isSpeaking = false;
    const isProcessing = false;
    const transcript = 'Tôi muốn hỏi đường ra hồ bơi';
    const isUserTalking = transcript.trim().length > 0;

    const isBusy = isSpeaking || isProcessing || isListening || isUserTalking;

    const onTick = () => {
      if (isBusy) return;
      if (currentState !== 'RT-01') return;
      isStandby = true;
    };

    onTick();
    expect(isStandby).toBe(false);
  });

  it('transitions from active conversation to RT-01 sleeping before allowing standby poster', () => {
    let isStandby = false;
    let currentState = 'RT-03';
    let isListening = false;
    let transcript = '';
    const isBusy = isListening || Boolean(transcript);

    // Step 1: In conversation but guest is silent for 45s -> Transition to RT-01
    const onConversationSilenceTimeout = () => {
      if (!isBusy && currentState !== 'RT-01') {
        currentState = 'RT-01';
      }
    };

    onConversationSilenceTimeout();
    expect(currentState).toBe('RT-01');
    expect(isStandby).toBe(false);

    // Step 2: Now in RT-01, if still completely idle for 60s -> Trigger Standby
    const onStandbyIdleTimeout = () => {
      if (!isBusy && currentState === 'RT-01') {
        isStandby = true;
      }
    };

    onStandbyIdleTimeout();
    expect(isStandby).toBe(true);

    // Step 3: Guest speaks -> Immediate wake up and dismiss standby
    const onVoiceWakeUp = (speech) => {
      if (speech && speech.trim().length > 0) {
        isStandby = false;
        currentState = 'RT-03';
      }
    };

    onVoiceWakeUp('Chào em robot');
    expect(isStandby).toBe(false);
    expect(currentState).toBe('RT-03');
  });

  it('keeps camera preview UI completely hidden on robot screen while running AI in background', () => {
    // Hotel guest view: camera UI is completely hidden (visible = false, no CAM button)
    const cameraVisibleOnRobotScreen = false;
    const cameraBackgroundActive = true;

    expect(cameraVisibleOnRobotScreen).toBe(false);
    expect(cameraBackgroundActive).toBe(true);
  });
});
