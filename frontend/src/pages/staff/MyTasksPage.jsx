import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Clock, CheckCircle2, User, ChefHat, Sparkles, ClipboardList } from 'lucide-react';
import {
  fetchUnifiedRequests,
  updateGenericRequestStatus,
} from '../../services/operationsApi';
import {
  isTaskAssignedToMeFn,
  isDirectServiceOrder,
  isFoodOrder,
  isTaskCompleted,
  isTaskInProgress,
  buildKitchenSteps,
  getKitchenOrderStageFn,
  buildFoodSteps,
  buildServiceSteps,
  getDirectServiceStageFn,
  getFoodOrderStageFn,
  canUserActOnStageFn,
} from './myTasksUtils';
import { MyTasksListSection } from './MyTasksListSection';
import { MyTasksDetailModal } from './MyTasksDetailModal';

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

  const isTaskAssignedToMe = (r) => isTaskAssignedToMeFn(r, { staffName, currentUser });
  const KITCHEN_STEPS = buildKitchenSteps(st);
  const getKitchenOrderStage = (status) => getKitchenOrderStageFn(status, st);
  const FOOD_STEPS = buildFoodSteps(st);
  const SERVICE_STEPS = buildServiceSteps(st);
  const getDirectServiceStage = (status) => getDirectServiceStageFn(status, st);
  const getFoodOrderStage = (status) => getFoodOrderStageFn(status, st);
  const canUserActOnStage = (step, req = null, isDirectSvc = false) =>
    canUserActOnStageFn(step, req, isDirectSvc, { isExecutive, isKitchenStaff, isRoomServiceStaff });

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

        <MyTasksListSection
          isLoading={isLoading}
          st={st}
          paginatedRequests={paginatedRequests}
          requests={requests}
          isDirectServiceOrder={isDirectServiceOrder}
          isFoodOrder={isFoodOrder}
          isKitchenStaff={isKitchenStaff}
          KITCHEN_STEPS={KITCHEN_STEPS}
          SERVICE_STEPS={SERVICE_STEPS}
          FOOD_STEPS={FOOD_STEPS}
          getKitchenOrderStage={getKitchenOrderStage}
          getDirectServiceStage={getDirectServiceStage}
          getFoodOrderStage={getFoodOrderStage}
          isTaskCompleted={isTaskCompleted}
          isTaskInProgress={isTaskInProgress}
          canUserActOnStage={canUserActOnStage}
          staffName={staffName}
          handleUpdateTaskStatus={handleUpdateTaskStatus}
          setSelectedDetailReq={setSelectedDetailReq}
          sortedRequests={sortedRequests}
          currentPage={currentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
        />
      </div>

      <MyTasksDetailModal
        selectedDetailReq={selectedDetailReq}
        setSelectedDetailReq={setSelectedDetailReq}
        isDirectServiceOrder={isDirectServiceOrder}
        isFoodOrder={isFoodOrder}
        SERVICE_STEPS={SERVICE_STEPS}
        FOOD_STEPS={FOOD_STEPS}
        getDirectServiceStage={getDirectServiceStage}
        getFoodOrderStage={getFoodOrderStage}
        isTaskCompleted={isTaskCompleted}
        canUserActOnStage={canUserActOnStage}
        staffName={staffName}
        handleUpdateTaskStatus={handleUpdateTaskStatus}
        st={st}
      />
    </div>
  );
};
