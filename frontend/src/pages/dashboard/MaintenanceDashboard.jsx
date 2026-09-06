import React, { useEffect, useMemo, useState } from 'react';
import { NewDirectiveModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_MAINTENANCE_DATA } from '../../data/mockHotelData';
import {
  createMaintenanceRequest,
  fetchMaintenanceDashboard,
  updateMaintenanceStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

const normalizeRequest = (request) => ({
  ...request,
  id: request.ticket_code || request.id,
  reportedTime: request.reported_time_label || request.reportedTime,
  assignedTo: request.assigned_to || request.assignedTo,
});

const statusMeta = {
  Pending: { dot: 'bg-[#8A8783]', label: 'Pending' },
  'In Progress': { dot: 'bg-[#66A6FF]', label: 'In Progress' },
  Completed: { dot: 'bg-[#54C987]', label: 'Completed' },
  Declined: { dot: 'bg-[#D75D5D]', label: 'Declined' },
};

export const MaintenanceDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'James D.';
  const [data, setData] = useState({
    ...INITIAL_MAINTENANCE_DATA,
    requests: INITIAL_MAINTENANCE_DATA.requests.map(normalizeRequest),
  });
  const [filter, setFilter] = useState('All');
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchMaintenanceDashboard();
      if (!response?.requests) return;
      const hasLiveRequests = response.requests.length > 0;

      setData((previous) => ({
        ...previous,
        kpis: hasLiveRequests && response.kpis ? response.kpis : previous.kpis,
        requests: hasLiveRequests
          ? response.requests.map(normalizeRequest)
          : previous.requests,
        staffAvailability:
          response.staff_availability?.length >= 3
            ? response.staff_availability
            : previous.staffAvailability,
        facilityMap: response.facility_map || previous.facilityMap,
      }));
    };

    loadData();
  }, []);

  const visibleRequests = useMemo(() => {
    const filtered = (data.requests || []).filter((request) => {
      if (filter === 'All') return true;
      const s = (request.status || '').toLowerCase();
      if (filter === 'Pending') return s === 'pending' || s === 'unassigned';
      if (filter === 'In Progress') return s === 'in progress' || s === 'in_progress';
      if (filter === 'Completed') return s === 'completed';
      return request.status === filter;
    });
    return sortNewestFirst ? filtered : [...filtered].reverse();
  }, [data.requests, filter, sortNewestFirst]);

  const updateRequestLocally = (requestId, status, assignedTo) => {
    setData((previous) => ({
      ...previous,
      requests: previous.requests.map((request) =>
        request.id === requestId
          ? { ...request, status, assignedTo: assignedTo || request.assignedTo }
          : request
      ),
    }));
  };

  const handleClaim = async (requestId) => {
    const activeTask = (data.requests || []).find(
      (r) =>
        r.status === 'In Progress' &&
        (r.assignedTo === staffName || r.assigned_to === staffName)
    );
    if (activeTask) {
      onNotify(
        `⚠️ Bạn đang có nhiệm vụ đang xử lý (${activeTask.title || activeTask.id}). Vui lòng hoàn thành công việc hiện tại trước khi nhận thêm nhiệm vụ mới!`
      );
      return;
    }

    updateRequestLocally(requestId, 'In Progress', staffName);
    await updateMaintenanceStatus(requestId, 'In Progress', staffName);
    onNotify(`Đã nhận xử lý yêu cầu ${requestId}`);
  };

  const handleDecline = async (requestId) => {
    updateRequestLocally(requestId, 'Declined');
    await updateMaintenanceStatus(requestId, 'Declined');
    onNotify(`Đã từ chối yêu cầu ${requestId}`);
  };

  const handleComplete = async (requestId) => {
    updateRequestLocally(requestId, 'Completed', staffName);
    await updateMaintenanceStatus(requestId, 'Completed', staffName);
    onNotify(`Đã hoàn tất yêu cầu ${requestId}`);
  };

  const { t } = useLanguage();

  const metrics = [
    {
      label: t('kpiTechsOnDuty'),
      value: data.kpis?.availableTechs?.count ?? 3,
    },
    {
      label: t('kpiPendingRequests'),
      value: data.kpis?.pendingRequests ?? 0,
    },
    {
      label: t('inProgress'),
      value: data.kpis?.inProgress ?? 0,
    },
    {
      label: t('kpiCompletedToday'),
      value: data.kpis?.completedToday?.count ?? 0,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-4 md:px-8 pt-3 pb-8">
        <section className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[#282522]">{t('mnTitle')}</h2>
            <p className="mt-0.5 text-[12px] text-[#69645F]">
              {t('mnSubtitle')}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {metrics.map(({ label, value }) => (
            <article
              key={label}
              className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
            >
              <p className="text-[11px] font-semibold text-[#6C6863]">
                {label}
              </p>
              <p className="mt-2 text-[18px] font-bold text-[#3C3936]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(225px,1fr)] gap-5 mt-8">
          <div className="min-w-0">
            <div className="h-9 mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-semibold text-[#403D39]">{t('activeRequests')}</h3>
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
                    {tab === 'All'
                      ? t('all')
                      : tab === 'Pending'
                      ? t('pending')
                      : tab === 'In Progress'
                      ? t('inProgress')
                      : t('completed')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {visibleRequests.map((request) => {
                const status = request.status || 'Pending';
                const meta = statusMeta[status] || statusMeta.Pending;
                const isPending = status === 'Pending' || status === 'Unassigned';
                const isInProgress = status === 'In Progress';
                const isCompleted = status === 'Completed';

                return (
                  <article
                    key={request.id}
                    className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13px] font-semibold text-[#3F3B38]">{request.title}</h4>
                          <span className="text-[10px] text-[#888] font-mono">[{request.id}]</span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#666]">
                          {request.location} • {request.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-[#888]">{request.reportedTime}</p>
                        <span className="mt-1 inline-block rounded bg-[#F0EFEC] px-2 py-0.5 text-[10px] font-semibold text-[#555]">
                          {isCompleted ? t('completed') : isInProgress ? t('inProgress') : t('pending')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#F0ECE6] pt-3 flex items-center justify-between gap-4">
                      <span className="text-[11px] text-[#777]">
                        {request.source || 'RECEIVED FROM HCROBOT'}
                      </span>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDecline(request.id)}
                            className="rounded-lg border border-[#DDD] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#555] hover:bg-[#F7F5F2] cursor-pointer"
                          >
                            {t('decline')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClaim(request.id)}
                            className="rounded-lg bg-black px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#252525] cursor-pointer"
                          >
                            {t('claimTask')}
                          </button>
                        </div>
                      )}

                      {isInProgress && (
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-[#68635E]">
                            Assigned: <strong>{request.assignedTo || staffName}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleComplete(request.id)}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            {t('completeTask')}
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                          {t('taskCompleted')}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}

              {visibleRequests.length === 0 && (
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#888] border border-[#E8E5E0]">
                  {t('noDataMatch')}
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">{t('mnStaffAvailability')}</h3>

              <div className="mt-3 space-y-2">
                {(data.staffAvailability || []).slice(0, 3).map((staff) => (
                  <div
                    key={staff.id || staff.name}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-[#E3E0DC] last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-[#333]">{staff.name}</p>
                      <p className="text-[10px] text-[#777]">{staff.role || staff.specialty}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#666]">{staff.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-4 border border-[#E8E5E0]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#777]">FACILITY MAP</p>
              <p className="mt-1 text-[12px] font-semibold text-[#333]">{data.facilityMap?.zone}</p>
              <p className="mt-1 text-[11px] text-[#666]">
                {data.facilityMap?.description}
              </p>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="mt-3 text-[11px] font-bold text-black underline cursor-pointer"
              >
                Open Map
              </button>
            </section>
          </aside>
        </section>
      </div>

      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Facility Map"
      />
    </main>
  );
};

