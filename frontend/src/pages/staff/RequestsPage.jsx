import { useStaffText, staffDepartmentLabel, staffStatusLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock, CheckCircle2, Check, Eye, User, MapPin, Utensils, ChefHat, Send, Truck, ArrowRight, Sparkles, ConciergeBell, Phone } from 'lucide-react';
import { NewDirectiveModal } from '../../components/dashboard/Modals';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
  createHousekeepingRequest,
  createMaintenanceRequest,
  createOperationalDirective,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

export const RequestsPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
  const st = useStaffText();
  const { t } = useLanguage();
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

  // Real-time WebSocket Listeners for Instant Status Workflows
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
      loadRequestsFromDb();
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

  // Phân quyền chặt chẽ theo từng giai đoạn (Stage-based Authorization):
  // - Đơn Dịch Vụ Phòng Trực Tiếp (4 bước):
  //   + Bước 1 (Chờ Tiếp Nhận -> Tiếp Nhận): Room Service
  //   + Bước 2 (Đang Chuẩn Bị -> Giao Lên Phòng): Room Service
  //   + Bước 3 (Đang Giao Phòng -> Xác Nhận Đã Giao): Room Service
  // - Đơn Món Ăn Bếp (6 bước):
  //   + Bước 1 (Khách đặt -> Chuyển sang bếp): CHỈ Room Service (hoặc Executive/Admin)
  //   + Bước 2 (Đã chuyển bếp -> Bếp nhận nấu): CHỈ Kitchen / Đầu Bếp (hoặc Executive/Admin)
  //   + Bước 3 (Bếp đang nấu -> Món đã nấu xong): CHỈ người nhận request (đầu bếp phụ trách) mới được bấm!
  //   + Bước 4 (Món đã nấu xong -> Lấy món & giao phòng): CHỈ Room Service (hoặc Executive/Admin)
  //   + Bước 5 (Đang giao phòng -> Xác nhận đã giao): CHỈ Room Service (hoặc Executive/Admin)
  const canUserActOnStage = (step, req = null, isDirectSvc = false) => {
    if (isExecutive) return true; // Quản lý khách sạn có quyền can thiệp/kiểm thử toàn trình

    if (isDirectSvc) {
      if (isKitchenStaff) return false; // Bếp tuyệt đối không can thiệp vào đơn dịch vụ phòng trực tiếp!
      if (step === 1) return isRoomServiceStaff || (!isKitchenStaff);
      if (step === 2 || step === 3) return isRoomServiceStaff || (!isKitchenStaff);
      return false;
    }

    const isKitchenOrder = (isKitchenStaff || req?.department === 'Kitchen' || req?.department === 'DEP-KITCHEN');
    if (isKitchenOrder) {
      // Cho Bếp với quy trình 3 bước (Pending -> Cooking -> Done):
      // Bước 1 (Pending): Đầu bếp trực ca bấm Bếp Nhận Nấu (Accept and cook)
      // Bước 2 (Cooking): Đầu bếp bấm Hoàn Thành (Complete)
      return true;
    }

    if (step === 1) {
      // Bếp hoặc Room Service đều có thể tiếp nhận và bắt đầu nấu
      return isKitchenStaff || isRoomServiceStaff || (!isKitchenStaff);
    }
    if (step === 2) {
      // Bếp nhận nấu: Đầu bếp trực ca có thể tiếp nhận đơn
      return isKitchenStaff || isRoomServiceStaff;
    }
    if (step === 3) {
      // Bếp nấu xong -> Món đã nấu xong: CHỈ người nhận request mới được bấm!
      return isKitchenStaff && isTaskAssignedToMe(req);
    }
    if (step === 4 || step === 5) {
      // Bếp nấu xong -> Bếp hoặc Room Service lấy món đi giao và xác nhận hoàn tất
      return isKitchenStaff || isRoomServiceStaff || (!isKitchenStaff);
    }
    return false;
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
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
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
        nextStatus: isKitchenStaff ? 'Cooking' : 'Sent to Kitchen',
        nextActionName: isKitchenStaff ? st("Accept and cook") : st("Send to kitchen"),
        nextIcon: ChefHat,
        actionBtnClass: isKitchenStaff ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white',
        deptNote: isKitchenStaff ? st("The kitchen accepts and prepares the food") : st("Room Service reviews the order and sends it to the kitchen"),
        roleBadge: isKitchenStaff ? st('Kitchen') : st('Room Service'),
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
        actionBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white',
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
        actionBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
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
      s === 'in_progress' ||
      s === 'in preparation' ||
      s === 'tiếp nhận' ||
      s === 'đang xử lý' ||
      s === 'đang chuẩn bị' ||
      s === 'sent to kitchen' ||
      s === 'ready'
    ) {
      return {
        step: 2,
        label: st("Preparing") || "Đang xử lý",
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        nextStatus: 'Delivering',
        nextActionName: st("Deliver to room") || "Giao phòng",
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
        label: st("Delivering to room") || "Đang giao phòng",
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        nextStatus: 'Completed',
        nextActionName: st("Confirm delivery") || "Hoàn thành",
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
    if ((uD.includes('concierge') || uD.includes('trợ lý')) && (rD.includes('concierge') || rD.includes('trợ lý') || rD.includes('live') || rD.includes('taxi') || rD.includes('xe'))) return true;
    if ((uD.includes('taxi') || uD.includes('xe') || uD.includes('vận chuyển')) && (rD.includes('taxi') || rD.includes('xe') || rD.includes('vận chuyển'))) return true;
    return false;
  };

  // Base list scoped to department & task visibility rules:
  // - Phương án 2 (Tách biệt hàng đợi Bếp & Room Service):
  //   + Đơn Dịch Vụ Phòng Trực Tiếp (Khăn tắm, Massage, Dọn phòng...):
  //     * Bếp (isKitchenStaff): ẨN HOÀN TOÀN khỏi hàng đợi của Bếp!
  //     * Room Service: Tiếp nhận (step 1), Chuẩn bị & Giao phòng (step 2, 3), Hoàn tất (step 4).
  //   + Đơn Món Ăn Bếp (Kitchen):
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
      // 1. Đơn dịch vụ buồng phòng trực tiếp (Không qua Bếp)
      if (isDirectServiceOrder(r)) {
        if (isKitchenStaff) {
          return false; // Bếp không nhận và không thấy đơn dịch vụ phòng!
        }
        const stage = getDirectServiceStage(r.status);
        if ((stage.step === 2 || stage.step === 3) && !isTaskAssignedToMe(r)) {
          return false;
        }
        return true;
      }

      // 2. Đơn món ăn ẩm thực (Qua Bếp)
      if (isFoodOrder(r)) {
        if (!isKitchenStaff) {
          // Room Service hoặc các bộ phận khác TUYỆT ĐỐI KHÔNG nhận và KHÔNG thấy đơn món ăn của Bếp!
          return false;
        }
        const stage = getFoodOrderStage(r.status);
        // Bước 3: Bếp đang nấu -> Đã có người nhận, ẩn khỏi người KHÁC (!isTaskAssignedToMe)
        if (stage.step === 3 && !isTaskAssignedToMe(r)) {
          return false;
        }
        // Bước 4, 5: Món xong / Giao phòng -> Ẩn khỏi người KHÁC (!isTaskAssignedToMe)
        if ((stage.step === 4 || stage.step === 5) && !isTaskAssignedToMe(r)) {
          return false;
        }
      } else {
        // Đơn thông thường (Non-Food, Housekeeping, Bell, MNT...):
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
    if (isTaskCompleted(r)) return false;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 1;
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 1;
    }
    return isTaskPending(r);
  };

  const isReqInProgressForUser = (r) => {
    if (isTaskCompleted(r) || isTaskPending(r)) return false;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 2;
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 2 || stage.step === 3;
    }
    return isTaskInProgress(r);
  };

  const isReqCompletedForUser = (r) => {
    if (isTaskCompleted(r)) return true;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 3;
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
      return stage.step === 4;
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
  const getRequestStatusOrder = (req) => {
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

  // Apply Status Sorting (Pending -> In Progress -> Completed)
  const sortedRequests = [...filtered].sort((a, b) => {
    const scoreA = getRequestStatusOrder(a);
    const scoreB = getRequestStatusOrder(b);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return (b.id || '').localeCompare(a.id || '');
  });

  // Paginated Slicing (10 items per page)
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

  // Giới hạn nhiệm vụ đang xử lý (Cho phép nhận tối đa 3 đơn cùng lúc)
  const MAX_CONCURRENT_TASKS = 3;
  const myActiveTasks = requests.filter((r) => {
    if (!isTaskAssignedToMe(r)) return false;
    if (isTaskCompleted(r)) return false;
    if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
      const stage = getKitchenOrderStage(r.status);
      return stage.step === 2;
    }
    if (isDirectServiceOrder(r)) {
      const stage = getDirectServiceStage(r.status);
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
        st("You have {0}/{1} active orders ({2}). Complete or deliver an order before accepting more.", activeTaskCount, MAX_CONCURRENT_TASKS, myActiveTasks.map((t) => '#' + t.id).join(', '))
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
      'Sent to Kitchen': st("Request #{0} sent to the kitchen and added to My Tasks.", reqId),
      'Cooking': st("The kitchen is preparing request #{0}.", reqId),
      'Ready': st("Request #{0} is ready for room delivery.", reqId),
      'Delivering': st("Room Service is delivering request #{0}.", reqId),
      'Completed': st("Request #{0} completed and delivered.", reqId),
      'In Progress': st("Request #{0} accepted and added to My Tasks.", reqId),
    };
    onNotify(statusMessages[nextStatus] || st("Request #{0} updated: {1}", reqId, nextStatus));
  };

  // Action: Self-Claim Request -> Persists to Database with Max-3 Tasks Guard
  const handleClaim = async (reqId) => {
    if (isTaskLimitReached) {
      onNotify(
        st("You have {0}/{1} active requests ({2}). Complete a task before accepting more.", activeTaskCount, MAX_CONCURRENT_TASKS, myActiveTasks.map((t) => '#' + t.id).join(', '))
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
        description: newReq.notes,
      });
    } else if (newReq.department === 'Maintenance') {
      await createMaintenanceRequest({
        title: newReq.title,
        location: newReq.location || 'Room 412',
        description: newReq.notes,
      });
    } else {
      await createOperationalDirective({
        title: newReq.title,
        department: newReq.department,
        location: newReq.location || 'Main Floor',
        description: newReq.notes,
      });
    }

    onNotify(st("Request #{0} created.", created.id));
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FAF8F5] font-sans">
      <div className="staff-page-container max-w-7xl mx-auto space-y-6">
        {/* Header & New Request Button */}
        <StaffPageHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1A1917]">
                {isExecutive ? st("Hotel service requests") : st("Service requests — {0}", st(staffDepartmentLabel(staffDept)))}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-700">
                {filtered.length} {st("requests")} </span>
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              {isExecutive
                ? st("Receive, coordinate and assign service requests across the hotel.")
                : st("Requests sent by HCRobot to {0}. Staff can claim tasks directly.", st(staffDepartmentLabel(staffDept)))}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="staff-header-details flex items-center gap-2 text-xs font-bold text-stone-700 bg-white px-4 py-2 rounded-full border border-[#DDD8CE] shadow-sm">
              <span>{st("On duty:")} {staffName}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isTaskLimitReached
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >{st("Active:")} {activeTaskCount}/{MAX_CONCURRENT_TASKS}
              </span>
            </div>

            {isExecutive && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <span>{st("New request")}</span>
              </button>
            )}
          </div>
        </StaffPageHeader>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box & Refresh Button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={st("Search by request ID, room or guest...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
              />
            </div>
            <button
              onClick={loadRequestsFromDb}
              title={st("Refresh data")}
              className="p-2 bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E0DCD3] text-stone-700 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Department Filter Pills (ONLY visible for Executive / Admin) */}
          {isExecutive && (
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-[11px] font-bold text-stone-500 uppercase mr-1">{st("Department:")}</span>
              {['All', 'Reception', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Concierge', 'Taxi'].map((dept) => (
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

          {/* Status Filter: Tabs for Kitchen (matching Dashboard), Dropdown for other depts */}
          {isKitchenStaff ? (
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full md:w-auto">
              {[
                { id: 'All', label: st('All'), count: deptScopedRequests.length },
                { id: 'Pending', label: st('Pending'), count: pendingCount },
                { id: 'In Progress', label: st('Cooking'), count: inProgressCount },
                { id: 'Completed', label: st('Done'), count: completedCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    onNotify(st("Filtered: {0}", tab.label));
                  }}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'text-stone-600 bg-[#FAF8F5] border border-[#E0DCD3] hover:bg-[#F0EEEA]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === tab.id ? 'bg-stone-700 text-stone-200' : 'bg-stone-200/80 text-stone-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs font-bold text-stone-500 shrink-0">{st("Status:")}</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  onNotify(st("Filtered: {0}", e.target.value));
                }}
                className="w-full md:w-56 px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-semibold text-stone-900 outline-none cursor-pointer focus:border-stone-400"
              >
                <option value="All">{st("All (")}{deptScopedRequests.length})</option>
                <option value="Pending">{st("Pending (")}{pendingCount})</option>
                <option value="In Progress">{st("In progress (")}{inProgressCount})</option>
                <option value="Completed">{st("Completed (")}{completedCount})</option>
              </select>
            </div>
          )}
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="py-20 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-700" />
            <p className="text-sm font-semibold text-stone-600">{t('opsLoading')}</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {paginatedRequests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
                {t('opsEmptyDesc')}
              </div>
            ) : (
              paginatedRequests.map((req) => {
                const isPending = isTaskPending(req);
                const isInProgress = isTaskInProgress(req);
                const isCompleted = isTaskCompleted(req);
                const isMine = isTaskAssignedToMe(req);
                const handlerName = getTaskHandlerName(req);
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
                    className={`bg-white rounded-2xl border border-[#E5E1D8] p-4 md:p-5 shadow-sm space-y-3.5 transition-all hover:shadow-md ${
                      isMultiStep
                        ? isKitchenOrder
                          ? stage.step === 3
                            ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10'
                            : stage.step === 2
                            ? 'border-l-4 border-l-amber-500'
                            : ''
                          : (isDirectSvc ? stage.step === 4 : stage.step === 4)
                          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/10'
                          : (isDirectSvc ? stage.step === 3 : stage.step === 5)
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
                              isPending
                                ? 'bg-amber-100 text-amber-800'
                                : isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {st(staffStatusLabel(req.status))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Request Title (Bold & Clean) */}
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
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : isCurrent
                                      ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow'
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

                    {/* Ordered Items / Services Pill Preview */}
                    {isMultiStep && Array.isArray(req.items) && req.items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDirectSvc ? (
                            <ConciergeBell className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <Utensils className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="font-semibold text-stone-800 text-[11px]">
                            {isDirectSvc ? st("Requested services:") : st("Order items:")}
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

                    {/* Guest & Phone Detail */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
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

                    {/* Bottom Action Bar: Compact & Responsive */}
                    <div className="pt-2 border-t border-[#F5F2EB] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#78716C] font-medium hidden md:inline">
                        {isMultiStep ? (
                          stage.deptNote
                        ) : isPending ? (
                          st("Awaiting acceptance")
                        ) : isInProgress ? (
                          st("In progress: {0}", handlerName)
                        ) : (
                          st("Completed by: {0}", handlerName)
                        )}
                      </span>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {/* 1. Multi-Step (Food or Direct Service) Action Button */}
                        {isMultiStep && stage.nextStatus && (
                          canUserActOnStage(stage.step, req, isDirectSvc) ? (
                            <div className="flex items-center gap-1.5">
                              {/* Tùy chọn Hoàn Tất Nhanh cho Direct Service nếu nhân viên muốn kết thúc đơn ngay */}
                              {isDirectSvc && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTaskStatus(req.id, 'Completed')}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-stone-600 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-stone-200 transition-all cursor-pointer shadow-2xs"
                                  title={st("Mark as completed and delivered to the guest")}
                                >{st("Quick complete")} </button>
                              )}

                              <button
                                onClick={() => {
                                  if (stage.step === 1 && isTaskLimitReached) {
                                    onNotify(
                                      st("You have {0}/{1} active orders ({2}). Complete or deliver an order before accepting more.", activeTaskCount, MAX_CONCURRENT_TASKS, myActiveTasks.map((t) => '#' + t.id).join(', '))
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
                                    ? st("Maximum of {0} concurrent orders reached ({1}/{2})", MAX_CONCURRENT_TASKS, activeTaskCount, MAX_CONCURRENT_TASKS)
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
                            </div>
                          ) : (
                            /* Không thuộc quyền bộ phận hiện tại -> hiển thị chip trạng thái chờ trực quan */
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
                                      ? st("This order is assigned to {0}. Only {1} can mark it ready.", handlerName, handlerName)
                                      : st("The kitchen is preparing the food and will notify Room Service when it is ready.")
                                  }
                                >
                                  <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                  <span>{isKitchenStaff ? st("Prepared by: {0}", handlerName) : st("Kitchen is cooking...")}</span>
                                </span>
                              ) : stage.step === 4 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={st("Food is ready for Room Service to collect and deliver.")}
                                >
                                  <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{st("Awaiting Room Service collection")}</span>
                                </span>
                              ) : stage.step === 5 ? (
                                <span
                                  className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-200 flex items-center gap-1.5 select-none shadow-2xs"
                                  title={st("Room Service is delivering the food to the guest.")}
                                >
                                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                                  <span>{st("Room Service is delivering")}</span>
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">{st("Waiting")} {stage.roleBadge}
                                </span>
                              )
                            )
                          )
                        )}

                        {/* Multi-step Completed indicator */}
                        {isMultiStep && !stage.nextStatus && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isDirectSvc ? st("Delivered") : st("Order completed")}</span>
                          </span>
                        )}

                        {/* 2. Standard Non-Food: Claim button */}
                        {!isMultiStep && isPending && (
                          <button
                            onClick={() => handleClaim(req.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 ${
                              isTaskLimitReached
                                ? 'bg-stone-200 text-stone-500 hover:bg-stone-300 border border-stone-300'
                                : 'bg-[#18181B] hover:bg-black text-white'
                            }`}
                            title={
                              isTaskLimitReached
                                ? st("You have {0}/{1} active tasks ({2}). Complete one before accepting more.", activeTaskCount, MAX_CONCURRENT_TASKS, myActiveTasks.map((t) => '#' + t.id).join(', '))
                                : st("Claim this request")
                            }
                          >
                            <span>{st("Claim task")}</span>
                            {isTaskLimitReached && (
                              <span className="text-[10px] ml-1 bg-stone-300 px-1.5 py-0.2 rounded-full text-stone-700">
                                {activeTaskCount}/{MAX_CONCURRENT_TASKS}
                              </span>
                            )}
                          </button>
                        )}

                        {/* 3. Standard Non-Food: Complete button */}
                        {!isMultiStep && isInProgress && (isMine || isExecutive) && (
                          <button
                            onClick={() => handleMarkCompleted(req.id)}
                            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                          >
                            <span>{st("Complete task")}</span>
                          </button>
                        )}

                        {/* 4. Chuyển sang trang Yêu Cầu Cá Nhân nếu đang phụ trách */}
                        {isMine && isInProgress && (
                          <button
                            onClick={() => onNavigate('MyTasks')}
                            className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                            title={st("Open My Tasks to track this request")}
                          >
                            <User className="w-3.5 h-3.5 text-amber-700" />
                            <span>{st("My Tasks")}</span>
                          </button>
                        )}

                        {/* 5. Xem Chi Tiết button (always visible) */}
                        <button
                          onClick={() => setSelectedDetailReq(req)}
                          className="px-4 py-1.5 rounded-full bg-[#FAF8F5] hover:bg-[#EFECE6] text-stone-900 border border-[#E0DCD3] text-xs font-bold transition-all shadow-sm cursor-pointer"
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
        const isModalDirectSvc = isDirectServiceOrder(selectedDetailReq);
        const isModalFood = !isModalDirectSvc && isFoodOrder(selectedDetailReq);
        const isModalMultiStep = isModalFood || isModalDirectSvc;
        const currentModalSteps = isModalDirectSvc ? SERVICE_STEPS : (isModalFood ? FOOD_STEPS : null);
        const modalStage = isModalDirectSvc
          ? getDirectServiceStage(selectedDetailReq.status)
          : (isModalFood ? getFoodOrderStage(selectedDetailReq.status) : null);
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
                      isModalDirectSvc
                        ? 'bg-indigo-100 text-indigo-900'
                        : isModalFood
                        ? 'bg-amber-100 text-amber-900'
                        : isModalCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    {isModalDirectSvc ? (
                      <ConciergeBell className="w-5 h-5 text-indigo-700" />
                    ) : isModalFood ? (
                      <ChefHat className="w-5 h-5 text-amber-700" />
                    ) : isModalCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-stone-900 tracking-tight">
                      {isModalDirectSvc
                        ? st("Service request #{0}", selectedDetailReq.id)
                        : isModalFood
                        ? st("Room Service order #{0}", selectedDetailReq.id)
                        : isModalCompleted
                        ? st("Completed request details")
                        : st("Request details #{0}", selectedDetailReq.id)}
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

              {/* Modal Body */}
              <div className="space-y-4 text-xs">
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-bold text-[11px] border border-indigo-100">{st("Department:")} {selectedDetailReq.department}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-stone-900 text-white font-bold text-[11px] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    {selectedDetailReq.location}
                  </span>

                  {isModalMultiStep ? (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${modalStage.badgeClass}`}
                      >
                        {modalStage.label}
                      </span>
                      {modalStage.roleBadge && (
                        <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-semibold text-[11px] border border-stone-200">{st("Assigned to:")} {modalStage.roleBadge}
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
                      {st(staffStatusLabel(selectedDetailReq.status))}
                    </span>
                  )}
                </div>

                {/* Stepper for Direct Service or Food Orders */}
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
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : isCurrent
                                  ? 'bg-stone-900 text-white ring-4 ring-amber-200 ring-offset-1 font-black scale-110 shadow'
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

                {/* Ordered Items / Services Detailed Table */}
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
                        <span>{st("TOTAL:")}</span>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-800">{st("Guest / requester:")}{' '}
                      </span>
                      <span className="font-medium text-stone-900">
                        {selectedDetailReq.guestName ||
                          selectedDetailReq.guest_name ||
                          st("Hotel guest")}
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
                        <span className="font-semibold text-stone-800">{st("Detailed notes:")} </span>
                        {selectedDetailReq.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Handler & Execution Information */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                    <User className="w-4 h-4 text-stone-700" />
                    <span>{st("ASSIGNMENT DETAILS")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-700">
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Assigned staff:")}</span>
                      <span className="font-bold text-stone-900 text-xs">
                        {getTaskHandlerName(selectedDetailReq)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Time:")}</span>
                      <span className="font-bold text-stone-900 text-xs">
                        {selectedDetailReq.time || st("Just completed")}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[11px] block">{st("Source:")}</span>
                      <span className="font-medium text-stone-800 text-xs">
                        {selectedDetailReq.source || 'Robot App / Front Desk'}
                      </span>
                    </div>
                    {selectedDetailReq.assigned_robot && (
                      <div>
                        <span className="text-stone-500 text-[11px] block">{st("Assigned robot:")}</span>
                        <span className="font-medium text-sky-700 text-xs">
                          {selectedDetailReq.assigned_robot}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isModalCompleted && (
                  <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 flex items-center gap-2">
                    <span className="text-sm"></span>
                    <span>
                      <strong>{st("Read-only record:")}</strong> {st("This completed request is saved in the audit log.")} </span>
                  </div>
                )}
              </div>

              {/* Modal Footer with Direct Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailReq(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-all cursor-pointer shadow-xs"
                >{st("Close")} </button>

                <div className="flex items-center gap-2">
                  {/* Multi-step action button inside modal */}
                  {isModalMultiStep && modalStage.nextStatus && (
                    canUserActOnStage(modalStage.step, selectedDetailReq, isModalDirectSvc) ? (
                      <div className="flex items-center gap-2">
                        {isModalDirectSvc && (
                          <button
                            type="button"
                            onClick={async () => {
                              await handleUpdateTaskStatus(selectedDetailReq.id, 'Completed');
                              setSelectedDetailReq((prev) => ({
                                ...prev,
                                status: 'Completed',
                                assignedTo: prev.assignedTo || staffName,
                              }));
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-stone-300 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
                          >{st("Quick complete")} </button>
                        )}
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
                      </div>
                    ) : (
                      <span className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold border border-stone-200 flex items-center gap-1.5 shadow-2xs">{st("This step is handled by")} {modalStage.roleBadge} {st("staff")} </span>
                    )
                  )}

                  {/* Standard non-multi-step buttons inside modal */}
                  {!isModalMultiStep && isModalPending && (
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
                    >{st("Claim task")} </button>
                  )}

                  {!isModalMultiStep && isModalInProgress && (
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
                    >{st("Complete task")} </button>
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

