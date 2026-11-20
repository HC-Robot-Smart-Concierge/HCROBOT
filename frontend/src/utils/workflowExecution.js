export const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function executionConfig(value = {}) {
  return { execution_mode: 'SCREEN', robot_id: 'RC-001', repeat_mode: 'COUNT', repeat_count: 1, interval_seconds: 0, schedules: [], ...value };
}

export function isChargerMove(step) {
  return step.type === 'MOVE' && step.params?.target_type === 'CHARGER' && step.params?.target_x == null;
}

export function executionError(workflow, { allowDraft = false, forSave = false } = {}) {
  const config = executionConfig(workflow.execution_config);
  if (!['SCREEN', 'ROBOT'].includes(config.execution_mode)) return 'Chọn chế độ thực thi hợp lệ.';
  if (config.execution_mode === 'ROBOT') {
    if (!forSave && (config.event_branches || []).some((b) => b.event === 'LOW_BATTERY')) return 'Nhánh pin yếu chưa chạy được trên xe thật (đợt 2). Gỡ nhánh để chạy.';
    if (!forSave && (workflow.steps || []).some(isChargerMove)) return 'Bước Về trạm sạc gần nhất chưa chạy được trên xe thật (đợt 2). Gỡ bước để chạy.';
    if ((workflow.steps || []).some((s) => !['MOVE', 'FOLLOW_ROUTE', 'WAIT'].includes(s.type))) return 'Xe thật hiện hỗ trợ Di chuyển, Đi theo tuyến và Chờ. Các bước giao tiếp dùng chế độ màn hình.';
    if ((workflow.steps || []).some((s) => s.type === 'MOVE' && !isChargerMove(s) && !s.params?.map_id)) return 'Bước MOVE cần gắn map. Hãy dùng bước Đi theo tuyến với tuyến lưu từ Physical Map.';
  }
  if (!['COUNT', 'CONTINUOUS'].includes(config.repeat_mode)) return 'Chọn chế độ lặp hợp lệ.';
  if (!Number.isInteger(config.repeat_count) || config.repeat_count < 1 || config.repeat_count > 1000) return 'Số vòng phải từ 1 đến 1000.';
  if (!Number.isInteger(config.interval_seconds) || config.interval_seconds < 0 || config.interval_seconds > 86400) return 'Thời gian nghỉ phải từ 0 đến 86400 giây.';
  if (!allowDraft && workflow.trigger_type === 'SCHEDULE' && !config.schedules.some((s) => s.enabled)) return 'Thêm ít nhất một lịch đang bật.';
  const slots = new Set();
  for (const schedule of config.schedules) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time) || !schedule.days.length) return 'Mỗi lịch cần giờ hợp lệ và ít nhất một ngày trong tuần.';
    if (!schedule.enabled) continue;
    for (const day of schedule.days) {
      const key = `${schedule.timezone}:${day}:${schedule.time}`;
      if (slots.has(key)) return 'Các lịch đang bật không được trùng giờ, ngày và múi giờ.';
      slots.add(key);
    }
  }
  return '';
}

export function executionSummary(workflow) {
  const config = executionConfig(workflow.execution_config);
  const rounds = config.repeat_mode === 'CONTINUOUS' ? 'Lặp liên tục' : `${config.repeat_count} vòng / lượt`;
  const mode = config.execution_mode === 'ROBOT' ? 'Xe thật' : 'Màn hình';
  if (workflow.trigger_type !== 'SCHEDULE') return `${mode} · ${rounds}`;
  return `${mode} · ${rounds} · ${config.schedules.filter((s) => s.enabled).length} lịch bật · ${config.execution_mode === 'ROBOT' ? 'Tự chạy khi backend hoạt động' : 'Chỉ xem lịch dự kiến'}`;
}
