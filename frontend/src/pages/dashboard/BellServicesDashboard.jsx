import React, { useEffect, useMemo, useState } from 'react';
import { INITIAL_BELL_SERVICES_DATA } from '../../data/mockHotelData';
import {
  fetchBellServicesDashboard,
  updateBellRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

const normalizeRequest = (request) => ({
  ...request,
  id: request.ticket_code || request.id,
  type: request.request_type || request.type,
  guestName: request.guest_name || request.guestName,
  assignedTo: request.assigned_to || request.assignedTo,
});

const getStatusLabel = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'in progress' || normalized === 'on job') return 'In Progress';
  if (normalized === 'completed') return 'Completed';
  return 'Pending';
};

export const BellServicesDashboard = ({ currentUser, onNotify = () => {} }) => {
  const { t } = useLanguage();
  const staffName = currentUser?.full_name || currentUser?.name || 'Marcus T.';
  const [data, setData] = useState({
    ...INITIAL_BELL_SERVICES_DATA,
    requests: INITIAL_BELL_SERVICES_DATA.requests.map(normalizeRequest),
  });
  const [filter, setFilter] = useState('All');

  const filteredRequests = useMemo(() => {
    const list = data.requests || [];
    if (filter === 'All') return list;
    return list.filter((r) => {
      const s = getStatusLabel(r.status);
      if (filter === 'Pending') return s === 'Pending';
      if (filter === 'In Progress') return s === 'In Progress';
      if (filter === 'Completed') return s === 'Completed';
      return s === filter;
    });
  }, [data.requests, filter]);

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchBellServicesDashboard();
      if (!response?.requests) return;
      const hasLiveRequests = response.requests.length > 0;

      setData((previous) => ({
        ...previous,
        kpis: hasLiveRequests && response.kpis ? response.kpis : previous.kpis,
        requests:
          hasLiveRequests
            ? response.requests.map(normalizeRequest)
            : previous.requests,
        teamStatus:
          response.team_status?.length > 0
            ? response.team_status
            : previous.teamStatus,
        announcement: response.announcement || previous.announcement,
      }));
    };

    loadData();
  }, []);

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

  const handleAccept = async (requestId) => {
    const activeTask = (data.requests || []).find(
      (r) =>
        (r.status === 'In Progress' || (r.status || '').toLowerCase() === 'in progress') &&
        (r.assignedTo === staffName || r.assigned_to === staffName)
    );
    if (activeTask) {
      onNotify(
        `⚠️ Bạn đang có nhiệm vụ đang xử lý (${activeTask.title || activeTask.id}). Vui lòng hoàn thành công việc hiện tại trước khi nhận thêm nhiệm vụ mới!`
      );
      return;
    }

    updateRequestLocally(requestId, 'In Progress', staffName);
    await updateBellRequestStatus(requestId, {
      status: 'In Progress',
      assigned_to: staffName,
    });
    onNotify(`Đã nhận xử lý yêu cầu ${requestId}`);
  };

  const handleComplete = async (requestId) => {
    updateRequestLocally(requestId, 'Completed', staffName);
    await updateBellRequestStatus(requestId, {
      status: 'Completed',
      assigned_to: staffName,
    });
    onNotify(`Đã hoàn tất yêu cầu ${requestId}`);
  };

  const metrics = [
    {
      label: t('kpiPending'),
      value: data.kpis?.pending ?? 0,
    },
    {
      label: t('kpiOnJob'),
      value: data.kpis?.onJob ?? 0,
    },
    {
      label: t('kpiCompleted'),
      value: data.kpis?.completed ?? 0,
    },
    {
      label: t('kpiActiveFleet'),
      value: data.kpis?.activeFleet ?? data.teamStatus?.length ?? 2,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-4 md:px-8 pt-3 pb-8">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#1A1917]">{t('bsTitle')}</h2>
          <span className="rounded bg-[#F0EEEB] px-2.5 py-1 text-[10px] font-bold text-[#77736E]">
            {t('bsActiveOps')}
          </span>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {metrics.map(({ label, value }) => (
            <article
              key={label}
              className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
            >
              <span className="text-[11px] font-semibold text-[#666]">{label}</span>
              <p className="mt-2 text-[18px] font-bold text-[#222]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(220px,1fr)] gap-5 mt-8">
          <div className="min-w-0">
            <div className="h-8 mb-3 flex items-center justify-between gap-4">
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
              {filteredRequests.length === 0 ? (
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#777] border border-[#E8E5E0]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const status = getStatusLabel(request.status);
                  const isPending = status === 'Pending';
                  const isInProgress = status === 'In Progress';

                  return (
                    <article
                      key={request.id}
                      className="rounded-xl bg-white p-4 border border-[#E8E5E0]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-semibold text-[#3F3B38]">
                            {request.title}
                          </h4>
                          <p className="mt-0.5 text-[12px] text-[#666]">
                            {request.location}
                            {request.guestName && ` • Guest: ${request.guestName}`}
                          </p>
                          <p className="mt-2 text-[12px] leading-relaxed text-[#444]">
                            {request.description}
                          </p>
                        </div>

                        <span className="shrink-0 rounded bg-[#F0EFEC] px-2 py-0.5 text-[10px] font-semibold text-[#555]">
                          {status === 'Completed' ? t('completed') : isInProgress ? t('inProgress') : t('pending')}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#F0ECE6] flex items-center justify-end gap-3">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleAccept(request.id)}
                            className="rounded-lg bg-black px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#252525] cursor-pointer"
                          >
                            {t('acceptTask')}
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            type="button"
                            onClick={() => handleComplete(request.id)}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            {t('completeTask')}
                          </button>
                        )}

                        {status === 'Completed' && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                            {t('taskCompleted')}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">{t('bsTeamStatus')}</h3>

              <div className="mt-3 space-y-2">
                {(data.teamStatus || []).slice(0, 3).map((member) => (
                  <div
                    key={member.id || member.name}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-[#E1DEDA] last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-[#333]">{member.name}</p>
                      <p className="text-[10px] text-[#777]">{member.role}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
};
