import { describe, expect, it } from 'vitest';
import { moveRoutePoint, newMapRoute, routePoint, routeWorkflow, expandWorkflowRoutes,
  unconfiguredRouteSteps, workflowRouteTargets, routeStepOnMap, routeIsClosed,
  closeRoutePoints, pickRoutePoints, routePointRole, physicalWorkflowForMap } from '../physicalMapRoute';

describe('Starting the configured workflow from Physical Map', () => {
  const route = { ...newMapRoute('lab'), id: 'route-a' };
  route.execution_config.route.points = [routePoint(0, 0), routePoint(1, 1)];
  const workflow = { id: 'wf-a', is_active: false, trigger_type: 'MANUAL',
    execution_config: { execution_mode: 'SCREEN', repeat_count: 2 }, steps: [
      { step_id: 'a', type: 'FOLLOW_ROUTE', params: { route_id: 'route-a', repeat_count: 1 } },
      { step_id: 'b', type: 'WAIT', params: { duration_sec: 5 } },
    ] };

  it('prepares robot mode while preserving workflow steps, timing and route bindings', () => {
    const result = physicalWorkflowForMap(workflow, [route], 'lab');
    expect(result.is_active).toBe(true);
    expect(result.execution_config).toMatchObject({ execution_mode: 'ROBOT', repeat_count: 2 });
    expect(result.steps).toEqual(workflow.steps);
    expect(workflow.is_active).toBe(false);
    expect(workflow.execution_config.execution_mode).toBe('SCREEN');
  });

  it('blocks activation until every route step is configured', () => {
    const draft = { ...workflow, steps: [...workflow.steps, { type: 'FOLLOW_ROUTE', params: {} }] };
    expect(() => physicalWorkflowForMap(draft, [route], 'lab')).toThrow('Còn bước chưa có tuyến');
    expect(() => physicalWorkflowForMap(workflow, [], 'lab')).toThrow('không còn khả dụng');
    expect(() => physicalWorkflowForMap(workflow, [route], 'other-map')).toThrow('cùng bản đồ');
  });

  it('does not enable robot mode for unsupported steps or invalid schedules', () => {
    expect(() => physicalWorkflowForMap({ ...workflow, steps: [...workflow.steps, { type: 'GREET' }] }, [route], 'lab')).toThrow('Xe thật hiện hỗ trợ');
    expect(() => physicalWorkflowForMap({ ...workflow, trigger_type: 'SCHEDULE' }, [route], 'lab')).toThrow('lịch');
  });
});

describe('Route endpoints and closing loops', () => {
  it('labels the first, intermediate and last positions without requiring landmarks', () => {
    const points = [routePoint(0, 0), routePoint(2, 1), routePoint(3, 0)];
    expect(points.map((_, index) => routePointRole(points, index))).toEqual(['Điểm đầu', 'Điểm trung gian', 'Điểm cuối']);
    expect(routeIsClosed(points)).toBe(false);
  });

  it('snaps a click near the start to an exact return leg that survives saving and execution', () => {
    const points = [routePoint(0, 0, { id: 'dock', name: 'Dock', yaw: 1.2 }), routePoint(2, 1), routePoint(3, 0)];
    const closed = pickRoutePoints(points, routePoint(0.04, 0.03), true);
    expect(routeIsClosed(closed)).toBe(true);
    expect(closed.at(-1)).toMatchObject({ x: 0, y: 0, yaw: 1.2, endpoint_id: 'dock' });
    expect(new Set(closed.map((point) => point.id)).size).toBe(4);
    expect(points).toHaveLength(3);
    expect(routePointRole(closed, 0)).toBe('Điểm đầu / cuối');
    expect(routePointRole(closed, 3)).toBe('Quay về điểm đầu');
    const draft = newMapRoute('lab');
    draft.execution_config.route.points = closed;
    const saved = JSON.parse(JSON.stringify(routeWorkflow(draft)));
    expect(saved.steps.map((step) => [step.params.target_x, step.params.target_y])).toEqual([[0, 0], [2, 1], [3, 0], [0, 0]]);
    expect(routeIsClosed(saved.execution_config.route.points)).toBe(true);
    expect(pickRoutePoints(closed, routePoint(5, 5))).toBe(closed);
    expect(closeRoutePoints(closed)).toBe(closed);
  });

  it('closes routes made only of free map positions and can reopen or change the start', () => {
    const closed = closeRoutePoints([routePoint(0, 0), routePoint(1, 1), routePoint(2, 0)]);
    const open = closed.slice(0, -1);
    expect(routeIsClosed(open)).toBe(false);
    expect(pickRoutePoints(open, routePoint(3, 3))).toHaveLength(4);
    const reordered = closeRoutePoints(moveRoutePoint(open, 0, 1));
    expect(routeIsClosed(reordered)).toBe(true);
    expect(reordered.at(-1).x).toBe(1);
    expect(reordered.at(-1).y).toBe(1);
  });

  it('requires a different destination and reserves space for the return leg', () => {
    const first = [routePoint(0, 0)];
    expect(pickRoutePoints(first, routePoint(0, 0), true)).toBe(first);
    const full = Array.from({ length: 200 }, (_, i) => routePoint(i, 0));
    expect(() => closeRoutePoints(full)).toThrow('200');
    expect(() => pickRoutePoints(full, routePoint(201, 0))).toThrow('200');
    expect(closeRoutePoints(full.slice(0, 199))).toHaveLength(200);
  });
});

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
