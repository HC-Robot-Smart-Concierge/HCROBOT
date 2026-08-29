import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_HOUSEKEEPING_DATA } from '../../data/mockHotelData';
import {
  fetchHousekeepingDashboard,
  assignHousekeepingStaff,
  updateGenericRequestStatus,
} from '../../services/operationsApi';
import {
  Inbox,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User,
  Layers,
  ChevronDown,
  Sparkles,
  CheckCheck,
} from 'lucide-react';

export const HousekeepingDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Maria Santos';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [data, setData] = useState(INITIAL_HOUSEKEEPING_DATA);
  const [filter, setFilter] = useState('All');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const filteredRequests = (data.requests || []).filter((req) => {
    if (filter === 'All') return true;
    const title = (req.title || '').toLowerCase();
    const desc = (req.description || '').toLowerCase();
    const reqType = (req.type || req.category || '').toLowerCase();
    const status = (req.status || '').toLowerCase();
    const priority = (req.priority || '').toUpperCase();

    if (filter === 'Pending') {
      return status === 'unassigned' || status === 'pending' || status === 'waiting';
    }
    if (filter === 'In Progress') {
      return status === 'in progress' || status === 'in_progress';
    }
    if (filter === 'Completed') {
      return status === 'completed' || status === 'ready' || status === 'done';
    }
    if (filter === 'High Priority') {
      return priority.includes('HIGH') || priority.includes('URGENT') || priority.includes('VIP');
    }
    if (filter === 'Spill Cleanup') {
      return reqType.includes('spill') || title.includes('spill') || title.includes('tràn') || desc.includes('spill');
    }
    if (filter === 'Towels') {
      return reqType.includes('towel') || title.includes('towel') || title.includes('khăn') || desc.includes('towel');
    }
    if (filter === 'Room Cleaning') {
      return reqType.includes('room_service') || reqType.includes('clean') || title.includes('clean') || title.includes('dọn') || desc.includes('clean');
    }
    return true;
  });

  // 4-Tier Priority Sorting Function:
  // 1. Ưu tiên cao chưa ai nhận (High Priority + Unassigned/Pending)
  // 2. Những yêu cầu chưa ai nhận (Normal/Low + Unassigned/Pending)
  // 3. Những yêu cầu đã có người nhận / Đang xử lý (In Progress)
  // 4. Những yêu cầu đã hoàn thành (Completed)
  const getRequestPriorityScore = (req) => {
    const s = (req.status || '').toLowerCase().trim();
    const p = (req.priority || '').toUpperCase().trim();
    const isPending = s === 'pending' || s === 'unassigned' || s === 'waiting';
    const isInProgress = s === 'in progress' || s === 'in_progress';
    const isCompleted = s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
    const isHighPriority = p.includes('HIGH') || p.includes('URGENT') || p.includes('VIP');

    if (isPending && isHighPriority) return 1;
    if (isPending && !isHighPriority) return 2;
    if (isInProgress) return 3;
    if (isCompleted) return 4;
    return 5;
  };

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const scoreA = getRequestPriorityScore(a);
    const scoreB = getRequestPriorityScore(b);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return (b.id || '').localeCompare(a.id || '');
  });

  // Calculate live dynamic KPI metrics directly from requests array
  const allHkRequests = data.requests || [];
  const pendingRequestsCount = allHkRequests.filter(
    (r) => (r.status || '').toLowerCase() === 'unassigned' || (r.status || '').toLowerCase() === 'pending'
  ).length;
  const inProgressCount = allHkRequests.filter(
    (r) => (r.status || '').toLowerCase() === 'in progress'
  ).length;
  const completedTodayCount = allHkRequests.filter(
    (r) => (r.status || '').toLowerCase() === 'completed'
  ).length;
  const highPriorityCount = allHkRequests.filter(
    (r) => (r.priority || '').toUpperCase().includes('HIGH') && (r.status || '').toLowerCase() !== 'completed'
  ).length;

  // Active Task Check: Mỗi nhân viên chỉ được nhận 1 yêu cầu tại một thời điểm
  const activeTask = allHkRequests.find((r) => {
    const s = (r.status || '').toLowerCase().trim();
    const isInProg = s === 'in progress' || s === 'in_progress';
    const isAssignedToMe =
      r.assignedStaff === staffName ||
      r.assigned_staff_name === staffName ||
      r.assignedTo === staffName;
    return isInProg && isAssignedToMe;
  });
  const hasActiveTask = Boolean(activeTask);

  const STORAGE_KEY_HK = `aurora_hk_claimed_${staffName}`;

  // Load live data from PostgreSQL on mount
  useEffect(() => {
    const loadData = async () => {
      const res = await fetchHousekeepingDashboard();
      let cachedRequests = [];
      try {
        const cached = localStorage.getItem(STORAGE_KEY_HK);
        if (cached) cachedRequests = JSON.parse(cached);
      } catch (e) {}

      if (res && res.requests && res.requests.length > 0) {
        const mergedRequests = res.requests.map((r) => {
          const local = cachedRequests.find(
            (c) =>
              c.id === r.id ||
              c.ticket_code === r.ticket_code ||
              (r.id && c.id && (r.id.includes(c.id) || c.id.includes(r.id)))
          );
          if (local && (local.status === 'In Progress' || local.status === 'Completed')) {
            return {
              ...r,
              status: r.status === 'Completed' ? 'Completed' : local.status,
              assignedStaff: r.assigned_staff_name || local.assignedStaff || local.assigned_staff_name || staffName,
              assigned_staff_name: r.assigned_staff_name || local.assigned_staff_name || local.assignedStaff || staffName,
            };
          }
          return {
            ...r,
            assignedStaff: r.assigned_staff_name || r.assignedStaff,
          };
        });

        setData((prev) => ({
          ...prev,
          kpis: res.kpis || prev.kpis,
          requests: mergedRequests,
          availableStaff: res.available_staff?.length > 0 ? res.available_staff : prev.availableStaff,
        }));
      } else if (cachedRequests.length > 0) {
        setData((prev) => ({
          ...prev,
          requests: cachedRequests,
        }));
      }
    };
    loadData();
  }, [staffName]);

  // Action: Self-Claim Request -> Persists in PostgreSQL with Staff Identity & local storage
  const handleClaimRequest = async (requestId) => {
    if (hasActiveTask) {
      onNotify(
        `⚠️ Bạn đang phụ trách phiếu #${activeTask.id}. Vui lòng bấm [Hoàn Thành] trước khi nhận thêm yêu cầu mới!`
      );
      return;
    }

    const updatedRequests = (data.requests || []).map((r) =>
      r.id === requestId || r.ticket_code === requestId || (r.id && r.id.includes(requestId))
        ? {
            ...r,
            status: 'In Progress',
            assignedStaff: staffName,
            assigned_staff_name: staffName,
          }
        : r
    );

    setData((prev) => ({
      ...prev,
      requests: updatedRequests,
    }));

    try {
      localStorage.setItem(STORAGE_KEY_HK, JSON.stringify(updatedRequests));
    } catch (e) {}

    // Persist to PostgreSQL backend via dual endpoints
    await assignHousekeepingStaff(requestId, {
      status: 'In Progress',
      assigned_staff_name: staffName,
      assigned_staff_id: staffId,
    });
    await updateGenericRequestStatus(requestId, 'In Progress', staffName);
    onNotify(`Bạn (${staffName}) đã nhận xử lý phiếu #${requestId}`);
  };

  // Action: Mark Completed -> Persists in PostgreSQL & local storage
  const handleCompleteRequest = async (requestId) => {
    const updatedRequests = (data.requests || []).map((r) =>
      r.id === requestId || r.ticket_code === requestId || (r.id && r.id.includes(requestId))
        ? { ...r, status: 'Completed' }
        : r
    );

    setData((prev) => ({
      ...prev,
      requests: updatedRequests,
    }));

    try {
      localStorage.setItem(STORAGE_KEY_HK, JSON.stringify(updatedRequests));
    } catch (e) {}

    await assignHousekeepingStaff(requestId, {
      status: 'Completed',
      assigned_staff_name: staffName,
      assigned_staff_id: staffId,
    });
    await updateGenericRequestStatus(requestId, 'Completed', staffName);
    onNotify(`Đã hoàn tất xử lý phiếu #${requestId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1A1917]">Housekeeping Operations</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Hàng đợi yêu cầu từ Robot HCRobot • Nhân viên nhận trực tiếp theo cơ chế First-Claim
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trực ca: {staffName}</span>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CHỜ TIẾP NHẬN"
            value={pendingRequestsCount}
            icon={Inbox}
          />
          <MetricCard
            title="ĐANG XỬ LÝ"
            value={inProgressCount}
            icon={RefreshCw}
          />
          <MetricCard
            title="ĐÃ HOÀN TẤT HÔM NAY"
            value={completedTodayCount}
            icon={CheckCircle2}
          />
          <MetricCard
            title="ƯU TIÊN CAO"
            value={highPriorityCount}
            variant="danger-solid"
            icon={AlertTriangle}
          />
        </div>

        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left Column: Incoming Requests */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#1A1917]">Hàng Đợi Yêu Cầu Từ Robot</h3>
                <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[11px] font-bold">
                  {filteredRequests.length} phiếu
                </span>
              </div>

              {/* Horizontal Filter Pill Bar matching Maintenance */}
              <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] overflow-x-auto no-scrollbar max-w-full">
                {[
                  'All',
                  'Pending',
                  'In Progress',
                  'Completed',
                  'High Priority',
                  'Spill Cleanup',
                  'Towels',
                  'Room Cleaning',
                ].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab);
                      onNotify(`Đã lọc danh sách buồng phòng theo: ${tab}`);
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

            {/* Active Task Banner if currently busy */}
            {hasActiveTask && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <div>
                    <span className="font-bold text-amber-950">Bạn đang phụ trách 1 yêu cầu: </span>
                    <span className="font-mono font-bold text-amber-800">#{activeTask.id}</span> - {activeTask.title} (Phòng {activeTask.room_number || activeTask.room || '502'})
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                    🔒 Giới hạn: 1 yêu cầu / lần
                  </span>
                  <button
                    onClick={() => handleCompleteRequest(activeTask.id)}
                    className="px-3.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    ✓ Hoàn Thành Ngay
                  </button>
                </div>
              </div>
            )}

            {/* Request Cards */}
            <div className="space-y-4">
              {sortedRequests.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E5E1D8] text-stone-500 text-xs font-medium">
                  Không có yêu cầu nào phù hợp với bộ lọc "{typeFilter}".
                </div>
              ) : (
                sortedRequests.map((req) => {
                  const isHighPriority = (req.priority || '').includes('HIGH');
                  const isUnassigned = (req.status || '').toLowerCase() === 'unassigned' || req.status === 'Pending';
                  const isInProgress = req.status === 'In Progress';
                  const isCompleted = req.status === 'Completed';
                  const handlerName = req.assignedStaff || req.assigned_staff_name;

                  return (
                    <div
                      key={req.id}
                      className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                        isInProgress ? 'border-l-4 border-l-sky-500' : ''
                      } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''} ${
                        isHighPriority && isUnassigned ? 'border-l-4 border-l-red-500' : ''
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#F0ECE3] text-[#44403C] font-semibold flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5 text-sky-700" />
                            <span>{req.source || 'PHÁT TỪ HCROBOT'}</span>
                          </span>
                          <span className="font-mono font-bold text-stone-600">ID: {req.id}</span>
                        </div>
                        <div className="flex items-center gap-2 font-semibold">
                          <span
                            className={`flex items-center gap-1 ${
                              isHighPriority ? 'text-red-600 font-bold' : 'text-stone-500'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isHighPriority ? 'bg-red-600 animate-ping' : 'bg-stone-400'
                              }`}
                            />
                            <span>{req.priority}</span>
                          </span>
                          <span className="text-stone-400 font-normal">{req.time || 'Vừa xong'}</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="pt-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-[#1A1917]">{req.title}</h4>
                            <p className="text-xs text-[#78716C] mt-1">{req.description}</p>
                            <p className="text-xs font-semibold text-stone-800 mt-2">
                              Khách báo:{' '}
                              <span className="text-stone-600 font-normal">{req.guestName || 'Khách lưu trú'}</span>
                            </p>
                          </div>
                          <div className="text-right pl-4">
                            <span className="text-[11px] font-semibold text-[#78716C] block">Phòng</span>
                            <span className="text-base font-extrabold text-[#1A1917]">
                              {req.room || req.room_number || '502'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer / Actions: Self-Claim & Complete */}
                      <div className="pt-3 border-t border-[#F5F2EB] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                          {isUnassigned ? (
                            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span className="font-semibold text-[11px]">Chờ nhân viên tiếp nhận</span>
                            </div>
                          ) : isInProgress ? (
                            <div className="flex items-center gap-1.5 text-sky-800 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                              <span className="w-2 h-2 rounded-full bg-sky-500" />
                              <span className="font-bold text-[11px]">
                                Đang xử lý bởi: <span className="underline">{handlerName || staffName}</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="font-bold text-[11px]">
                                Hoàn tất bởi: {handlerName || staffName}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {isUnassigned && (
                            <button
                              onClick={() => handleClaimRequest(req.id)}
                              className={`px-5 py-2 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                hasActiveTask
                                  ? 'bg-stone-200 text-stone-500 hover:bg-stone-300 border border-stone-300'
                                  : 'bg-[#18181B] hover:bg-black text-white'
                              }`}
                              title={
                                hasActiveTask
                                  ? `Bạn đang xử lý phiếu #${activeTask.id}. Hãy hoàn thành trước khi nhận thêm!`
                                  : 'Bấm để nhận xử lý yêu cầu'
                              }
                            >
                              <span>✋ Nhận Xử Lý</span>
                              {hasActiveTask && (
                                <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded-full font-normal">
                                  Đang bận
                                </span>
                              )}
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              onClick={() => handleCompleteRequest(req.id)}
                              className="px-5 py-2 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hoàn Thành</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Floor Status & Available Staff */}
          <div className="lg:col-span-4 space-y-4">
            {/* Floor Status Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Trạng Thái Tầng & Khu Vực
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600">Tầng 4 & 5 (Khu Vực Trực)</span>
                  <span className="font-bold text-[#1A1917]">4 / 6 phòng sạch</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#EFECE6] overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '66%' }} />
                </div>
              </div>

              <div className="pt-2 border-t border-[#F5F2EB]">
                <button
                  onClick={() => setIsMapModalOpen(true)}
                  className="w-full py-2.5 rounded-xl border border-[#E0DCD3] hover:bg-[#FAF8F5] text-xs font-bold text-stone-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Layers className="w-4 h-4 text-stone-600" />
                  <span>Mở Sơ Đồ Buồng Phòng Trực Quan</span>
                </button>
              </div>
            </div>

            {/* Shift Team Status */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Đồng Đội Trong Ca Trực
              </h3>
              <p className="text-[11px] text-stone-500">
                Tất cả thành viên trong ca đều nhận thông báo đồng thời từ Robot.
              </p>

              <div className="space-y-2.5 pt-1">
                {(data.availableStaff || []).map((st) => (
                  <div
                    key={st.id || st.name}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={
                          st.avatar ||
                          st.avatar_url ||
                          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'
                        }
                        alt={st.name}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-stone-800">{st.name}</p>
                        <p className="text-[10px] text-stone-500">{st.location || 'Khu vực tầng 4-5'}</p>
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

      {/* Map Modal */}
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Bản Đồ Phân Bổ Buồng Phòng & Robot"
      />
    </div>
  );
};
