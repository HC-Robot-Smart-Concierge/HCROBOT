import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Filter,
  Home,
  Lightbulb,
  ListFilter,
  Plus,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { NewDirectiveModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_MAINTENANCE_DATA } from '../../data/mockHotelData';
import {
  createMaintenanceRequest,
  fetchMaintenanceDashboard,
  updateMaintenanceStatus,
} from '../../services/operationsApi';

const normalizeRequest = (request) => ({
  ...request,
  id: request.ticket_code || request.id,
  reportedTime: request.reported_time_label || request.reportedTime,
  assignedTo: request.assigned_to || request.assignedTo,
});

const categoryIcons = {
  plumbing: Home,
  hvac: Snowflake,
  electrical: Lightbulb,
};

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
    const filtered = (data.requests || []).filter((request) =>
      filter === 'All' ? true : request.status === filter
    );
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

  const handleCreateNew = async (newRequest) => {
    const requestId = `MN-${Math.floor(404 + Math.random() * 9000)}`;
    const createdRequest = normalizeRequest({
      id: requestId,
      title: newRequest.title,
      priority: newRequest.priority || 'NORMAL',
      reportedTime: 'Just now',
      status: 'Pending',
      location: newRequest.location || 'Room 412',
      description: newRequest.notes || 'Facility maintenance request.',
      source: 'RECEIVED FROM HCROBOT',
      category: newRequest.category || 'general',
    });

    setData((previous) => ({
      ...previous,
      requests: [createdRequest, ...previous.requests],
    }));

    await createMaintenanceRequest({
      title: createdRequest.title,
      priority: createdRequest.priority,
      location: createdRequest.location,
      description: createdRequest.description,
      source: createdRequest.source,
      category: createdRequest.category,
    });
    onNotify(`Đã tạo yêu cầu bảo trì ${requestId}`);
  };

  const metrics = [
    {
      label: 'TECHNICIANS\nON DUTY',
      value: data.kpis?.availableTechs?.count ?? 3,
      delta: data.kpis?.availableTechs?.delta,
      deltaColor: 'text-[#20A75B]',
      DeltaIcon: TrendingUp,
    },
    {
      label: 'PENDING\nREQUESTS',
      value: data.kpis?.pendingRequests ?? 0,
    },
    {
      label: 'IN PROGRESS',
      value: data.kpis?.inProgress ?? 0,
    },
    {
      label: 'COMPLETED\nTODAY',
      value: data.kpis?.completedToday?.count ?? 0,
      delta: data.kpis?.completedToday?.delta,
      deltaColor: 'text-[#20A75B]',
      DeltaIcon: TrendingUp,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-8 pt-3 pb-8">
        <section className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[15px] font-medium text-[#282522]">Maintenance Dashboard</h2>
            <p className="mt-1 text-[12px] text-[#69645F]">
              Manage and track all facility repair and upkeep requests.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsNewRequestModalOpen(true)}
            className="flex items-center gap-2 rounded-[10px] bg-black px-5 py-3 text-[12px] font-medium text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#252525]"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            New Request
          </button>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-[52px]">
          {metrics.map(({ label, value, delta, deltaColor, DeltaIcon }) => (
            <article
              key={label}
              className="h-[126px] rounded-[14px] bg-white/85 px-5 py-5 shadow-[0_4px_18px_rgba(55,48,42,0.035)]"
            >
              <p className="whitespace-pre-line text-[12px] font-medium leading-[1.45] tracking-[0.08em] text-[#6C6863]">
                {label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="text-[14px] font-medium text-[#3C3936]">{value}</span>
                {delta && (
                  <span className={`flex max-w-[82px] items-center gap-1 text-[11px] leading-[1.25] ${deltaColor}`}>
                    {DeltaIcon && <DeltaIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />}
                    {delta}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(225px,1fr)] gap-5 mt-[50px]">
          <div className="min-w-0">
            <div className="h-11 flex items-start justify-between">
              <h3 className="pt-2 text-[13px] font-medium text-[#403D39]">Active Requests</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Filter pending requests"
                  onClick={() => setFilter((current) => (current === 'Pending' ? 'All' : 'Pending'))}
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                    filter === 'Pending' ? 'bg-black text-white' : 'bg-[#F1EFEC] text-[#77736E] hover:bg-[#E9E6E2]'
                  }`}
                >
                  <Filter className="h-4 w-4" strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  title="Reverse request order"
                  onClick={() => setSortNewestFirst((current) => !current)}
                  className="h-9 w-9 rounded-full bg-[#F1EFEC] flex items-center justify-center text-[#77736E] transition-colors hover:bg-[#E9E6E2]"
                >
                  <ListFilter className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleRequests.map((request) => {
                const Icon = categoryIcons[request.category] || Wrench;
                const status = request.status || 'Pending';
                const meta = statusMeta[status] || statusMeta.Pending;
                const isPending = status === 'Pending' || status === 'Unassigned';
                const isInProgress = status === 'In Progress';
                const isCompleted = status === 'Completed';

                return (
                  <article
                    key={request.id}
                    className="relative overflow-hidden rounded-[18px] bg-white px-5 py-[18px] shadow-[0_4px_18px_rgba(55,48,42,0.045)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 shrink-0 rounded-[13px] flex items-center justify-center bg-[#EFEEEB] text-[#5F5B56]">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[13px] font-medium text-[#3F3B38]">{request.title}</h4>
                            </div>
                            <p className="mt-1 text-[12px] leading-[1.45] text-[#706B66]">
                              {request.location} • {request.description}
                            </p>
                          </div>

                          <div className="w-[88px] shrink-0 text-right">
                            <p className="text-[11px] text-[#69645F]">{request.reportedTime}</p>
                            <span className="mt-1 inline-flex items-center gap-1.5 rounded-[7px] bg-[#F0EFEC] px-2 py-1 text-[11px] text-[#69645F]">
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-[#EAE7E3] pt-4 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-2 text-[11px] text-[#67625D]">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                        <span className="tracking-[0.03em]">{request.source || 'RECEIVED FROM HCROBOT'}</span>
                      </div>

                      {isPending && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDecline(request.id)}
                            className="rounded-[9px] border border-[#D8D4CF] bg-white px-4 py-2.5 text-[11px] font-medium text-[#5F5B56] hover:bg-[#F7F5F2]"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClaim(request.id)}
                            className="rounded-[9px] bg-black px-4 py-2.5 text-[11px] font-medium text-white hover:bg-[#252525]"
                          >
                            Accept Task
                          </button>
                        </div>
                      )}

                      {isInProgress && (
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="flex items-center gap-2 text-[11px] text-[#68635E]">
                            <span className="h-5 w-5 rounded-full bg-black flex items-center justify-center text-[9px] font-semibold text-white">
                              {(request.assignedTo || staffName)
                                .split(' ')
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join('')}
                            </span>
                            <span>Assigned to: {request.assignedTo || staffName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleComplete(request.id)}
                            className="rounded-[9px] border border-[#D8D4CF] bg-white px-4 py-2.5 text-[11px] font-medium text-[#5F5B56] hover:bg-[#F7F5F2]"
                          >
                            Update Status
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => onNotify(`Báo cáo yêu cầu ${request.id}`)}
                          className="shrink-0 text-[11px] text-[#77726D] underline decoration-[#C5C0BA] underline-offset-2 hover:text-black"
                        >
                          View Report
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {visibleRequests.length === 0 && (
                <div className="rounded-[18px] bg-white px-6 py-12 text-center text-[12px] text-[#77726D]">
                  No requests match this filter.
                </div>
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-7">
            <section className="rounded-[18px] bg-[#F5F3F0] px-5 py-5 shadow-[0_4px_18px_rgba(55,48,42,0.035)]">
              <h3 className="text-[13px] font-medium text-[#403D39]">Staff Availability</h3>

              <div className="mt-3">
                {(data.staffAvailability || []).slice(0, 3).map((staff, index, staffList) => {
                  const isBusy = (staff.status || '').toLowerCase().includes('busy');
                  const isOffShift = (staff.status || '').toLowerCase().includes('off');

                  return (
                    <div
                      key={staff.id || staff.name}
                      className={`flex min-h-[64px] items-center gap-3 ${
                        index < staffList.length - 1 ? 'border-b border-[#E3E0DC]' : ''
                      } ${isOffShift ? 'opacity-55' : ''}`}
                    >
                      <div className="relative h-9 w-9 shrink-0 rounded-full bg-[#E9E7E4] flex items-center justify-center text-[11px] font-medium text-[#625E59]">
                        {(staff.name || 'MS')
                          .split(' ')
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')}
                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#F5F3F0] ${
                            isOffShift ? 'bg-[#A9A5A0]' : isBusy ? 'bg-[#5C9DFF]' : 'bg-[#29C66B]'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[#45413D]">{staff.name}</p>
                        <p className="truncate text-[11px] text-[#77726D]">{staff.role || staff.specialty}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-[#6E6964]">{staff.status}</span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onNotify('Đã mở lịch làm việc của đội Maintenance')}
                className="mt-3 w-full rounded-[10px] border border-[#D7D2CD] bg-transparent px-4 py-3 text-[11px] font-medium text-[#4F4B46] hover:bg-white"
              >
                Manage Schedule
              </button>
            </section>

            <section
              className="relative h-[202px] overflow-hidden rounded-[18px] bg-[#E6E3DE] bg-cover bg-center shadow-[0_4px_18px_rgba(55,48,42,0.045)]"
              style={{ backgroundImage: `url(${data.facilityMap?.thumbnail})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#E5E1DB]/95 via-[#ECE9E4]/65 to-white/15" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 text-[#504C47]">
                <p className="text-[11px] font-medium tracking-[0.08em]">FACILITY MAP</p>
                <p className="mt-1 text-[12px] font-medium">{data.facilityMap?.zone}</p>
                <p className="mt-2 max-w-[175px] text-[11px] leading-[1.45]">
                  {data.facilityMap?.description}
                </p>
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(true)}
                  className="mt-3 w-fit text-[11px] font-medium underline decoration-[#A8A29B] underline-offset-2 hover:text-black"
                >
                  Open Interactive Map
                </button>
              </div>
            </section>
          </aside>
        </section>
      </div>

      <NewDirectiveModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSubmit={handleCreateNew}
      />

      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Facility Map"
      />
    </main>
  );
};
