import React from 'react';
import { CheckCircle2, ChefHat, Truck, Sparkles, ConciergeBell } from 'lucide-react';

export const isTaskAssignedToMeFn = (r, { staffName, currentUser }) => {
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
export const isDirectServiceOrder = (r) => {
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
export const isFoodOrder = (r) => {
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

export const isTaskPending = (r) => {
  const s = (r.status || '').toLowerCase().trim();
  return (
    s === 'pending' ||
    s === 'pending action' ||
    s === 'unassigned' ||
    s === 'waiting' ||
    s === 'chờ tiếp nhận'
  );
};

export const isTaskCompleted = (r) => {
  const s = (r.status || '').toLowerCase().trim();
  return (
    s === 'completed' ||
    s === 'delivered' ||
    s === 'done' ||
    s === 'hoàn tất' ||
    s === 'đã hoàn thành'
  );
};

export const isTaskInProgress = (r) => {
  return !isTaskCompleted(r) && !isTaskPending(r);
};

export const buildKitchenSteps = (st) => [
  { step: 1, title: st("Pending") },
  { step: 2, title: st("Cooking") },
  { step: 3, title: st("Done") },
];

export const getKitchenOrderStageFn = (status, st) => {
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

export const buildFoodSteps = (st) => [
  { step: 1, title: st("Guest orders") },
  { step: 2, title: st("Send to kitchen") },
  { step: 3, title: st("Cooking") },
  { step: 4, title: st("Ready") },
  { step: 5, title: st("Room delivery") },
  { step: 6, title: st("Completed") },
];

export const buildServiceSteps = (st) => [
  { step: 1, title: st("Guest orders") },
  { step: 2, title: st("Accepted") },
  { step: 3, title: st("Room delivery") },
  { step: 4, title: st("Completed") },
];

export const getDirectServiceStageFn = (status, st) => {
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

export const getFoodOrderStageFn = (status, st) => {
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

export const canUserActOnStageFn = (step, req = null, isDirectSvc = false, { isExecutive, isKitchenStaff, isRoomServiceStaff } = {}) => {
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
