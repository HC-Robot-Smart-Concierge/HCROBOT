import { describe, it, expect } from 'vitest';
import {
  BUILTIN_SIMULATOR_WORKFLOWS,
  GAZEBO_LOBBY_WAYPOINTS as W,
  resolveMoveTarget,
} from '../workflowSimulatorUtils';

const move = (params, step_id) => ({ step_id, type: 'MOVE', params });
const at = (key) => ({ x: W[key].x, y: W[key].y });

describe('resolveMoveTarget', () => {
  it('moves untouched stock targets from the old 10 x 6 m lobby onto current waypoints', () => {
    expect(resolveMoveTarget(move({ target_value: 'MAIN_ENTRANCE', target_x: 5.2, target_y: 1 }, 'wf1-step-1'))).toEqual(at('MAIN_ENTRANCE'));
    expect(resolveMoveTarget(move({ target_value: 'FRONT_DESK', target_x: 6.4, target_y: 2.0 }))).toEqual(at('FRONT_DESK'));
    expect(resolveMoveTarget(move({ target_value: 'ELEVATOR', target_x: 7.7, target_y: 4.2 }))).toEqual(at('ELEVATOR'));
    expect(resolveMoveTarget(move({ target_value: 'CENTRAL_LOBBY', target_x: 4.8, target_y: 2.5 }))).toEqual(at('CENTRAL_LOBBY'));
    expect(resolveMoveTarget(move({ target_value: 'DOCK_LOBBY', target_x: 3.2, target_y: 2.8 }))).toEqual(at('ROBOT_STANDBY'));
  });

  it('treats (0, 0) as an unset placeholder for known destinations', () => {
    expect(resolveMoveTarget(move({ target_waypoint_id: 'wp-reception', target_x: 0, target_y: 0 }))).toEqual(at('FRONT_DESK'));
  });

  it('keeps targets a user has re-pointed or created', () => {
    expect(resolveMoveTarget(move({ target_value: 'FRONT_DESK', target_x: 11.0, target_y: 3.1 }))).toEqual({ x: 11.0, y: 3.1 });
    expect(resolveMoveTarget(move({ target_waypoint_id: 'wp-custom', target_x: 0, target_y: 0 }))).toEqual({ x: 0, y: 0 });
  });

  it('falls back to the waypoint table when no coordinates are stored', () => {
    const endpoints = [{ id: 'wp-custom', x: 4.4, y: 4.4 }];
    expect(resolveMoveTarget(move({ target_waypoint_id: 'wp-custom' }), endpoints)).toMatchObject({ x: 4.4, y: 4.4 });
    expect(resolveMoveTarget(move({ target_value: 'ELEVATOR' }))).toMatchObject(at('ELEVATOR'));
  });

  it('sends charger moves to the charging station shown on the map', () => {
    const goCharge = move({ target_type: 'CHARGER', target_value: 'CHARGER_STATION', target_x: 6.0, target_y: 9.6 });
    const mapped = [{ id: 'wp-a', type: 'WAYPOINT', x: 1, y: 1 }, { id: 'wp-c', type: 'CHARGER', x: 3.95, y: 6.6 }];
    expect(resolveMoveTarget(goCharge, mapped)).toEqual({ x: 3.95, y: 6.6 });
    expect(resolveMoveTarget(goCharge, [])).toEqual({ x: 6.0, y: 9.6 });
    expect(resolveMoveTarget(move({ target_type: 'CHARGER', target_value: 'CHARGER_STATION' }), [])).toMatchObject(at('CHARGER_STATION'));
  });

  it('built-in fallback workflows only use current lobby waypoints', () => {
    const moves = BUILTIN_SIMULATOR_WORKFLOWS.flatMap((wf) => wf.steps).filter((s) => s.type === 'MOVE');
    for (const step of moves) {
      const key = step.params.target_value;
      expect({ x: step.params.target_x, y: step.params.target_y }).toEqual(at(key));
    }
  });
});
