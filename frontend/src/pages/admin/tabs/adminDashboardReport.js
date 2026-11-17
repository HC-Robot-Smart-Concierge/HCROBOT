const escapeHtml = (val) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPeriodLabel = (period, isEN) => {
  if (period === 'weekly') return isEN ? 'Weekly (Last 7 Days)' : 'Theo tuần (7 ngày gần nhất)';
  if (period === 'monthly') return isEN ? 'Monthly (Last 30 Days)' : 'Theo tháng (30 ngày gần nhất)';
  return isEN ? 'All Time' : 'Toàn thời gian';
};

export const buildDashboardReportHtml = ({ data, deptEntries, period = 'all', language = 'VI' }) => {
  const isEN = language === 'EN';
  const periodLabel = getPeriodLabel(period, isEN);
  const generatedAt = new Date().toLocaleString(isEN ? 'en-US' : 'vi-VN');
  const title = isEN
    ? 'Aurora Grand Hotel — HCRobot Operational Performance Report'
    : 'Aurora Grand Hotel — Báo Cáo Hiệu Suất Vận Hành HCRobot';

  const deptRows = deptEntries
    .map(
      (d) => `
      <tr>
        <td>${escapeHtml(d.name)}</td>
        <td class="num">${escapeHtml(d.count)}</td>
        <td class="num">${escapeHtml(d.pct)}%</td>
      </tr>`
    )
    .join('');

  const activityRows = (data.recent_activities || []).length
    ? (data.recent_activities || [])
      .map(
        (item) => `
      <tr>
        <td class="mono">${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.department)}</td>
        <td class="mono">${escapeHtml(item.location)}</td>
        <td>${escapeHtml(item.status)}</td>
      </tr>`
      )
      .join('')
    : `<tr><td colspan="5" style="text-align:center;color:#737373;">${escapeHtml(
      isEN ? 'No activities in this period' : 'Không có hoạt động nào trong kỳ báo cáo'
    )}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="${isEN ? 'en' : 'vi'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #262626; margin: 0; padding: 16px; background: #fff; font-size: 12px; }
    .header { border-bottom: 2px solid #262626; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 17px; margin: 0 0 4px 0; }
    .meta { font-size: 11px; color: #525252; line-height: 1.5; }
    .badge { display: inline-block; background: #E9E5DC; border: 1px solid #BFBFBD; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi-card { border: 1px solid #BFBFBD; border-radius: 6px; padding: 10px; background: #FAFAFA; }
    .kpi-label { font-size: 10px; font-weight: bold; color: #737373; text-transform: uppercase; }
    .kpi-val { font-size: 20px; font-weight: bold; margin: 4px 0; }
    .kpi-sub { font-size: 10px; color: #525252; }
    h2 { font-size: 13px; margin: 14px 0 6px 0; border-left: 3px solid #262626; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    th, td { border: 1px solid #D4D4D4; padding: 6px 8px; text-align: left; }
    th { background: #E9E5DC; font-weight: bold; }
    .num { text-align: right; font-family: monospace; }
    .mono { font-family: monospace; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(isEN ? 'Generated At' : 'Thời gian kết xuất')}: ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="badge">${escapeHtml(isEN ? 'Period' : 'Kỳ báo cáo')}: ${escapeHtml(periodLabel)}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(isEN ? 'Chat Sessions' : 'Phiên tương tác')}</div>
      <div class="kpi-val">${escapeHtml(data.total_sessions ?? 0)}</div>
      <div class="kpi-sub">${escapeHtml(data.total_messages ?? 0)} ${escapeHtml(isEN ? 'messages' : 'tin nhắn')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(isEN ? 'Service Tasks' : 'Nhiệm vụ dịch vụ')}</div>
      <div class="kpi-val">${escapeHtml(data.total_tasks ?? 0)}</div>
      <div class="kpi-sub">${escapeHtml(data.completed_tasks ?? 0)} ${escapeHtml(isEN ? 'completed' : 'hoàn tất')} (${escapeHtml(data.completion_rate ?? 0)}%)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(isEN ? 'Robot Automation' : 'Tỷ lệ Robot hỗ trợ')}</div>
      <div class="kpi-val">${escapeHtml(data.robot_rate ?? 0)}%</div>
      <div class="kpi-sub">${escapeHtml(data.robot_assigned_tasks ?? 0)} Robot / ${escapeHtml(data.human_tasks ?? 0)} Staff</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(isEN ? 'Staff on Duty' : 'Nhân sự trực')}</div>
      <div class="kpi-val">${escapeHtml(data.total_staff ?? 0)}</div>
      <div class="kpi-sub">${escapeHtml(isEN ? 'Active staff accounts' : 'Tài khoản đang hoạt động')}</div>
    </div>
  </div>

  <h2>${escapeHtml(isEN ? 'Department Task Distribution' : 'Phân bổ công việc theo bộ phận')}</h2>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(isEN ? 'Department' : 'Bộ phận')}</th>
        <th class="num">${escapeHtml(isEN ? 'Tasks' : 'Số lượng')}</th>
        <th class="num">${escapeHtml(isEN ? 'Percentage' : 'Tỷ lệ')}</th>
      </tr>
    </thead>
    <tbody>${deptRows}</tbody>
  </table>

  <h2>${escapeHtml(isEN ? 'Recent Service Activities' : 'Hoạt động dịch vụ gần đây')}</h2>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(isEN ? 'ID' : 'Mã')}</th>
        <th>${escapeHtml(isEN ? 'Content' : 'Nội dung')}</th>
        <th>${escapeHtml(isEN ? 'Department' : 'Bộ phận')}</th>
        <th>${escapeHtml(isEN ? 'Location' : 'Vị trí')}</th>
        <th>${escapeHtml(isEN ? 'Status' : 'Trạng thái')}</th>
      </tr>
    </thead>
    <tbody>${activityRows}</tbody>
  </table>
</body>
</html>`;
};
