import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RosbridgeClient } from './rosbridgeService';

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
