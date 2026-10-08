import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  User,
  MapPin,
  Utensils,
  ChefHat,
  Truck,
  Sparkles,
  ClipboardList,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
} from '../../services/operationsApi';

export const MyTasksPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffDept = currentUser?.department || 'F&B';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'In Progress' | 'Ready' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailReq, setSelectedDetailReq] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [requests, setRequests] = useState([]);

  // Load live data from database
  const loadMyRequests = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnifiedRequests();
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err) {
      console.error('Error loading my tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMyRequests();
  }, []);

  // Department Role Checks
  const userDeptLower = String(currentUser?.department || staffDept || '').toLowerCase();
  const userNameLower = String(currentUser?.username || '').toLowerCase();
  const userRoleLower = String(currentUser?.role || '').toLowerCase();
  const userFullNameLower = String(currentUser?.full_name || currentUser?.name || '').toLowerCase();

  const isExecutive =
    currentUser?.department === 'Executive' ||
    userNameLower === 'admin' ||
    userRoleLower === 'admin' ||
    userRoleLower.includes('general manager') ||
    userRoleLower.includes('director') ||
    userRoleLower.includes('executive') ||
    userDeptLower.includes('executive');

  const isKitchenStaff =
    userDeptLower.includes('kitchen') ||
    userDeptLower.includes('bếp') ||
    userDeptLower.includes('bep') ||
    userDeptLower.includes('chef') ||
    userNameLower.includes('kitchen') ||
    userFullNameLower.includes('bếp');

  const isRoomServiceStaff =
    userDeptLower.includes('room') ||
    userDeptLower.includes('phục vụ phòng') ||
    userDeptLower.includes('phuc vu phong') ||
    userDeptLower.includes('f&b') ||
    userNameLower.includes('room_service') ||
    userFullNameLower.includes('phục vụ phòng');

  // Check if task is assigned to current user
  const isTaskAssignedToMe = (r) => {
    const assigned =
      r.assignedTo ||
      r.assigned_to ||
      r.assigned_staff_name ||
      r.assignedStaff ||
      r.staffName ||
      r.staff_name ||
      r.completed_by;
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

  // Helper to determine if a request is a Room Service food order
  const isFoodOrder = (r) => {
    if (!r) return false;
    const dept = (r.department || '').toLowerCase();
    const id = (r.id || '').toUpperCase();
    const title = (r.title || '').toLowerCase();
    return (
      dept.includes('room') ||
      dept.includes('f&b') ||
      dept.includes('ẩm thực') ||
      dept.includes('kitchen') ||
      dept.includes('bếp') ||
      id.includes('ORD') ||
      title.includes('room service') ||
      title.includes('order') ||
      r.table_type === 'room_service'
    );
  };

  const isTaskPending = (r) => {
    const s = (r.status || '').toLowerCase().trim();
    return (
      s === 'pending' ||
      s === 'pending action' ||
      s === 'unassigned' ||
      s === 'waiting' ||
      s === 'chờ tiếp nhận'
    );
  };

  const isTaskCompleted = (r) => {
    const s = (r.status || '').toLowerCase().trim();
    return (
      s === 'completed' ||
      s === 'delivered' ||
      s === 'done' ||
      s === 'hoàn tất' ||
      s === 'đã hoàn thành'
    );
  };

  const isTaskInProgress = (r) => {
    return !isTaskCompleted(r) && !isTaskPending(r);
  };

  const FOOD_STEPS = [
    { step: 1, title: 'Khách Đặt' },
    { step: 2, title: 'Chuyển Bếp' },
    { step: 3, title: 'Bếp Nấu' },
    { step: 4, title: 'Món Xong' },
    { step: 5, title: 'Giao Phòng' },
    { step: 6, title: 'Hoàn Tất' },
  ];

  const getFoodOrderStage = (status) => {
    const s = (status || '').toLowerCase().trim();
    if (
      s === 'pending' ||
      s === 'pending action' ||
      s === 'unassigned' ||
      s === 'waiting' ||
      s === 'chờ tiếp nhận'
    ) {
      return {
        step: 1,
        label: 'Chờ Tiếp Nhận',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'Sent to Kitchen',
        nextActionName: 'Chuyển Sang Bếp',
        nextIcon: ChefHat,
        actionBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        deptNote: 'Room Service kiểm tra đơn và gửi Bếp',
        roleBadge: 'Room Service',
      };
    }
    if (
      s === 'sent to kitchen' ||
      s === 'sent_to_kitchen' ||
      s === 'chuyển sang bếp' ||
      s === 'đã chuyển bếp'
    ) {
      return {
        step: 2,
        label: 'Đã Chuyển Bếp',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        nextStatus: 'Cooking',
        nextActionName: 'Bếp Nhận Nấu',
        nextIcon: ChefHat,
        actionBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        deptNote: 'Bếp tiếp nhận chế biến món',
        roleBadge: 'Kitchen',
      };
    }
    if (
      s === 'cooking' ||
      s === 'in preparation' ||
      s === 'in progress' ||
      s === 'đang nấu' ||
      s === 'bếp đang nấu'
    ) {
      return {
        step: 3,
        label: 'Bếp Đang Nấu',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'Ready',
        nextActionName: 'Món Đã Nấu Xong',
        nextIcon: Sparkles,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        deptNote: 'Bếp nấu xong, báo Room Service',
        roleBadge: 'Kitchen',
      };
    }
    if (
      s === 'ready' ||
      s === 'món đã nấu xong' ||
      s === 'sẵn sàng' ||
      s === 'chờ giao phòng'
    ) {
      return {
        step: 4,
        label: 'Món Đã Nấu Xong',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        nextStatus: 'Delivering',
        nextActionName: 'Lấy Món & Giao Phòng',
        nextIcon: Truck,
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm',
        deptNote: 'Room Service lấy món và chuẩn bị dụng cụ giao phòng',
        roleBadge: 'Room Service',
      };
    }
    if (
      s === 'delivering' ||
      s === 'in transit' ||
      s === 'đang giao' ||
      s === 'đang giao phòng'
    ) {
      return {
        step: 5,
        label: 'Đang Giao Phòng',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        nextStatus: 'Completed',
        nextActionName: 'Xác Nhận Đã Giao',
        nextIcon: CheckCircle2,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
        deptNote: 'Giao món và đồ dùng lên phòng thành công',
        roleBadge: 'Room Service',
      };
    }
    return {
      step: 6,
      label: 'Đã Hoàn Tất',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      nextStatus: null,
      nextActionName: null,
      nextIcon: null,
      actionBtnClass: '',
      deptNote: 'Đơn hàng đã phục vụ xong',
      roleBadge: 'Hoàn Thành',
    };
  };

  const canUserActOnStage = (step, req = null) => {
    if (isExecutive) return true;
    if (step === 1) return isRoomServiceStaff || (!isKitchenStaff);
    if (step === 2) return isKitchenStaff;
    if (step === 3) {
      // Bước 3 (Bếp nấu xong -> Món đã nấu xong): CHỈ người nhận request (đầu bếp phụ trách) mới được bấm!
      return isKitchenStaff && isTaskAssignedToMe(req);
    }
    if (step === 4 || step === 5) return isRoomServiceStaff || (!isKitchenStaff);
    return false;
  };

  // Scope strictly to: tasks assigned to or handled by current user
  const myAssignedRequests = requests.filter((r) => isTaskAssignedToMe(r));

  // Phân định trách nhiệm hoàn thành theo bộ phận:
  // - Bộ phận Bếp (Kitchen): Khi chuyển request đến 'Món Xong' (Ready, step >= 4) thì XEM NHƯ ĐÃ XONG PHẦN PHỤ TRÁCH, phần còn lại (giao phòng) là của Room Service!
  //   Do đó: Bếp chỉ 'Đang Phụ Trách' khi đang chế biến (Cooking / Sent to Kitchen).
  // - Room Service: Phụ trách toàn trình từ tiếp nhận tới giao phòng thành công.
  const isTaskActiveForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step === 2 || stage.step === 3;
    }
    return isTaskInProgress(r);
  };

  const isTaskDoneForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step >= 4; // Món đã nấu xong, đã xong phần phụ trách của Bếp
    }
    return isTaskCompleted(r);
  };

  // Calculate live badge counts
  const activeCount = myAssignedRequests.filter(isTaskActiveForUser).length;
  const readyCount = myAssignedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'ready' || s === 'món đã nấu xong' || s === 'sẵn sàng';
  }).length;
  const cookingCount = myAssignedRequests.filter((r) => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'cooking' || s === 'in preparation' || s === 'sent to kitchen' || s === 'sent_to_kitchen';
  }).length;
  const completedCount = isKitchenStaff
    ? myAssignedRequests.filter(isTaskDoneForUser).length
    : myAssignedRequests.filter(isTaskCompleted).length;

  // Filter requests
  const filtered = myAssignedRequests.filter((r) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'In Progress') return isTaskActiveForUser(r);
      if (statusFilter === 'Ready') {
        const s = (r.status || '').toLowerCase().trim();
        return s === 'ready' || s === 'món đã nấu xong';
      }
      if (statusFilter === 'Completed') return isTaskDoneForUser(r);
      return (r.status || '').toLowerCase().trim() === statusFilter.toLowerCase();
    })();

    const matchSearch =
      (r.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.guestName || r.guest_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchSearch;
  });

  // Sort: Đơn đang xử lý đưa lên đầu, đơn đã xong phần việc đưa xuống cuối
  const sortedRequests = [...filtered].sort((a, b) => {
    const isCompA = isTaskDoneForUser(a);
    const isCompB = isTaskDoneForUser(b);
    if (isCompA !== isCompB) return isCompA ? 1 : -1;
    return (b.id || '').localeCompare(a.id || '');
  });

  const paginatedRequests = sortedRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Status transition handler
  const handleUpdateTaskStatus = async (reqId, nextStatus) => {
    const isCompletedStatus =
      nextStatus.toLowerCase() === 'completed' ||
      nextStatus.toLowerCase() === 'delivered' ||
      nextStatus.toLowerCase() === 'done';

    const isNewClaimOrAssign =
      nextStatus.toLowerCase() === 'cooking' ||
      nextStatus.toLowerCase() === 'delivering' ||
      nextStatus.toLowerCase() === 'in progress';

    const targetReq = requests.find((r) => r.id === reqId);
    const finalAssignedTo = isNewClaimOrAssign ? staffName : (targetReq?.assignedTo || staffName);

    setRequests((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: nextStatus,
              assignedTo: finalAssignedTo,
              assigned_to: finalAssignedTo,
              assigned_staff_name: finalAssignedTo,
              completed_by: isCompletedStatus ? staffName : r.completed_by,
            }
          : r
      )
    );

    await updateGenericRequestStatus(reqId, nextStatus, finalAssignedTo);

    const statusMessages = {
      'Sent to Kitchen': `Đã chuyển phiếu #${reqId} sang bộ phận Bếp (Kitchen)`,
      'Cooking': `Bếp đã tiếp nhận và đang chế biến phiếu #${reqId}`,
      'Ready': `Bếp đã làm xong món cho phiếu #${reqId}! Sẵn sàng giao phòng`,
      'Delivering': `Room Service đang lấy món và đồ dùng để giao phiếu #${reqId} lên phòng!`,
      'Completed': `Đã hoàn thành và giao thành công phiếu #${reqId}!`,
    };
    onNotify(statusMessages[nextStatus] || `Đã cập nhật trạng thái phiếu #${reqId}: ${nextStatus}`);
  };



  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1917]">
                    Yêu Cầu Cá Nhân Đang Phụ Trách
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-700">
                    {myAssignedRequests.length} phiếu
                  </span>
                </div>
                <p className="text-xs text-[#78716C] mt-0.5">
                  Danh sách các đơn hàng Room Service & yêu cầu bạn đã nhận, theo dõi tiến độ Bếp chế biến và giao phòng.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-xs">
              <User className="w-3.5 h-3.5 text-stone-500" />
              <span>Nhân viên: {staffName} ({staffDept})</span>
            </div>
          </div>
        </div>

        {/* Mini KPI Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-stone-500 uppercase">Đang Phụ Trách</p>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200">
                  Tối đa 3
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <h3 className="text-2xl font-black text-stone-900">{activeCount}</h3>
                <span className="text-xs font-bold text-stone-400">/ 3</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5 text-sky-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Bếp Đang Nấu</p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">{cookingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ChefHat className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Món Xong Chờ Giao</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{readyCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">
                {isKitchenStaff ? 'Đã Xong Phần Bếp' : 'Đã Giao Xong'}
              </p>
              <h3 className="text-2xl font-black text-stone-700 mt-0.5">{completedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box & Refresh */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã đơn, phòng, tên khách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
              />
            </div>
            <button
              onClick={loadMyRequests}
              title="Làm mới dữ liệu"
              className="p-2 bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E0DCD3] text-stone-700 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tab Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {[
              { key: 'All', label: `Tất Cả (${myAssignedRequests.length})` },
              { key: 'In Progress', label: `Đang Xử Lý (${activeCount})` },
              { key: 'Ready', label: `Món Xong Chờ Giao (${readyCount})` },
              {
                key: 'Completed',
                label: isKitchenStaff
                  ? `Đã Xong Phần Bếp (${completedCount})`
                  : `Đã Giao Xong (${completedCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-[#18181B] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-stone-600 border border-[#E0DCD3] hover:bg-[#EFECE6]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
            <p className="text-sm font-semibold text-stone-600">Đang tải danh sách nhiệm vụ...</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedRequests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6 text-amber-600" />
                </div>
                <p className="font-semibold text-stone-700 text-sm">
                  {statusFilter === 'All'
                    ? 'Bạn chưa nhận phụ trách yêu cầu nào.'
                    : `Không có yêu cầu nào ở mục "${statusFilter}".`}
                </p>
                <p className="text-stone-500 text-xs">
                  Vui lòng sang trang <strong>"Hàng Đợi Yêu Cầu (Requests)"</strong> để nhận hoặc chuyển tiếp yêu cầu từ khách lưu trú.
                </p>
              </div>
            ) : (
              paginatedRequests.map((req) => {
                const isInProgress = isTaskInProgress(req);
                const isCompleted = isTaskCompleted(req);
                const isFood = isFoodOrder(req);
                const stage = isFood ? getFoodOrderStage(req.status) : null;

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-xs space-y-3.5 transition-all hover:shadow-md ${
                      isFood
                        ? stage.step === 4
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                          : stage.step === 5
                          ? 'border-l-4 border-l-purple-500 bg-purple-50/10'
                          : isInProgress
                          ? 'border-l-4 border-l-sky-500'
                          : ''
                        : isInProgress
                        ? 'border-l-4 border-l-sky-500'
                        : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                  >
                    {/* Top Bar: ID, Room, Dept & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#1A1917]">{req.id}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                          {req.location}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 text-[10px] font-bold">
                          {req.department}
                        </span>
                        {isFood && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                            <Utensils className="w-2.5 h-2.5 text-amber-600" />
                            Đơn Room Service
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isFood ? (
                          <>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${stage.badgeClass}`}
                            >
                              {stage.label}
                            </span>
                            {stage.roleBadge && stage.step < 6 && (
                              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-semibold border border-stone-200">
                                Phụ trách: {stage.roleBadge}
                              </span>
                            )}
                          </>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-[#1A1917] leading-snug">{req.title}</h4>

                    {/* Food Stepper Component: 6-stage Visual Progress Bar */}
                    {isFood && (
                      <div className="py-2 px-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80">
                        <div className="flex items-center justify-between relative">
                          {/* Background connecting line */}
                          <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                          <div
                            className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, ((stage.step - 1) / (FOOD_STEPS.length - 1)) * 100)
                              )}%`,
                            }}
                          />

                          {FOOD_STEPS.map((s) => {
                            const isPast = stage.step > s.step;
                            const isCurrent = stage.step === s.step;
                            return (
                              <div
                                key={s.step}
                                className="flex flex-col items-center relative z-10"
                              >
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isPast
                                      ? 'bg-emerald-500 text-white shadow-xs'
                                      : isCurrent
                                      ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow-xs'
                                      : 'bg-white text-stone-400 border border-stone-300'
                                  }`}
                                >
                                  {isPast ? '✓' : s.step}
                                </div>
                                <span
                                  className={`text-[9px] md:text-[10px] mt-1 font-semibold whitespace-nowrap ${
                                    isCurrent
                                      ? 'text-stone-950 font-bold'
                                      : isPast
                                      ? 'text-emerald-700'
                                      : 'text-stone-400'
                                  }`}
                                >
                                  {s.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ordered Items Preview */}
                    {isFood && Array.isArray(req.items) && req.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold text-stone-800 text-[11px]">Món ăn:</span>
                          {req.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="bg-white px-2 py-0.5 rounded-md border border-stone-200 text-stone-700 text-[11px] font-medium shadow-2xs"
                            >
                              {it.quantity || it.qty || 1}x {it.name || it.item_name}
                            </span>
                          ))}
                        </div>
                        {req.total_amount > 0 && (
                          <span className="font-bold text-stone-900 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                            Tổng: {Number(req.total_amount).toLocaleString('vi-VN')} ₫
                          </span>
                        )}
                      </div>
                    )}

                    {/* Guest info & Notes */}
                    <div className="text-xs text-[#78716C] flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-semibold text-stone-800">
                          {req.guestName || req.guest_name || 'Khách lưu trú'}
                        </span>
                        {req.notes && ` • Ghi chú: ${req.notes}`}
                      </div>
                      <span className="text-[11px] text-stone-500">
                        Thời gian tạo: {req.time || 'Vừa xong'}
                      </span>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isFood ? stage.deptNote : `Đang phụ trách bởi bạn (${staffName})`}
                      </span>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {/* 1. Food Order: Stage Action Button if User has permission */}
                        {isFood && stage.nextStatus && (
                          canUserActOnStage(stage.step, req) ? (
                            <button
                              onClick={() => handleUpdateTaskStatus(req.id, stage.nextStatus)}
                              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5 ${stage.actionBtnClass}`}
                              title={stage.deptNote}
                            >
                              {stage.nextIcon && <stage.nextIcon className="w-3.5 h-3.5" />}
                              <span>{stage.nextActionName}</span>
                            </button>
                          ) : (
                            /* Waiting chips for kitchen steps */
                            stage.step === 2 ? (
                              <span
                                className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1.5 select-none shadow-2xs"
                                title="Đơn đã gửi sang Bếp. Chỉ nhân viên Bếp mới có quyền nhận nấu món!"
                              >
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>Chờ Bếp Nhận Nấu</span>
                              </span>
                            ) : stage.step === 3 ? (
                              <span
                                className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1.5 select-none shadow-2xs"
                                title={
                                  isKitchenStaff
                                    ? `Đơn này do ${req.assignedTo || req.assigned_staff_name || 'đầu bếp khác'} nhận nấu. Chỉ người nhận mới có quyền bấm món nấu xong.`
                                    : 'Bếp đang chế biến món ăn. Khi hoàn tất, Bếp sẽ bấm xác nhận để báo cho Room Service.'
                                }
                              >
                                <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>
                                  {isKitchenStaff
                                    ? `Đang nấu bởi: ${req.assignedTo || req.assigned_staff_name || 'Đầu bếp khác'}`
                                    : 'Bếp Đang Nấu Món...'}
                                </span>
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">
                                Chờ {stage.roleBadge}
                              </span>
                            )
                          )
                        )}

                        {/* Completed indicator */}
                        {isFood && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã Giao Xong</span>
                          </span>
                        )}

                        {/* Standard Non-Food Task Complete button */}
                        {!isFood && isInProgress && (
                          <button
                            onClick={() => handleUpdateTaskStatus(req.id, 'Completed')}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <span>Hoàn Thành</span>
                          </button>
                        )}

                        {/* Xem Chi Tiết */}
                        <button
                          onClick={() => setSelectedDetailReq(req)}
                          className="px-4 py-1.5 rounded-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-stone-900 border border-[#E0DCD3] text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title="Bấm để xem chi tiết yêu cầu"
                        >
                          <span>Xem Chi Tiết</span>
                        </button>
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
            className="rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
          />
        )}
      </div>

      {/* Modal: Detail View */}
      {selectedDetailReq && (() => {
        const isModalFood = isFoodOrder(selectedDetailReq);
        const modalStage = isModalFood ? getFoodOrderStage(selectedDetailReq.status) : null;
        const isModalCompleted = isTaskCompleted(selectedDetailReq);
        const modalItems = Array.isArray(selectedDetailReq.items) ? selectedDetailReq.items : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 tracking-tight">
                      {isModalFood
                        ? `Chi Tiết Đơn Room Service #${selectedDetailReq.id}`
                        : `Chi Tiết Yêu Cầu #${selectedDetailReq.id}`}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-mono">
                      Vị trí: {selectedDetailReq.location} • Khách:{' '}
                      {selectedDetailReq.guestName || selectedDetailReq.guest_name || 'Khách lưu trú'}
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

              {/* Body */}
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
                  {isModalFood && (
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${modalStage.badgeClass}`}>
                      {modalStage.label}
                    </span>
                  )}
                </div>

                {/* Stepper */}
                {isModalFood && (
                  <div className="py-2.5 px-3.5 bg-[#FAF8F5] rounded-2xl border border-stone-200">
                    <div className="text-[11px] font-bold text-stone-700 mb-2 flex items-center justify-between">
                      <span>TIẾN ĐỘ THỰC HIỆN ĐƠN HÀNG:</span>
                      <span className="text-amber-800 font-extrabold">{modalStage.deptNote}</span>
                    </div>
                    <div className="flex items-center justify-between relative mt-1">
                      <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                      <div
                        className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, ((modalStage.step - 1) / (FOOD_STEPS.length - 1)) * 100)
                          )}%`,
                        }}
                      />
                      {FOOD_STEPS.map((s) => {
                        const isPast = modalStage.step > s.step;
                        const isCurrent = modalStage.step === s.step;
                        return (
                          <div key={s.step} className="flex flex-col items-center relative z-10">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                isPast
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : isCurrent
                                  ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow-xs'
                                  : 'bg-white text-stone-400 border border-stone-300'
                              }`}
                            >
                              {isPast ? '✓' : s.step}
                            </div>
                            <span
                              className={`text-[9px] md:text-[10px] mt-1 font-semibold whitespace-nowrap ${
                                isCurrent
                                  ? 'text-stone-950 font-bold'
                                  : isPast
                                  ? 'text-emerald-700'
                                  : 'text-stone-400'
                              }`}
                            >
                              {s.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Items */}
                {isModalFood && modalItems.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-stone-800 text-[11px] pb-1.5 border-b border-stone-100">
                      <span>MÓN ĂN ĐÃ GỌI</span>
                      <span>SỐ LƯỢNG & ĐƠN GIÁ</span>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {modalItems.map((it, idx) => {
                        const q = it.quantity || it.qty || 1;
                        const p = it.price || 0;
                        return (
                          <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-800">{it.name || it.item_name}</span>
                            <div className="flex items-center gap-3 text-stone-600">
                              <span className="font-bold text-stone-900">x{q}</span>
                              {p > 0 && <span>{Number(p * q).toLocaleString('vi-VN')} ₫</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedDetailReq.total_amount > 0 && (
                      <div className="pt-2 border-t border-stone-200 flex items-center justify-between font-black text-xs text-stone-900">
                        <span>TỔNG CỘNG:</span>
                        <span className="text-amber-900 text-sm">
                          {Number(selectedDetailReq.total_amount).toLocaleString('vi-VN')} ₫
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Content & Notes */}
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-2">
                  <h4 className="text-sm font-extrabold text-stone-900">{selectedDetailReq.title}</h4>
                  <div className="text-stone-600 space-y-1">
                    <p>
                      <span className="font-semibold text-stone-800">Khách hàng: </span>
                      {selectedDetailReq.guestName || selectedDetailReq.guest_name || 'Khách lưu trú'}
                    </p>
                    {selectedDetailReq.notes && (
                      <p>
                        <span className="font-semibold text-stone-800">Ghi chú: </span>
                        {selectedDetailReq.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailReq(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer shadow-xs"
                >
                  Đóng
                </button>

                {isModalFood && modalStage.nextStatus && (
                  canUserActOnStage(modalStage.step, selectedDetailReq) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleUpdateTaskStatus(selectedDetailReq.id, modalStage.nextStatus);
                        setSelectedDetailReq((prev) => ({
                          ...prev,
                          status: modalStage.nextStatus,
                          assignedTo: staffName,
                        }));
                      }}
                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2 ${modalStage.actionBtnClass}`}
                    >
                      {modalStage.nextIcon && <modalStage.nextIcon className="w-4 h-4" />}
                      <span>{modalStage.nextActionName}</span>
                    </button>
                  ) : (
                    <span className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 flex items-center gap-1.5 shadow-2xs">
                      🔒 Giai đoạn này do bộ phận {modalStage.roleBadge} thực hiện
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
