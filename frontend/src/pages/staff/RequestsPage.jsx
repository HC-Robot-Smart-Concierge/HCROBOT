import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock, CheckCircle2, Eye, User, MapPin, Utensils, ChefHat, Send, Truck, ArrowRight, Sparkles } from 'lucide-react';
import { NewDirectiveModal } from '../../components/dashboard/Modals';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
  createHousekeepingRequest,
  createMaintenanceRequest,
  createOperationalDirective,
} from '../../services/operationsApi';

export const RequestsPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
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
  const pageSize = 10;

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

  // Department Role Filtering & Multi-Department Authorization
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
    userDeptLower.includes('executive') ||
    userDeptLower.includes('management');

  // Check if current logged-in user belongs to Kitchen (Bếp)
  const isKitchenStaff =
    userDeptLower.includes('kitchen') ||
    userDeptLower.includes('bếp') ||
    userDeptLower.includes('bep') ||
    userDeptLower.includes('chef') ||
    userNameLower.includes('kitchen') ||
    userNameLower.includes('bep') ||
    userFullNameLower.includes('bếp') ||
    userFullNameLower.includes('kitchen');

  // Check if current logged-in user belongs to Room Service / F&B (Phục vụ phòng)
  const isRoomServiceStaff =
    userDeptLower.includes('room') ||
    userDeptLower.includes('phục vụ phòng') ||
    userDeptLower.includes('phuc vu phong') ||
    userDeptLower.includes('f&b') ||
    userNameLower.includes('room_service') ||
    userNameLower.includes('roomservice') ||
    userFullNameLower.includes('phục vụ phòng') ||
    userFullNameLower.includes('room service');

  // Phân quyền chặt chẽ theo từng giai đoạn (Stage-based Authorization):
  // - Bước 1 (Khách đặt -> Chuyển sang bếp): CHỈ Room Service (hoặc Executive/Admin)
  // - Bước 2 (Đã chuyển bếp -> Bếp nhận nấu): CHỈ Kitchen / Đầu Bếp (hoặc Executive/Admin)
  // - Bước 3 (Bếp đang nấu -> Món đã nấu xong): CHỈ Kitchen / Đầu Bếp (hoặc Executive/Admin)
  // - Bước 4 (Món đã nấu xong -> Lấy món & giao phòng): CHỈ Room Service (hoặc Executive/Admin)
  // Helper to check if task is assigned to current user
  const isTaskAssignedToMe = (r) => {
    if (!r) return false;
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

  // Phân quyền chặt chẽ theo từng giai đoạn (Stage-based Authorization):
  // - Bước 1 (Khách đặt -> Chuyển sang bếp): CHỈ Room Service (hoặc Executive/Admin)
  // - Bước 2 (Đã chuyển bếp -> Bếp nhận nấu): CHỈ Kitchen / Đầu Bếp (hoặc Executive/Admin)
  // - Bước 3 (Bếp đang nấu -> Món đã nấu xong): CHỈ người nhận request (đầu bếp phụ trách) mới được bấm!
  // - Bước 4 (Món đã nấu xong -> Lấy món & giao phòng): CHỈ Room Service (hoặc Executive/Admin)
  // - Bước 5 (Đang giao phòng -> Xác nhận đã giao): CHỈ Room Service (hoặc Executive/Admin)
  const canUserActOnStage = (step, req = null) => {
    if (isExecutive) return true; // Quản lý khách sạn có quyền can thiệp/kiểm thử toàn trình
    if (step === 1) {
      // Room Service kiểm tra và chuyển cho Bếp
      return isRoomServiceStaff || (!isKitchenStaff);
    }
    if (step === 2) {
      // Bếp nhận nấu: Đầu bếp trực ca có thể tiếp nhận đơn
      return isKitchenStaff;
    }
    if (step === 3) {
      // Bếp nấu xong -> Món đã nấu xong: CHỈ người nhận request mới được bấm!
      return isKitchenStaff && isTaskAssignedToMe(req);
    }
    if (step === 4 || step === 5) {
      // Bếp nấu xong -> Room Service lấy món đi giao và xác nhận hoàn tất: CHỈ Room Service mới được bấm!
      return isRoomServiceStaff || (!isKitchenStaff);
    }
    return false;
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

  // Helper to check task status categories
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
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white',
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
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deptFilter, searchQuery]);

  const isDeptMatch = (reqDept, userDept) => {
    if (!reqDept || !userDept) return true;
    const rD = reqDept.toLowerCase().trim();
    const uD = userDept.toLowerCase().trim();
    if (rD === uD) return true;
    if (
      (uD.includes('f&b') || uD.includes('room') || uD.includes('kitchen') || uD.includes('bếp')) &&
      (rD.includes('f&b') || rD.includes('room') || rD.includes('kitchen') || rD.includes('bếp') || rD.includes('ẩm thực'))
    ) return true;
    if ((uD.includes('housekeeping') || uD.includes('buồng')) && (rD.includes('housekeeping') || rD.includes('buồng'))) return true;
    if ((uD.includes('bell') || uD.includes('hành lý')) && (rD.includes('bell') || rD.includes('hành lý'))) return true;
    if ((uD.includes('maint') || uD.includes('bảo trì') || uD.includes('kỹ thuật')) && (rD.includes('maint') || rD.includes('bảo trì') || rD.includes('kỹ thuật'))) return true;
    if ((uD.includes('reception') || uD.includes('lễ tân')) && (rD.includes('reception') || rD.includes('lễ tân'))) return true;
    return false;
  };

  // Base list scoped to department & task visibility rules:
  // - Phương án 2 (Tách biệt hàng đợi Bếp & Room Service):
  //   + Nhân viên Bếp (Kitchen):
  //     * Bước 1 (Khách Đặt): Chưa chuyển bếp -> Bếp không thấy.
  //     * Bước 2 (Đã Chuyển Bếp): Chờ nhận nấu -> Hiển thị cho tất cả đầu bếp để nhận việc.
  //     * Bước 3 (Bếp Đang Nấu): Đã có người nhận -> Ẩn đối với người khác (!isTaskAssignedToMe), chỉ người nhận mới thấy.
  //     * Bước 4, 5 (Món Xong / Đang Giao): Ẩn đối với người khác, người nấu vẫn có thể theo dõi.
  //     * Bước 6 (Đã Hoàn Tất): Hiển thị bình thường trong lịch sử đơn hàng.
  //   + Room Service: Quản lý tiếp nhận (step 1) và giao phòng (step 4, 5).
  const deptScopedRequests = requests.filter((r) => {
    if (!isExecutive && !isDeptMatch(r.department, staffDept)) {
      return false;
    }

    if (!isExecutive) {
      if (isFoodOrder(r)) {
        const stage = getFoodOrderStage(r.status);
        if (isKitchenStaff) {
          // 1. Bước 1: Khách đặt -> Room Service duyệt (Bếp không thấy)
          if (stage.step === 1) {
            return false;
          }
          // 2. Bước 3: Bếp đang nấu -> Đã có người nhận, ẩn khỏi người KHÁC (!isTaskAssignedToMe)
          if (stage.step === 3 && !isTaskAssignedToMe(r)) {
            return false;
          }
          // 3. Bước 4, 5: Món xong / Giao phòng -> Ẩn khỏi người KHÁC (!isTaskAssignedToMe)
          if ((stage.step === 4 || stage.step === 5) && !isTaskAssignedToMe(r)) {
            return false;
          }
        } else {
          // Với Room Service / Bộ phận khác:
          // - Bước 3: Bếp đang nấu -> Ẩn khỏi Requests của Room Service (Bếp đang nấu)
          if (stage.step === 3) {
            return false;
          }
          // - Bước 5: Đang giao phòng -> Đã có người nhận đi giao, ẩn khỏi người KHÁC
          if (stage.step === 5 && !isTaskAssignedToMe(r)) {
            return false;
          }
        }
      } else {
        // Đơn thông thường (Non-Food):
        // Khi task đã có người nhận (In Progress) mà KHÔNG PHẢI TÔI NHẬN -> Ẩn khỏi Requests!
        if (isTaskInProgress(r) && !isTaskAssignedToMe(r)) {
          return false;
        }
      }
    }

    return true;
  });

  // Helper phân loại trạng thái theo vai trò người dùng (Bếp vs Room Service/Khác)
  const isReqPendingForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step === 2; // Đã chuyển bếp, chờ Bếp bấm nhận nấu
    }
    return isTaskPending(r);
  };

  const isReqInProgressForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      // Với Bếp: Chỉ 'Đang Xử Lý' khi bếp đang chế biến (step 3).
      // Khi đã đến 'Món Xong' (step >= 4), xem như Bếp đã xong phần phụ trách, phần còn lại là của Room Service!
      return stage.step === 3;
    }
    return isTaskInProgress(r);
  };

  const isReqCompletedForUser = (r) => {
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step >= 4; // Món đã nấu xong -> xong phần phụ trách của Bếp
    }
    return isTaskCompleted(r);
  };

  // Calculate live badge counts
  const pendingCount = deptScopedRequests.filter(isReqPendingForUser).length;
  const inProgressCount = deptScopedRequests.filter(isReqInProgressForUser).length;
  const completedCount = deptScopedRequests.filter(isReqCompletedForUser).length;

  // Sorting logic based on progress workflow:
  // 1. Pending (chờ tiếp nhận)
  // 2. In Progress (đang xử lý / Bếp nấu)
  // 3. Completed (hoàn thành)
  const getRequestPriorityScore = (req) => {
    const isPending = isReqPendingForUser(req);
    const isInProgress = isReqInProgressForUser(req);
    const isCompleted = isReqCompletedForUser(req);

    if (isPending) return 1;
    if (isInProgress) return 2;
    if (isCompleted) return 3;
    return 4;
  };

  // Filter requests
  const filtered = deptScopedRequests.filter((r) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Pending') return isReqPendingForUser(r);
      if (statusFilter === 'In Progress') return isReqInProgressForUser(r);
      if (statusFilter === 'Completed') return isReqCompletedForUser(r);
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

  // Giới hạn nhiệm vụ đang xử lý (Cho phép nhận tối đa 3 đơn cùng lúc)
  const MAX_CONCURRENT_TASKS = 3;
  const myActiveTasks = requests.filter((r) => {
    if (!isTaskAssignedToMe(r)) return false;
    if (isKitchenStaff && isFoodOrder(r)) {
      const stage = getFoodOrderStage(r.status);
      return stage.step === 2 || stage.step === 3;
    }
    return isTaskInProgress(r);
  });
  const activeTaskCount = myActiveTasks.length;
  const isTaskLimitReached = activeTaskCount >= MAX_CONCURRENT_TASKS;

  // Action: Transition task to next status in workflow -> Persists to Database
  const handleUpdateTaskStatus = async (reqId, nextStatus) => {
    const targetReq = requests.find((r) => r.id === reqId);
    // Nếu là bước nhận đơn mới (từ Chờ Tiếp Nhận) và đã đạt giới hạn 3 đơn
    if (targetReq && isTaskPending(targetReq) && isTaskLimitReached) {
      onNotify(
        `⚠️ Bạn đang phụ trách ${activeTaskCount}/${MAX_CONCURRENT_TASKS} đơn (${myActiveTasks.map((t) => '#' + t.id).join(', ')}). Vui lòng hoàn tất hoặc giao bớt đơn trước khi nhận thêm!`
      );
      return;
    }

    const isCompletedStatus =
      nextStatus.toLowerCase() === 'completed' ||
      nextStatus.toLowerCase() === 'delivered' ||
      nextStatus.toLowerCase() === 'done';

    // Khi nhận việc mới (chuyển sang Cooking, Delivering, hoặc In Progress), gán chính xác người thực hiện
    const isNewClaimOrAssign =
      nextStatus.toLowerCase() === 'cooking' ||
      nextStatus.toLowerCase() === 'delivering' ||
      nextStatus.toLowerCase() === 'in progress';

    const finalAssignedTo = isNewClaimOrAssign ? staffName : (targetReq?.assignedTo || staffName);

    // 1. Optimistic UI update
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

    // 2. Call backend API to persist in PostgreSQL database
    await updateGenericRequestStatus(reqId, nextStatus, finalAssignedTo);

    const statusMessages = {
      'Sent to Kitchen': `Đã chuyển phiếu #${reqId} sang bộ phận Bếp và lưu vào mục [Yêu Cầu Cá Nhân]!`,
      'Cooking': `Bếp đã tiếp nhận và đang chế biến phiếu #${reqId}`,
      'Ready': `Bếp đã làm xong món cho phiếu #${reqId}! Sẵn sàng giao phòng`,
      'Delivering': `Room Service đang giao phiếu #${reqId} lên phòng`,
      'Completed': `Đã hoàn thành và giao thành công phiếu #${reqId}!`,
      'In Progress': `Đã nhận xử lý phiếu #${reqId} và lưu vào mục [Yêu Cầu Cá Nhân]!`,
    };
    onNotify(statusMessages[nextStatus] || `Đã cập nhật trạng thái phiếu #${reqId}: ${nextStatus}`);
  };

  // Action: Self-Claim Request -> Persists to Database with Max-3 Tasks Guard
  const handleClaim = async (reqId) => {
    if (isTaskLimitReached) {
      onNotify(
        `⚠️ Bạn đang phụ trách ${activeTaskCount}/${MAX_CONCURRENT_TASKS} yêu cầu (${myActiveTasks.map((t) => '#' + t.id).join(', ')}). Vui lòng hoàn tất bớt việc trước khi nhận thêm!`
      );
      return;
    }

    const req = requests.find((r) => r.id === reqId);
    if (isFoodOrder(req)) {
      await handleUpdateTaskStatus(reqId, 'Sent to Kitchen');
    } else {
      await handleUpdateTaskStatus(reqId, 'In Progress');
    }
  };

  // Action: Mark Completed -> Persists to Database
  const handleMarkCompleted = async (reqId) => {
    await handleUpdateTaskStatus(reqId, 'Completed');
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
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FAF8F5] font-sans">
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
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isTaskLimitReached
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                Đang nhận: {activeTaskCount}/{MAX_CONCURRENT_TASKS}
              </span>
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

          {/* Status Filter Dropdown (Gray select) */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-stone-500 shrink-0">Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                onNotify(`Đã lọc: ${e.target.value}`);
              }}
              className="w-full md:w-56 px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-semibold text-stone-900 outline-none cursor-pointer focus:border-stone-400"
            >
              <option value="All">Tất Cả ({deptScopedRequests.length})</option>
              <option value="Pending">Chờ Tiếp Nhận ({pendingCount})</option>
              <option value="In Progress">Đang Xử Lý ({inProgressCount})</option>
              <option value="Completed">Đã Hoàn Tất ({completedCount})</option>
            </select>
          </div>
        </div>

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
                const isFood = isFoodOrder(req);
                const stage = isFood ? getFoodOrderStage(req.status) : null;

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-sm space-y-3.5 transition-all hover:shadow-md ${
                      isFood
                        ? stage.step === 4
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10'
                          : stage.step === 5
                          ? 'border-l-4 border-l-purple-500'
                          : isInProgress
                          ? 'border-l-4 border-l-sky-500'
                          : ''
                        : isInProgress
                        ? 'border-l-4 border-l-sky-500'
                        : ''
                    } ${isCompleted ? 'border-l-4 border-l-emerald-500 bg-emerald-50/5' : ''}`}
                  >
                    {/* Top Bar: ID, Location, Department & Status */}
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
                              isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Request Title (Bold & Clean) */}
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
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : isCurrent
                                      ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow'
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

                    {/* Ordered Items Pill Preview */}
                    {isFood && Array.isArray(req.items) && req.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold text-stone-800 text-[11px]">Danh sách món:</span>
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

                    {/* Desktop Extra Detail */}
                    <div className="hidden md:block text-xs text-[#78716C]">
                      <span className="font-semibold text-stone-800">
                        {req.guestName || 'Khách lưu trú'}
                      </span>
                      {req.notes && ` • Ghi chú: ${req.notes}`}
                    </div>

                    {/* Bottom Action Bar: Compact & Responsive */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isFood ? (
                          stage.deptNote
                        ) : isPending ? (
                          'Chờ tiếp nhận'
                        ) : isInProgress ? (
                          `Đang xử lý: ${handlerName}`
                        ) : (
                          `Hoàn tất bởi: ${handlerName}`
                        )}
                      </span>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {/* 1. Food Order Action Button for the current stage */}
                        {isFood && stage.nextStatus && (
                          canUserActOnStage(stage.step, req) ? (
                            <button
                              onClick={() => {
                                if (stage.step === 1 && isTaskLimitReached) {
                                  onNotify(
                                    `⚠️ Bạn đang phụ trách ${activeTaskCount}/${MAX_CONCURRENT_TASKS} đơn (${myActiveTasks.map((t) => '#' + t.id).join(', ')}). Vui lòng hoàn tất hoặc giao bớt đơn trước khi nhận thêm!`
                                  );
                                  return;
                                }
                                handleUpdateTaskStatus(req.id, stage.nextStatus);
                              }}
                              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                                stage.step === 1 && isTaskLimitReached
                                  ? 'bg-stone-200 text-stone-500 hover:bg-stone-300 border border-stone-300'
                                  : stage.actionBtnClass
                              }`}
                              title={
                                stage.step === 1 && isTaskLimitReached
                                  ? `Đã đạt giới hạn tối đa ${MAX_CONCURRENT_TASKS} đơn cùng lúc (${activeTaskCount}/${MAX_CONCURRENT_TASKS})`
                                  : stage.deptNote
                              }
                            >
                              {stage.nextIcon && <stage.nextIcon className="w-3.5 h-3.5" />}
                              <span>{stage.nextActionName}</span>
                              {stage.step === 1 && isTaskLimitReached && (
                                <span className="text-[10px] ml-1 bg-stone-300/80 px-1.5 py-0.2 rounded-full text-stone-700">
                                  {activeTaskCount}/{MAX_CONCURRENT_TASKS}
                                </span>
                              )}
                            </button>
                          ) : (
                            /* Không thuộc quyền bộ phận hiện tại -> hiển thị chip trạng thái chờ trực quan */
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
                                    ? `Đơn này do ${handlerName} nhận nấu. Chỉ ${handlerName} mới có quyền bấm món nấu xong.`
                                    : 'Bếp đang chế biến món ăn. Khi hoàn tất, Bếp sẽ bấm xác nhận để báo cho Room Service.'
                                }
                              >
                                <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>{isKitchenStaff ? `Đang nấu bởi: ${handlerName}` : 'Bếp Đang Nấu Món...'}</span>
                              </span>
                            ) : stage.step === 4 ? (
                              <span
                                className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1.5 select-none shadow-2xs"
                                title="Món đã nấu xong! Đang chờ Room Service đến lấy món và giao lên phòng."
                              >
                                <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Chờ Room Service Lấy Món</span>
                              </span>
                            ) : stage.step === 5 ? (
                              <span
                                className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-200 flex items-center gap-1.5 select-none shadow-2xs"
                                title="Room Service đang mang món lên phòng cho khách."
                              >
                                <Truck className="w-3.5 h-3.5 text-purple-600" />
                                <span>Room Service Đang Giao</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">
                                Chờ {stage.roleBadge}
                              </span>
                            )
                          )
                        )}

                        {/* Food Order Completed indicator */}
                        {isFood && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã Hoàn Tất Đơn</span>
                          </span>
                        )}

                        {/* 2. Standard Non-Food: Claim button */}
                        {!isFood && isPending && (
                          <button
                            onClick={() => handleClaim(req.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 ${
                              isTaskLimitReached
                                ? 'bg-stone-200 text-stone-500 hover:bg-stone-300 border border-stone-300'
                                : 'bg-[#18181B] hover:bg-black text-white'
                            }`}
                            title={
                              isTaskLimitReached
                                ? `Bạn đang xử lý ${activeTaskCount}/${MAX_CONCURRENT_TASKS} việc (${myActiveTasks.map((t) => '#' + t.id).join(', ')}). Hãy hoàn thành trước khi nhận thêm!`
                                : 'Bấm để nhận xử lý yêu cầu'
                            }
                          >
                            <span>Nhận Việc</span>
                            {isTaskLimitReached && (
                              <span className="text-[10px] ml-1 bg-stone-300 px-1.5 py-0.2 rounded-full text-stone-700">
                                {activeTaskCount}/{MAX_CONCURRENT_TASKS}
                              </span>
                            )}
                          </button>
                        )}

                        {/* 3. Standard Non-Food: Complete button */}
                        {!isFood && isInProgress && (isMine || isExecutive) && (
                          <button
                            onClick={() => handleMarkCompleted(req.id)}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                          >
                            <span>Hoàn Thành</span>
                          </button>
                        )}

                        {/* 4. Chuyển sang trang Yêu Cầu Cá Nhân nếu đang phụ trách */}
                        {isMine && isInProgress && (
                          <button
                            onClick={() => onNavigate('MyTasks')}
                            className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                            title="Chuyển sang trang Yêu Cầu Cá Nhân để theo dõi"
                          >
                            <User className="w-3.5 h-3.5 text-amber-700" />
                            <span>Yêu Cầu Cá Nhân</span>
                          </button>
                        )}

                        {/* 5. Xem Chi Tiết button (always visible) */}
                        <button
                          onClick={() => setSelectedDetailReq(req)}
                          className="px-4 py-1.5 rounded-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-stone-900 border border-[#E0DCD3] text-xs font-bold transition-all shadow-sm cursor-pointer"
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

      {/* 2. Modal: Detail View & Direct Action for any task status */}
      {selectedDetailReq && (() => {
        const isModalFood = isFoodOrder(selectedDetailReq);
        const modalStage = isModalFood ? getFoodOrderStage(selectedDetailReq.status) : null;
        const isModalCompleted = isTaskCompleted(selectedDetailReq);
        const isModalPending = isTaskPending(selectedDetailReq);
        const isModalInProgress = isTaskInProgress(selectedDetailReq);
        const modalItems = Array.isArray(selectedDetailReq.items) ? selectedDetailReq.items : [];

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      isModalFood
                        ? 'bg-amber-100 text-amber-900'
                        : isModalCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    {isModalFood ? (
                      <ChefHat className="w-5 h-5 text-amber-700" />
                    ) : isModalCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 tracking-tight">
                      {isModalFood
                        ? `Đơn Món Room Service #${selectedDetailReq.id}`
                        : isModalCompleted
                        ? 'Chi Tiết Phiếu Yêu Cầu Đã Hoàn Tất'
                        : `Chi Tiết Phiếu Yêu Cầu #${selectedDetailReq.id}`}
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

                  {isModalFood ? (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${modalStage.badgeClass}`}
                      >
                        {modalStage.label}
                      </span>
                      {modalStage.roleBadge && (
                        <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-semibold text-[11px] border border-stone-200">
                          Phụ trách: {modalStage.roleBadge}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
                        isModalCompleted
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isModalPending
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-sky-100 text-sky-800 border-sky-200'
                      }`}
                    >
                      {selectedDetailReq.status}
                    </span>
                  )}

                  {((selectedDetailReq.priority || '').toUpperCase().includes('HIGH') ||
                    (selectedDetailReq.priority || '').toUpperCase().includes('URGENT')) && (
                    <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold text-[11px]">
                      HIGH PRIORITY
                    </span>
                  )}
                </div>

                {/* Stepper for Food Orders */}
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
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : isCurrent
                                  ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow'
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

                {/* Ordered Items Detailed Table */}
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
                          <div
                            key={idx}
                            className="py-1.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-stone-800">
                              {it.name || it.item_name}
                            </span>
                            <div className="flex items-center gap-3 text-stone-600">
                              <span className="font-bold text-stone-900">x{q}</span>
                              {p > 0 && (
                                <span className="font-medium">
                                  {Number(p * q).toLocaleString('vi-VN')} ₫
                                </span>
                              )}
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

                {/* Title & Content */}
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-2">
                  <h4 className="text-sm font-extrabold text-stone-900">
                    {selectedDetailReq.title}
                  </h4>
                  <div className="text-stone-600 space-y-1">
                    <p>
                      <span className="font-semibold text-stone-800">
                        Khách hàng / Người yêu cầu:{' '}
                      </span>
                      {selectedDetailReq.guestName ||
                        selectedDetailReq.guest_name ||
                        'Khách lưu trú'}
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
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <User className="w-4 h-4 text-stone-700" />
                    <span>THÔNG TIN THỰC HIỆN & PHỤ TRÁCH</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-700">
                    <div>
                      <span className="text-stone-500 text-[11px] block">Nhân viên phụ trách:</span>
                      <span className="font-bold text-stone-900 text-xs">
                        {getTaskHandlerName(selectedDetailReq)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">Thời gian:</span>
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

                {isModalCompleted && (
                  <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 flex items-center gap-2">
                    <span className="text-sm">🔒</span>
                    <span>
                      <strong>Hồ sơ chỉ đọc:</strong> Phiếu đã hoàn thành và lưu trữ an toàn trong
                      nhật ký kiểm toán.
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Footer with Direct Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailReq(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer shadow-xs"
                >
                  Đóng
                </button>

                <div className="flex items-center gap-2">
                  {/* Food order next step button inside modal */}
                  {isModalFood && modalStage.nextStatus && (
                    canUserActOnStage(modalStage.step, selectedDetailReq) ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleUpdateTaskStatus(
                            selectedDetailReq.id,
                            modalStage.nextStatus
                          );
                          setSelectedDetailReq((prev) => ({
                            ...prev,
                            status: modalStage.nextStatus,
                            assignedTo: prev.assignedTo || staffName,
                          }));
                        }}
                        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 ${modalStage.actionBtnClass}`}
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

                  {/* Standard non-food buttons inside modal */}
                  {!isModalFood && isModalPending && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleClaim(selectedDetailReq.id);
                        setSelectedDetailReq((prev) => ({
                          ...prev,
                          status: 'In Progress',
                          assignedTo: staffName,
                        }));
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white transition-all cursor-pointer shadow-sm"
                    >
                      Nhận Việc
                    </button>
                  )}

                  {!isModalFood && isModalInProgress && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleMarkCompleted(selectedDetailReq.id);
                        setSelectedDetailReq((prev) => ({
                          ...prev,
                          status: 'Completed',
                          completed_by: staffName,
                        }));
                      }}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-sm"
                    >
                      Hoàn Thành
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

