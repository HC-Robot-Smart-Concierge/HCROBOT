import React, { useState, useEffect } from 'react';
import {
  Bot,
  Bell,
  AlertTriangle,
  Database,
  TrendingUp,
  RefreshCw,
  Plus,
  Battery,
  Wifi,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { fetchAdminSummary, fetchAdminTasks } from '../../../services/operationsApi';

export const AdminDashboardTab = ({ onNavigateToOperations = () => {}, onNavigateToRobots = () => {} }) => {
  const [summary, setSummary] = useState({
    total_active: 12,
    all_count: 19,
    reception_count: 2,
    housekeeping_count: 5,
    room_service_count: 4,
    bell_services_count: 3,
    maintenance_count: 2,
    directives_count: 3,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sum, tasks] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminTasks({ limit: 5 }),
      ]);
      if (sum) setSummary(sum);
      if (Array.isArray(tasks)) setRecentTasks(tasks.slice(0, 4));
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="w-full min-h-full p-4 md:p-6 space-y-6 pb-16 bg-[#FCFAF7] font-sans">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1D8] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#1A1917] tracking-tight">System Overview</h2>
          <p className="text-xs text-[#78716C] font-medium mt-0.5">
            Dữ liệu vận hành thời gian thực từ các bộ phận & Robot Concierge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-800 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới Dữ Liệu</span>
          </button>
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Online Robots */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E1D8] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              ONLINE ROBOTS
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#EFECE6] text-stone-900 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4 text-stone-800" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1917]">1</span>
            <span className="text-xs font-bold text-stone-500">/ 1 Unit</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>~100% SLA (Trực sảnh chính)</span>
          </div>
        </div>

        {/* Card 2: Active Requests */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E1D8] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              ACTIVE REQUESTS
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#EFECE6] text-stone-900 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4 text-stone-800" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1917]">{summary.total_active || 12}</span>
            <span className="text-xs font-bold text-stone-500">trên 5 bộ phận</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-stone-700 pt-1">
            <TrendingUp className="w-3.5 h-3.5 text-stone-700" />
            <span>+3 yêu cầu mới từ Robot STT</span>
          </div>
        </div>

        {/* Card 3: Escalations */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E1D8] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
              CẦN XỬ LÝ
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#F5F2EB] text-stone-800 flex items-center justify-center border border-[#DDD8CE]">
              <AlertTriangle className="w-4 h-4 text-stone-700" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-stone-900">3</span>
            <span className="text-xs font-bold text-stone-500">cần chú ý</span>
          </div>
          <div className="text-[11px] font-bold text-stone-600 pt-1">
            <span>Vật cản đường & Mức pin thấp</span>
          </div>
        </div>

        {/* Card 4: Knowledge Health */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5E1D8] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              KNOWLEDGE HEALTH
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#EFECE6] text-stone-900 flex items-center justify-center">
              <Database className="w-4 h-4 text-stone-800" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1A1917]">98.2<span className="text-lg">%</span></span>
          </div>
          <div className="text-[11px] font-bold text-stone-500 pt-1">
            <span>Đồng bộ gần nhất: 2m ago (RAG DB)</span>
          </div>
        </div>
      </div>

      {/* Row 2: Live Alerts (Left) & Active Robot Status (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Alerts (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 md:p-6 rounded-3xl border border-[#E5E1D8] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1A1917]">Cảnh Báo Hoạt Động</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#18181B] text-white">
                3 Đang hoạt động
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Alert 1 */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-stone-700" />
                <span>Phát hiện vật cản: Hành lang 4A</span>
              </div>
              <p className="text-[11px] text-stone-600 pl-5">
                Robot RC-001 cần hỗ trợ can thiệp thủ công.
              </p>
              <div className="text-[10px] font-semibold text-stone-400 pl-5 pt-0.5">
                2 phút trước
              </div>
            </div>

            {/* Alert 2 */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <Battery className="w-3.5 h-3.5 shrink-0 text-stone-700" />
                <span>Pin Thấp: Cần về trạm sạc</span>
              </div>
              <p className="text-[11px] text-stone-600 pl-5">
                Mức pin Robot 15%, trạm sạc khả dụng trong 2 mét.
              </p>
              <div className="text-[10px] font-semibold text-stone-400 pl-5 pt-0.5">
                12 phút trước
              </div>
            </div>

            {/* Alert 3 */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <Wifi className="w-3.5 h-3.5 shrink-0 text-stone-700" />
                <span>Kết Nối Mạng Ổn Định</span>
              </div>
              <p className="text-[11px] text-stone-600 pl-5">
                Tailscale P2P tunnel kết nối tốt, độ trễ 12ms.
              </p>
              <div className="text-[10px] font-semibold text-stone-400 pl-5 pt-0.5">
                1 giờ trước
              </div>
            </div>
          </div>
        </div>

        {/* Active Robot Concierge Status (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 md:p-6 rounded-3xl border border-[#E5E1D8] shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-[#F0ECE6] pb-3">
            <div>
              <h3 className="text-base font-bold text-[#1A1917]">Trạng Thái Robot Concierge</h3>
              <p className="text-xs text-stone-500 font-medium">Phần cứng & Bản đồ điều hướng LiDAR</p>
            </div>
            <button
              onClick={onNavigateToRobots}
              className="text-xs font-bold text-stone-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem Bản Đồ SLAM</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit Info Box (Soft Gray Theme) */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] text-[#1A1917] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">UNIT RC-001</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ONLINE
                </span>
              </div>
              <div className="text-base font-black tracking-tight text-[#1A1917]">
                Concierge Bot Alpha
              </div>
              <div className="space-y-1 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span className="text-stone-500">Vị trí:</span>
                  <span className="font-semibold text-stone-900">Quầy Lễ Tân (Lobby)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Tọa độ:</span>
                  <span className="font-mono text-[11px] text-stone-700">x: 0.00, y: 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">LiDAR COM9:</span>
                  <span className="font-semibold text-emerald-800">Đã kết nối (Hoạt động)</span>
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="flex flex-col justify-between space-y-2">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E1D8] flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Chế Độ Hoạt Động</span>
                <span className="text-xs font-bold text-stone-900">Trực Sảnh & Chào Khách</span>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E1D8] flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Mức Pin</span>
                <span className="text-xs font-bold text-emerald-800">92% (Tự động về trạm 15%)</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => alert('Đã gửi lệnh dừng khẩn cấp tới Robot Concierge!')}
                  className="flex-1 py-2 rounded-xl bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm cursor-pointer text-center"
                >
                  Dừng Khẩn Cấp
                </button>
                <button
                  onClick={() => alert('Robot đang di chuyển về Dock sạc!')}
                  className="flex-1 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#DDD8CE] text-stone-900 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Về Trạm Sạc
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Service Requests (Left) & Guest Satisfaction (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Service Requests Table (8 cols) */}
        <div className="lg:col-span-8 bg-white p-5 md:p-6 rounded-3xl border border-[#E5E1D8] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1A1917]">Yêu Cầu Phục Vụ Gần Đây</h3>
            <button
              onClick={onNavigateToOperations}
              className="text-xs font-bold text-stone-900 hover:underline cursor-pointer"
            >
              Xem tất cả ({summary.all_count}) →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E8E5E0] text-stone-500 font-bold uppercase text-[10px]">
                  <th className="pb-2.5">Mã Phiếu</th>
                  <th className="pb-2.5">Nội Dung</th>
                  <th className="pb-2.5">Vị Trí</th>
                  <th className="pb-2.5">Gán Cho</th>
                  <th className="pb-2.5 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE6] font-medium text-stone-800">
                {(recentTasks.length > 0 ? recentTasks : [
                  { id: 'REQ-992', title: 'Mang Khăn Tắm', location: 'Phòng 412', assigned_robot: 'RC-001', status: 'Đang Xử Lý' },
                  { id: 'REQ-991', title: 'Giao Thức Ăn F&B', location: 'Phòng 1004', assigned_robot: 'RC-001', status: 'Đang Xử Lý' },
                  { id: 'REQ-990', title: 'Hỗ Trợ Hành Lý', location: 'Sảnh Chính', assigned_robot: 'Bot Alpha', status: 'Chờ Tiếp Nhận' },
                ]).map((r) => (
                  <tr key={r.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 font-mono font-bold text-stone-900">{r.id}</td>
                    <td className="py-3 font-bold text-stone-900">{r.title}</td>
                    <td className="py-3 text-stone-600">{r.location}</td>
                    <td className="py-3 font-semibold text-stone-800">
                      {r.assigned_robot || r.assigned_to || 'Chờ phân công'}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFECE6] text-stone-900 border border-[#DDD8CE]">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Guest Satisfaction Widget (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 md:p-6 rounded-3xl border border-[#E5E1D8] shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#1A1917]">Đánh Giá Từ Khách Hàng</h3>
            <p className="text-xs text-stone-500 font-medium">Báo cáo đánh giá trải nghiệm Robot hàng tuần</p>
          </div>

          {/* Bar Chart Mockup */}
          <div className="flex items-end justify-between h-28 px-2 pt-4">
            {[
              { day: 'T2', h: '40%' },
              { day: 'T3', h: '60%' },
              { day: 'T4', h: '55%' },
              { day: 'T5', h: '75%' },
              { day: 'T6', h: '95%' },
              { day: 'T7', h: '90%' },
              { day: 'CN', h: '100%', highlight: true },
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  style={{ height: bar.h }}
                  className={`w-6 rounded-t-lg transition-all ${
                    bar.highlight ? 'bg-[#18181B]' : 'bg-[#E5E1D8]'
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-500">{bar.day}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#F0ECE6] pt-3">
            <span className="text-xs font-bold text-stone-500">Trung bình tuần</span>
            <div className="flex items-center gap-1 text-lg font-black text-stone-900">
              <span>4.8</span>
              <span className="text-stone-700 text-sm font-bold">/ 5.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
