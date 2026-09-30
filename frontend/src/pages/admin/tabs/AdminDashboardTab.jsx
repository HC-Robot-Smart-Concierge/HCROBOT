import React, { useState, useEffect } from 'react';
import {
  fetchAdminSummary,
  fetchAdminTasks,
  fetchAnalyticsSummary,
  fetchNotifications,
  sendRobotControlCommand,
} from '../../../services/operationsApi';
import { fetchRAGStats } from '../../../services/knowledgeApi';

export const AdminDashboardTab = ({
  onNavigateToOperations = () => {},
  onNavigateToRobots = () => {},
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

  return (
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl border text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-4"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Title & Action Bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5"
        style={{ borderColor: '#BFBFBD' }}
      >
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Tổng Quan Vận Hành Robot (System Overview)
          </h2>
          <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
            Dữ liệu vận hành thời gian thực từ cơ sở dữ liệu và trung tâm điều phối Robot Concierge
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          {isLoading ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* 4 Top Metric Cards (Compact Single Row - Connected to Real Backend API) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Online Robots */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            <span>ROBOT TRỰC TUYẾN</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {analytics.total_robots || 1}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>/ 1 Unit</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Trực sảnh chính (Tỷ lệ tự động: {analytics.robot_rate || 0}%)
          </div>
        </div>

        {/* Card 2: Active Requests */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            YÊU CẦU ĐANG XỬ LÝ
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {summary.total_active ?? analytics.active_tasks ?? 0}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>
              / {summary.all_count ?? analytics.total_tasks ?? 0} tổng phiếu
            </span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Tỷ lệ hoàn tất: {analytics.completion_rate || 0}%
          </div>
        </div>

        {/* Card 3: Guest Interaction Sessions */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            PHIÊN TƯƠNG TÁC KHÁCH
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {analytics.total_sessions || 0}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>hội thoại</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            {analytics.total_messages || 0} tin nhắn trao đổi
          </div>
        </div>

        {/* Card 4: Knowledge Health */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            KNOWLEDGE RAG HEALTH
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {ragStats.rag_health_percent || 98.5}%
            </span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            {ragStats.total_documents || 0} tài liệu ChromaDB & Vault
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Robot & Requests) | Right (Alerts & Satisfaction) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          {/* Active Robot Concierge Box */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <div className="text-xs font-bold" style={{ color: '#262626' }}>
                  Robot Concierge Unit RC-001 (Bot Alpha)
                </div>
                <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  Vị trí: Quầy Lễ Tân (Lobby) • LiDAR Pi5: Sẵn sàng kết nối
                </div>
              </div>
              <button
                onClick={onNavigateToRobots}
                className="text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                Xem SLAM Map →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>Chế độ</div>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>Trực sảnh chính</div>
              </div>
              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>Mức pin</div>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>92% (Tự về dock: 15%)</div>
              </div>
              <div className="col-span-2 sm:col-span-1 flex gap-1.5 items-center">
                <button
                  onClick={handleEmergencyStop}
                  className="flex-1 py-2 rounded text-[11px] font-semibold border cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                  style={{
                    backgroundColor: '#262626',
                    borderColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  Dừng khẩn cấp
                </button>
                <button
                  onClick={handleReturnToDock}
                  className="flex-1 py-2 rounded text-[11px] font-medium border cursor-pointer hover:bg-stone-50 active:scale-95 transition-all"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  Về sạc
                </button>
              </div>
            </div>
          </div>

          {/* Recent Requests Table */}
          <div
            className="p-3.5 rounded-xl border"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Yêu cầu phục vụ gần đây (Toàn khách sạn)
              </span>
              <button
                onClick={onNavigateToOperations}
                className="text-[11px] font-semibold hover:underline cursor-pointer"
                style={{ color: '#262626' }}
              >
                Xem tất cả ({summary.all_count || analytics.total_tasks || 0}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase" style={{ color: '#8C8C8C' }}>
                    <th className="py-2">Mã</th>
                    <th className="py-2">Bộ phận</th>
                    <th className="py-2">Nội dung</th>
                    <th className="py-2">Vị trí</th>
                    <th className="py-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                  {recentTasks.length > 0 ? (
                    recentTasks.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F2EFE9]/40 transition-colors">
                        <td className="py-1.5 font-mono font-semibold" style={{ color: '#262626' }}>
                          {r.id}
                        </td>
                        <td className="py-1.5" style={{ color: '#8C8C8C' }}>
                          {r.department || 'General'}
                        </td>
                        <td className="py-1.5 font-medium" style={{ color: '#262626' }}>
                          {r.title}
                        </td>
                        <td className="py-1.5" style={{ color: '#8C8C8C' }}>
                          {r.location || r.room_number || 'N/A'}
                        </td>
                        <td className="py-1.5 text-right">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium border"
                            style={{
                              backgroundColor:
                                (r.status || '').toLowerCase() === 'completed' ? '#E6F4EA' : '#E9E5DC',
                              borderColor: '#BFBFBD',
                              color:
                                (r.status || '').toLowerCase() === 'completed' ? '#137333' : '#262626',
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-stone-400">
                        Chưa có yêu cầu nào được ghi nhận
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          {/* Live Alerts & Notifications */}
          <div
            className="p-3.5 rounded-xl border space-y-2"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Thông báo & Cảnh báo thời gian thực
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                {alerts.length} thông báo
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {alerts.length > 0 ? (
                alerts.map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    className="p-2 rounded border"
                    style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>
                        {alert.title}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-stone-600 font-mono">
                        {alert.department || 'All'}
                      </span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: '#8C8C8C' }}>
                      {alert.description}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="p-2 rounded border text-center text-[11px]"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                >
                  Không có cảnh báo mới
                </div>
              )}
            </div>
          </div>

          {/* Department Distribution Mini Breakdown */}
          <div
            className="p-3.5 rounded-xl border space-y-2"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Phân bổ yêu cầu theo bộ phận
              </span>
              <span className="text-[10px] font-semibold text-stone-500">
                Nhân sự: {analytics.total_staff || 0} NV
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded border bg-[#F8F7F4]" style={{ borderColor: '#E9E5DC' }}>
                <span className="text-[10px] text-stone-500 block">Lễ tân</span>
                <span className="font-bold text-stone-900">{summary.reception_count || 0} phiếu</span>
              </div>
              <div className="p-2 rounded border bg-[#F8F7F4]" style={{ borderColor: '#E9E5DC' }}>
                <span className="text-[10px] text-stone-500 block">Buồng phòng</span>
                <span className="font-bold text-stone-900">{summary.housekeeping_count || 0} phiếu</span>
              </div>
              <div className="p-2 rounded border bg-[#F8F7F4]" style={{ borderColor: '#E9E5DC' }}>
                <span className="text-[10px] text-stone-500 block">F&B / Ẩm thực</span>
                <span className="font-bold text-stone-900">{summary.room_service_count || 0} phiếu</span>
              </div>
              <div className="p-2 rounded border bg-[#F8F7F4]" style={{ borderColor: '#E9E5DC' }}>
                <span className="text-[10px] text-stone-500 block">Hành lý & Kỹ thuật</span>
                <span className="font-bold text-stone-900">
                  {(summary.bell_services_count || 0) + (summary.maintenance_count || 0)} phiếu
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
