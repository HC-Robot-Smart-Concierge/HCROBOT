export function parseZoneSpeed(value) {
  if (String(value).trim() === '') return null;
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0.01 || speed > 1) return null;
  return Math.floor(speed * 100 + 1e-9) / 100;
}

export function speedZoneLabel(zone) {
  const name = zone.name || 'Giới hạn tốc độ';
  return `≤ ${Number(zone.speed_limit).toFixed(2)} m/s · ${name.length > 18 ? name.slice(0, 16) + '…' : name}`;
}

export function appliedSpeedLabel(state, now = Date.now()) {
  if (state?.receivedAt && now - state.receivedAt > 3000) return 'Mất cập nhật vùng tốc độ';
  if (!state?.mask_ready) return 'Chưa nhận vùng tốc độ';
  const limit = state.limit;
  if (!limit || !Number.isFinite(limit.speed_limit)) return 'Chờ Nav2 xác nhận giới hạn';
  if (limit.speed_limit === 0) return 'Ngoài vùng · tốc độ thường';
  return `Nav2: ≤ ${limit.percentage ? limit.speed_limit.toFixed(0) + '%' : limit.speed_limit.toFixed(2) + ' m/s'}`;
}
