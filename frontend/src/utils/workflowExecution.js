export const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function executionConfig(value = {}) {
  return { repeat_mode: 'COUNT', repeat_count: 1, interval_seconds: 0, schedules: [], ...value };
}

export function executionError(workflow) {
  const config = executionConfig(workflow.execution_config);
  if (!['COUNT', 'CONTINUOUS'].includes(config.repeat_mode)) return 'Chọn chế độ lặp hợp lệ.';
  if (!Number.isInteger(config.repeat_count) || config.repeat_count < 1 || config.repeat_count > 1000) return 'Số vòng phải từ 1 đến 1000.';
  if (!Number.isInteger(config.interval_seconds) || config.interval_seconds < 0 || config.interval_seconds > 86400) return 'Thời gian nghỉ phải từ 0 đến 86400 giây.';
  if (workflow.trigger_type === 'SCHEDULE' && !config.schedules.some((s) => s.enabled)) return 'Thêm ít nhất một lịch đang bật.';
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
  if (workflow.trigger_type !== 'SCHEDULE') return rounds;
  return `${rounds} · ${config.schedules.filter((s) => s.enabled).length} lịch bật · Chỉ lưu cấu hình`;
}
