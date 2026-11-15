import { useStaffText, staffDepartmentLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
  createHousekeepingRequest,
  createMaintenanceRequest,
  createOperationalDirective,
} from '../../services/operationsApi';
import {
  isDirectServiceOrder,
  isFoodOrder,
  isTaskPending,
  isTaskCompleted,
  buildKitchenSteps,
  getKitchenOrderStage as getKitchenOrderStageFn,
  buildFoodSteps,
  getFoodOrderStage as getFoodOrderStageFn,
  buildServiceSteps,
  getDirectServiceStage as getDirectServiceStageFn,
} from './requestsPageStageUtils';
import {
  INITIAL_SAMPLE_REQUESTS,
  MAX_CONCURRENT_REQUEST_TASKS,
  computeUserRoleFlags,
  isTaskAssignedToMeFn,
  getTaskHandlerNameFn,
  canUserActOnStageFn,
  filterDeptScopedRequests,
  isReqPendingForUserFn,
  isReqInProgressForUserFn,
  isReqCompletedForUserFn,
  filterAndSortRequests,
} from './requestsPageScopeUtils';
import { RequestsListSection } from './RequestsListSection';
import { RequestsDetailModals } from './RequestsDetailModals';

export const RequestsPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffDept = currentUser?.department || 'F&B';
  const MAX_CONCURRENT_TASKS = MAX_CONCURRENT_REQUEST_TASKS;

  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDetailReq, setSelectedDetailReq] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [requests, setRequests] = useState(INITIAL_SAMPLE_REQUESTS);

  const loadRequestsFromDb = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnifiedRequests();
      if (data && Array.isArray(data) && data.length > 0) {
        setRequests(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequestsFromDb();
  }, []);

  useEffect(() => {
    const handleStatusUpdate = (e) => {
      const { orderId, status } = e.detail || {};
      if (orderId && status) {
        setRequests((prev) =>
          prev.map((r) => (r.id === orderId ? { ...r, status } : r))
        );
      }
    };
    const handleNewOrderOrRequest = () => loadRequestsFromDb();
    const handleOrdersCleared = () => loadRequestsFromDb();

    window.addEventListener('hc_order_status_updated', handleStatusUpdate);
    window.addEventListener('hc_food_order_created', handleNewOrderOrRequest);
    window.addEventListener('hc_new_request_created', handleNewOrderOrRequest);
    window.addEventListener('hc_orders_cleared', handleOrdersCleared);

    const interval = setInterval(() => {
      loadRequestsFromDb();
    }, 8000);

    return () => {
      window.removeEventListener('hc_order_status_updated', handleStatusUpdate);
      window.removeEventListener('hc_food_order_created', handleNewOrderOrRequest);
      window.removeEventListener('hc_new_request_created', handleNewOrderOrRequest);
      window.removeEventListener('hc_orders_cleared', handleOrdersCleared);
      clearInterval(interval);
    };
  }, []);

  const { isExecutive, isKitchenStaff, isRoomServiceStaff } = computeUserRoleFlags(currentUser);
  const isTaskAssignedToMe = (r) => isTaskAssignedToMeFn(r, staffName, currentUser);
  const getTaskHandlerName = (r) => getTaskHandlerNameFn(r, staffName);
  const canUserActOnStage = (step, req = null, isDirectSvc = false) =>
    canUserActOnStageFn({ step, req, isDirectSvc, isExecutive, isKitchenStaff, isRoomServiceStaff, isTaskAssignedToMe });

  const KITCHEN_STEPS = buildKitchenSteps(st);
  const FOOD_STEPS = buildFoodSteps(st);
  const SERVICE_STEPS = buildServiceSteps(st);
  const getKitchenOrderStage = (status) => getKitchenOrderStageFn(status, st);
  const getFoodOrderStage = (status) => getFoodOrderStageFn(status, st, isKitchenStaff);
  const getDirectServiceStage = (status) => getDirectServiceStageFn(status, st);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deptFilter, searchQuery]);

  const deptScopedRequests = filterDeptScopedRequests({
    requests,
    isExecutive,
    staffDept,
    isKitchenStaff,
    isTaskAssignedToMe,
    st,
  });

  const pendingCount = deptScopedRequests.filter((r) => isReqPendingForUserFn(r, isKitchenStaff, st)).length;
  const inProgressCount = deptScopedRequests.filter((r) => isReqInProgressForUserFn(r, isKitchenStaff, st)).length;
  const completedCount = deptScopedRequests.filter((r) => isReqCompletedForUserFn(r, isKitchenStaff, st)).length;

  const { filtered, sortedRequests } = filterAndSortRequests({
    deptScopedRequests,
    statusFilter,
    deptFilter,
    searchQuery,
    isExecutive,
    isKitchenStaff,
    st,
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
    return true;
  });

  const activeTaskCount = myActiveTasks.length;
  const isTaskLimitReached = activeTaskCount >= MAX_CONCURRENT_TASKS;

  const handleUpdateTaskStatus = async (reqId, nextStatus) => {
    const targetReq = requests.find((r) => r.id === reqId);
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

    const isNewClaimOrAssign =
      nextStatus.toLowerCase() === 'cooking' ||
      nextStatus.toLowerCase() === 'delivering' ||
      nextStatus.toLowerCase() === 'in progress';

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
      'Sent to Kitchen': st("Request #{0} sent to the kitchen and added to My Tasks.", reqId),
      'Cooking': st("The kitchen is preparing request #{0}.", reqId),
      'Ready': st("Request #{0} is ready for room delivery.", reqId),
      'Delivering': st("Room Service is delivering request #{0}.", reqId),
      'Completed': st("Request #{0} completed and delivered.", reqId),
      'In Progress': st("Request #{0} accepted and added to My Tasks.", reqId),
    };
    onNotify(statusMessages[nextStatus] || st("Request #{0} updated: {1}", reqId, nextStatus));
  };

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

  const handleMarkCompleted = async (reqId) => {
    await handleUpdateTaskStatus(reqId, 'Completed');
  };

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

        <RequestsListSection
          KITCHEN_STEPS={KITCHEN_STEPS}
          FOOD_STEPS={FOOD_STEPS}
          SERVICE_STEPS={SERVICE_STEPS}
          isLoading={isLoading}
          paginatedRequests={paginatedRequests}
          sortedRequests={sortedRequests}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          isKitchenStaff={isKitchenStaff}
          isTaskAssignedToMe={isTaskAssignedToMe}
          getTaskHandlerName={getTaskHandlerName}
          getKitchenOrderStage={getKitchenOrderStage}
          getDirectServiceStage={getDirectServiceStage}
          getFoodOrderStage={getFoodOrderStage}
          canUserActOnStage={canUserActOnStage}
          handleUpdateTaskStatus={handleUpdateTaskStatus}
          handleClaim={handleClaim}
          handleMarkCompleted={handleMarkCompleted}
          setSelectedDetailReq={setSelectedDetailReq}
          isTaskLimitReached={isTaskLimitReached}
          activeTaskCount={activeTaskCount}
          myActiveTasks={myActiveTasks}
          onNotify={onNotify}
          onNavigate={onNavigate}
        />
      </div>

      <RequestsDetailModals
        isNewModalOpen={isNewModalOpen}
        setIsNewModalOpen={setIsNewModalOpen}
        handleCreateNew={handleCreateNew}
        selectedDetailReq={selectedDetailReq}
        setSelectedDetailReq={setSelectedDetailReq}
        SERVICE_STEPS={SERVICE_STEPS}
        FOOD_STEPS={FOOD_STEPS}
        getDirectServiceStage={getDirectServiceStage}
        getFoodOrderStage={getFoodOrderStage}
        getTaskHandlerName={getTaskHandlerName}
        canUserActOnStage={canUserActOnStage}
        handleUpdateTaskStatus={handleUpdateTaskStatus}
        handleClaim={handleClaim}
        handleMarkCompleted={handleMarkCompleted}
        staffName={staffName}
      />
    </div>
  );
};
