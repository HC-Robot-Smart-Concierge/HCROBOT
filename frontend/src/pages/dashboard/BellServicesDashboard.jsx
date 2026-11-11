import React, { useEffect, useMemo, useState } from 'react';
import { Pagination } from '../../components/common/Pagination';
import { INITIAL_BELL_SERVICES_DATA } from '../../data/mockHotelData';
import {
  fetchBellServicesDashboard,
  updateBellRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText, staffStatusLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';

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
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Marcus T.';
  const [data, setData] = useState({
    ...INITIAL_BELL_SERVICES_DATA,
    requests: INITIAL_BELL_SERVICES_DATA.requests.map(normalizeRequest),
  });
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

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
        st('Complete your current task ({0}) before claiming another request.', activeTask.title || activeTask.id)
      );
      return;
    }

    updateRequestLocally(requestId, 'In Progress', staffName);
    await updateBellRequestStatus(requestId, {
      status: 'In Progress',
      assigned_to: staffName,
    });
    onNotify(st('Request {0} claimed.', requestId));
  };

  const handleComplete = async (requestId) => {
    updateRequestLocally(requestId, 'Completed', staffName);
    await updateBellRequestStatus(requestId, {
      status: 'Completed',
      assigned_to: staffName,
    });
    onNotify(st('Request {0} completed.', requestId));
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
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container">
        <StaffPageHeader className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1>{t('bsTitle')}</h1>
            <p>{st('Coordinate luggage assistance, guest requests and the Bell Services team.')}</p>
          </div>
          <span className="staff-header-details rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#77736E]">
            {t('bsActiveOps')}
          </span>
        </StaffPageHeader>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(({ label, value }) => (
            <article
              key={label}
              className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
            >
              <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">{label}</p>
              <p className="mt-2 text-[22px] font-bold text-[#262626]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 mt-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#403D39]">{t('activeRequests')}</h3>
              <div className="staff-request-filters" role="group" aria-label={t('activeRequests')}>
                {['All', 'Pending', 'In Progress', 'Completed'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    aria-pressed={filter === tab}
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
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#777] border border-[#BFBFBD]">
                  {t('noDataMatch')}
                </div>
              ) : (
                paginatedRequests.map((request) => {
                  const status = getStatusLabel(request.status);
                  const isPending = status === 'Pending';
                  const isInProgress = status === 'In Progress';

                  return (
                    <article
                      key={request.id}
                      className="rounded-xl bg-white px-5 py-4 border border-[#BFBFBD]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-semibold text-[#3F3B38] break-words">
                            {request.title}
                          </h4>
                          <p className="mt-1 text-[12px] text-[#666] break-words">
                            {request.location}
                            {request.guestName && <> • {st('Guest:')} {request.guestName}</>}
                          </p>
                          <p className="mt-2 text-[12px] leading-relaxed text-[#444] break-words">
                            {request.description}
                          </p>
                        </div>

                        <span className="shrink-0 rounded bg-[#F0EFEC] px-2 py-0.5 text-[10px] font-semibold text-[#555]">
                          {status === 'Completed' ? t('completed') : isInProgress ? t('inProgress') : t('pending')}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-end gap-3">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleAccept(request.id)}
                            className="rounded-lg bg-[#262626] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#404040] cursor-pointer"
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

            {/* Pagination Footer */}
            {filteredRequests.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredRequests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName={st('requests')}
                className="mt-3 rounded-xl border border-[#BFBFBD]"
              />
            )}
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl bg-white p-4 border border-[#BFBFBD]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">{t('bsTeamStatus')}</h3>

              <div className="mt-3 space-y-2">
                {(data.teamStatus || []).slice(0, 3).map((member) => (
                  <div
                    key={member.id || member.name}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-[#E1DEDA] last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#333] break-words">{member.name}</p>
                      <p className="text-[10px] text-[#777]">{st(member.role)}</p>
                    </div>
                    {member.status && <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[#777]">
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${
                        staffStatusLabel(member.status) === 'Available' ? 'bg-emerald-500'
                          : staffStatusLabel(member.status) === 'Busy' ? 'bg-amber-500' : 'bg-stone-400'
                      }`} />
                      {st(staffStatusLabel(member.status))}
                    </span>}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
};
