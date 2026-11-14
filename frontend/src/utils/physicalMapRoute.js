import { executionConfig, executionError } from './workflowExecution';

export function unconfiguredRouteSteps(workflow) {
  return (workflow.steps || []).filter((step) => step.type === 'FOLLOW_ROUTE' && !step.params?.route_id);
}

export function workflowRouteTargets(workflows) {
  return workflows.filter((workflow) => !workflow.execution_config?.route
    && (workflow.steps || []).some((step) => step.type === 'FOLLOW_ROUTE'));
}

export function routeStepOnMap(workflow, stepId, routes, mapId) {
  const step = workflow?.steps?.find((s) => s.step_id === stepId && s.type === 'FOLLOW_ROUTE');
  if (!step) throw new Error('Chọn bước Đi theo tuyến cần cấu hình.');
  const bound = routes.find((route) => route.id === step.params?.route_id);
  return { step, route: bound?.execution_config?.route?.map_id === mapId ? bound : null,
    otherMap: bound && bound.execution_config?.route?.map_id !== mapId ? bound.execution_config.route.map_id : null };
}

export function newMapRoute(mapId) {
  return {
    name: 'Tuyến di chuyển mới', description: '', trigger_type: 'MANUAL', is_active: true,
    execution_config: { ...executionConfig(), route: { map_id: mapId, frame_id: 'map', points: [] } },
    steps: [],
  };
}

export function routePoint(x, y, endpoint = null) {
  return {
    id: `rp-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    endpoint_id: endpoint?.id || null,
    name: endpoint?.name || 'Điểm trung gian',
    x: Number(x), y: Number(y), yaw: Number(endpoint?.yaw || 0),
  };
}

export function routeWorkflow(draft) {
  const config = executionConfig(draft.execution_config);
  const route = config.route;
  if (!draft.name?.trim()) throw new Error('Nhập tên tuyến đường.');
  if (!route?.map_id || route.frame_id !== 'map') throw new Error('Tuyến cần gắn với bản đồ hợp lệ.');
  if (route.points.length < 2 || route.points.length > 200) throw new Error('Chọn từ 2 đến 200 điểm cho tuyến.');
  if (route.points.some((p) => ![p.x, p.y, p.yaw].every(Number.isFinite))) throw new Error('Tọa độ tuyến không hợp lệ.');
  const error = executionError(draft);
  if (error) throw new Error(error);
  return {
    ...draft,
    name: draft.name.trim(),
    execution_config: config,
    steps: route.points.map((point, index) => ({
      step_id: point.id, type: 'MOVE', title: `${index + 1}. ${point.name}`,
      params: {
        map_id: route.map_id, frame_id: 'map', target_type: point.endpoint_id ? 'WAYPOINT' : 'COORDINATES',
        target_waypoint_id: point.endpoint_id, target_value: point.endpoint_id || point.id,
        waypoint_name: point.name, target_x: point.x, target_y: point.y, target_yaw: point.yaw,
        from_waypoint: index ? route.points[index - 1].endpoint_id || route.points[index - 1].id : 'CURRENT', speed: 0.12, timeout_sec: 120,
      },
    })),
  };
}

export function moveRoutePoint(points, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= points.length) return points;
  const result = [...points];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export function expandWorkflowRoutes(workflow, routes) {
  const steps = (workflow.steps || []).flatMap((step) => {
    if (step.type !== 'FOLLOW_ROUTE') return [step];
    const route = routes.find((r) => r.id === step.params?.route_id && r.is_active);
    if (!route?.execution_config?.route) throw new Error('Tuyến không còn khả dụng. Chọn lại tuyến trong workflow.');
    const count = step.params.repeat_count ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Số vòng của tuyến phải từ 1 đến 100.');
    const moves = routeWorkflow({ ...route, trigger_type: 'MANUAL' }).steps;
    const expanded = Array.from({ length: count }, (_, round) => moves.map((move, index) => ({
      ...move, step_id: round === 0 && index === 0 ? step.step_id : `${step.step_id}::${round}::${index}`,
      params: { ...move.params, source_route_id: route.id },
    }))).flat();
    if (step.params.next_step_id) expanded[expanded.length - 1].params.next_step_id = step.params.next_step_id;
    return expanded;
  });
  if (steps.length > 2000) throw new Error('Workflow sau khi mở tuyến vượt 2000 bước. Giảm số vòng.');
  return { ...workflow, steps };
}
