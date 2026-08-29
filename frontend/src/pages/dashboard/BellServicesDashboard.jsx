import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { INITIAL_BELL_SERVICES_DATA } from '../../data/mockHotelData';
import {
  fetchBellServicesDashboard,
  updateBellRequestStatus,
} from '../../services/operationsApi';
import {
  Hourglass,
  Footprints,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  ArrowRightLeft,
  Search,
  Bot,
  Users,
  Info,
  CheckCheck,
} from 'lucide-react';

export const BellServicesDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Marcus T.';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [data, setData] = useState(INITIAL_BELL_SERVICES_DATA);
  const [filter, setFilter] = useState('All');
  const [activeDetailTask, setActiveDetailTask] = useState(null);

  // Load live data from PostgreSQL on mount
  useEffect(() => {
    const loadData = async () => {
      const res = await fetchBellServicesDashboard();
      if (res && res.requests) {
        setData((prev) => ({
          ...prev,
          kpis: res.kpis || prev.kpis,
          requests: res.requests.length > 0 ? res.requests : prev.requests,
          teamStatus: res.team_status?.length > 0 ? res.team_status : prev.teamStatus,
        }));
      }
    };
    loadData();
  }, []);

  const filteredRequests = (data.requests || []).filter((req) => {
    if (filter === 'All') return true;
    const s = (req.status || '').toLowerCase().trim();
    const type = (req.type || '').toLowerCase().trim();
    const p = (req.priority || '').toUpperCase().trim();

    if (filter === 'Pending') return s === 'pending' || s === 'unassigned';
    if (filter === 'In Progress') return s === 'in progress' || s === 'in_progress';
    if (filter === 'Completed') return s === 'completed' || s === 'done';
    if (filter === 'Luggage') return type === 'luggage' || (req.title || '').toLowerCase().includes('hành lý');
    if (filter === 'Room Move') return type === 'room_move' || type === 'room-move' || (req.title || '').toLowerCase().includes('chuyển phòng');
    if (filter === 'High Priority') return p.includes('HIGH') || p.includes('URGENT') || p.includes('VIP');
    return true;
  });

  // Action: Self-Claim Task -> Persists in PostgreSQL with Staff Identity
  const handleClaim = async (taskId) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        (r.id === taskId || r.ticket_code === taskId)
          ? { ...r, status: 'In Progress', assignedTo: staffName }
          : r
      ),
      kpis: {
        ...prev.kpis,
        pendingDispatch: Math.max(0, prev.kpis.pendingDispatch - 1),
        activeRuns: prev.kpis.activeRuns + 1,
      },
    }));

    await updateBellRequestStatus(taskId, {
      status: 'In Progress',
      assigned_to: staffName,
      assigned_staff_id: staffId,
    });
    onNotify(`Bạn (${staffName}) đã nhận xử lý phiếu hành lý #${taskId}`);
  };

  // Action: Mark Completed -> Persists in PostgreSQL
  const handleComplete = async (taskId) => {
    setData((prev) => ({
      ...prev,
      requests: prev.requests.map((r) =>
        (r.id === taskId || r.ticket_code === taskId)
          ? { ...r, status: 'Completed' }
          : r
      ),
      kpis: {
        ...prev.kpis,
        activeRuns: Math.max(0, prev.kpis.activeRuns - 1),
        completedToday: prev.kpis.completedToday + 1,
      },
    }));

    await updateBellRequestStatus(taskId, {
      status: 'Completed',
      assigned_to: staffName,
      assigned_staff_id: staffId,
    });
    onNotify(`Đã hoàn tất xử lý phiếu hành lý #${taskId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">Bell Services Operations</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Hàng đợi yêu cầu hành lý từ HCRobot • Nhân viên nhận trực tiếp theo cơ chế First-Claim
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trực ca: {staffName}</span>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CHỜ TIẾP NHẬN"
            value={data.kpis.pendingDispatch}
            icon={Hourglass}
          />
          <MetricCard
            title="ĐANG THỰC HIỆN"
            value={data.kpis.activeRuns}
            icon={Footprints}
          />
          <MetricCard
            title="HOÀN TẤT HÔM NAY"
            value={data.kpis.completedToday}
            icon={CheckCircle2}
          />
          <MetricCard
            title="CHẬM TRỄ / CẦN GẤP"
            value={data.kpis.delayedRuns}
            variant="danger-solid"
            icon={AlertTriangle}
          />
        </div>

        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Live Queue */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1A1917] shrink-0">Hàng Đợi Yêu Cầu Hành Lý & Chuyển Phòng</h3>
              <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] overflow-x-auto no-scrollbar max-w-full">
                {['All', 'Pending', 'In Progress', 'Completed', 'Luggage', 'Room Move', 'High Priority'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab);
                      onNotify(`Đã lọc danh sách hành lý theo: ${tab}`);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filter === tab
                        ? 'bg-[#18181B] text-white shadow-sm'
                        : 'text-[#78716C] hover:text-[#1A1917]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
                  Không có yêu cầu nào trong danh mục "{filter}".
                </div>
              ) : (
                filteredRequests.map((req) => {
                const isUrgent = (req.priority || '').includes('HIGH');
                const isPending = req.status === 'Pending' || req.status === 'Unassigned';
                const isInProgress = req.status === 'In Progress';
                const isCompleted = req.status === 'Completed';
                const handlerName = req.assignedTo || req.assigned_to;

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-4 transition-all hover:shadow-md ${
                      isInProgress ? 'border-l-4 border-l-sky-500' : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-[#F0ECE3] flex items-center justify-center text-stone-700">
                          {req.type === 'luggage' ? (
                            <Briefcase className="w-4 h-4" />
                          ) : (
                            <ArrowRightLeft className="w-4 h-4" />
                          )}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-stone-900 block">{req.id}</span>
                          <span className="text-[10px] text-stone-500">{req.guestName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUrgent && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                            HIGH PRIORITY
                          </span>
                        )}
                        <span className="text-stone-400">{req.time}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h4 className="text-sm font-bold text-[#1A1917]">{req.title}</h4>
                      <p className="text-xs text-[#78716C] mt-1">{req.description}</p>
                      <p className="text-xs font-semibold text-stone-800 mt-2">
                        Lộ trình di chuyển: <span className="text-amber-800 font-bold">{req.location}</span>
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-[#F5F2EB] flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        {isPending ? (
                          <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold text-[11px]">
                            Chờ Bellman tiếp nhận
                          </span>
                        ) : isInProgress ? (
                          <span className="text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 font-bold text-[11px]">
                            Đang xử lý bởi: <span className="underline">{handlerName || staffName}</span>
                          </span>
                        ) : (
                          <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                            Hoàn tất bởi: {handlerName || staffName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <button
                            onClick={() => handleClaim(req.id)}
                            className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                          >
                            <span>✋ Nhận Xử Lý</span>
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            onClick={() => handleComplete(req.id)}
                            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Hoàn Thành</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Right Column: Fleet & Shift Team */}
          <div className="lg:col-span-4 space-y-4">
            {/* Robot Transport Fleet */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Xe Đẩy Robot Tự Hành (Bot Fleet)
              </h3>

              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-stone-900">Bot Unit Alpha</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[11px] text-stone-600">Trạng thái: Sẵn sàng tại sảnh Lobby • Pin: 92%</p>
              </div>
            </div>

            {/* Team Roster */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Đồng Đội Bellman Trong Ca
              </h3>
              <p className="text-[11px] text-stone-500">
                Tất cả thành viên trong ca đều nhận thông báo đồng thời từ Robot.
              </p>

              <div className="space-y-2.5 pt-1">
                {(data.teamStatus || []).map((t) => (
                  <div
                    key={t.id || t.name}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          t.avatar ||
                          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
                        }
                        alt={t.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-stone-800">{t.name}</p>
                        <p className="text-[10px] text-stone-500">{t.location || 'Sảnh chính'}</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
