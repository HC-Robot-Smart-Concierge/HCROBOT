import { describe, it, expect, vi } from 'vitest';
import {
  amclPoseIsReliable, composeMapPose, laserPointToMap, localizationFromManager, navigationBlockingReason, sendNav2Endpoint,
} from './physicalMapNavigation';

const now = 10000;
const config = { originX: -1, originY: -1, widthMeters: 4, heightMeters: 4 };
const ready = () => ({
  connected: true, runtime: { mode: 'NAVIGATION', activeMap: 'phong_test' }, mapId: 'phong_test',
  physical: true, localized: true, poseAt: now, costmapAt: now, healthAt: now, now,
  health: { pi_ws_connected: true, lidar_live: true, encoder_packets: 100, last_encoder_age_sec: 0.1 },
});
const grid = () => ({ header: { frame_id: 'map' }, info: { width: 40, height: 40, resolution: 0.1,
  origin: { position: { x: -1, y: -1 }, orientation: { z: 0, w: 1 } } }, data: Array(1600).fill(0) });
const target = { x: 1, y: 1, yaw: 0.6 };

describe('AMCL localization quality', () => {
  const message = (xVariance = 0.01, yVariance = 0.01, yawVariance = 0.01) => {
    const covariance = Array(36).fill(0);
    covariance[0] = xVariance;
    covariance[7] = yVariance;
    covariance[35] = yawVariance;
    return { pose: { pose: { position: { x: 1, y: 1 }, orientation: { z: 0, w: 1 } }, covariance } };
  };

  it('accepts a concentrated pose distribution', () => {
    expect(amclPoseIsReliable(message())).toBe(true);
  });
  it('rejects the recorded uncertain pose even though AMCL published it', () => {
    expect(amclPoseIsReliable(message(0.1909458, 0.4075255, 1.5188223))).toBe(false);
  });
  it.each([[0.07, 0.01, 0.01], [0.01, 0.07, 0.01], [0.01, 0.01, 0.2]])(
    'rejects excessive uncertainty (%s, %s, %s)', (x, y, yaw) => {
      expect(amclPoseIsReliable(message(x, y, yaw))).toBe(false);
    });
  it('accounts for the worst correlated horizontal direction', () => {
    const msg = message(0.04, 0.04);
    msg.pose.covariance[1] = msg.pose.covariance[6] = 0.03;
    expect(amclPoseIsReliable(msg)).toBe(false);
  });
  it('rejects missing, malformed and non-finite measurements', () => {
    expect(amclPoseIsReliable({})).toBe(false);
    expect(amclPoseIsReliable(message(-1))).toBe(false);
    expect(amclPoseIsReliable(message(NaN))).toBe(false);
    const msg = message();
    msg.pose.pose.position.x = Infinity;
    expect(amclPoseIsReliable(msg)).toBe(false);
  });
});

describe('Physical robot map-frame navigation', () => {
  it('does not present raw Pi odometry as map coordinates when TF is missing', () => {
    expect(composeMapPose(null, { x: 12.38, y: 0, yaw: 0 })).toBeNull();
  });

  it('corrects the screenshot odometry through map->odom before display', () => {
    const pose = composeMapPose({ x: -12, y: 1, yaw: 0 }, { x: 12.38, y: 0, yaw: 0.3 });
    expect(pose.x).toBeCloseTo(0.38);
    expect(pose.y).toBe(1);
    expect(pose.yaw).toBeCloseTo(0.3);
  });

  it('rotates odometry into the map frame', () => {
    const pose = composeMapPose({ x: 1, y: 2, yaw: Math.PI / 2 }, { x: 2, y: 0, yaw: 0 });
    expect(pose.x).toBeCloseTo(1);
    expect(pose.y).toBeCloseTo(4);
  });

  it('draws ROS laser degrees/distance with the measured laser offset', () => {
    const hit = laserPointToMap({ angle: 90, distance: 1 }, { x: 2, y: 3, yaw: Math.PI / 2 });
    expect(hit.x).toBeCloseTo(1);
    expect(hit.y).toBeCloseTo(3.08);
    expect(laserPointToMap({ angle: 0, distance: null }, { x: 0, y: 0, yaw: 0 })).toBeNull();
  });

  it('publishes a physical endpoint exactly once through Nav2 in map frame', () => {
    const client = { isConnected: true, publish: vi.fn(() => true) };
    sendNav2Endpoint(client, ready(), target, config, grid());
    expect(client.publish).toHaveBeenCalledOnce();
    const [topic, type, message] = client.publish.mock.calls[0];
    expect(topic).toBe('/goal_pose');
    expect(type).toBe('geometry_msgs/PoseStamped');
    expect(message.header.frame_id).toBe('map');
    expect(message.pose.position).toEqual({ x: 1, y: 1, z: 0 });
  });

  it.each([
    ['disconnected', { connected: false }],
    ['still exploring', { runtime: { mode: 'EXPLORING', activeMap: 'phong_test' } }],
    ['wrong map', { runtime: { mode: 'NAVIGATION', activeMap: 'layout2' } }],
    ['unknown map', { runtime: { mode: 'NAVIGATION', activeMap: null } }],
    ['not localized', { localized: false }],
    ['stale pose', { poseAt: 1 }],
    ['stale costmap', { costmapAt: 1 }],
    ['stale hardware state', { healthAt: 1 }],
    ['missing encoder', { health: { pi_ws_connected: true, lidar_live: true, encoder_packets: 0 } }],
    ['missing lidar', { health: { pi_ws_connected: true, lidar_live: false, encoder_packets: 10 } }],
    ['stale encoder', { health: { pi_ws_connected: true, lidar_live: true, encoder_packets: 10, last_encoder_age_sec: 2 } }],
  ])('does not navigate with %s', (_name, override) => {
    expect(navigationBlockingReason({ ...ready(), ...override })).toBeTruthy();
  });

  it.each([-1, 99, 100])('rejects unknown/blocked endpoint cost %s', (value) => {
    const costmap = grid();
    costmap.data[20 * 40 + 20] = value;
    const client = { isConnected: true, publish: vi.fn() };
    expect(() => sendNav2Endpoint(client, ready(), target, config, costmap)).toThrow(/vật cản/);
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('rejects endpoints outside the selected map and reports failed transmission', () => {
    const client = { isConnected: true, publish: vi.fn(() => false) };
    expect(() => sendNav2Endpoint(client, ready(), { ...target, x: 20 }, config, grid())).toThrow(/ngoài bản đồ/);
    expect(client.publish).not.toHaveBeenCalled();
    expect(() => sendNav2Endpoint(client, ready(), target, config, grid())).toThrow(/Mất kết nối/);
  });

  it('shows the localization manager reason when the robot is not localized', () => {
    const reason = 'Mất định vị: LiDAR chỉ còn khớp 20% bản đồ. Đã dừng xe.';
    expect(navigationBlockingReason({ ...ready(), localized: false, localizationReason: reason })).toBe(reason);
  });
});

describe('localizationFromManager (/localization/state tu robot)', () => {
  const at = 1_000_000;
  const msg = (state, extra = {}) => ({ state, reason: `ly do ${state}`, score: 0.83, ...extra });

  it('trusts only a recent LOCALIZED message', () => {
    const loc = localizationFromManager(msg('LOCALIZED'), at, at + 1000);
    expect(loc).toMatchObject({ fresh: true, localized: true, tone: 'good' });
    expect(loc.label).toContain('83%');
  });

  it.each(['UNLOCALIZED', 'LOCALIZING', 'LOCALIZATION_LOST'])('blocks navigation while %s', (state) => {
    const loc = localizationFromManager(msg(state), at, at + 1000);
    expect(loc.fresh).toBe(true);
    expect(loc.localized).toBe(false);
    expect(loc.reason).toBe(`ly do ${state}`);
  });

  it('reports no manager when it is silent or absent (Web falls back to its own AMCL check)', () => {
    expect(localizationFromManager(msg('LOCALIZED'), at, at + 6000).fresh).toBe(false);
    expect(localizationFromManager(null, 0, at).fresh).toBe(false);
  });
});
