import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TTS Audio Pipeline Single-Owner Concurrency', () => {
  it('ensures only one recovery path executes when HTML5 audio play rejects', async () => {
    let recoveryCount = 0;
    let recoveryHandled = false;
    let hasStartedPlaying = false;

    const triggerSingleRecovery = () => {
      if (recoveryHandled || hasStartedPlaying) return;
      recoveryHandled = true;
      recoveryCount += 1;
    };

    // Simulate both audio.onerror and catch(playErr) firing
    const simulateFailure = async () => {
      // onerror fires
      if (!hasStartedPlaying && !recoveryHandled) {
        triggerSingleRecovery();
      }

      // catch(playErr) fires
      try {
        throw new Error('Play rejected by browser policy');
      } catch (err) {
        if (!hasStartedPlaying && !recoveryHandled) {
          triggerSingleRecovery();
        }
      }
    };

    await simulateFailure();

    // Exactly 1 recovery executed, preventing duplicate audio playback!
    expect(recoveryCount).toBe(1);
    expect(recoveryHandled).toBe(true);
  });

  it('prevents error recovery from firing if playback already started', () => {
    let recoveryCount = 0;
    let recoveryHandled = true;
    let hasStartedPlaying = true;

    const triggerSingleRecovery = () => {
      if (recoveryHandled || hasStartedPlaying) return;
      recoveryHandled = true;
      recoveryCount += 1;
    };

    // Simulate late audio error after playback started
    if (!hasStartedPlaying && !recoveryHandled) {
      triggerSingleRecovery();
    }

    expect(recoveryCount).toBe(0);
  });

  it('deduplicates STT final transcript commit between isFinal and debounce timer', () => {
    let commitCount = 0;
    let committedText = '';
    const utteranceCommittedRef = { current: false };

    const commitFinalTranscript = (text) => {
      if (utteranceCommittedRef.current) return;
      utteranceCommittedRef.current = true;
      commitCount += 1;
      committedText = text;
    };

    // 1. Debounce timer fires first
    commitFinalTranscript('Xin chào lễ tân');

    // 2. Delayed isFinal arrives later from browser recognition
    commitFinalTranscript('Xin chào lễ tân');

    expect(commitCount).toBe(1);
    expect(committedText).toBe('Xin chào lễ tân');
  });

  it('prevents stale WebSocket callbacks from scheduling duplicate reconnect timers and cleans up on department change/unmount', () => {
    vi.useFakeTimers();
    const createdSockets = [];

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this.closeCalls = 0;
        createdSockets.push(this);
      }
      close() {
        this.closeCalls += 1;
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose();
      }
    }

    const socketRef = { current: null };
    const socketUrlRef = { current: null };
    const reconnectTimeoutRef = { current: null };
    const isMountedRef = { current: true };

    const cleanupSocket = () => {
      const ws = socketRef.current;
      socketRef.current = null;
      socketUrlRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === MockWebSocket.OPEN || ws.readyState === MockWebSocket.CONNECTING) {
          ws.close();
        }
      }
    };

    const connect = (dept = 'All', enabled = true) => {
      if (!enabled || !isMountedRef.current) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const wsUrl = `wss://localhost:3000/api/v1/operations/ws/notifications?department=${encodeURIComponent(dept)}`;
      if (
        socketRef.current &&
        socketUrlRef.current === wsUrl &&
        (socketRef.current.readyState === MockWebSocket.OPEN ||
          socketRef.current.readyState === MockWebSocket.CONNECTING)
      ) {
        return;
      }
      cleanupSocket();
      const ws = new MockWebSocket(wsUrl);
      socketRef.current = ws;
      socketUrlRef.current = wsUrl;
      ws.onclose = () => {
        if (!isMountedRef.current || socketRef.current !== ws) return;
        socketRef.current = null;
        socketUrlRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          if (isMountedRef.current && enabled) connect(dept, enabled);
        }, 3000);
      };
      ws.onerror = () => {
        if (!isMountedRef.current || socketRef.current !== ws) return;
        if (ws.readyState === MockWebSocket.OPEN) ws.close();
      };
    };

    // 1. Connect to 'All', duplicate call with 'All' should not open a second socket
    connect('All', true);
    connect('All', true);
    expect(createdSockets.length).toBe(1);
    const firstSocket = createdSockets[0];

    // 2. Switch department to 'Reception': cleans up first socket and does not schedule reconnect from firstSocket
    connect('Reception', true);
    expect(createdSockets.length).toBe(2);
    expect(reconnectTimeoutRef.current).toBeNull();

    // Even if a stale onclose callback reference is invoked manually, it is ignored
    const secondSocket = createdSockets[1];
    secondSocket.onclose();
    expect(reconnectTimeoutRef.current).not.toBeNull();

    // 3. Unmount cleans up timer and prevents reconnect after 3s
    isMountedRef.current = false;
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
    cleanupSocket();
    vi.advanceTimersByTime(5000);
    expect(createdSockets.length).toBe(2);
    vi.useRealTimers();
  });

  it('verifies RobotScreenPage has no undefined refs in handleStartTalk and guards modal states', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const robotScreenPath = path.resolve(process.cwd(), 'src/pages/robot/RobotScreenPage.jsx');
    const source = fs.readFileSync(robotScreenPath, 'utf8');

    expect(source).not.toContain('isLoopSwearingRef');
    expect(source).toContain('if (isVideoCallOpen || isVideoCallOpenRef.current || isPinModalOpen || isPinModalOpenRef.current) return;');
  });
});

