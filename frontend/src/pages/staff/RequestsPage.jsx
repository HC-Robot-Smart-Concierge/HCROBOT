import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock, CheckCircle2, Eye, User, MapPin } from 'lucide-react';
import { NewDirectiveModal } from '../../components/dashboard/Modals';
import { Pagination } from '../../components/common/Pagination';
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
  const [deptFilter, setDeptFilter] = useState('All'); // 'All' | 'Reception' | 'F&B' | 'Housekeeping' | 'Bell Services' | 'Maintenance'
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDetailReq, setSelectedDetailReq] = useState(null); // Read-only completed detail modal
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Consolidated initial hotel requests
  const [requests, setRequests] = useState([
    {
      id: 'REQ-1042',
      department: 'F&B',
      title: 'Club Sandwich & Truffle Fries (x2), Artisan Cola (x2)',
      location: 'ROOM 412',
      guestName: 'Mr. John Smith',
      priority: 'NORMAL',
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
      priority: 'NORMAL',
      status: 'Pending',
      time: '10:15 AM',
      assignedTo: null,
      notes: 'Guest requested carpet cleaning.',
    },
    {
      id: 'REQ-BS-501',
      department: 'Bell Services',
      title: 'Luggage Pickup',
      location: 'ROOM 402',
      guestName: 'Mr. Aris Thorne',
      priority: 'NORMAL',
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
    try {
      const data = await fetchUnifiedRequests();
      if (data && Array.isArray(data) && data.length > 0) {
        setRequests(data);
      }
    } catch (err) {
      console.error('Error loading staff requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequestsFromDb();
  }, []);

  // Department Role Filtering
  const isExecutive =
    currentUser?.department === 'Executive' ||
    currentUser?.username === 'admin';

  // Helper to check if task is assigned to current user
  const isTaskAssignedToMe = (r) => {
    const assigned =
      r.assignedTo ||
      r.assigned_to ||
      r.assigned_staff_name ||
      r.assignedStaff ||
      r.staffName ||
      r.staff_name;
    if (!assigned) return false;
    const assignedNorm = String(assigned).toLowerCase().trim();
    const staffNameNorm = String(staffName || '').toLowerCase().trim();
    const curNameNorm = String(currentUser?.name || '').toLowerCase().trim();
    const curFullNameNorm = String(currentUser?.full_name || '').toLowerCase().trim();
    const curUserNorm = String(currentUser?.username || '').toLowerCase().trim();

    return (
      assignedNorm === staffNameNorm ||
      (curNameNorm && assignedNorm === curNameNorm) ||
      (curFullNameNorm && assignedNorm === curFullNameNorm) ||
      (curUserNorm && assignedNorm === curUserNorm)
    );
  };

  // Helper to get unified handler name for both list view and detail modal
  const getTaskHandlerName = (r) => {
    if (!r) return staffName;
    return (
      r.assignedTo ||
      r.assigned_to ||
      r.assigned_staff_name ||
      r.assignedStaff ||
      r.staffName ||
      r.staff_name ||
      r.completedBy ||
      r.completed_by ||
      staffName
    );
  };

  // Helper to check task status categories
  const isTaskInProgress = (r) => {
    const s = (r.status || '').toLowerCase().trim();
    return (
      s === 'in progress' ||
      s === 'in_progress' ||
      s === 'cooking' ||
      s === 'delivering' ||
      s === 'active' ||
      s === 'processing'
    );
  };

  const isTaskPending = (r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'pending' || s === 'pending action' || s === 'unassigned' || s === 'waiting';
  };

  const isTaskCompleted = (r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'ready' || s === 'delivered' || s === 'done';
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deptFilter, searchQuery]);

  const isDeptMatch = (reqDept, userDept) => {
    if (!reqDept || !userDept) return true;
    const rD = reqDept.toLowerCase().trim();
    const uD = userDept.toLowerCase().trim();
    if (rD === uD) return true;
    if ((uD.includes('f&b') || uD.includes('room')) && (rD.includes('f&b') || rD.includes('room') || rD.includes('ẩm thực'))) return true;
    if ((uD.includes('housekeeping') || uD.includes('buồng')) && (rD.includes('housekeeping') || rD.includes('buồng'))) return true;
    if ((uD.includes('bell') || uD.includes('hành lý')) && (rD.includes('bell') || rD.includes('hành lý'))) return true;
    if ((uD.includes('maint') || uD.includes('bảo trì') || uD.includes('kỹ thuật')) && (rD.includes('maint') || rD.includes('bảo trì') || rD.includes('kỹ thuật'))) return true;
    if ((uD.includes('reception') || uD.includes('lễ tân')) && (rD.includes('reception') || rD.includes('lễ tân'))) return true;
    return false;
  };

  // Base list scoped to department & task visibility rules:
  // - Đang xử lý: Chỉ ai nhận công việc đó mới xem được (trừ khi là quản trị viên/Executive)
  // - Đã hoàn tất: Mọi người trong bộ phận / toàn khách sạn đều xem được
  // - Chờ tiếp nhận: Mọi người trong bộ phận đều xem được để nhận việc
  const deptScopedRequests = requests.filter((r) => {
    if (!isExecutive && !isDeptMatch(r.department, staffDept)) {
      return false;
    }

    // Đang xử lý: Nếu không phải người nhận và không phải Executive -> Không hiển thị
    if (!isExecutive && isTaskInProgress(r) && !isTaskAssignedToMe(r)) {
      return false;
    }

    return true;
  });

  // Calculate live badge counts
  const pendingCount = deptScopedRequests.filter(isTaskPending).length;
  const inProgressCount = deptScopedRequests.filter(isTaskInProgress).length;
  const completedCount = deptScopedRequests.filter(isTaskCompleted).length;

  // Sorting logic based on progress workflow:
  // 1. Pending (chờ tiếp nhận)
  // 2. In Progress (đang xử lý)
  // 3. Completed (hoàn thành)
  const getRequestPriorityScore = (req) => {
    const isPending = isTaskPending(req);
    const isInProgress = isTaskInProgress(req);
    const isCompleted = isTaskCompleted(req);

    if (isPending) return 1;
    if (isInProgress) return 2;
    if (isCompleted) return 3;
    return 4;
  };

  // Filter requests
  const filtered = deptScopedRequests.filter((r) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Pending') return isTaskPending(r);
      if (statusFilter === 'In Progress') return isTaskInProgress(r);
      if (statusFilter === 'Completed') return isTaskCompleted(r);
      return (r.status || '').toLowerCase().trim() === statusFilter.toLowerCase();
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

  // Paginated Slicing (20 items per page)
  const paginatedRequests = sortedRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Active Task Check: Mỗi nhân viên chỉ được nhận 1 yêu cầu tại một thời điểm
  const activeTask = deptScopedRequests.find((r) => isTaskInProgress(r) && isTaskAssignedToMe(r));
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
        r.id === reqId
          ? {
              ...r,
              status: 'In Progress',
              assignedTo: staffName,
              assigned_to: staffName,
              assigned_staff_name: staffName,
            }
          : r
      )
    );

    // 2. Persist to local cache for Dashboard synchronization
    try {
      const storageKey = `aurora_hk_claimed_${staffName}`;
      const cached = localStorage.getItem(storageKey);
      let list = cached ? JSON.parse(cached) : [];
      const updatedList = list.map((r) =>
        r.id === reqId || r.ticket_code === reqId || (r.id && r.id.includes(reqId))
          ? {
              ...r,
              status: 'In Progress',
              assignedStaff: staffName,
              assigned_staff_name: staffName,
              assigned_to: staffName,
            }
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
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'Completed',
              assignedTo: r.assignedTo || r.assigned_to || staffName,
              assigned_to: r.assigned_to || r.assignedTo || staffName,
              assigned_staff_name: r.assigned_staff_name || staffName,
              completed_by: staffName,
            }
          : r
      )
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

            {isExecutive && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <span>Tạo Yêu Cầu Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box & Refresh Button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo mã phiếu, số phòng, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
              />
            </div>
            <button
              onClick={loadRequestsFromDb}
              title="Làm mới dữ liệu"
              className="p-2 bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E0DCD3] text-stone-700 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
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
        {isLoading ? (
          <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
            <p className="text-sm font-semibold text-stone-600">Đang tải danh sách yêu cầu...</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedRequests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
                Không tìm thấy yêu cầu nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              paginatedRequests.map((req) => {
                const isPending = isTaskPending(req);
                const isInProgress = isTaskInProgress(req);
                const isCompleted = isTaskCompleted(req);
                const isMine = isTaskAssignedToMe(req);
                const handlerName = getTaskHandlerName(req);

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                      isInProgress ? 'border-l-4 border-l-sky-500' : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
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
                            <span>Đang xử lý bởi: <span className="underline">{handlerName}</span></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-bold text-[11px]">
                            <span>Hoàn tất bởi: <strong className="text-emerald-950 font-semibold">{handlerName}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* 1. Pending: Claim button */}
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

                        {/* 2. In Progress: Only assignee (or executive) can complete */}
                        {isInProgress && (isMine || isExecutive) && (
                          <button
                            onClick={() => handleMarkCompleted(req.id)}
                            className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5"
                          >
                            <span>Hoàn Thành</span>
                          </button>
                        )}

                        {/* 3. Completed: Everyone can view details (Read-only) */}
                        {isCompleted && (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                              <span>Đã hoàn tất</span>
                            </span>

                            <button
                              onClick={() => setSelectedDetailReq(req)}
                              className="px-4 py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                              title="Bấm để xem chi tiết người thực hiện (Chỉ xem)"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-300" />
                              <span>Xem Chi Tiết</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && sortedRequests.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={sortedRequests.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="rounded-2xl border border-[#E5E1D8] shadow-sm bg-white"
          />
        )}
      </div>

      {/* 1. Modal: Create New Directive / Request */}
      <NewDirectiveModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateNew}
      />

      {/* 2. Modal: Read-Only Detail View for Completed Task */}
      {selectedDetailReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 tracking-tight">
                    Chi Tiết Phiếu Yêu Cầu Đã Hoàn Tất
                  </h3>
                  <p className="text-[11px] text-stone-500 font-mono">
                    Mã phiếu: {selectedDetailReq.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailReq(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100">
                  Bộ phận: {selectedDetailReq.department}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  {selectedDetailReq.location}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ĐÃ HOÀN TẤT
                </span>
                {((selectedDetailReq.priority || '').toUpperCase().includes('HIGH') ||
                  (selectedDetailReq.priority || '').toUpperCase().includes('URGENT')) && (
                  <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold text-[11px]">
                    HIGH PRIORITY
                  </span>
                )}
              </div>

              {/* Title & Content */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-2">
                <h4 className="text-sm font-extrabold text-stone-900">
                  {selectedDetailReq.title}
                </h4>
                <div className="text-stone-600 space-y-1">
                  <p>
                    <span className="font-semibold text-stone-800">Khách hàng / Người yêu cầu: </span>
                    {selectedDetailReq.guestName || selectedDetailReq.guest_name || 'Khách lưu trú'}
                  </p>
                  {selectedDetailReq.notes && (
                    <p>
                      <span className="font-semibold text-stone-800">Ghi chú chi tiết: </span>
                      {selectedDetailReq.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Handler & Execution Information */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>THÔNG TIN NGƯỜI THỰC HIỆN & HOÀN TẤT</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-700">
                  <div>
                    <span className="text-stone-500 text-[11px] block">Nhân viên thực hiện:</span>
                    <span className="font-bold text-stone-900 text-xs">
                      {getTaskHandlerName(selectedDetailReq)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[11px] block">Thời gian hoàn thành:</span>
                    <span className="font-bold text-stone-900 text-xs">
                      {selectedDetailReq.time || 'Vừa xong'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 text-[11px] block">Nguồn tiếp nhận:</span>
                    <span className="font-medium text-stone-800 text-xs">
                      {selectedDetailReq.source || 'Robot App / Front Desk'}
                    </span>
                  </div>
                  {selectedDetailReq.assigned_robot && (
                    <div>
                      <span className="text-stone-500 text-[11px] block">Robot phối hợp:</span>
                      <span className="font-medium text-sky-700 text-xs">
                        {selectedDetailReq.assigned_robot}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Read-Only Notice */}
              <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 flex items-center gap-2">
                <span className="text-sm">🔒</span>
                <span>
                  <strong>Hồ sơ chỉ đọc (View-only):</strong> Phiếu đã hoàn thành và lưu trữ an toàn trong nhật ký kiểm toán. Không được chỉnh sửa.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedDetailReq(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition-all cursor-pointer shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

