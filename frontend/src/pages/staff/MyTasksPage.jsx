import { useStaffText, staffDepartmentLabel, staffStatusLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
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
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffDept = currentUser?.department || 'F&B';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'In Progress' | 'Ready' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDetailReq, setSelectedDetailReq] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  const KITCHEN_STEPS = [
    { step: 1, title: st("Pending") },
    { step: 2, title: st("Cooking") },
    { step: 3, title: st("Done") },
  ];

  const getKitchenOrderStage = (status) => {
    const s = (status || '').toLowerCase().trim();
    if (
      s === 'pending' ||
      s === 'pending action' ||
      s === 'unassigned' ||
      s === 'waiting' ||
      s === 'chờ tiếp nhận' ||
      s === 'sent to kitchen' ||
      s === 'sent_to_kitchen' ||
      s === 'chuyển sang bếp' ||
      s === 'đã chuyển bếp'
    ) {
      return {
        step: 1,
        label: st("Pending"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'Cooking',
        nextActionName: st("Accept and cook"),
        nextIcon: ChefHat,
        actionBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        deptNote: st("The kitchen accepts and prepares the food"),
        roleBadge: st('Kitchen'),
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
        step: 2,
        label: st("Cooking"),
        badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
        nextStatus: 'Completed',
        nextActionName: st("Complete"),
        nextIcon: CheckCircle2,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        deptNote: st("Bếp đang chế biến món ăn"),
        roleBadge: st('Kitchen'),
      };
    }
    return {
      step: 3,
      label: st("Done"),
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      nextStatus: null,
      nextActionName: null,
      nextIcon: null,
      actionBtnClass: '',
      deptNote: st("Đã hoàn tất chu đáo"),
      roleBadge: st('Kitchen'),
    };
  };

  const FOOD_STEPS = [
    { step: 1, title: st("Guest orders") },
    { step: 2, title: st("Send to kitchen") },
    { step: 3, title: st("Cooking") },
    { step: 4, title: st("Ready") },
    { step: 5, title: st("Room delivery") },
    { step: 6, title: st("Completed") },
  ];

  const SERVICE_STEPS = [
    { step: 1, title: st("Guest orders") },
    { step: 2, title: st("Accepted") },
    { step: 3, title: st("Room delivery") },
    { step: 4, title: st("Completed") },
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
        label: st("Pending"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'In Progress',
        nextActionName: st("Accept request"),
        nextIcon: ConciergeBell,
        actionBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        deptNote: st("Room Service accepts and prepares the requested service"),
        roleBadge: st('Room Service'),
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
        label: st("Preparing"),
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        nextStatus: 'Delivering',
        nextActionName: st("Deliver to room"),
        nextIcon: Truck,
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white',
        deptNote: st("Ready for staff to deliver to the room"),
        roleBadge: st('Room Service'),
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
        label: st("Delivering to room"),
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        nextStatus: 'Completed',
        nextActionName: st("Confirm delivery"),
        nextIcon: CheckCircle2,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        deptNote: st("Delivery in progress. Confirm when delivered."),
        roleBadge: st('Room Service'),
      };
    }
    return {
      step: 4,
      label: st("Completed"),
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      nextStatus: null,
      nextActionName: null,
      nextIcon: null,
      actionBtnClass: '',
      deptNote: st("Room service completed"),
      roleBadge: st("Complete task"),
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
        label: st("Pending"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'Sent to Kitchen',
        nextActionName: st("Send to kitchen"),
        nextIcon: ChefHat,
        actionBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        deptNote: st("Room Service reviews the order and sends it to the kitchen"),
        roleBadge: st('Room Service'),
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
        label: st("Sent to kitchen"),
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
        nextStatus: 'Cooking',
        nextActionName: st("Accept and cook"),
        nextIcon: ChefHat,
        actionBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
        deptNote: st("The kitchen accepts and prepares the food"),
        roleBadge: st('Kitchen'),
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
        label: st("In preparation"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        nextStatus: 'Ready',
        nextActionName: st("Food ready"),
        nextIcon: Sparkles,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        deptNote: st("Food ready; notify Room Service"),
        roleBadge: st('Kitchen'),
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
        label: st("Food ready"),
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        nextStatus: 'Delivering',
        nextActionName: st("Collect and deliver"),
        nextIcon: Truck,
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm',
        deptNote: st("Room Service collects food and utensils for delivery"),
        roleBadge: st('Room Service'),
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
        label: st("Delivering to room"),
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        nextStatus: 'Completed',
        nextActionName: st("Confirm delivery"),
        nextIcon: CheckCircle2,
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
        deptNote: st("Food and items delivered to the room"),
        roleBadge: st('Room Service'),
      };
    }
    return {
      step: 6,
      label: st("Completed"),
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      nextStatus: null,
      nextActionName: null,
      nextIcon: null,
      actionBtnClass: '',
      deptNote: st("Order fulfilled"),
      roleBadge: st("Complete task"),
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
    const isKitchenOrder = (isKitchenStaff || req?.department === 'Kitchen' || req?.department === 'DEP-KITCHEN');
    if (isKitchenOrder) {
      return true;
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
  // - Bộ phận Bếp (Kitchen): 3 trạng thái chuẩn hoá (Pending -> Cooking -> Done).
  // - Room Service: Phụ trách toàn trình từ tiếp nhận tới giao phòng thành công.
  const isTaskActiveForUser = (r) => {
    if (isTaskCompleted(r)) return false;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 2; // Cooking
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 2 || stage.step === 3;
    }
    return isTaskInProgress(r);
  };

  const isTaskDoneForUser = (r) => {
    if (isTaskCompleted(r)) return true;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 3; // Done
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

  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
      'Sent to Kitchen': st("Request #{0} sent to the kitchen.", reqId),
      'Cooking': st("The kitchen is preparing request #{0}.", reqId),
      'Ready': st("Request #{0} is ready for room delivery.", reqId),
      'Delivering': isDirectSvc
        ? st("Room Service is delivering service #{0} to the guest.", reqId)
        : st("Room Service is collecting food and items for request #{0}.", reqId),
      'Completed': isDirectSvc
        ? st("Service #{0} completed and delivered.", reqId)
        : st("Request #{0} completed and delivered.", reqId),
      'In Progress': st("Request #{0} accepted.", reqId),
    };
    onNotify(statusMessages[nextStatus] || st("Request #{0} updated: {1}", reqId, nextStatus));
  };



  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FAF8F5] font-sans">
      <div className="staff-page-container max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <StaffPageHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="staff-heading-decoration w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1917]">{st("My assigned tasks")} </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-700">
                    {myAssignedRequests.length} {st("requests")} </span>
                </div>
              </div>
            </div>
          </div>

          <div className="staff-header-details flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-xs">
              <User className="w-3.5 h-3.5 text-stone-500" />
              <span>{st("Staff:")} {staffName} ({st(staffDepartmentLabel(staffDept))})</span>
            </div>
          </div>
        </StaffPageHeader>

        {/* Mini KPI Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-stone-500 uppercase">{st("Active tasks")}</p>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200">{st("Up to 3")} </span>
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
              <p className="text-[11px] font-bold text-stone-500 uppercase">{st("In preparation")}</p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">{cookingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ChefHat className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">{st("Ready for collection")}</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{readyCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">
                {isKitchenStaff ? st("Kitchen completed") : st("Delivered")}
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
                placeholder={st("Search by order ID, room or guest...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
              />
            </div>
            <button
              onClick={loadMyRequests}
              title={st("Refresh data")}
              className="p-2 bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E0DCD3] text-stone-700 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tab Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(isKitchenStaff
              ? [
                  { key: 'All', label: st("All ({0})", myAssignedRequests.length) },
                  { key: 'In Progress', label: st("Cooking ({0})", activeCount) },
                  { key: 'Completed', label: st("Done ({0})", completedCount) },
                ]
              : [
                  { key: 'All', label: st("All ({0})", myAssignedRequests.length) },
                  { key: 'In Progress', label: st("In progress ({0})", activeCount) },
                  { key: 'Ready', label: st("Ready for collection ({0})", readyCount) },
                  { key: 'Completed', label: st("Delivered ({0})", completedCount) },
                ]
            ).map((tab) => (
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
            <p className="text-sm font-semibold text-stone-600">{st("Loading tasks...")}</p>
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
                    ? st("You have no assigned requests yet.")
                    : st("No requests in \"{0}\".", statusFilter)}
                </p>
                <p className="text-stone-500 text-xs">{st("Go to")} <strong>{st("Requests")}</strong> {st("to claim or forward guest requests.")} </p>
              </div>
            ) : (
              paginatedRequests.map((req) => {
                const isInProgress = isTaskInProgress(req);
                const isCompleted = isTaskCompleted(req);
                const isDirectSvc = isDirectServiceOrder(req);
                const isFood = !isDirectSvc && isFoodOrder(req);
                const isKitchenOrder = (isKitchenStaff || req.department === 'Kitchen' || req.department === 'DEP-KITCHEN') && isFood;
                const isMultiStep = isFood || isDirectSvc;
                const currentSteps = isKitchenOrder
                  ? KITCHEN_STEPS
                  : isDirectSvc
                  ? SERVICE_STEPS
                  : isFood
                  ? FOOD_STEPS
                  : null;
                const stage = isKitchenOrder
                  ? getKitchenOrderStage(req.status)
                  : isDirectSvc
                  ? getDirectServiceStage(req.status)
                  : isFood
                  ? getFoodOrderStage(req.status)
                  : null;

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-xs space-y-3.5 transition-all hover:shadow-md ${
                      isMultiStep
                        ? isKitchenOrder
                          ? stage.step === 3
                            ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                            : stage.step === 2
                            ? 'border-l-4 border-l-amber-500'
                            : ''
                          : (isDirectSvc ? stage.step === 4 : stage.step === 4)
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/15'
                          : (isDirectSvc ? stage.step === 3 : stage.step === 5)
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
                          {st(staffDepartmentLabel(req.department))}
                        </span>
                        {isFood && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                            <Utensils className="w-2.5 h-2.5 text-amber-600" />{st("Food order")} </span>
                        )}
                        {isDirectSvc && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold flex items-center gap-1">
                            <ConciergeBell className="w-2.5 h-2.5 text-indigo-600" />{st("Room service")} </span>
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
                              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-semibold border border-stone-200">{st("Assigned to:")} {stage.roleBadge}
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
                            {st(staffStatusLabel(req.status))}
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
                            {isDirectSvc ? st("Requested services:") : st("Food:")}
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
                          <span className="font-bold text-stone-900 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200 text-[11px]">{st("Total:")} {Number(req.total_amount).toLocaleString('vi-VN')} ₫
                          </span>
                        )}
                      </div>
                    )}

                    {/* Guest info & Notes */}
                    <div className="text-xs text-[#78716C] flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-stone-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-stone-500" />
                          <span>{req.guestName || req.guest_name || st("Hotel guest")}</span>
                        </span>
                        {(req.guestPhone || req.guest_phone) && (
                          <a
                            href={`tel:${req.guestPhone || req.guest_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                            title={st("Call the guest to confirm the order")}
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{st("Phone:")} {req.guestPhone || req.guest_phone}</span>
                          </a>
                        )}
                        {(req.roomPhone || req.room_phone) && (
                          <span
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium shadow-2xs"
                            title={st("Room extension")}
                          >
                            <Phone className="w-3 h-3 text-amber-600" />
                            <span>{req.roomPhone || req.room_phone}</span>
                          </span>
                        )}
                        {req.notes && <span className="text-stone-500">{st("• Notes:")} {req.notes}</span>}
                      </div>
                      <span className="text-[11px] text-stone-500">{st("Created:")} {req.time || st("Just completed")}
                      </span>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isMultiStep ? stage.deptNote : st("Assigned to you ({0})", staffName)}
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
                                  title={st("Mark as completed and delivered to the guest")}
                                >{st("Quick complete")} </button>
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
                              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{st("Waiting")} {stage.roleBadge}
                              </span>
                            ) : (
                              stage.step === 2 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={st("This order has been sent to the kitchen. Kitchen staff must accept it.")}
                                >
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{st("Awaiting kitchen acceptance")}</span>
                                </span>
                              ) : stage.step === 3 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={
                                    isKitchenStaff
                                      ? st("This order is assigned to {0}. Only the assigned staff member can mark it ready.", req.assignedTo || req.assigned_staff_name || st('Another chef'))
                                      : st("The kitchen is preparing the food and will notify Room Service when it is ready.")
                                  }
                                >
                                  <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>
                                    {isKitchenStaff
                                      ? st("Prepared by: {0}", req.assignedTo || req.assigned_staff_name || st('Another chef'))
                                      : st("Kitchen is cooking...")}
                                  </span>
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{st("Waiting")} {stage.roleBadge}
                                </span>
                              )
                            )
                          )
                        )}

                        {/* Completed indicator */}
                        {isMultiStep && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isDirectSvc ? st("Delivered") : st("Delivered")}</span>
                          </span>
                        )}

                        {/* Standard Non-Food Task Complete button */}
                        {!isMultiStep && isInProgress && (
                          <button
                            onClick={() => handleUpdateTaskStatus(req.id, 'Completed')}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <span>{st("Complete task")}</span>
                          </button>
                        )}

                        {/* Xem Chi Tiết */}
                        <button
                          onClick={() => setSelectedDetailReq(req)}
                          className="px-4 py-1.5 rounded-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-stone-900 border border-[#E0DCD3] text-xs font-bold transition-all shadow-xs cursor-pointer"
                          title={st("View request details")}
                        >
                          <span>{st("View details")}</span>
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
                        ? st("Service details #{0}", selectedDetailReq.id)
                        : isModalFood
                        ? st("Room Service order details #{0}", selectedDetailReq.id)
                        : st("Request #{0}", selectedDetailReq.id)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 font-mono mt-0.5">
                      <span>{st("Location:")} {selectedDetailReq.location}</span>
                      <span>{st("• Guest:")} {selectedDetailReq.guestName || selectedDetailReq.guest_name || st("Hotel guest")}</span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">{st("Phone:")} {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
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
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100">{st("Department:")} {selectedDetailReq.department}
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
                      <span>{st("PROGRESS:")}</span>
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
                      <span>{isModalDirectSvc ? st("SERVICES / ITEMS") : st("FOOD ORDERED")}</span>
                      <span>{st("QUANTITY & UNIT PRICE")}</span>
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
                        <span>{st("TOTAL:")}</span>
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
                      <span className="font-semibold text-stone-800">{st("Guest:")} </span>
                      <span className="font-medium text-stone-900">
                        {selectedDetailReq.guestName || selectedDetailReq.guest_name || st("Hotel guest")}
                      </span>
                      {(selectedDetailReq.guestPhone || selectedDetailReq.guest_phone) && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">{st("Mobile phone:")} {selectedDetailReq.guestPhone || selectedDetailReq.guest_phone}
                        </span>
                      )}
                      {(selectedDetailReq.roomPhone || selectedDetailReq.room_phone) && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium">{st("Extension:")} {selectedDetailReq.roomPhone || selectedDetailReq.room_phone}
                        </span>
                      )}
                    </div>
                    {selectedDetailReq.notes && (
                      <p>
                        <span className="font-semibold text-stone-800">{st("Notes:")} </span>
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
                >{st("Close")} </button>

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
                    <span className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 flex items-center gap-1.5 shadow-2xs">{st("This step is handled by")} {modalStage.roleBadge} {st("staff")} </span>
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
