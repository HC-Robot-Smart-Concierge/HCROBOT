import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Check,
  User,
  MapPin,
  Utensils,
  ChefHat,
  Truck,
  Sparkles,
  ClipboardList,
  AlertCircle,
  ArrowRight,
  ConciergeBell,
  Phone,
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

  // Real-time WebSocket Listeners for Instant Task Status Updates
  useEffect(() => {
    const handleStatusUpdate = (e) => {
      const updated = e.detail;
      if (!updated) return;
      setRequests((prev) =>
        prev.map((r) => {
          const isMatch =
            r.id === updated.id ||
            r.id === updated.raw_id ||
            r.id === `REQ-${updated.id}` ||
            r.id === `REQ-${updated.ticket_code}` ||
            r.raw_id === updated.id ||
            r.raw_id === updated.raw_id ||
            (updated.ticket_code && r.ticket_code === updated.ticket_code);
          if (isMatch) {
            return {
              ...r,
              status: updated.status || r.status,
              progress: updated.progress !== undefined ? updated.progress : r.progress,
              assignedTo: updated.assigned_to || updated.assigned_staff_name || r.assignedTo,
              assigned_to: updated.assigned_to || updated.assigned_staff_name || r.assigned_to,
              assigned_staff_name: updated.assigned_staff_name || r.assigned_staff_name,
            };
          }
          return r;
        })
      );
    };

    const handleNewOrderOrRequest = () => {
      loadMyRequests();
    };

    const handleOrdersCleared = () => {
      setRequests((prev) => prev.filter((r) => r.department !== 'F&B' && r.table_type !== 'room_service'));
    };

    window.addEventListener('app:task_status_updated', handleStatusUpdate);
    window.addEventListener('app:order_created', handleNewOrderOrRequest);
    window.addEventListener('app:request_created', handleNewOrderOrRequest);
    window.addEventListener('app:orders_cleared', handleOrdersCleared);

    return () => {
      window.removeEventListener('app:task_status_updated', handleStatusUpdate);
      window.removeEventListener('app:order_created', handleNewOrderOrRequest);
      window.removeEventListener('app:request_created', handleNewOrderOrRequest);
      window.removeEventListener('app:orders_cleared', handleOrdersCleared);
    };
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

  // Helper to determine if a request is a direct Room Service request (Towels, Amenities, Massage, Cleaning, etc.)
  // Direct Room Service does NOT go through Kitchen!
  const isDirectServiceOrder = (r) => {
    if (!r) return false;
    if (r.is_service_request === true || r.extra_data?.is_service_request === true) return true;
    const title = (r.title || '').toLowerCase();
    const desc = (r.description || r.notes || '').toLowerCase();
    const itemsText = (Array.isArray(r.items) ? r.items.map((it) => it.name || it.item_name || '').join(' ') : '').toLowerCase();
    const combined = `${title} ${desc} ${itemsText}`;
    const serviceKeywords = [
      'khăn', 'khan', 'gối', 'goi', 'chăn', 'chan', 'nệm', 'nem',
      'dọn phòng', 'don phong', 'vệ sinh', 've sinh', 'massage', 'mát xa', 'spa',
      'giặt', 'giat', 'ủi', 'ui', 'bàn ủi', 'bàn là', 'tiện ích', 'amenity',
      'dịch vụ phòng', 'dich vu phong', 'súc bình xăng', 'binh xang', 'dép', 'bàn chải'
    ];
    return serviceKeywords.some((k) => combined.includes(k));
  };

  // Helper to determine if a request is a Room Service food order (F&B / Kitchen)
  const isFoodOrder = (r) => {
    if (!r) return false;
    if (isDirectServiceOrder(r)) return false; // Dịch vụ phòng trực tiếp không phải món ăn của Bếp!
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

  const SERVICE_STEPS = [
    { step: 1, title: 'Khách Đặt' },
    { step: 2, title: 'Tiếp Nhận' },
    { step: 3, title: 'Giao Phòng' },
    { step: 4, title: 'Hoàn Tất' },
  ];

  const getDirectServiceStage = (status) => {
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
        nextStatus: 'In Progress',
        nextActionName: 'Tiếp Nhận Xử Lý',
        nextIcon: ConciergeBell,
        actionBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        deptNote: 'Room Service tiếp nhận và chuẩn bị đồ/dịch vụ',
        roleBadge: 'Room Service',
      };
    }
    if (
      s === 'in progress' ||
      s === 'in preparation' ||
      s === 'tiếp nhận' ||
      s === 'đang xử lý' ||
      s === 'đang chuẩn bị' ||
      s === 'sent to kitchen' ||
      s === 'ready'
    ) {
      return {
        step: 2,
        label: 'Đang Chuẩn Bị',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        nextStatus: 'Delivering',
        nextActionName: 'Giao Lên Phòng',
        nextIcon: Truck,
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white',
        deptNote: 'Đã chuẩn bị xong, nhân viên mang lên phòng cho khách',
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
        step: 3,
        label: 'Đang Giao Phòng',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        nextStatus: 'Completed',
        nextActionName: 'Xác Nhận Đã Giao',
        nextIcon: CheckCircle2,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        deptNote: 'Đang mang lên phòng. Xác nhận khi giao thành công',
        roleBadge: 'Room Service',
      };
    }
    return {
      step: 4,
      label: 'Đã Hoàn Tất',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      nextStatus: null,
      nextActionName: null,
      nextIcon: null,
      actionBtnClass: '',
      deptNote: 'Dịch vụ buồng phòng đã phục vụ xong',
      roleBadge: 'Hoàn Thành',
    };
  };

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

  const canUserActOnStage = (step, req = null, isDirectSvc = false) => {
    if (isExecutive) return true;
    if (isDirectSvc) {
      if (isKitchenStaff) return false;
      if (step === 1) return isRoomServiceStaff || (!isKitchenStaff);
      if (step === 2 || step === 3) return isRoomServiceStaff || (!isKitchenStaff);
      return false;
    }
    if (step === 1) return isKitchenStaff || isRoomServiceStaff || (!isKitchenStaff);
    if (step === 2) return isKitchenStaff || isRoomServiceStaff;
    if (step === 3) {
      // Bước 3 (Bếp nấu xong -> Món đã nấu xong): CHỈ người nhận request (đầu bếp phụ trách) mới được bấm!
      return isKitchenStaff && isTaskAssignedToMe(req);
    }
    if (step === 4 || step === 5) return isKitchenStaff || isRoomServiceStaff || (!isKitchenStaff);
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
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 2 || stage.step === 3;
    }
    return isTaskInProgress(r);
  };

  const isTaskDoneForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step >= 4; // Món đã nấu xong, đã xong phần phụ trách của Bếp
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 4;
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

    const isDirectSvc = isDirectServiceOrder(targetReq);
    const statusMessages = {
      'Sent to Kitchen': `Đã chuyển phiếu #${reqId} sang bộ phận Bếp (Kitchen)`,
      'Cooking': `Bếp đã tiếp nhận và đang chế biến phiếu #${reqId}`,
      'Ready': `Bếp đã làm xong món cho phiếu #${reqId}! Sẵn sàng giao phòng`,
      'Delivering': isDirectSvc
        ? `Room Service đang mang dịch vụ #${reqId} lên phòng cho khách!`
        : `Room Service đang lấy món và đồ dùng để giao phiếu #${reqId} lên phòng!`,
      'Completed': isDirectSvc
        ? `Đã hoàn tất và giao thành công dịch vụ #${reqId} lên phòng!`
        : `Đã hoàn thành và giao thành công phiếu #${reqId}!`,
      'In Progress': `Đã tiếp nhận xử lý phiếu #${reqId}!`,
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
                const isDirectSvc = isDirectServiceOrder(req);
                const isFood = !isDirectSvc && isFoodOrder(req);
                const isMultiStep = isFood || isDirectSvc;
                const currentSteps = isDirectSvc ? SERVICE_STEPS : (isFood ? FOOD_STEPS : null);
                const stage = isDirectSvc ? getDirectServiceStage(req.status) : (isFood ? getFoodOrderStage(req.status) : null);

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-xs space-y-3.5 transition-all hover:shadow-md ${
                      isMultiStep
                        ? (isDirectSvc ? stage.step === 3 : stage.step === 4)
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                          : (isDirectSvc ? stage.step === 2 : stage.step === 5)
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
                            Đơn Món Bếp
                          </span>
                        )}
                        {isDirectSvc && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold flex items-center gap-1">
                            <ConciergeBell className="w-2.5 h-2.5 text-indigo-600" />
                            Dịch Vụ Buồng Phòng
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isMultiStep ? (
                          <>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${stage.badgeClass}`}
                            >
                              {stage.label}
                            </span>
                            {stage.roleBadge && stage.step < currentSteps.length && (
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

                    {/* Stepper Component: Visual Progress Bar */}
                    {isMultiStep && (
                      <div className="py-2 px-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80">
                        <div className="flex items-center justify-between relative">
                          {/* Background connecting line */}
                          <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                          <div
                            className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, ((stage.step - 1) / (currentSteps.length - 1)) * 100)
                              )}%`,
                            }}
                          />

                          {currentSteps.map((s) => {
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
                                  {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
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

                    {/* Ordered Items / Services Preview */}
                    {isMultiStep && Array.isArray(req.items) && req.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDirectSvc ? (
                            <ConciergeBell className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="font-semibold text-stone-800 text-[11px]">
                            {isDirectSvc ? 'Dịch vụ yêu cầu:' : 'Món ăn:'}
                          </span>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-stone-500" />
                          <span>{req.guestName || req.guest_name || 'Khách lưu trú'}</span>
                        </span>
                        {(req.guestPhone || req.guest_phone) && (
                          <a
                            href={`tel:${req.guestPhone || req.guest_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Bấm để gọi điện thoại xác nhận đơn với khách"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>ĐT: {req.guestPhone || req.guest_phone}</span>
                          </a>
                        )}
                        {(req.roomPhone || req.room_phone) && (
                          <span
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium shadow-2xs"
                            title="Số máy nhánh phòng khách"
                          >
                            <Phone className="w-3 h-3 text-amber-600" />
                            <span>{req.roomPhone || req.room_phone}</span>
                          </span>
                        )}
                        {req.notes && <span className="text-stone-500">• Ghi chú: {req.notes}</span>}
                      </div>
                      <span className="text-[11px] text-stone-500">
                        Thời gian tạo: {req.time || 'Vừa xong'}
                      </span>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isMultiStep ? stage.deptNote : `Đang phụ trách bởi bạn (${staffName})`}
                      </span>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {/* 1. Multi-Step (Food or Direct Service) Action Button */}
                        {isMultiStep && stage.nextStatus && (
                          canUserActOnStage(stage.step, req, isDirectSvc) ? (
                            <div className="flex items-center gap-1.5">
                              {isDirectSvc && stage.step > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskStatus(req.id, 'Completed')}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-stone-600 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-stone-200 transition-all cursor-pointer shadow-2xs"
                                  title="Đánh dấu đã hoàn tất và giao thành công cho khách ngay lập tức"
                                >
                                  Hoàn Tất Nhanh
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateTaskStatus(req.id, stage.nextStatus)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5 ${stage.actionBtnClass}`}
                                title={stage.deptNote}
                              >
                                {stage.nextIcon && <stage.nextIcon className="w-3.5 h-3.5" />}
                                <span>{stage.nextActionName}</span>
                              </button>
                            </div>
                          ) : (
                            /* Waiting chips for kitchen steps */
                            isDirectSvc ? (
                              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">
                                Chờ {stage.roleBadge}
                              </span>
                            ) : (
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
                          )
                        )}

                        {/* Completed indicator */}
                        {isMultiStep && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isDirectSvc ? 'Đã Giao Xong' : 'Đã Giao Xong'}</span>
                          </span>
                        )}

                        {/* Standard Non-Food Task Complete button */}
                        {!isMultiStep && isInProgress && (
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
        const isModalDirectSvc = isDirectServiceOrder(selectedDetailReq);
        const isModalFood = !isModalDirectSvc && isFoodOrder(selectedDetailReq);
        const isModalMultiStep = isModalFood || isModalDirectSvc;
        const currentModalSteps = isModalDirectSvc ? SERVICE_STEPS : (isModalFood ? FOOD_STEPS : null);
        const modalStage = isModalDirectSvc
          ? getDirectServiceStage(selectedDetailReq.status)
          : (isModalFood ? getFoodOrderStage(selectedDetailReq.status) : null);
        const isModalCompleted = isTaskCompleted(selectedDetailReq);
        const modalItems = Array.isArray(selectedDetailReq.items) ? selectedDetailReq.items : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      isModalDirectSvc
                        ? 'bg-indigo-100 text-indigo-900'
                        : isModalFood
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    {isModalDirectSvc ? (
                      <ConciergeBell className="w-5 h-5 text-indigo-700" />
                    ) : isModalFood ? (
                      <ChefHat className="w-5 h-5 text-amber-800" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 tracking-tight">
                      {isModalDirectSvc
                        ? `Chi Tiết Dịch Vụ Buồng Phòng #${selectedDetailReq.id}`
                        : isModalFood
                        ? `Chi Tiết Đơn Room Service #${selectedDetailReq.id}`
                        : `Chi Tiết Yêu Cầu #${selectedDetailReq.id}`}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 font-mono mt-0.5">
                      <span>Vị trí: {selectedDetailReq.location}</span>
                      <span>• Khách: {selectedDetailReq.guestName || selectedDetailReq.guest_name || 'Khách lưu trú'}</span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                          ĐT: {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
                        </span>
                      )}
                      {(selectedDetailReq.roomPhone || selectedDetailReq.room_phone) && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-medium">
                          {selectedDetailReq.roomPhone || selectedDetailReq.room_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailReq(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                >
                  X
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
                  {isModalMultiStep && (
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${modalStage.badgeClass}`}>
                      {modalStage.label}
                    </span>
                  )}
                </div>

                {/* Stepper */}
                {isModalMultiStep && (
                  <div className="py-2.5 px-3.5 bg-[#FAF8F5] rounded-2xl border border-stone-200">
                    <div className="text-[11px] font-bold text-stone-700 mb-2 flex items-center justify-between">
                      <span>TIẾN ĐỘ THỰC HIỆN:</span>
                      <span className="text-amber-800 font-extrabold">{modalStage.deptNote}</span>
                    </div>
                    <div className="flex items-center justify-between relative mt-1">
                      <div className="absolute left-3 right-3 top-3 h-0.5 bg-stone-200 z-0" />
                      <div
                        className="absolute left-3 top-3 h-0.5 bg-emerald-500 transition-all duration-300 z-0"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, ((modalStage.step - 1) / (currentModalSteps.length - 1)) * 100)
                          )}%`,
                        }}
                      />
                      {currentModalSteps.map((s) => {
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
                              {isPast ? <Check className="w-3 h-3 stroke-[3]" /> : s.step}
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
                {isModalMultiStep && modalItems.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-stone-800 text-[11px] pb-1.5 border-b border-stone-100">
                      <span>{isModalDirectSvc ? 'DỊCH VỤ / VẬT DỤNG' : 'MÓN ĂN ĐÃ GỌI'}</span>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-800">Khách hàng: </span>
                      <span className="font-medium text-stone-900">
                        {selectedDetailReq.guestName || selectedDetailReq.guest_name || 'Khách lưu trú'}
                      </span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          ĐT di động: {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
                        </span>
                      )}
                      {(selectedDetailReq.roomPhone || selectedDetailReq.room_phone) && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium">
                          Máy nhánh: {selectedDetailReq.roomPhone || selectedDetailReq.room_phone}
                        </span>
                      )}
                    </div>
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

                {isModalMultiStep && modalStage.nextStatus && (
                  canUserActOnStage(modalStage.step, selectedDetailReq, isModalDirectSvc) ? (
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
                      Giai đoạn này do bộ phận {modalStage.roleBadge} thực hiện
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
