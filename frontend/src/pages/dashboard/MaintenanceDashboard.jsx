import React, { useEffect, useMemo, useState } from 'react';
import { Pagination } from '../../components/common/Pagination';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { MaintenanceCatalogModal } from '../../components/dashboard/MaintenanceCatalogModal';
import {
  fetchMaintenanceDashboard,
  updateMaintenanceStatus,
  updateMaintenancePriority,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { staffStatusLabel, useStaffText } from '../../context/StaffLanguage';
import { RefreshCw, Wrench } from 'lucide-react';

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
  const { language, t } = useLanguage();
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'James D.';
  const [data, setData] = useState({
    kpis: { availableTechs: { count: 0 } }, requests: [], staffAvailability: [],
  });
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const pageSize = 10;
  const [priorityUpdating, setPriorityUpdating] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadData = async () => {
      const response = await fetchMaintenanceDashboard();
      if (cancelled) return;
      if (response?.requests) {
        setData((previous) => ({
          ...previous,
          kpis: response.kpis || previous.kpis,
          requests: response.requests.map(normalizeRequest),
          staffAvailability: response.staff_availability || [],
          facilityMap: response.facility_map || previous.facilityMap,
        }));
      }
      timer = setTimeout(loadData, 15000);
    };

    loadData();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refreshKey]);

  const visibleRequests = useMemo(() => {
    const filtered = (data.requests || []).filter((request) => {
      if (filter === 'All') return true;
      const s = (request.status || '').toLowerCase();
      if (filter === 'Pending') return s === 'pending' || s === 'unassigned';
      if (filter === 'In Progress') return s === 'in progress' || s === 'in_progress';
      if (filter === 'Completed') return s === 'completed';
      return request.status === filter;
    });
    const terminal = new Set(['completed', 'resolved', 'done', 'closed', 'cancelled', 'canceled', 'declined', 'rejected', 'delivered', 'missed', 'hoàn tất', 'đã hoàn thành', 'đã hoàn tất', 'đã hủy', 'hủy', 'đã từ chối']);
    return filtered.sort((a, b) => {
      const closedA = terminal.has((a.status || '').trim().toLowerCase());
      const closedB = terminal.has((b.status || '').trim().toLowerCase());
      if (closedA !== closedB) return Number(closedA) - Number(closedB);
      const timeA = Date.parse(a.created_at) || 0;
      const timeB = Date.parse(b.created_at) || 0;
      if (closedA) return timeB - timeA;
      const urgentA = (a.priority || '').toUpperCase() === 'URGENT';
      const urgentB = (b.priority || '').toUpperCase() === 'URGENT';
      return Number(urgentB) - Number(urgentA) || timeA - timeB || a.id.localeCompare(b.id);
    });
  }, [data.requests, filter]);

  const totalPages = Math.max(1, Math.ceil(visibleRequests.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return visibleRequests.slice(startIndex, startIndex + pageSize);
  }, [visibleRequests, currentPage, pageSize]);

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
        st('Complete your current task ({0}) before claiming another request.', activeTask.title || activeTask.id)
      );
      return;
    }

    updateRequestLocally(requestId, 'In Progress', staffName);
    await updateMaintenanceStatus(requestId, 'In Progress', staffName);
    onNotify(st('Request {0} claimed.', requestId));
  };

  const handleDecline = async (requestId) => {
    updateRequestLocally(requestId, 'Declined');
    await updateMaintenanceStatus(requestId, 'Declined');
    onNotify(st('Request {0} declined.', requestId));
  };

  const handleComplete = async (requestId) => {
    updateRequestLocally(requestId, 'Completed', staffName);
    await updateMaintenanceStatus(requestId, 'Completed', staffName);
    onNotify(st('Request {0} completed.', requestId));
  };

  const handlePriority = async (request) => {
    if (priorityUpdating) return;
    setPriorityUpdating(request.id);
    try {
      const priority = (request.priority || '').toUpperCase() === 'URGENT' ? 'Normal' : 'Urgent';
      const updated = await updateMaintenancePriority(request.id, priority);
      setData((previous) => ({
        ...previous,
        requests: previous.requests.map((item) => item.id === request.id ? normalizeRequest(updated) : item),
      }));
      setRefreshKey((value) => value + 1);
      onNotify(st('Repair priority updated.'));
    } catch {
      onNotify(st('Could not update repair priority. Please refresh and try again.'));
    } finally {
      setPriorityUpdating(null);
    }
  };

  // Localize known server labels at render time without changing request data.
  const reportedTimeLabel = (value) => {
    const text = String(value || '').trim();
    const relativeUnits = [
      [/^(\d+)\s*(?:mins?|minutes?)\s+ago$|^(\d+)\s*phút trước$/i, 'minute'],
      [/^(\d+)\s*(?:hrs?|hours?)\s+ago$|^(\d+)\s*giờ trước$/i, 'hour'],
      [/^(\d+)\s*days?\s+ago$|^(\d+)\s*ngày trước$/i, 'day'],
    ];
    for (const [pattern, unit] of relativeUnits) {
      const match = text.match(pattern);
      if (match) return new Intl.RelativeTimeFormat(language === 'VI' ? 'vi' : 'en').format(-Number(match[1] || match[2]), unit);
    }
    if (/^(just now|vừa xong|vừa đặt)$/i.test(text)) return st('Just now');
    return text;
  };
  const availabilityLabel = (value) => {
    const match = String(value || '').match(/^([^()]*?)(\s*\(.*\))?$/);
    return match ? `${st(staffStatusLabel(match[1].trim()))}${match[2] || ''}` : value;
  };
  const sourceLabel = (source) => {
    if (!source || /^(received from hcrobot|tiếp nhận từ hcrobot)$/i.test(source)) return st('Received from HCRobot');
    return st(source);
  };

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
    <div className="staff-page-body maintenance-dashboard flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container">
        <StaffPageHeader>
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-[#282522]">{t('mnTitle')}</h2>
            <p className="mt-0.5 text-[12px] text-[#69645F]">
              {t('mnSubtitle')}
            </p>
          </div>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}
            className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> {st('Refresh')}
          </button>
          <button
            type="button"
            onClick={() => setIsCatalogModalOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{language === 'VI' ? 'Danh mục sự cố' : 'Issue Catalog'}</span>
          </button>
        </StaffPageHeader>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(({ label, value }) => (
            <article
              key={label}
              className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
            >
              <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">
                {label}
              </p>
              <p className="mt-2 text-[22px] font-bold text-[#262626]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 mt-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#403D39]">{t('activeRequests')}</h3>
              <div className="maintenance-filters" role="group" aria-label={t('activeRequests')}>
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

            <p className="mb-3 text-[11px] text-[#777]">{st('Urgent repairs first, then oldest requests. Additional reports keep the original queue position.')}</p>
            <div className="space-y-3">
              {paginatedRequests.map((request) => {
                const status = request.status || 'Pending';
                const displayStatus = staffStatusLabel(status);
                const meta = statusMeta[displayStatus] || statusMeta.Pending;
                const isPending = status === 'Pending' || status === 'Unassigned';
                const isInProgress = status === 'In Progress';
                const isCompleted = status === 'Completed';

                return (
                  <article
                    key={request.id}
                    className="rounded-xl bg-white px-5 py-4 border border-[#E8E5E0]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[13px] font-semibold text-[#3F3B38] break-words">{request.title}</h4>
                          <span className="text-[10px] text-[#888] font-mono">[{request.id}]</span>
                          {(request.priority || '').toUpperCase() === 'URGENT' && (
                            <span className="rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-semibold">{st('Urgent')}</span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#666] break-words whitespace-pre-line">
                          {request.location} • {request.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-[#888]">{reportedTimeLabel(request.reportedTime)}</p>
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded bg-[#F0EFEC] px-2 py-0.5 text-[10px] font-semibold text-[#555]">
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                          {st(displayStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#E9E5DC] pt-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] text-[#777]">
                        {sourceLabel(request.source)}
                      </span>

                      {(isPending || isInProgress) && (
                        <button type="button" disabled={Boolean(priorityUpdating)} onClick={() => handlePriority(request)}
                          className="rounded-lg border border-[#DDD] px-3 py-1.5 text-[11px] font-semibold hover:bg-stone-50 disabled:opacity-50 cursor-pointer">
                          {(request.priority || '').toUpperCase() === 'URGENT' ? st('Remove urgency') : st('Mark urgent')}
                        </button>
                      )}

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
                            className="rounded-lg bg-[#262626] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#404040] cursor-pointer"
                          >
                            {t('claimTask')}
                          </button>
                        </div>
                      )}

                      {isInProgress && (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[11px] text-[#68635E]">
                            {st('Assigned:')} <strong>{request.assignedTo || staffName}</strong>
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
                <div className="maintenance-panel rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#888] border">
                  {t('noDataMatch')}
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {visibleRequests.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={visibleRequests.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName={st('requests')}
                className="mt-3 rounded-xl border bg-white"
              />
            )}
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="maintenance-panel rounded-xl bg-white p-4 border">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">{t('mnStaffAvailability')}</h3>

              <div className="mt-3 space-y-2">
                {(data.staffAvailability || []).slice(0, 3).map((staff) => (
                  <div
                    key={staff.id || staff.name}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-[#E3E0DC] last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-[#333]">{staff.name}</p>
                      <p className="text-[10px] text-[#777]">{st(staff.role || staff.specialty)}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[#666]">{availabilityLabel(staff.status)}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>

      <MaintenanceCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        onNotify={onNotify}
      />
    </div>
  );
};

