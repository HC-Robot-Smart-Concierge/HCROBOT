import React, { useEffect, useMemo, useState } from 'react';
import { AssignStaffModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_HOUSEKEEPING_DATA } from '../../data/mockHotelData';
import {
  assignHousekeepingStaff,
  fetchHousekeepingDashboard,
  updateGenericRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  RefreshCw,
  UserX,
} from 'lucide-react';

const FILTER_OPTIONS = [
  { value: 'All', label: 'All Types' },
  { value: 'Spill Cleanup', label: 'Spill Cleanup' },
  { value: 'Towels', label: 'Towels' },
  { value: 'Room Cleaning', label: 'Room Cleaning' },
];

const normalizeStatus = (status = '') => status.toLowerCase().trim().replace('_', ' ');
const isPendingRequest = (request) => ['unassigned', 'pending', 'waiting'].includes(normalizeStatus(request.status));
const isInProgressRequest = (request) => normalizeStatus(request.status) === 'in progress';
const isCompletedRequest = (request) => ['completed', 'ready', 'done'].includes(normalizeStatus(request.status));
const isUrgentRequest = (request) => String(request?.urgency || request?.priority || '').toLowerCase() === 'high' || Boolean(request?.is_urgent);

const requestKey = (request) => request.ticket_code || request.id;
const displayRequestId = (request) => String(request.ticket_code || request.id || '').replace(/^REQ-/, '');
const requestMatches = (request, id) => {
  const values = [request.id, request.ticket_code, displayRequestId(request)].filter(Boolean).map(String);
  return values.some((value) => value === String(id) || value.includes(String(id)) || String(id).includes(value));
};

const KpiCard = ({ label, value, icon: Icon, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'bg-gradient-to-br from-[#F7F4EF] to-[#F2F0EC] text-[#151515]',
    success: 'bg-gradient-to-br from-[#F6F6F1] to-[#EEF3EB] text-[#151515]',
    danger: 'bg-gradient-to-br from-[#C91C1C] to-[#C51616] text-white',
  };

  return (
    <div className={`h-[93px] rounded-[15px] px-5 py-[18px] flex flex-col justify-between ${toneClasses[tone]}`}>
      <div className={`flex items-center justify-between text-[13px] ${tone === 'danger' ? 'text-red-50' : 'text-[#575757]'}`}>
        <span>{label}</span>
        <Icon className={`w-[18px] h-[18px] ${tone === 'danger' ? 'text-red-50' : tone === 'success' ? 'text-[#7D998D]' : 'text-[#777777]'}`} strokeWidth={1.8} />
      </div>
      <span className="text-[14px] font-medium leading-none">{value}</span>
    </div>
  );
};

export const HousekeepingDashboard = ({ currentUser, onNotify = () => {} }) => {
  const { t } = useLanguage();
  const staffName = currentUser?.full_name || currentUser?.name || 'Maria Santos';
  const staffId = currentUser?.id || currentUser?.username || 'user';
  const storageKey = `aurora_hk_claimed_${staffName}`;

  const [data, setData] = useState(INITIAL_HOUSEKEEPING_DATA);
  const [filter, setFilter] = useState('All');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [requestToAssign, setRequestToAssign] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchHousekeepingDashboard();
      let cachedRequests = [];

      try {
        const cached = localStorage.getItem(storageKey);
        if (cached) cachedRequests = JSON.parse(cached);
      } catch {
        cachedRequests = [];
      }

      if (response?.requests?.length > 0) {
        const mergedRequests = response.requests.map((request) => {
          const cached = cachedRequests.find((item) => requestMatches(item, requestKey(request)));
          const cachedStatusCanOverride = cached && ['In Progress', 'Completed'].includes(cached.status);

          return {
            ...request,
            status: cachedStatusCanOverride && request.status !== 'Completed' ? cached.status : request.status,
            assignedStaff:
              request.assigned_staff_name || cached?.assignedStaff || cached?.assigned_staff_name || request.assignedStaff,
          };
        });

        setData((previous) => ({
          ...previous,
          kpis: response.kpis || previous.kpis,
          requests: mergedRequests,
          floorStatus: response.floor_status || previous.floorStatus,
          availableStaff: response.available_staff?.length > 0 ? response.available_staff : previous.availableStaff,
        }));
      } else if (cachedRequests.length > 0) {
        setData((previous) => ({ ...previous, requests: cachedRequests }));
      }
    };

    loadData();
  }, [storageKey]);

  const allRequests = data.requests || [];
  const computedKpis = {
    pendingRequests: allRequests.filter(isPendingRequest).length,
    inProgress: allRequests.filter(isInProgressRequest).length,
    completedToday: allRequests.filter(isCompletedRequest).length,
    staffOnDuty: 4,
  };
  const kpis = {
    pendingRequests: data.kpis?.pendingRequests ?? computedKpis.pendingRequests,
    inProgress: data.kpis?.inProgress ?? computedKpis.inProgress,
    completedToday: data.kpis?.completedToday ?? computedKpis.completedToday,
    staffOnDuty: data.kpis?.staffOnDuty ?? computedKpis.staffOnDuty,
  };

  const filteredRequests = useMemo(() => {
    const filtered = allRequests.filter((request) => {
      if (filter === 'All') return true;
      if (filter === 'Pending') return isPendingRequest(request);
      if (filter === 'In Progress') return isInProgressRequest(request);
      if (filter === 'Completed') return isCompletedRequest(request);
      return true;
    });

    return [...filtered].sort((a, b) => {
      const score = (request) => {
        if (isPendingRequest(request)) return 1;
        if (isInProgressRequest(request)) return 2;
        if (isCompletedRequest(request)) return 3;
        return 4;
      };
      return score(a) - score(b);
    });
  }, [allRequests, filter]);

  const saveRequests = (requests) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(requests));
    } catch {
      // Local persistence is best-effort; PostgreSQL remains the source of truth.
    }
  };

  const transitionRequest = async (requestId, status, assignedName) => {
    const currentRequest = allRequests.find((request) => requestMatches(request, requestId));
    const wasPending = currentRequest ? isPendingRequest(currentRequest) : false;
    const wasInProgress = currentRequest ? isInProgressRequest(currentRequest) : false;

    const updatedRequests = allRequests.map((request) =>
      requestMatches(request, requestId)
        ? {
            ...request,
            status,
            assignedStaff: assignedName || request.assignedStaff || request.assigned_staff_name,
            assigned_staff_name: assignedName || request.assigned_staff_name || request.assignedStaff,
          }
        : request
    );

    setData((previous) => ({
      ...previous,
      requests: updatedRequests,
      kpis: {
        ...previous.kpis,
        pendingRequests: wasPending ? Math.max(0, kpis.pendingRequests - 1) : kpis.pendingRequests,
        inProgress:
          status === 'In Progress' && !wasInProgress
            ? kpis.inProgress + 1
            : status === 'Completed' && wasInProgress
              ? Math.max(0, kpis.inProgress - 1)
              : kpis.inProgress,
        completedToday: status === 'Completed' ? kpis.completedToday + 1 : kpis.completedToday,
        staffOnDuty: previous.kpis?.staffOnDuty ?? 4,
      },
    }));
    saveRequests(updatedRequests);

    await assignHousekeepingStaff(requestId, {
      status,
      assigned_staff_name: assignedName || staffName,
      assigned_staff_id: staffId,
    });
    await updateGenericRequestStatus(requestId, status, assignedName || staffName);
  };

  const handleClaimRequest = async (requestId) => {
    const activeTask = allRequests.find(
      (r) =>
        isInProgressRequest(r) &&
        (r.assignedStaff === staffName ||
          r.assigned_staff_name === staffName ||
          r.assignedTo === staffName)
    );
    if (activeTask) {
      onNotify(
        `⚠️ Bạn đang có nhiệm vụ đang xử lý (${activeTask.title || activeTask.id}). Vui lòng hoàn thành công việc hiện tại trước khi nhận thêm nhiệm vụ mới!`
      );
      return;
    }

    await transitionRequest(requestId, 'In Progress', staffName);
    onNotify(`${staffName} accepted request ${requestId}.`);
  };

  const handleCompleteRequest = async (requestId) => {
    await transitionRequest(requestId, 'Completed', staffName);
    onNotify(`Request ${requestId} was completed.`);
  };

  const handleAssignRequest = async (requestId, assignment) => {
    await transitionRequest(requestId, 'In Progress', assignment.name);
    onNotify(`Request ${requestId} was assigned to ${assignment.name}.`);
  };

  const floorStatus = data.floorStatus || INITIAL_HOUSEKEEPING_DATA.floorStatus;
  const roomsCleaned = floorStatus.roomsCleaned ?? 45;
  const totalRooms = floorStatus.totalRooms ?? 120;
  const roomsCleanedPercent = Math.min(100, Math.round((roomsCleaned / Math.max(1, totalRooms)) * 100));
  const availableStaff = (data.availableStaff || []).map((staff) => ({
    ...staff,
    name: staff.name || staff.full_name,
    id: staff.id || staff.code || staff.username,
  }));

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] px-8 pt-[34px] pb-10 font-sans">
      <div className="w-full max-w-[1120px] mx-auto">
        <section className="mb-10">
          <h1 className="text-[14px] font-medium leading-5 text-[#171717]">Housekeeping</h1>
          <p className="mt-1 text-[14px] leading-5 text-[#707070]">Live operations dashboard</p>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-[18px] mb-10">
          <KpiCard label="Pending Requests" value={kpis.pendingRequests} icon={ClipboardList} />
          <KpiCard label="In Progress" value={kpis.inProgress} icon={RefreshCw} />
          <KpiCard label="Completed Today" value={kpis.completedToday} icon={CheckCircle2} tone="success" />
          <KpiCard label="Staff on Duty" value={kpis.staffOnDuty ?? availableStaff.length} icon={Bot} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(220px,0.98fr)] gap-6 items-start">
          <div className="min-w-0">
            <div className="h-6 mb-4 flex items-center justify-between gap-4">
              <h2 className="text-[14px] font-medium text-[#171717]">Incoming Requests</h2>
              <div className="flex items-center gap-1 flex-wrap">
                {['All', 'Pending', 'In Progress', 'Completed'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-[9px] px-3.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                      filter === tab
                        ? 'bg-[#EAE8E4] text-[#494540] shadow-xs'
                        : 'text-[#77726D] hover:bg-[#F0EEEA]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-[14px]">
              {filteredRequests.length === 0 ? (
                <div className="rounded-[20px] bg-white px-6 py-14 text-center text-[13px] text-[#777]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const requestId = requestKey(request);
                  const pending = isPendingRequest(request);
                  const inProgress = isInProgressRequest(request);
                  const completed = isCompletedRequest(request);
                  const urgencyLabel = isUrgentRequest(request) ? 'High' : 'Normal';
                  const assignee = request.assignedStaff || request.assigned_staff_name;

                  return (
                    <article key={requestId} className="rounded-[20px] bg-white px-5 py-5 shadow-[0_1px_1px_rgba(32,28,24,0.02)]">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECEAE7] px-2.5 py-1 text-[#555] whitespace-nowrap">
                            <Bot className="w-3 h-3 text-[#202020]" strokeWidth={2} />
                            {request.source || 'From HCRobot'}
                          </span>
                          <span className="text-[#999] whitespace-nowrap">ID: {displayRequestId(request)}</span>
                        </div>
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <time className="text-[#4E4E4E]">{request.time || request.time_label || 'Recent'}</time>
                        </div>
                      </div>

                      <div className="mt-4 flex items-start justify-between gap-5">
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-medium text-[#171717]">{request.title}</h3>
                          <p className="mt-1 text-[14px] leading-5 text-[#4E4E4E]">{request.description}</p>
                          {(request.guestName || request.guest_name) && (
                            <p className="mt-1.5 text-[14px] text-[#171717]">
                              Guest: <span className="ml-1 text-[#555]">{request.guestName || request.guest_name}</span>
                            </p>
                          )}
                        </div>

                        <div className="min-w-[48px] text-right text-[13px] text-[#555]">
                          <span className="block">Room</span>
                          <strong className="block mt-0.5 text-[14px] font-medium text-[#171717]">
                            {request.room || request.room_number || '—'}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#F2EFEB]">
                        <div className="flex items-center gap-2 text-[12px] text-[#757575]">
                          {pending && (
                            <>
                              <span className="h-5 w-5 rounded-full bg-[#EBEBEB] flex items-center justify-center">
                                <UserX className="w-3.5 h-3.5 text-[#8A8A8A]" />
                              </span>
                              <span>{t('unassigned')}</span>
                            </>
                          )}
                          {inProgress && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#1B87C9]" />
                              <span>{t('inProgress')}: {assignee || staffName}</span>
                            </>
                          )}
                          {completed && (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-[#3E8D69]" />
                              <span>{t('taskCompleted')}: {assignee || staffName}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 ml-auto">
                          {pending && (
                            <button
                              type="button"
                              onClick={() => handleClaimRequest(requestId)}
                              className="h-9 min-w-[130px] px-5 rounded-[11px] bg-black text-white text-[13px] font-bold hover:bg-[#242424] transition-colors cursor-pointer shadow-sm"
                            >
                              {t('claimTask')}
                            </button>
                          )}
                          {inProgress && (
                            <button
                              type="button"
                              onClick={() => handleCompleteRequest(requestId)}
                              className="h-9 px-5 rounded-[11px] bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t('completeTask')}</span>
                            </button>
                          )}
                          {completed && (
                            <span className="text-[12px] font-bold text-emerald-700 bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              {t('taskCompleted')}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-[18px]">
            <section className="rounded-[20px] bg-[#F7F5F2] px-5 pt-5 pb-[18px]">
              <h2 className="text-[14px] font-medium text-[#171717]">Floor Status</h2>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="relative mt-3 w-full h-[110px] overflow-hidden rounded-[10px] text-left group"
              >
                <img src="/floor-plan.svg" alt="Floor 5 hotel plan" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute left-3 bottom-3 text-[13px] tracking-[0.16em] text-[#262626]">{floorStatus.activeFloor || 'FLOOR 5 - ACTIVE'}</span>
              </button>

              <div className="mt-5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#4D4D4D]">Rooms Cleaned</span>
                  <span className="text-[#202020]">{roomsCleaned} / {totalRooms}</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-[#E0DED9] overflow-hidden">
                  <div className="h-full rounded-full bg-black" style={{ width: `${roomsCleanedPercent}%` }} />
                </div>
              </div>
            </section>

            <section className="rounded-[20px] bg-[#F7F5F2] px-5 py-5">
              <h2 className="text-[13px] font-medium text-[#171717]">Available Staff</h2>
              <div className="mt-5 space-y-[18px]">
                {availableStaff.slice(0, 2).map((staff) => {
                  const initials = (staff.code || staff.name || 'ST')
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={staff.id || staff.name} className="flex items-center gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-[#EAE8E4] flex items-center justify-center text-[12px] text-[#333]">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[#171717]">{staff.name}</p>
                        <p className="mt-0.5 text-[13px] text-[#555]">{staff.location || 'On duty'}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" aria-label="Online" />
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </div>

      <AssignStaffModal
        isOpen={Boolean(requestToAssign)}
        onClose={() => setRequestToAssign(null)}
        task={requestToAssign ? { ...requestToAssign, id: requestKey(requestToAssign) } : null}
        staffList={availableStaff}
        onAssign={handleAssignRequest}
      />
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Floor 5 Housekeeping Status"
      />
    </main>
  );
};
