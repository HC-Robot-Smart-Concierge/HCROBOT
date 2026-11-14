import { describe, expect, it } from 'vitest';
import { moveRoutePoint, newMapRoute, routePoint, routeWorkflow, expandWorkflowRoutes,
  unconfiguredRouteSteps, workflowRouteTargets, routeStepOnMap } from '../physicalMapRoute';

describe('Map routes with schedules', () => {
  it('includes unconfigured inactive templates for setup from a map', () => {
    const template = { id: 'flow', is_active: false, steps: [
      { step_id: 'a', type: 'FOLLOW_ROUTE', title: 'A', params: {} },
      { step_id: 'b', type: 'WAIT', params: { duration_sec: 5 } },
    ] };
    expect(unconfiguredRouteSteps(template).map((s) => s.step_id)).toEqual(['a']);
    expect(workflowRouteTargets([template, newMapRoute('lab'), { steps: [{ type: 'GREET' }] }])).toEqual([template]);
  });

  it('loads only the chosen step route on the current map without mutating other steps', () => {
    const a = { ...newMapRoute('map_a'), id: 'route-a' };
    const b = { ...newMapRoute('map_b'), id: 'route-b' };
    const flow = { steps: [
      { step_id: 'out', type: 'FOLLOW_ROUTE', params: { route_id: 'route-a' } },
      { step_id: 'back', type: 'FOLLOW_ROUTE', params: { route_id: 'route-b' } },
    ] };
    expect(routeStepOnMap(flow, 'out', [a, b], 'map_a').route).toBe(a);
    expect(routeStepOnMap(flow, 'back', [a, b], 'map_a')).toMatchObject({ route: null, otherMap: 'map_b' });
    expect(flow.steps[1].params.route_id).toBe('route-b');
    expect(() => routeStepOnMap(flow, 'missing', [a, b], 'map_a')).toThrow('Chọn bước');
  });
  it('resolves a reusable route step without repeating adjacent workflow actions', () => {
    const route = { ...newMapRoute('map_kho'), id: 'route-1' };
    route.execution_config.route.points = [routePoint(-1, 2), routePoint(3, 4)];
    const flow = { steps: [
      { step_id: 'hello', type: 'GREET' },
      { step_id: 'patrol', type: 'FOLLOW_ROUTE', params: { route_id: route.id, repeat_count: 2, next_step_id: 'bye' } },
      { step_id: 'bye', type: 'SPEAK' },
    ] };
    const result = expandWorkflowRoutes(flow, [route]);
    expect(result.steps.map((s) => s.type)).toEqual(['GREET', 'MOVE', 'MOVE', 'MOVE', 'MOVE', 'SPEAK']);
    expect(result.steps[1].step_id).toBe('patrol');
    expect(result.steps[4].params.next_step_id).toBe('bye');
    expect(flow.steps[1].type).toBe('FOLLOW_ROUTE');
    expect(() => expandWorkflowRoutes(flow, [])).toThrow('không còn khả dụng');
  });
  it('saves ordered physical coordinates and map separately from schedule triggers', () => {
    const draft = newMapRoute('map_kho');
    const a = routePoint(-1.2, 0.8, { id: 'dock', name: 'Dock', yaw: 1.57 });
    const b = routePoint(3.4, -0.2);
    draft.execution_config.route.points = [a, b, { ...a, id: 'return-dock' }];
    draft.trigger_type = 'SCHEDULE';
    draft.execution_config.repeat_count = 3;
    draft.execution_config.schedules = [{ time: '08:00', days: [0, 2], timezone: 'Asia/Ho_Chi_Minh', enabled: true }];
    const saved = JSON.parse(JSON.stringify(routeWorkflow(draft)));
    expect(saved.steps.map((step) => step.type)).toEqual(['MOVE', 'MOVE', 'MOVE']);
    expect(saved.steps.map((step) => step.params.target_x)).toEqual([-1.2, 3.4, -1.2]);
    expect(saved.steps[0].params).toMatchObject({ map_id: 'map_kho', frame_id: 'map', target_yaw: 1.57, target_waypoint_id: 'dock' });
    expect(saved.execution_config.schedules[0].days).toEqual([0, 2]);
    expect(saved.execution_config.repeat_count).toBe(3);
    expect(saved.execution_config.route.points).toEqual(draft.execution_config.route.points);
  });

  it('reorders points without mutating the draft and updates generated steps', () => {
    const draft = newMapRoute('lab');
    const points = [routePoint(0, 0), routePoint(1, 1), routePoint(2, 2)];
    draft.execution_config.route.points = moveRoutePoint(points, 2, -1);
    expect(points[1].x).toBe(1);
    expect(routeWorkflow(draft).steps.map((step) => step.params.target_x)).toEqual([0, 2, 1]);
    expect(moveRoutePoint(points, 0, -1)).toBe(points);
  });

  it('refuses incomplete routes, missing schedules, and non-finite coordinates', () => {
    const draft = newMapRoute('lab');
    expect(() => routeWorkflow(draft)).toThrow('2 đến 200');
    draft.execution_config.route.points = [routePoint(0, 0), routePoint(1, 1)];
    draft.trigger_type = 'SCHEDULE';
    expect(() => routeWorkflow(draft)).toThrow('lịch');
    draft.trigger_type = 'MANUAL';
    draft.execution_config.route.points[1].x = NaN;
    expect(() => routeWorkflow(draft)).toThrow('Tọa độ');
  });
});
