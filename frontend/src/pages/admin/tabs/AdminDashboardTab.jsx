import React, { useState, useEffect } from 'react';
import {
  Bot,
  Bell,
  AlertTriangle,
  Database,
  TrendingUp,
  RefreshCw,
  Plus,
  Compass,
  Battery,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
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
    <div className="w-full min-h-full p-6 space-y-6 pb-16">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">System Overview</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Live operations data across all hotel departments & Concierge Robot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-xs font-bold text-stone-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            onClick={onNavigateToOperations}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Deploy Unit</span>
          </button>
        </div>
      </div>

      {/* 4 Top Metric Cards (Matches Figma row 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Online Robots */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              ONLINE ROBOTS
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-stone-900">1</span>
            <span className="text-sm font-semibold text-stone-400">/ 1 Unit</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>~100% SLA (On Duty at Lobby)</span>
          </div>
        </div>

        {/* Card 2: Active Requests */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              ACTIVE REQUESTS
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-stone-900">{summary.total_active || 12}</span>
            <span className="text-xs font-semibold text-stone-400">across 5 departments</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 pt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+3 new from Robot STT</span>
          </div>
        </div>

        {/* Card 3: Escalations */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">
              ESCALATIONS
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">3</span>
            <span className="text-xs font-semibold text-stone-400">require attention</span>
          </div>
          <div className="text-[11px] font-bold text-rose-500 pt-1 flex items-center gap-1">
            <span>Path blocked & Low battery</span>
          </div>
        </div>

        {/* Card 4: Knowledge Health */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              KNOWLEDGE HEALTH
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-stone-900">98.2<span className="text-lg">%</span></span>
          </div>
          <div className="text-[11px] font-semibold text-stone-400 pt-1">
            <span>Last synced: 2m ago (ChromaDB)</span>
          </div>
        </div>
      </div>

      {/* Row 2: Live Alerts (Left) & Active Robot Status (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Alerts (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-stone-900">Live Alerts</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-600">
                3 Active
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Alert 1 */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Path Blocked: Corridor 4A</span>
              </div>
              <p className="text-[11px] text-rose-600/90 pl-5">
                Unit RC-001 requires manual intervention.
              </p>
              <div className="text-[10px] font-semibold text-rose-400 pl-5 pt-0.5">
                2 mins ago
              </div>
            </div>

            {/* Alert 2 */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Battery className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Low Battery: Return Failed</span>
              </div>
              <p className="text-[11px] text-amber-700/90 pl-5">
                Unit RC-001 battery at 15%, docking station reachable in 2m.
              </p>
              <div className="text-[10px] font-semibold text-amber-500 pl-5 pt-0.5">
                12 mins ago
              </div>
            </div>

            {/* Alert 3 */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                <Wifi className="w-3.5 h-3.5 shrink-0 text-stone-500" />
                <span>API Sync Delayed</span>
              </div>
              <p className="text-[11px] text-stone-500 pl-5">
                Tailscale connection stable, latency 12ms.
              </p>
              <div className="text-[10px] font-semibold text-stone-400 pl-5 pt-0.5">
                1 hr ago
              </div>
            </div>
          </div>
        </div>

        {/* Active Robot Concierge Status (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-stone-900">Active Concierge Status</h3>
              <p className="text-xs text-stone-400">Physical Hardware & ROS 2 Navigation</p>
            </div>
            <button
              onClick={onNavigateToRobots}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View SLAM Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit Info Box */}
            <div className="p-4 rounded-2xl bg-[#18181B] text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">UNIT RC-001</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ONLINE
                </span>
              </div>
              <div className="text-lg font-black tracking-tight">
                Concierge Bot Alpha
              </div>
              <div className="space-y-1 text-xs text-stone-300">
                <div className="flex justify-between">
                  <span className="text-stone-400">Vị trí:</span>
                  <span className="font-semibold text-white">Quầy Lễ Tân (Lobby)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Tọa độ:</span>
                  <span className="font-mono text-[11px] text-amber-300">x: 0.00, y: 0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">LiDAR Cổng COM9:</span>
                  <span className="font-semibold text-emerald-400">Connected (Active)</span>
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="flex flex-col justify-between space-y-2">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Chế Độ Hoạt Động</span>
                <span className="text-xs font-extrabold text-indigo-600">Trực Sảnh & Chào Khách</span>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Mức Pin</span>
                <span className="text-xs font-extrabold text-emerald-600">92% (Tự động về Dock 15%)</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => alert('Đã gửi lệnh khẩn cấp tới Robot Concierge!')}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer text-center"
                >
                  Emergency Stop
                </button>
                <button
                  onClick={() => alert('Robot đang di chuyển về Dock sạc!')}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Return to Dock
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Service Requests (Left) & Guest Satisfaction (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Service Requests Table (8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-stone-900">Recent Service Requests</h3>
            <button
              onClick={onNavigateToOperations}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
            >
              Xem tất cả ({summary.all_count}) →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Nhiệm Vụ</th>
                  <th className="pb-3">Vị Trí</th>
                  <th className="pb-3">Gán Cho</th>
                  <th className="pb-3 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-800">
                {(recentTasks.length > 0 ? recentTasks : [
                  { id: 'REQ-992', title: 'Towel Delivery', location: 'Room 412', assigned_robot: 'RC-001', status: 'In Progress' },
                  { id: 'REQ-991', title: 'Room Service F&B', location: 'Room 1004', assigned_robot: 'RC-001', status: 'In Progress' },
                  { id: 'REQ-990', title: 'Luggage Assist', location: 'Lobby', assigned_robot: 'Bot Alpha', status: 'Pending' },
                ]).map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 font-mono font-bold text-stone-900">{r.id}</td>
                    <td className="py-3 font-bold text-stone-900">{r.title}</td>
                    <td className="py-3 text-stone-600">{r.location}</td>
                    <td className="py-3 font-semibold text-indigo-600">
                      {r.assigned_robot || r.assigned_to || 'Chờ gán'}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-600 border border-indigo-100">
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
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-stone-900">Guest Satisfaction</h3>
            <p className="text-xs text-stone-400">Weekly Feedback on Robot Concierge</p>
          </div>

          {/* Bar Chart Mockup (Matches Figma) */}
          <div className="flex items-end justify-between h-28 px-2 pt-4">
            {[
              { day: 'M', h: '40%' },
              { day: 'T', h: '60%' },
              { day: 'W', h: '55%' },
              { day: 'T', h: '75%' },
              { day: 'F', h: '95%' },
              { day: 'S', h: '90%' },
              { day: 'S', h: '100%', highlight: true },
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  style={{ height: bar.h }}
                  className={`w-6 rounded-t-lg transition-all ${
                    bar.highlight ? 'bg-indigo-600' : 'bg-stone-800'
                  }`}
                />
                <span className="text-[10px] font-bold text-stone-400">{bar.day}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 pt-3">
            <span className="text-xs font-bold text-stone-500">Weekly Average</span>
            <div className="flex items-center gap-1 text-lg font-black text-stone-900">
              <span>4.8</span>
              <span className="text-amber-400 text-sm">★</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
