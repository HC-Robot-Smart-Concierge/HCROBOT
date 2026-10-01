import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  Bot,
  Zap,
  Battery,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Sparkles,
  ShieldCheck,
  MapPin,
  MessageSquare,
  FileText,
} from 'lucide-react';
import {
  fetchAdminSummary,
  fetchAdminTasks,
  fetchAnalyticsSummary,
  fetchNotifications,
  sendRobotControlCommand,
} from '../../../services/operationsApi';
import { fetchRAGStats } from '../../../services/knowledgeApi';

export const AdminDashboardTab = ({
  onNavigateToOperations = () => { },
  onNavigateToRobots = () => { },
}) => {
  const [summary, setSummary] = useState({
    total_active: 0,
    all_count: 0,
    reception_count: 0,
    housekeeping_count: 0,
    room_service_count: 0,
    bell_services_count: 0,
    maintenance_count: 0,
    directives_count: 0,
  });

  const [analytics, setAnalytics] = useState({
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
  });

  const [ragStats, setRagStats] = useState({
    rag_health_percent: 98.5,
    total_documents: 0,
    last_synced: 'Đang kết nối...',
  });

  const [alerts, setAlerts] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [selectedDeptHover, setSelectedDeptHover] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sum, tasks, anl, rag, notifs] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminTasks({ limit: 6 }),
        fetchAnalyticsSummary(),
        fetchRAGStats(),
        fetchNotifications('All', 5),
      ]);

      if (sum) setSummary(sum);
      if (Array.isArray(tasks)) setRecentTasks(tasks.slice(0, 5));
      if (anl) setAnalytics(anl);
      if (rag) setRagStats(rag);
      if (Array.isArray(notifs)) setAlerts(notifs.slice(0, 4));
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleEmergencyStop = async () => {
    try {
      await sendRobotControlCommand('stop');
      showToast('⚠️ Đã phát lệnh DỪNG KHẨN CẤP tới Robot Concierge RC-001!');
    } catch {
      showToast('⚠️ Không thể gửi lệnh tới Robot. Vui lòng kiểm tra kết nối mạng!');
    }
  };

  const handleReturnToDock = async () => {
    try {
      await sendRobotControlCommand('dock');
      showToast('🔋 Đã gửi lệnh điều hướng Robot di chuyển về Dock sạc tự động!');
    } catch {
      showToast('⚠️ Lỗi gửi lệnh về Dock.');
    }
  };

  // Department distribution data for charts
  const deptData = useMemo(() => {
    const raw = [
      { id: 'Reception', name: 'Lễ tân (Reception)', count: summary.reception_count || analytics.dept_distribution?.Reception || 0, color: '#262626' },
      { id: 'Housekeeping', name: 'Buồng phòng (Housekeeping)', count: summary.housekeeping_count || analytics.dept_distribution?.Housekeeping || 0, color: '#525252' },
      { id: 'F&B', name: 'Ẩm thực (Food & Beverage)', count: summary.room_service_count || analytics.dept_distribution?.['F&B'] || 0, color: '#737373' },
      { id: 'Bell Services', name: 'Hành lý (Bell Services)', count: summary.bell_services_count || analytics.dept_distribution?.['Bell Services'] || 0, color: '#9E9E9C' },
      { id: 'Maintenance', name: 'Kỹ thuật (Maintenance)', count: summary.maintenance_count || analytics.dept_distribution?.Maintenance || 0, color: '#BFBFBD' },
    ];
    const total = raw.reduce((sum, d) => sum + d.count, 0) || summary.all_count || analytics.total_tasks || 1;
    return raw.map((d) => ({
      ...d,
      percent: Math.round((d.count / total) * 100),
      rawPercent: d.count / total,
    }));
  }, [summary, analytics]);

  const totalDeptTasks = useMemo(() => {
    return deptData.reduce((acc, d) => acc + d.count, 0) || summary.all_count || analytics.total_tasks || 0;
  }, [deptData, summary, analytics]);

  // Hourly workload distribution for the Column Bar Chart
  const hourlyData = useMemo(() => {
    const baseTotal = totalDeptTasks || 40;
    // Distribution curve throughout hotel operating day
    const distributionRatios = [
      { time: '06h', ratio: 0.05, label: '06:00 - 08:00' },
      { time: '08h', ratio: 0.12, label: '08:00 - 10:00' },
      { time: '10h', ratio: 0.22, label: '10:00 - 12:00 (Check-out)' },
      { time: '12h', ratio: 0.19, label: '12:00 - 14:00 (Room Service)' },
      { time: '14h', ratio: 0.18, label: '14:00 - 16:00 (Check-in)' },
      { time: '16h', ratio: 0.11, label: '16:00 - 18:00' },
      { time: '18h', ratio: 0.15, label: '18:00 - 20:00 (Bữa tối)' },
      { time: '20h', ratio: 0.08, label: '20:00 - 22:00' },
      { time: '22h', ratio: 0.04, label: '22:00 - 00:00 (Ca đêm)' },
    ];

    const maxRatio = Math.max(...distributionRatios.map(d => d.ratio));
    return distributionRatios.map(item => {
      const estimatedCount = Math.max(1, Math.round(item.ratio * baseTotal));
      const heightPercent = Math.min(100, Math.round((item.ratio / maxRatio) * 90) + 10);
      return {
        ...item,
        count: estimatedCount,
        heightPercent,
      };
    });
  }, [totalDeptTasks]);

  // Calculations for Donut Chart SVG
  const donutSlices = useMemo(() => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.76
    let accumulated = 0;

    return deptData.map((d) => {
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
  }, [deptData]);

  return (
    <div className="w-full flex flex-col min-h-full pb-6" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Bar - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
              Tổng Quan Vận Hành Robot (System Overview)
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Giám sát trực quan dữ liệu điều phối, phân bổ nhiệm vụ và trạng thái Robot Concierge
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:bg-[#E9E5DC]/80 shrink-0 flex items-center gap-1.5"
          style={{
            backgroundColor: '#E9E5DC',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Đang cập nhật...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Main Dashboard Content */}
      <div className="p-4 space-y-3.5">

        {/* 1. THE VISUAL CHARTS SECTION (DONUT CHART & HOURLY COLUMN BAR CHART) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">

          {/* CHART 1 (5 cols): BIỂU ĐỒ TRÒN (DONUT CHART) - PHÂN BỔ NHIỆM VỤ THEO BỘ PHẬN */}
          <div
            className="lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* Chart Header */}
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#262626' }}>
                  <PieChart className="w-3.5 h-3.5" />
                  <span>Phân Bổ Yêu Cầu Theo 5 Bộ Phận</span>
                </div>
              </div>
            </div>

            {/* Chart Body: Donut Chart & Legend */}
            <div className="py-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* SVG Donut Chart */}
              <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    stroke="#E9E5DC"
                    strokeWidth="14"
                    fill="none"
                  />
                  {donutSlices.map((slice) => (
                    <circle
                      key={slice.id}
                      cx="50"
                      cy="50"
                      r="38"
                      stroke={slice.color}
                      strokeWidth={selectedDeptHover === slice.id ? '17' : '14'}
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      fill="none"
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setSelectedDeptHover(slice.id)}
                      onMouseLeave={() => setSelectedDeptHover(null)}
                    />
                  ))}
                </svg>
                {/* Center Text in Donut */}
                <div className="absolute text-center select-none pointer-events-none">
                  <div className="text-xl font-black" style={{ color: '#262626' }}>
                    {totalDeptTasks}
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                    Tổng Phiếu
                  </div>
                </div>
              </div>

              {/* Legend & Breakdown List */}
              <div className="flex-1 w-full space-y-1.5 text-xs">
                {deptData.map((dept) => (
                  <div
                    key={dept.id}
                    onMouseEnter={() => setSelectedDeptHover(dept.id)}
                    onMouseLeave={() => setSelectedDeptHover(null)}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${selectedDeptHover === dept.id ? 'bg-[#E9E5DC] font-bold' : 'hover:bg-[#F2EFE9]'
                      }`}
                    style={{
                      borderColor: selectedDeptHover === dept.id ? '#262626' : '#E9E5DC',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      <span className="text-[11px] font-medium truncate" style={{ color: '#262626' }}>
                        {dept.name.split('(')[0].trim()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                      <span className="font-bold" style={{ color: '#262626' }}>{dept.count}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded font-semibold" style={{ backgroundColor: '#E9E5DC', color: '#8C8C8C' }}>
                        {dept.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick summary footer */}
            <div
              className="p-2 rounded-lg border text-[10px] flex items-center justify-between font-medium"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              <span>Bộ phận nhận nhiều nhất: <strong>Lễ tân (60%)</strong></span>
              <span className="font-bold text-[#8C8C8C]">Nhân sự: {analytics.total_staff || 10} NV</span>
            </div>
          </div>

          {/* CHART 2 (7 cols): BIỂU ĐỒ CỘT (HOURLY COLUMN CHART) - HOẠT ĐỘNG & TẢI THEO KHUNG GIỜ */}
          <div
            className="lg:col-span-7 p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#262626' }}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Lưu Lượng Hoạt Động & Yêu Cầu Theo Khung Giờ</span>
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Khối lượng nhiệm vụ và phiên tương tác của Robot xuyên suốt 24 giờ
                </div>
              </div>

              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold border"
                style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
              >
                Đỉnh điểm: 10h - 14h
              </span>
            </div>

            {/* Visual Column / Bar Chart (SVG + CSS Flex) */}
            <div className="py-3">
              <div className="h-36 flex items-end justify-between gap-2 px-2 border-b pb-1" style={{ borderColor: '#E9E5DC' }}>
                {hourlyData.map((item, idx) => {
                  const isPeak = item.heightPercent >= 80;
                  return (
                    <div
                      key={item.time}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded bg-[#262626] text-[#F2EFE9] text-[9px] font-mono font-bold whitespace-nowrap shadow-lg z-10">
                        {item.count} phiếu ({item.label})
                      </div>

                      {/* Bar Value on top */}
                      <span className="text-[9px] font-mono font-bold mb-1 opacity-70 group-hover:opacity-100" style={{ color: isPeak ? '#262626' : '#8C8C8C' }}>
                        {item.count}
                      </span>

                      {/* The Column Bar */}
                      <div
                        className="w-full max-w-[28px] rounded-t-md transition-all duration-500 group-hover:brightness-110"
                        style={{
                          height: `${item.heightPercent}%`,
                          backgroundColor: isPeak ? '#262626' : '#8C8C8C',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Time Axis Labels */}
              <div className="flex items-center justify-between gap-2 px-2 pt-1.5 text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                {hourlyData.map((item) => (
                  <div key={item.time} className="flex-1 text-center font-bold">
                    {item.time}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Summary Bar: Automation Split */}
            <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#262626' }} />
                  <span className="text-[11px] font-semibold" style={{ color: '#262626' }}>
                    Robot Concierge tự động: {analytics.robot_rate || 0}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#BFBFBD' }} />
                  <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                    Nhân sự tiếp nhận: {100 - (analytics.robot_rate || 0)}%
                  </span>
                </div>
              </div>

              <div className="text-[10px] font-bold" style={{ color: '#262626' }}>
                Thời gian phản hồi TB: ~1.2 phút
              </div>
            </div>
          </div>
        </div>

        {/* 3. OPERATIONAL STREAM & CONTROLS (ROBOT ACTIONS, RECENT REQUESTS & LIVE ALERTS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">

          {/* Left Column (7 cols): Robot Quick Action Panel + Recent Tasks Table */}
          <div className="lg:col-span-7 space-y-2.5">

            {/* Robot Concierge Controller Strip */}
            <div
              className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#262626' }}>
                    <span>Điều Khiển Robot RC-001 (Bot Alpha)</span>
                    <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleEmergencyStop}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all hover:bg-black active:scale-95"
                  style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#F2EFE9' }}
                >
                  Dừng khẩn cấp
                </button>
                <button
                  type="button"
                  onClick={handleReturnToDock}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all hover:bg-stone-200 active:scale-95"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Về sạc
                </button>
                <button
                  type="button"
                  onClick={onNavigateToRobots}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all hover:bg-stone-200 active:scale-95 flex items-center gap-1"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  <span>Bản đồ SLAM</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Recent Requests Table */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#BFBFBD' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: '#262626' }}>
                    Yêu Cầu Phục Vụ Gần Đây (Toàn Khách Sạn)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}>
                    {recentTasks.length} mới nhất
                  </span>
                </div>

                <button
                  onClick={onNavigateToOperations}
                  className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                  style={{ color: '#262626' }}
                >
                  <span>Xem tất cả ({summary.all_count || analytics.total_tasks || 0})</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase border-b" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}>
                      <th className="py-2 px-2.5">Mã</th>
                      <th className="py-2 px-2">Bộ phận</th>
                      <th className="py-2 px-2">Nội dung</th>
                      <th className="py-2 px-2">Vị trí</th>
                      <th className="py-2 px-2.5 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                    {recentTasks.length > 0 ? (
                      recentTasks.map((r) => {
                        const isCompleted = (r.status || '').toLowerCase() === 'completed';
                        const isPending = (r.status || '').toLowerCase() === 'pending';
                        return (
                          <tr key={r.id} className="hover:bg-[#E9E5DC]/40 transition-colors">
                            <td className="py-2 px-2.5 font-mono font-bold" style={{ color: '#262626' }}>
                              {r.id}
                            </td>
                            <td className="py-2 px-2" style={{ color: '#8C8C8C' }}>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}>
                                {r.department || 'General'}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-medium" style={{ color: '#262626' }}>
                              {r.title}
                            </td>
                            <td className="py-2 px-2 font-mono text-[10px]" style={{ color: '#8C8C8C' }}>
                              {r.location || r.room_number || 'N/A'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold border inline-block"
                                style={{
                                  backgroundColor: isCompleted ? '#E9E5DC' : isPending ? '#262626' : '#FFFFFF',
                                  borderColor: isCompleted ? '#BFBFBD' : isPending ? '#262626' : '#BFBFBD',
                                  color: isCompleted ? '#262626' : isPending ? '#F2EFE9' : '#262626',
                                }}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-4 text-center text-xs" style={{ color: '#8C8C8C' }}>
                          Chưa có yêu cầu nào được ghi nhận
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Live Alerts & Notification Stream */}
          <div className="lg:col-span-5 space-y-2.5">
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
            >
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#BFBFBD' }}>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" style={{ color: '#262626' }} />
                  <span className="text-xs font-bold" style={{ color: '#262626' }}>
                    Thông Báo & Cảnh Báo Thời Gian Thực
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold border"
                  style={{
                    backgroundColor: '#262626',
                    color: '#F2EFE9',
                    borderColor: '#262626',
                  }}
                >
                  {alerts.length} sự kiện
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {alerts.length > 0 ? (
                  alerts.map((alert, idx) => (
                    <div
                      key={alert.id || idx}
                      className="p-2.5 rounded-lg border transition-all hover:border-[#262626]"
                      style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-[11px]" style={{ color: '#262626' }}>
                          {alert.title}
                        </div>
                        <span
                          className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border"
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#BFBFBD',
                            color: '#262626',
                          }}
                        >
                          {alert.department || 'All'}
                        </span>
                      </div>
                      <p className="text-[10px] mt-1 line-clamp-2" style={{ color: '#8C8C8C' }}>
                        {alert.description}
                      </p>
                      <div className="text-[9px] font-mono mt-1 text-right" style={{ color: '#8C8C8C' }}>
                        {alert.created_at ? new Date(alert.created_at).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="p-4 rounded-lg border text-center text-xs"
                    style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                  >
                    Không có cảnh báo mới
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
