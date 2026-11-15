import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  PieChart,
  ArrowUpRight,
  Activity,
  MessageSquare,
  FileText,
  Users,
  FileDown,
} from 'lucide-react';
import { fetchAnalyticsSummary } from '../../../services/operationsApi';
import { useLanguage } from '../../../context/LanguageContext';

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

export const AdminDashboardTab = ({
  onNavigateToOperations = () => { },
}) => {
  const { t, language } = useLanguage();
  const [reportPeriod, setReportPeriod] = useState('all');
  const [data, setData] = useState({
    total_tasks: 0,
    active_tasks: 0,
    completed_tasks: 0,
    completion_rate: 0,
    robot_assigned_tasks: 0,
    human_tasks: 0,
    robot_rate: 0,
    total_sessions: 0,
    total_messages: 0,
    total_staff: 0,
    fallback_staff: 0,
    total_robots: 1,
    dept_distribution: {
      Reception: 0,
      Housekeeping: 0,
      'F&B': 0,
      'Bell Services': 0,
      Maintenance: 0,
    },
    recent_activities: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [selectedDeptHover, setSelectedDeptHover] = useState(null);

  const loadData = async (period = reportPeriod) => {
    setIsLoading(true);
    try {
      const analyticsRes = await fetchAnalyticsSummary(period);
      if (analyticsRes) {
        setData(analyticsRes);
      }
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(reportPeriod);
  }, [reportPeriod]);

  const totalTasks = data.total_tasks || 1;

  const deptEntries = useMemo(() => {
    const raw = [
      { id: 'Reception', name: t('deptReception'), count: data.dept_distribution?.Reception || 0, color: '#262626' },
      { id: 'F&B', name: t('deptFB'), count: data.dept_distribution?.['F&B'] || 0, color: '#525252' },
      { id: 'Housekeeping', name: t('deptHousekeeping'), count: data.dept_distribution?.Housekeeping || 0, color: '#737373' },
      { id: 'Bell Services', name: t('deptBell'), count: data.dept_distribution?.['Bell Services'] || 0, color: '#9E9E9C' },
      { id: 'Maintenance', name: t('deptMaintenance'), count: data.dept_distribution?.Maintenance || 0, color: '#BFBFBD' },
    ];

    return raw.map((d) => {
      const pct = Math.round((d.count / totalTasks) * 100);
      const rawPercent = d.count / totalTasks;
      return {
        ...d,
        pct,
        rawPercent,
      };
    });
  }, [data.dept_distribution, totalTasks]);

  // Donut SVG calculations
  const donutSlices = useMemo(() => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.76
    let accumulated = 0;

    return deptEntries.map((d) => {
      const sliceLength = d.rawPercent * circumference;
      const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
      const strokeDashoffset = -accumulated * circumference;
      accumulated += d.rawPercent;
      return {
        ...d,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [deptEntries]);

  const handleExportPdf = () => {
    const html = buildDashboardReportHtml({
      data,
      deptEntries,
      period: reportPeriod,
      language,
    });
    const printWin = window.open('', '_blank', 'width=960,height=720');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 250);
    } else {
      window.print();
    }
  };

  return (
    <div className="w-full flex flex-col min-h-full pb-6" style={{ color: '#262626' }}>
      {/* Header Bar - seamlessly aligned with sidebar brand header (h-16, #BFBFBD, #F2EFE9) */}
      <div
        className="min-h-16 py-2 px-5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            {t('dashTitle')}
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('dashSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <select
            aria-label={t('dashPeriodAll')}
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer focus:outline-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            <option value="all">{t('dashPeriodAll')}</option>
            <option value="weekly">{t('dashPeriodWeekly')}</option>
            <option value="monthly">{t('dashPeriodMonthly')}</option>
          </select>

          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:opacity-90 shrink-0 flex items-center gap-1.5"
            style={{
              backgroundColor: '#262626',
              borderColor: '#262626',
              color: '#F2EFE9',
            }}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{t('dashExportPdf')}</span>
          </button>

          <button
            type="button"
            onClick={() => loadData(reportPeriod)}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:bg-[#E9E5DC]/80 shrink-0 flex items-center gap-1.5"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
              color: '#262626',
            }}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? t('dashRefreshing') : t('dashRefresh')}</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-3.5">
        {/* 1. TOP 4 METRIC CARDS (100% Real Database Analytics) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Chat Sessions */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                {t('dashCardSessionsTitle')}
              </span>
              <MessageSquare className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_sessions}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('dashCardSessionsUnit')}</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {t('dashCardSessionsMsg').replace('{count}', data.total_messages || 0)}
            </div>
          </div>

          {/* Card 2: Service Tasks */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                {t('dashCardTasksTitle')}
              </span>
              <FileText className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_tasks}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('dashCardTasksUnit')}</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {t('dashCardTasksActive').replace('{count}', data.active_tasks || 0)}
            </div>
          </div>

          {/* Card 3: Staff Roster & Escalation */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                {t('dashCardStaffTitle')}
              </span>
              <Users className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_staff}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('dashCardStaffUnit')}</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {t('dashCardStaffActive')}
            </div>
          </div>

          {/* Card 4: Dispatch Mode */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                {t('dashCardRateTitle')}
              </span>
              <Activity className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.human_tasks}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>{t('dashCardRateUnit').replace('{count}', data.total_tasks)}</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {t('dashCardRateSub').replace('{count}', data.robot_assigned_tasks || 0).replace('{rate}', data.robot_rate || 0)}
            </div>
          </div>
        </div>

        {/* 2. MAIN GRID: LEFT (DEPARTMENT BREAKDOWN & DONUT) | RIGHT (RECENT REAL ACTIVITIES) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* Left Column (5 cols): Department Breakdown + Donut Chart */}
          <div
            className="lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between space-y-3"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* Header */}
            <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#262626' }}>
                  <PieChart className="w-3.5 h-3.5" />
                  <span>{t('dashDeptDistribution')}</span>
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  {t('dashDeptDistributionSub')}
                </div>
              </div>
            </div>

            {/* Visual Donut Chart + Slices */}
            <div className="flex items-center justify-center py-1">
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#E9E5DC"
                    strokeWidth="13"
                    fill="none"
                  />
                  {donutSlices.map((slice) => (
                    <circle
                      key={slice.id}
                      cx="50"
                      cy="50"
                      r="38"
                      stroke={slice.color}
                      strokeWidth={selectedDeptHover === slice.id ? '16' : '13'}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      fill="none"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setSelectedDeptHover(slice.id)}
                      onMouseLeave={() => setSelectedDeptHover(null)}
                    />
                  ))}
                </svg>
                {/* Center Text */}
                <div className="absolute text-center select-none pointer-events-none">
                  <div className="text-lg font-black font-mono leading-none" style={{ color: '#262626' }}>
                    {data.total_tasks}
                  </div>
                  <div className="text-[8px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: '#8C8C8C' }}>
                    {t('dashTotalTasksCenter')}
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Department Progress Bars */}
            <div className="space-y-2 text-xs">
              {deptEntries.map((dept) => {
                const isHovered = selectedDeptHover === dept.id;
                return (
                  <div
                    key={dept.id}
                    className="space-y-1 cursor-pointer transition-all"
                    onMouseEnter={() => setSelectedDeptHover(dept.id)}
                    onMouseLeave={() => setSelectedDeptHover(null)}
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color }}
                        />
                        <span
                          className={`truncate transition-colors ${isHovered ? 'font-bold' : 'font-medium'}`}
                          style={{ color: '#262626' }}
                        >
                          {dept.name}
                        </span>
                      </div>
                      <span className="font-mono font-semibold shrink-0" style={{ color: isHovered ? '#262626' : '#8C8C8C' }}>
                        {dept.count} ({dept.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E9E5DC' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(dept.pct, dept.count > 0 ? 4 : 0)}%`,
                          backgroundColor: dept.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Footer Box */}
            <div
              className="p-2 rounded border text-[11px] flex justify-between items-center"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
            >
              <span className="font-medium" style={{ color: '#262626' }}>
                {t('dashTotalTasksRecorded')}
              </span>
              <span className="font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_tasks}
              </span>
            </div>
          </div>

          {/* Right Column (7 cols): Recent Real Activities Table */}
          <div
            className="lg:col-span-7 p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <span className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('dashRecentActivitiesTitle')}
                </span>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  {t('dashRecentActivitiesSub')}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-600" />
                <span className="text-[11px] font-mono font-semibold" style={{ color: '#8C8C8C' }}>
                  {t('dashDbLive')}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto my-1 flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase border-b" style={{ borderColor: '#E9E5DC', color: '#8C8C8C' }}>
                    <th className="py-2 px-1">{t('dashColId')}</th>
                    <th className="py-2 px-2">{t('dashColContent')}</th>
                    <th className="py-2 px-2">{t('dashColDept')}</th>
                    <th className="py-2 px-2">{t('dashColLocation')}</th>
                    <th className="py-2 px-1 text-right">{t('dashColStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                  {data.recent_activities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {t('dashNoActivities')}
                      </td>
                    </tr>
                  ) : (
                    data.recent_activities.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F2EFE9]/60 transition-colors">
                        <td className="py-2 px-1 font-mono font-bold whitespace-nowrap" style={{ color: '#262626' }}>
                          {item.id}
                        </td>
                        <td className="py-2 px-2 font-medium truncate max-w-[210px]" style={{ color: '#262626' }}>
                          {item.title}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                            style={{
                              backgroundColor: '#E9E5DC',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            {item.department}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] whitespace-nowrap" style={{ color: '#8C8C8C' }}>
                          {item.location}
                        </td>
                        <td className="py-2 px-1 text-right whitespace-nowrap">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                            style={{
                              backgroundColor: item.status === 'Completed' ? '#262626' : '#FFFFFF',
                              color: item.status === 'Completed' ? '#F2EFE9' : '#262626',
                              borderColor: '#BFBFBD',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Navigation to Operations */}
            <div className="pt-2 border-t text-[11px] flex justify-between items-center" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-[10px]" style={{ color: '#8C8C8C' }}>
                {t('dashShowingLatest').replace('{count}', Math.min(data.recent_activities.length, 10))}
              </span>
              <button
                onClick={onNavigateToOperations}
                className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                style={{ color: '#262626' }}
              >
                <span>{t('dashViewAllSupport')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
