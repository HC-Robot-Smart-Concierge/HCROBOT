const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const finite = (value) => value !== '' && value != null && Number.isFinite(Number(value));

export function stepSetup(step, routes = []) {
  const p = step.params || {};
  const issues = [];
  let summary = step.title || step.type;
  switch (step.type) {
    case 'WAIT':
      if (!finite(p.duration_sec) || Number(p.duration_sec) <= 0 || Number(p.duration_sec) > 3600) issues.push('Thời gian chờ phải lớn hơn 0 và không quá 3600 giây.');
      summary = `Chờ ${p.duration_sec ?? 5} giây`;
      break;
    case 'FOLLOW_ROUTE': {
      const route = routes.find((r) => r.id === p.route_id && r.is_active);
      if (!route?.execution_config?.route) issues.push('Chọn tuyến đường còn khả dụng.');
      const count = p.repeat_count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > 100) issues.push('Số vòng của tuyến phải từ 1 đến 100.');
      summary = route ? `${route.name} · ${count} vòng` : 'Chưa chọn tuyến đường';
      break;
    }
    case 'MOVE':
      if (!hasText(p.target_waypoint_id) && !hasText(p.target_value) && !(finite(p.target_x) && finite(p.target_y))) issues.push('Chọn điểm đến hoặc nhập tọa độ X, Y.');
      summary = p.waypoint_name || p.target_waypoint_id || p.target_value || 'Chưa chọn điểm đến';
      break;
    case 'GREET':
      if (!hasText(p.greeting_text) && !hasText(p.text)) issues.push('Nhập lời chào.');
      summary = p.greeting_text || p.text || 'Chưa nhập lời chào';
      break;
    case 'SPEAK':
      if (!hasText(p.speech_text) && !hasText(p.text)) issues.push('Nhập nội dung cần phát.');
      summary = p.speech_text || p.text || 'Chưa nhập nội dung';
      break;
    case 'CHOICE': {
      const options = Array.isArray(p.options) ? p.options : [];
      if (options.length < 2 || options.some((o) => !hasText(o.label))) issues.push('Thêm ít nhất hai lựa chọn có tên.');
      summary = options.map((o) => o.label).filter(Boolean).join(' / ') || 'Chưa có lựa chọn';
      break;
    }
    case 'SHOW':
      if (!hasText(p.screen_mode) && !hasText(p.screen_type) && !hasText(p.content_id)) issues.push('Chọn nội dung hiển thị.');
      summary = p.display_banner || p.screen_mode || p.content_id || 'Chưa chọn nội dung';
      break;
    case 'COMMUNICATE': summary = p.initial_prompt || 'Đối thoại với khách'; break;
    default: break;
  }
  if (p.speed !== undefined && (!finite(p.speed) || Number(p.speed) <= 0)) issues.push('Vận tốc phải lớn hơn 0.');
  return { ready: issues.length === 0, issues, summary: String(summary ?? '') };
}

export function selectedStepIndex(steps, selectedId) {
  const index = steps.findIndex((step) => step.step_id === selectedId);
  return index >= 0 ? index : steps.length ? 0 : -1;
}
