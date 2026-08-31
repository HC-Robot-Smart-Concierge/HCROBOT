import React, { useEffect, useMemo, useState } from 'react';
import { AssignStaffModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_HOUSEKEEPING_DATA } from '../../data/mockHotelData';
import {
  assignHousekeepingStaff,
  fetchHousekeepingDashboard,
  updateGenericRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

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

const KpiCard = ({ label, value }) => {
  return (
    <div className="rounded-xl bg-white p-4 border border-[#E8E5E0]">
      <div className="text-[11px] font-semibold text-[#666]">
        {label}
      </div>
      <div className="mt-2 text-[18px] font-bold text-[#222]">{value}</div>
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
      // Local persistence is best-effort
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
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] px-4 md:px-8 pt-3 pb-8 font-sans">
      <div className="w-full max-w-[1180px] mx-auto">
        <section className="mb-6">
          <h1 className="text-[15px] font-semibold text-[#171717]">Housekeeping</h1>
          <p className="mt-0.5 text-[12px] text-[#707070]">Live operations dashboard</p>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Pending Requests" value={kpis.pendingRequests} />
          <KpiCard label="In Progress" value={kpis.inProgress} />
          <KpiCard label="Completed Today" value={kpis.completedToday} />
          <KpiCard label="Staff on Duty" value={kpis.staffOnDuty ?? availableStaff.length} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(220px,0.98fr)] gap-5 items-start">
          <div className="min-w-0">
            <div className="h-8 mb-3 flex items-center justify-between gap-4">
              <h2 className="text-[13px] font-semibold text-[#171717]">Incoming Requests</h2>
              <div className="flex items-center gap-1 flex-wrap">
                {['All', 'Pending', 'In Progress', 'Completed'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      filter === tab
                        ? 'bg-[#EAE8E4] text-[#494540]'
                        : 'text-[#77726D] hover:bg-[#F0EEEA]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#777] border border-[#E8E5E0]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const requestId = requestKey(request);
                  const pending = isPendingRequest(request);
                  const inProgress = isInProgressRequest(request);
                  const completed = isCompletedRequest(request);
                  const assignee = request.assignedStaff || request.assigned_staff_name;

                  return (
                    <article key={requestId} className="rounded-xl bg-white p-4 border border-[#E8E5E0]">
                      <div className="flex items-center justify-between text-[11px] text-[#666]">
                        <span className="font-semibold text-[#333]">
                          {request.source || 'HCRobot'} • ID: {displayRequestId(request)}
                        </span>
                        <span>{request.time || request.time_label || 'Recent'}</span>
                      </div>

                      <div className="mt-2 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-semibold text-[#171717]">{request.title}</h3>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-[#555]">{request.description}</p>
                          {(request.guestName || request.guest_name) && (
                            <p className="mt-1 text-[11px] text-[#777]">
                              Guest: {request.guestName || request.guest_name}
                            </p>
                          )}
                        </div>

                        <div className="text-right text-[11px]">
                          <span className="block text-[#888]">Room</span>
                          <strong className="block text-[13px] font-bold text-[#171717]">
                            {request.room || request.room_number || '—'}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-[#F2EFEB]">
                        <span className="text-[11px] text-[#666]">
                          {pending && t('unassigned')}
                          {inProgress && `${t('inProgress')}: ${assignee || staffName}`}
                          {completed && `${t('taskCompleted')}: ${assignee || staffName}`}
                        </span>

                        <div className="flex items-center gap-2">
                          {pending && (
                            <button
                              type="button"
                              onClick={() => handleClaimRequest(requestId)}
                              className="h-8 px-4 rounded-lg bg-black text-white text-[11px] font-bold hover:bg-[#242424] cursor-pointer"
                            >
                              {t('claimTask')}
                            </button>
                          )}
                          {inProgress && (
                            <button
                              type="button"
                              onClick={() => handleCompleteRequest(requestId)}
                              className="h-8 px-4 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                            >
                              {t('completeTask')}
                            </button>
                          )}
                          {completed && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
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

          <aside className="space-y-4">
            <section className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#171717]">Floor Status</h2>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="mt-2 w-full rounded-lg bg-white p-3 text-left border border-[#E0DDD8] cursor-pointer hover:bg-[#FAF9F7]"
              >
                <span className="text-[12px] font-semibold text-[#222]">
                  {floorStatus.activeFloor || 'FLOOR 5 - ACTIVE'}
                </span>
              </button>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[#555]">
                  <span>Rooms Cleaned</span>
                  <span className="font-semibold text-[#222]">{roomsCleaned} / {totalRooms}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#E0DED9] overflow-hidden">
                  <div className="h-full rounded-full bg-black" style={{ width: `${roomsCleanedPercent}%` }} />
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#171717]">Available Staff</h2>
              <div className="mt-3 space-y-2">
                {availableStaff.slice(0, 3).map((staff) => (
                  <div key={staff.id || staff.name} className="flex items-center justify-between text-[11px] py-1 border-b border-[#E0DDD8] last:border-0">
                    <div>
                      <p className="font-semibold text-[#222]">{staff.name}</p>
                      <p className="text-[10px] text-[#666]">{staff.location || 'On duty'}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
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

