import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  Bot,
  PieChart,
  ArrowUpRight,
  Activity,
  MessageSquare,
  FileText,
  Users,
  CheckCircle2,
} from 'lucide-react';
import {
  fetchAnalyticsSummary,
  fetchNotifications,
  sendRobotControlCommand,
} from '../../../services/operationsApi';

export const AdminDashboardTab = ({
  onNavigateToOperations = () => {},
  onNavigateToRobots = () => {},
}) => {
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

  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [selectedDeptHover, setSelectedDeptHover] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, notifsRes] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchNotifications('All', 5),
      ]);

      if (analyticsRes) {
        setData(analyticsRes);
      }
      if (Array.isArray(notifsRes)) {
        setAlerts(notifsRes.slice(0, 4));
      }
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const totalTasks = data.total_tasks || 1;

  const deptEntries = useMemo(() => {
    const raw = [
      { id: 'Reception', name: 'Lễ tân (Reception)', count: data.dept_distribution?.Reception || 0, color: '#262626' },
      { id: 'F&B', name: 'Phục vụ phòng (F&B)', count: data.dept_distribution?.['F&B'] || 0, color: '#525252' },
      { id: 'Housekeeping', name: 'Buồng phòng (Housekeeping)', count: data.dept_distribution?.Housekeeping || 0, color: '#737373' },
      { id: 'Bell Services', name: 'Hành lý (Bell Services)', count: data.dept_distribution?.['Bell Services'] || 0, color: '#9E9E9C' },
      { id: 'Maintenance', name: 'Kỹ thuật (Maintenance)', count: data.dept_distribution?.Maintenance || 0, color: '#BFBFBD' },
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

      {/* Header Bar - seamlessly aligned with sidebar brand header (h-16, #BFBFBD, #F2EFE9) */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
            Phân Tích & Tổng Quan Vận Hành (Dashboard Analytics)
          </h2>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Thống kê trực tiếp từ cơ sở dữ liệu về phiên hội thoại, nhiệm vụ và điều phối nhân sự hỗ trợ
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:bg-[#E9E5DC]/80 shrink-0 flex items-center gap-1.5"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Đang cập nhật...' : 'Cập nhật số liệu'}</span>
        </button>
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
                PHIÊN TƯƠNG TÁC ROBOT
              </span>
              <MessageSquare className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_sessions}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>phiên</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              Tổng {data.total_messages || 0} tin nhắn hội thoại
            </div>
          </div>

          {/* Card 2: Service Tasks */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                YÊU CẦU DỊCH VỤ PHÁT SINH
              </span>
              <FileText className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_tasks}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>phiếu</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {data.active_tasks || 0} đang hoạt động trong CSDL
            </div>
          </div>

          {/* Card 3: Staff Roster & Escalation */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                NHÂN SỰ ĐIỀU PHỐI
              </span>
              <Users className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.total_staff}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>nhân sự</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              Trực vận hành tại 5 bộ phận khách sạn
            </div>
          </div>

          {/* Card 4: Dispatch Mode */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
                TỶ LỆ PHÂN BỔ NHIỆM VỤ
              </span>
              <Activity className="w-3.5 h-3.5" style={{ color: '#8C8C8C' }} />
            </div>
            <div className="flex items-baseline gap-1.5 my-1.5">
              <span className="text-2xl font-bold font-mono" style={{ color: '#262626' }}>
                {data.human_tasks}
              </span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}>/ {data.total_tasks} việc</span>
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              {data.robot_assigned_tasks || 0} robot hỗ trợ ({data.robot_rate || 0}%)
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
                  <span>Phân bổ công việc theo 5 bộ phận</span>
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Tỷ lệ khối lượng yêu cầu dịch vụ thực tế trong CSDL
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
                    Tổng Yêu Cầu
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
                Tổng số yêu cầu đã ghi nhận:
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
                  Nhật ký yêu cầu gần đây nhất
                </span>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Dữ liệu thực từ các bảng nghiệp vụ và robot điều phối
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-600" />
                <span className="text-[11px] font-mono font-semibold" style={{ color: '#8C8C8C' }}>
                  Database Live
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto my-1 flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase border-b" style={{ borderColor: '#E9E5DC', color: '#8C8C8C' }}>
                    <th className="py-2 px-1">Mã</th>
                    <th className="py-2 px-2">Nội dung</th>
                    <th className="py-2 px-2">Bộ phận</th>
                    <th className="py-2 px-2">Vị trí</th>
                    <th className="py-2 px-1 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                  {data.recent_activities.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        Chưa có yêu cầu nào trong hệ thống.
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
                Hiển thị {Math.min(data.recent_activities.length, 10)} yêu cầu mới nhất
              </span>
              <button
                onClick={onNavigateToOperations}
                className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                style={{ color: '#262626' }}
              >
                <span>Xem tất cả phiếu hỗ trợ</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. ROBOT CONTROLLER STRIP & LIVE SYSTEM ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* Left Column (7 cols): Robot RC-001 Quick Actions */}
          <div
            className="lg:col-span-7 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
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
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Trạng thái trực tuyến • Phục vụ tự động & hỗ trợ nhân sự
                </div>
              </div>
            </div>

            {/* Quick Actions */}
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

          {/* Right Column (5 cols): Live System Alerts */}
          <div
            className="lg:col-span-5 p-3 rounded-xl border flex items-center justify-between gap-2"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-4 h-4 shrink-0" style={{ color: '#262626' }} />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: '#262626' }}>
                  {alerts[0]?.title || 'Hệ thống vận hành ổn định'}
                </div>
                <div className="text-[10px] truncate" style={{ color: '#8C8C8C' }}>
                  {alerts[0]?.description || 'Tất cả các dịch vụ kết nối cơ sở dữ liệu hoạt động bình thường.'}
                </div>
              </div>
            </div>
            <span
              className="text-[9px] px-2 py-0.5 rounded font-mono font-bold border shrink-0"
              style={{
                backgroundColor: '#E9E5DC',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
