import React, { useState, useEffect } from 'react';
import { NewDirectiveModal } from '../../components/dashboard/Modals';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
  createHousekeepingRequest,
  createMaintenanceRequest,
  createOperationalDirective,
} from '../../services/operationsApi';

export const RequestsPage = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffDept = currentUser?.department || 'F&B';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'In Progress' | 'Completed'
  const [deptFilter, setDeptFilter] = useState('All'); // 'All' | 'F&B' | 'Housekeeping' | 'Bell Services' | 'Maintenance'
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Consolidated initial hotel requests
  const [requests, setRequests] = useState([
    {
      id: 'REQ-1042',
      department: 'F&B',
      title: 'Club Sandwich & Truffle Fries (x2), Artisan Cola (x2)',
      location: 'ROOM 412',
      guestName: 'Mr. John Smith (VIP)',
      priority: 'HIGH PRIORITY',
      status: 'Pending',
      time: '4 mins ago',
      assignedTo: null,
      notes: 'No mayo on one sandwich, please.',
    },
    {
      id: 'REQ-HK-1042',
      department: 'Housekeeping',
      title: 'Spill cleanup required (Wine spill on carpet)',
      location: 'ROOM 502',
      guestName: 'Mr. John Smith',
      priority: 'HIGH PRIORITY',
      status: 'Pending',
      time: '10:15 AM',
      assignedTo: null,
      notes: 'Guest requested immediate carpet cleaning.',
    },
    {
      id: 'REQ-BS-501',
      department: 'Bell Services',
      title: 'Luggage Pickup (Urgent International Flight)',
      location: 'SUITE 402',
      guestName: 'Mr. Aris Thorne',
      priority: 'HIGH PRIORITY',
      status: 'Pending',
      time: '09:30 AM',
      assignedTo: null,
      notes: '4 large suitcases + 2 garment bags.',
    },
    {
      id: 'REQ-MN-401',
      department: 'Maintenance',
      title: 'Plumbing Leak near bathroom sink',
      location: 'ROOM 412',
      guestName: 'Guest in 412',
      priority: 'HIGH PRIORITY',
      status: 'Pending',
      time: '10 mins ago',
      assignedTo: null,
      notes: 'Water pooling on bathroom tile.',
    },
  ]);

  // Load from database on mount
  const loadRequestsFromDb = async () => {
    setIsLoading(true);
    const data = await fetchUnifiedRequests();
    if (data && Array.isArray(data) && data.length > 0) {
      setRequests(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRequestsFromDb();
  }, []);

  // Department Role Filtering
  // Department Role Filtering
  const isExecutive =
    currentUser?.department === 'Executive' ||
    currentUser?.username === 'admin';

  // Base list scoped to department
  const deptScopedRequests = requests.filter((r) => {
    if (!isExecutive && (r.department || '').toLowerCase() !== staffDept.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Calculate live badge counts
  const pendingCount = deptScopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'pending' || s === 'unassigned' || s === 'waiting';
  }).length;

  const inProgressCount = deptScopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();
    return (
      s === 'in progress' ||
      s === 'in_progress' ||
      s === 'cooking' ||
      s === 'delivering' ||
      s === 'active' ||
      s === 'processing'
    );
  }).length;

  const completedCount = deptScopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
  }).length;

  // 4-Tier Priority Sorting Function:
  // 1. Ưu tiên cao chưa ai nhận (High Priority + Unassigned/Pending)
  // 2. Những yêu cầu chưa ai nhận (Normal/Low + Unassigned/Pending)
  // 3. Những yêu cầu đã có người nhận / Đang xử lý (In Progress)
  // 4. Những yêu cầu đã hoàn thành (Completed)
  const getRequestPriorityScore = (req) => {
    const s = (req.status || '').toLowerCase().trim();
    const p = (req.priority || '').toUpperCase().trim();
    const isPending = s === 'pending' || s === 'unassigned' || s === 'waiting';
    const isInProgress =
      s === 'in progress' ||
      s === 'in_progress' ||
      s === 'cooking' ||
      s === 'delivering' ||
      s === 'active' ||
      s === 'processing';
    const isCompleted = s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
    const isHighPriority = p.includes('HIGH') || p.includes('URGENT') || p.includes('VIP');

    if (isPending && isHighPriority) return 1;
    if (isPending && !isHighPriority) return 2;
    if (isInProgress) return 3;
    if (isCompleted) return 4;
    return 5;
  };

  // Filter requests
  const filtered = deptScopedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();

    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Pending') {
        return s === 'pending' || s === 'unassigned' || s === 'waiting';
      }
      if (statusFilter === 'In Progress') {
        return (
          s === 'in progress' ||
          s === 'in_progress' ||
          s === 'cooking' ||
          s === 'delivering' ||
          s === 'active' ||
          s === 'processing'
        );
      }
      if (statusFilter === 'Completed') {
        return s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
      }
      return s === statusFilter.toLowerCase();
    })();

    const matchDept =
      !isExecutive || deptFilter === 'All' || (r.department || '').toLowerCase() === deptFilter.toLowerCase();
    const matchSearch =
      (r.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.guestName || r.guest_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchDept && matchSearch;
  });

  // Apply Priority Sorting
  const sortedRequests = [...filtered].sort((a, b) => {
    const scoreA = getRequestPriorityScore(a);
    const scoreB = getRequestPriorityScore(b);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return (b.id || '').localeCompare(a.id || '');
  });

  // Active Task Check: Mỗi nhân viên chỉ được nhận 1 yêu cầu tại một thời điểm
  const activeTask = deptScopedRequests.find((r) => {
    const s = (r.status || '').toLowerCase().trim();
    const isInProg = s === 'in progress' || s === 'in_progress' || s === 'cooking';
    const isAssignedToMe =
      r.assignedTo === staffName ||
      r.assigned_staff_name === staffName ||
      r.assignedStaff === staffName;
    return isInProg && isAssignedToMe;
  });
  const hasActiveTask = Boolean(activeTask);

  // Action: Self-Claim Request -> Persists to Database with Single-Task Guard
  const handleClaim = async (reqId) => {
    if (hasActiveTask) {
      onNotify(
        `⚠️ Bạn đang phụ trách phiếu #${activeTask.id}. Vui lòng bấm [Hoàn Thành] trước khi nhận thêm yêu cầu mới!`
      );
      return;
    }

    // 1. Optimistic UI update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId ? { ...r, status: 'In Progress', assignedTo: staffName } : r
      )
    );

    // 2. Persist to local cache for Dashboard synchronization
    try {
      const storageKey = `aurora_hk_claimed_${staffName}`;
      const cached = localStorage.getItem(storageKey);
      let list = cached ? JSON.parse(cached) : [];
      const updatedList = list.map((r) =>
        r.id === reqId || r.ticket_code === reqId || (r.id && r.id.includes(reqId))
          ? { ...r, status: 'In Progress', assignedStaff: staffName, assigned_staff_name: staffName }
          : r
      );
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (e) {}

    // 3. Call backend API to persist in PostgreSQL database
    await updateGenericRequestStatus(reqId, 'In Progress', staffName);
    onNotify(`Bạn (${staffName}) đã nhận xử lý phiếu ${reqId}`);
  };

  // Action: Mark Completed -> Persists to Database
  const handleMarkCompleted = async (reqId) => {
    // 1. Optimistic UI update
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'Completed' } : r))
    );

    // 2. Persist to local cache for Dashboard synchronization
    try {
      const storageKey = `aurora_hk_claimed_${staffName}`;
      const cached = localStorage.getItem(storageKey);
      let list = cached ? JSON.parse(cached) : [];
      const updatedList = list.map((r) =>
        r.id === reqId || r.ticket_code === reqId || (r.id && r.id.includes(reqId))
          ? { ...r, status: 'Completed' }
          : r
      );
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (e) {}

    // 3. Call backend API to persist in PostgreSQL database
    await updateGenericRequestStatus(reqId, 'Completed', staffName);
    onNotify(`Đã hoàn tất xử lý phiếu ${reqId}`);
  };

  // Action: Create New Directive/Request -> Persists to Database
  const handleCreateNew = async (newReq) => {
    const created = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      department: newReq.department || staffDept,
      title: newReq.title,
      location: newReq.location || 'General',
      guestName: 'Guest / Staff Reported',
      priority: newReq.priority || 'NORMAL',
      status: 'Pending',
      time: 'Vừa xong',
      assignedTo: null,
      notes: newReq.notes || '',
    };
    setRequests([created, ...requests]);

    // Persist to Database according to department
    if (newReq.department === 'Housekeeping') {
      await createHousekeepingRequest({
        title: newReq.title,
        room_number: newReq.location || '502',
        priority: newReq.priority,
        description: newReq.notes,
      });
    } else if (newReq.department === 'Maintenance') {
      await createMaintenanceRequest({
        title: newReq.title,
        location: newReq.location || 'Room 412',
        priority: newReq.priority,
        description: newReq.notes,
      });
    } else {
      await createOperationalDirective({
        title: newReq.title,
        department: newReq.department,
        location: newReq.location || 'Main Floor',
        priority: newReq.priority,
        description: newReq.notes,
      });
    }

    onNotify(`Đã tạo phiếu yêu cầu mới: #${created.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & New Request Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1A1917]">
                {isExecutive ? 'Quản Lý Yêu Cầu Toàn Khách Sạn' : `Yêu Cầu Dịch Vụ - Bộ Phận ${staffDept}`}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-700">
                {filtered.length} phiếu
              </span>
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              {isExecutive
                ? 'Trung tâm tiếp nhận, điều phối và phân công yêu cầu dịch vụ trên toàn khách sạn.'
                : `Hàng đợi yêu cầu từ Robot HCRobot gửi về bộ phận ${staffDept} • Nhân viên nhận trực tiếp (Self-Claim).`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-sm">
              <span>Trực ca: {staffName}</span>
            </div>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Tạo Yêu Cầu Mới</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Tìm theo mã phiếu, số phòng, tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
            />
          </div>

          {/* Department Filter Pills (ONLY visible for Executive / Admin) */}
          {isExecutive && (
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-[11px] font-bold text-stone-500 uppercase mr-1">Bộ phận:</span>
              {['All', 'F&B', 'Housekeeping', 'Bell Services', 'Maintenance'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDeptFilter(dept)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    deptFilter === dept
                      ? 'bg-[#18181B] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-600 border border-[#E0DCD3] hover:bg-[#EFECE6]'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE]">
            {[
              { id: 'All', label: 'Tất Cả', count: deptScopedRequests.length },
              { id: 'Pending', label: 'Chờ Tiếp Nhận', count: pendingCount },
              { id: 'In Progress', label: 'Đang Xử Lý', count: inProgressCount },
              { id: 'Completed', label: 'Đã Hoàn Tất', count: completedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  onNotify(`Đã lọc: ${tab.label}`);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-[#18181B] text-white shadow-md'
                    : 'text-stone-600 hover:text-black hover:bg-stone-200/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === tab.id
                      ? 'bg-stone-800 text-amber-300'
                      : 'bg-[#DDD8CE] text-stone-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Task Banner if currently busy */}
        {hasActiveTask && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <div>
                <span className="font-bold text-amber-950">Bạn đang phụ trách 1 yêu cầu: </span>
                <span className="font-mono font-bold text-amber-800">#{activeTask.id}</span> - {activeTask.title} ({activeTask.location})
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                Quy tắc: 1 yêu cầu / lần
              </span>
              <button
                onClick={() => handleMarkCompleted(activeTask.id)}
                className="px-3.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
              >
                Hoàn Thành Ngay
              </button>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="space-y-3.5">
          {sortedRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
              Không tìm thấy yêu cầu nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            sortedRequests.map((req) => {
              const priorityStr = (req.priority || 'NORMAL').toUpperCase();
              const isUrgent = priorityStr.includes('HIGH') || priorityStr.includes('URGENT');
              const statusStr = (req.status || 'Pending').toLowerCase();
              const isPending = statusStr === 'pending' || statusStr === 'unassigned';
              const isInProgress = statusStr === 'in progress' || statusStr === 'cooking' || statusStr === 'delivering';
              const isCompleted = statusStr === 'completed' || statusStr === 'ready';
              const handlerName = req.assignedTo || req.assigned_staff_name;

              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                    isInProgress ? 'border-l-4 border-l-sky-500' : ''
                  } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''} ${
                    isUrgent && isPending ? 'border-l-4 border-l-red-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Title */}
                    <div className="flex items-start flex-1 min-w-0">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#1A1917]">{req.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 text-[10px] font-bold">
                            {req.department}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                            {req.location}
                          </span>
                          {isUrgent && (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                              HIGH PRIORITY
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-[#1A1917]">{req.title}</h4>

                        <p className="text-xs text-[#78716C]">
                          <span className="font-semibold text-stone-800">{req.guestName || 'Khách lưu trú'}</span>
                          {req.notes && ` • Ghi chú: ${req.notes}`}
                        </p>
                      </div>
                    </div>

                    {/* Status & Time */}
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#78716C] block">{req.time || 'Vừa xong'}</span>
                      <span
                        className={`inline-block mt-1 px-3 py-0.5 rounded-full text-[11px] font-bold ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-3 border-t border-[#F5F2EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-stone-600">
                      {isPending ? (
                        <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-semibold text-[11px]">
                          Chờ nhân viên tiếp nhận
                        </span>
                      ) : isInProgress ? (
                        <div className="flex items-center gap-1.5 text-sky-800 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 font-bold text-[11px]">
                          <span>Đang xử lý bởi: <span className="underline">{handlerName || staffName}</span></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-bold text-[11px]">
                          <span>Hoàn tất bởi: {handlerName || staffName}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isPending && (
                        <button
                          onClick={() => handleClaim(req.id)}
                          className={`px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 ${
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
                          <span>Nhận Xử Lý</span>
                          {hasActiveTask && (
                            <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded-full font-normal">
                              Đang bận
                            </span>
                          )}
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          onClick={() => handleMarkCompleted(req.id)}
                          className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5"
                        >
                          <span>Hoàn Thành</span>
                        </button>
                      )}

                      {isCompleted && (
                        <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          <span>Đã hoàn tất thành công</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Request Modal */}
      <NewDirectiveModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateNew}
      />
    </div>
  );
};
