if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseLaserScan, RosbridgeClient } from './rosbridgeService';

describe('parseLaserScan', () => {
  it('ignores rosbridge null/invalid ranges without crashing', () => {
    const points = parseLaserScan({
      angle_min: 0,
      angle_increment: Math.PI / 2,
      range_min: 0.1,
      range_max: 12,
      ranges: [null, 1.5, '2.0', Number.POSITIVE_INFINITY, 0.05, 13],
      intensities: [0, 20, 30, 40, 50, 60],
    });

    expect(points).toEqual([
      { angle: 90, distance: 1.5, quality: 20 },
    ]);
  });
});

describe('RosbridgeClient connection events', () => {
  it('signals connection readiness using the onOpen/onClose API used by the map screen', () => {
    const Original = globalThis.WebSocket;
    class FakeSocket { static OPEN = 1; static CONNECTING = 0; close() {} }
    globalThis.WebSocket = FakeSocket;
    try {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const client = new RosbridgeClient('ws://test', { onOpen, onClose, autoReconnect: false });
      client.connect();
      client.ws.onopen();
      expect(client.isConnected).toBe(true);
      expect(onOpen).toHaveBeenCalledOnce();
      client.ws.onclose();
      expect(client.isConnected).toBe(false);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      globalThis.WebSocket = Original;
    }
  });
});

describe('RosbridgeClient Map Management Methods', () => {
  let client;
  let sentMessages;

  beforeEach(() => {
    client = new RosbridgeClient('ws://127.0.0.1:9090', { autoReconnect: false });
    sentMessages = [];
    client.ws = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn((data) => {
        sentMessages.push(JSON.parse(data));
      }),
    };
    client.isConnected = true;
  });

  it('togglePauseMap publishes empty message to /robot/pause_map', () => {
    client.togglePauseMap();

    const publishMsg = sentMessages.find(
      (m) => m.op === 'publish' && m.topic === '/robot/pause_map'
    );
    expect(publishMsg).toBeDefined();
    expect(publishMsg.type).toBe('std_msgs/Empty');
    expect(publishMsg.msg).toEqual({});
  });

  it('resetMap publishes empty message to /robot/reset_map', () => {
    client.resetMap();

    const publishMsg = sentMessages.find(
      (m) => m.op === 'publish' && m.topic === '/robot/reset_map'
    );
    expect(publishMsg).toBeDefined();
    expect(publishMsg.type).toBe('std_msgs/Empty');
    expect(publishMsg.msg).toEqual({});
  });

  it('saveSlamMap publishes map name to /robot/save_map', () => {
    client.saveSlamMap('room_test_1');

    const publishMsg = sentMessages.find(
      (m) => m.op === 'publish' && m.topic === '/robot/save_map'
    );
    expect(publishMsg).toBeDefined();
    expect(publishMsg.type).toBe('std_msgs/String');
    expect(publishMsg.msg).toEqual({ data: 'room_test_1' });
  });
});
