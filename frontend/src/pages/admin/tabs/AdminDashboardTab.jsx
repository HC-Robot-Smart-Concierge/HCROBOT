import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  Activity,
  MessageSquare,
  FileText,
  Users,
  FileDown,
} from 'lucide-react';
import { fetchAnalyticsSummary } from '../../../services/operationsApi';
import { useLanguage } from '../../../context/LanguageContext';
import { buildDashboardReportHtml } from './adminDashboardReport';
import { AdminDashboardActivityGrid } from './AdminDashboardActivityGrid';

export { buildDashboardReportHtml };

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
        <AdminDashboardActivityGrid
          t={t}
          data={data}
          deptEntries={deptEntries}
          donutSlices={donutSlices}
          selectedDeptHover={selectedDeptHover}
          setSelectedDeptHover={setSelectedDeptHover}
          onNavigateToOperations={onNavigateToOperations}
        />
      </div>
    </div>
  );
};
