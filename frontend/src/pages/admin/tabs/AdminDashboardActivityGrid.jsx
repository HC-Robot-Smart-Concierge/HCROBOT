import React from 'react';
import { PieChart, ArrowUpRight } from 'lucide-react';

export const AdminDashboardActivityGrid = ({
  t,
  data,
  deptEntries,
  donutSlices,
  selectedDeptHover,
  setSelectedDeptHover,
  onNavigateToOperations,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
    {/* Left Column (5 cols): Department Breakdown + Donut Chart */}
    <div
      className="lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between space-y-3"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
    >
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
            <circle cx="50" cy="50" r="38" stroke="#E9E5DC" strokeWidth="13" fill="none" />
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
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} />
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
                      style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
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
);
