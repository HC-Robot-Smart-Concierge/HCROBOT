import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseOccupancyGrid,
  parseLaserScan,
  createGoalPoseMsg,
  createCmdVelMsg,
  quaternionToYaw,
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
} from './rosbridgeService';

describe('rosbridgeService Logic & Helpers', () => {
  it('should parse ROS 2 OccupancyGrid into GridData and Metadata correctly', () => {
    const mockOccGrid = {
      header: { frame_id: 'map' },
      info: {
        width: 100,
        height: 100,
        resolution: 0.05,
        origin: {
          position: { x: -2.5, y: -2.5, z: 0 },
        },
      },
      data: new Array(100 * 100).fill(0),
    };

    const parsed = parseOccupancyGrid(mockOccGrid);
    expect(parsed).not.toBeNull();
    expect(parsed.gridData.length).toBe(10000);
    expect(parsed.metadata.width).toBe(100);
    expect(parsed.metadata.height).toBe(100);
    expect(parsed.metadata.resolution).toBe(0.05);
    expect(parsed.metadata.origin_x).toBe(-2.5);
    expect(parsed.metadata.origin_y).toBe(-2.5);
  });

  it('should handle null or invalid OccupancyGrid safely', () => {
    expect(parseOccupancyGrid(null)).toBeNull();
    expect(parseOccupancyGrid({})).toBeNull();
  });

  it('should parse ROS 2 LaserScan message into polar scan points', () => {
    const mockScan = {
      angle_min: 0,
      angle_increment: Math.PI / 2, // 90 deg steps
      ranges: [1.5, 2.0, 3.5, 5.0],
      intensities: [100, 100, 100, 100],
      range_min: 0.1,
      range_max: 10.0,
    };

    const points = parseLaserScan(mockScan);
    expect(points.length).toBe(4);
    expect(points[0].angle).toBe(0);
    expect(points[0].distance).toBe(1.5);
    expect(points[1].angle).toBe(90);
    expect(points[1].distance).toBe(2.0);
  });

  it('should create valid Nav2 GoalPose message with quaternion orientation', () => {
    const goalMsg = createGoalPoseMsg(2.5, 3.8, Math.PI / 2);
    expect(goalMsg.header.frame_id).toBe('map');
    expect(goalMsg.pose.position.x).toBe(2.5);
    expect(goalMsg.pose.position.y).toBe(3.8);
    expect(goalMsg.pose.orientation.z).toBeCloseTo(Math.sin(Math.PI / 4));
    expect(goalMsg.pose.orientation.w).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('should create valid Twist /cmd_vel message for robot motion', () => {
    const cmdMsg = createCmdVelMsg(0.25, -0.5);
    expect(cmdMsg.linear.x).toBe(0.25);
    expect(cmdMsg.linear.y).toBe(0.0);
    expect(cmdMsg.angular.z).toBe(-0.5);
  });

  it('should convert Quaternion (z, w) to Yaw angle accurately', () => {
    const yaw = quaternionToYaw(0, 1);
    expect(yaw).toBe(0);

    const yaw90 = quaternionToYaw(Math.sin(Math.PI / 4), Math.cos(Math.PI / 4));
    expect(yaw90).toBeCloseTo(Math.PI / 2);
  });
});

describe('RosbridgeClient Class', () => {
  let mockWs;

  beforeEach(() => {
    mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
    };
    const MockWebSocket = vi.fn().mockImplementation(() => mockWs);
    MockWebSocket.OPEN = 1;
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;
    global.WebSocket = MockWebSocket;
  });

  it('should connect and publish op messages over WebSocket', () => {
    const client = new RosbridgeClient('ws://127.0.0.1:9090', { autoReconnect: false });
    client.connect();

    // Trigger onopen
    mockWs.onopen();
    expect(client.isConnected).toBe(true);

    // Subscribe
    const listener = vi.fn();
    client.subscribe(ROS_TOPICS.MAP, ROS_MSG_TYPES.OCCUPANCY_GRID, listener);

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        op: 'subscribe',
        topic: ROS_TOPICS.MAP,
        type: ROS_MSG_TYPES.OCCUPANCY_GRID,
      })
    );

    // Publish goal
    client.publishGoal(1.0, 2.0, 0);
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"topic":"/goal_pose"')
    );

    client.disconnect();
    expect(mockWs.close).toHaveBeenCalled();
  });
});
