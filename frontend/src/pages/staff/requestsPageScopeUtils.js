import {
  isDirectServiceOrder,
  isFoodOrder,
  isTaskPending,
  isTaskCompleted,
  isTaskInProgress,
  getKitchenOrderStage,
  getFoodOrderStage,
  getDirectServiceStage,
} from './requestsPageStageUtils';

export const MAX_CONCURRENT_REQUEST_TASKS = 3;

export const INITIAL_SAMPLE_REQUESTS = [
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
];

export const computeUserRoleFlags = (currentUser) => {
  const userDeptLower = String(currentUser?.department || '').toLowerCase();
  const userRoleLower = String(currentUser?.role || '').toLowerCase();
  const userNameLower = String(currentUser?.username || '').toLowerCase();
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

  const isKitchenStaff =
    userDeptLower.includes('kitchen') ||
    userDeptLower.includes('bếp') ||
    userDeptLower.includes('bep') ||
    userDeptLower.includes('chef') ||
    userNameLower.includes('kitchen') ||
    userNameLower.includes('bep') ||
    userFullNameLower.includes('bếp') ||
    userFullNameLower.includes('kitchen');

  const isRoomServiceStaff =
    userDeptLower.includes('room') ||
    userDeptLower.includes('f&b') ||
    userDeptLower.includes('ẩm thực') ||
    userNameLower.includes('room');

  return { isExecutive, isKitchenStaff, isRoomServiceStaff };
};

export const isTaskAssignedToMeFn = (r, staffName, currentUser) => {
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

export const getTaskHandlerNameFn = (r, staffName) => {
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

export const canUserActOnStageFn = ({
  step,
  req = null,
  isDirectSvc = false,
  isExecutive,
  isKitchenStaff,
  isRoomServiceStaff,
  isTaskAssignedToMe,
}) => {
  if (isExecutive) return true;

  if (isDirectSvc) {
    if (isKitchenStaff) return false;
    if (step === 1) return isRoomServiceStaff || !isKitchenStaff;
    if (step === 2 || step === 3) return isRoomServiceStaff || !isKitchenStaff;
    return false;
  }

  const isKitchenOrder = isKitchenStaff || req?.department === 'Kitchen' || req?.department === 'DEP-KITCHEN';
  if (isKitchenOrder) {
    return true;
  }

  if (step === 1) return isKitchenStaff || isRoomServiceStaff || !isKitchenStaff;
  if (step === 2) return isKitchenStaff || isRoomServiceStaff;
  if (step === 3) return isKitchenStaff && isTaskAssignedToMe(req);
  if (step === 4 || step === 5) return isKitchenStaff || isRoomServiceStaff || !isKitchenStaff;
  return false;
};

export const isDeptMatch = (reqDept, userDept) => {
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

export const filterDeptScopedRequests = ({
  requests,
  isExecutive,
  staffDept,
  isKitchenStaff,
  isTaskAssignedToMe,
  st,
}) => {
  return requests.filter((r) => {
    if (!isExecutive && !isDeptMatch(r.department, staffDept)) {
      return false;
    }

    if (!isExecutive) {
      if (isDirectServiceOrder(r)) {
        if (isKitchenStaff) return false;
        const stage = getDirectServiceStage(r.status, st);
        if ((stage.step === 2 || stage.step === 3) && !isTaskAssignedToMe(r)) return false;
        return true;
      }

      if (isFoodOrder(r)) {
        if (!isKitchenStaff) return false;
        const stage = getFoodOrderStage(r.status, st, isKitchenStaff);
        if (stage.step === 3 && !isTaskAssignedToMe(r)) return false;
        if ((stage.step === 4 || stage.step === 5) && !isTaskAssignedToMe(r)) return false;
      } else {
        if (isTaskInProgress(r) && !isTaskAssignedToMe(r)) return false;
      }
    }

    return true;
  });
};

export const isReqPendingForUserFn = (r, isKitchenStaff, st) => {
  if (isTaskCompleted(r)) return false;
  if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
    const stage = getKitchenOrderStage(r.status, st);
    return stage.step === 1;
  }
  if (isDirectServiceOrder(r)) {
    const stage = getDirectServiceStage(r.status, st);
    return stage.step === 1;
  }
  return isTaskPending(r);
};

export const isReqInProgressForUserFn = (r, isKitchenStaff, st) => {
  if (isTaskCompleted(r) || isTaskPending(r)) return false;
  if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
    const stage = getKitchenOrderStage(r.status, st);
    return stage.step === 2;
  }
  if (isDirectServiceOrder(r)) {
    const stage = getDirectServiceStage(r.status, st);
    return stage.step === 2 || stage.step === 3;
  }
  return isTaskInProgress(r);
};

export const isReqCompletedForUserFn = (r, isKitchenStaff, st) => {
  if (isTaskCompleted(r)) return true;
  if ((isKitchenStaff || r?.department === 'Kitchen' || r?.department === 'DEP-KITCHEN') && isFoodOrder(r)) {
    const stage = getKitchenOrderStage(r.status, st);
    return stage.step === 3;
  }
  if (isDirectServiceOrder(r)) {
    const stage = getDirectServiceStage(r.status, st);
    return stage.step === 4;
  }
  return isTaskCompleted(r);
};

export const filterAndSortRequests = ({
  deptScopedRequests,
  statusFilter,
  deptFilter,
  searchQuery,
  isExecutive,
  isKitchenStaff,
  st,
}) => {
  const filtered = deptScopedRequests.filter((r) => {
    const matchStatus = (() => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Pending') return isReqPendingForUserFn(r, isKitchenStaff, st);
      if (statusFilter === 'In Progress') return isReqInProgressForUserFn(r, isKitchenStaff, st);
      if (statusFilter === 'Completed') return isReqCompletedForUserFn(r, isKitchenStaff, st);
      return (r.status || '').toLowerCase().trim() === statusFilter.toLowerCase();
    })();
    const matchDept =
      !isExecutive ||
      deptFilter === 'All' ||
      r.department?.toLowerCase().includes(deptFilter.toLowerCase()) ||
      (deptFilter === 'Taxi' && r.department === 'Concierge');
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q) ||
      r.guestName?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q);
    return matchStatus && matchDept && matchSearch;
  });

  const getOrder = (req) => {
    if (isReqPendingForUserFn(req, isKitchenStaff, st)) return 1;
    if (isReqInProgressForUserFn(req, isKitchenStaff, st)) return 2;
    if (isReqCompletedForUserFn(req, isKitchenStaff, st)) return 3;
    return 4;
  };

  const sortedRequests = [...filtered].sort((a, b) => getOrder(a) - getOrder(b));
  return { filtered, sortedRequests };
};
