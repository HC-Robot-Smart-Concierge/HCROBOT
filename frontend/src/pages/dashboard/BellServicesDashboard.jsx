import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Bot,
  Briefcase,
  CheckCircle2,
  FileSearch,
  Footprints,
  Hourglass,
  AlertTriangle,
} from 'lucide-react';
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

const requestIcon = {
  luggage: Briefcase,
  room_move: BedDouble,
  lost_found: FileSearch,
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

  const handleAssignToBot = async (requestId) => {
    updateRequestLocally(requestId, 'In Progress', 'Bot Unit Alpha');
    await updateBellRequestStatus(requestId, {
      status: 'In Progress',
      assigned_to: 'Bot Unit Alpha',
    });
    onNotify(`Đã giao yêu cầu ${requestId} cho Bot Unit Alpha`);
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
      icon: Hourglass,
    },
    {
      label: t('kpiOnJob'),
      value: data.kpis?.onJob ?? 0,
      icon: Footprints,
    },
    {
      label: t('kpiCompleted'),
      value: data.kpis?.completed ?? 0,
      icon: CheckCircle2,
    },
    {
      label: t('kpiActiveFleet'),
      value: data.kpis?.activeFleet ?? data.teamStatus?.length ?? 2,
      icon: Bot,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-8 pt-4 pb-8">
        <div className="flex items-center gap-4 min-h-10">
          <h2 className="text-[15px] font-medium text-[#1A1917]">{t('bsTitle')}</h2>
          <span className="rounded-full bg-[#F0EEEB] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#77736E]">
            {t('bsActiveOps')}
          </span>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          {metrics.map(({ label, value, icon: Icon, urgent }) => (
            <article
              key={label}
              className={`h-[98px] rounded-[14px] px-5 py-4 flex flex-col justify-between shadow-[0_2px_7px_rgba(43,38,32,0.03)] ${
                urgent
                  ? 'bg-gradient-to-br from-[#FFE4E1] to-[#F8B9BA] text-[#B92329]'
                  : 'bg-[#F0EEEB] text-[#57534E]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium tracking-[0.08em]">{label}</span>
                <Icon
                  className={`h-[18px] w-[18px] ${urgent ? 'text-[#D52930]' : 'text-[#827F7A]'}`}
                  strokeWidth={1.8}
                />
              </div>
              <span className={`text-[14px] font-medium ${urgent ? 'text-[#B92329]' : 'text-[#4D4945]'}`}>
                {value}
              </span>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.08fr)_minmax(220px,1fr)] gap-5 mt-11">
          <div className="min-w-0">
            <div className="h-9 mb-4 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-medium text-[#403D39]">{t('activeRequests')}</h3>
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
                <div className="rounded-[18px] bg-white px-6 py-12 text-center text-[12px] text-[#77726D]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const Icon = requestIcon[request.type] || Briefcase;
                  const status = getStatusLabel(request.status);
                  const isPending = status === 'Pending';
                  const isInProgress = status === 'In Progress';

                  return (
                    <article
                      key={request.id}
                      className="rounded-[18px] bg-[#F0EFEC] px-5 py-[18px] shadow-[0_3px_12px_rgba(55,48,42,0.035)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 h-12 w-12 shrink-0 rounded-full flex items-center justify-center bg-[#E7E5E3] text-[#54514E]">
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-medium leading-5 text-[#3F3B38]">
                                {request.title}
                              </h4>
                              <p className="text-[12px] leading-5 text-[#66615C]">
                                {request.location}
                                {request.guestName && ` • Guest: ${request.guestName}`}
                                {request.reporter && ` • Reporter: ${request.reporter}`}
                              </p>
                            </div>

                            <span className="shrink-0 flex items-center gap-1 text-[11px] text-[#696561]">
                              <span className={`h-1.5 w-1.5 rounded-full ${isInProgress ? 'bg-black' : 'bg-[#77736E]'}`} />
                              {status === 'Completed' ? t('completed') : isInProgress ? t('inProgress') : t('pending')}
                            </span>
                          </div>

                          <p className="mt-3 max-w-[94%] text-[12px] leading-[1.45] text-[#66615C]">
                            {request.description}
                          </p>

                          <div className="mt-4 flex items-center gap-3">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleAccept(request.id)}
                                className="rounded-[9px] bg-black px-5 py-2 text-[11px] font-bold text-white transition-colors hover:bg-[#252525] cursor-pointer shadow-sm"
                              >
                                {t('acceptTask')}
                              </button>
                            )}

                            {isInProgress && (
                              <button
                                type="button"
                                onClick={() => handleComplete(request.id)}
                                className="rounded-[9px] bg-emerald-600 px-5 py-2 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer shadow-sm flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{t('completeTask')}</span>
                              </button>
                            )}

                            {status === 'Completed' && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {t('taskCompleted')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="min-w-0">
            <h3 className="h-9 text-[13px] font-medium text-[#403D39]">{t('bsTeamStatus')}</h3>

            <div className="rounded-[18px] bg-[#F2F1EE] px-4 py-2 shadow-[0_3px_12px_rgba(55,48,42,0.035)]">
              {(data.teamStatus || []).slice(0, 3).map((member, index, members) => (
                <div
                  key={member.id || member.name}
                  className={`flex min-h-[68px] items-center gap-3 ${
                    index < members.length - 1 ? 'border-b border-[#E1DEDA]' : ''
                  }`}
                >
                  {member.isRobot ? (
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[#E5E3E0] flex items-center justify-center text-[#68645F]">
                      <Bot className="h-[17px] w-[17px]" strokeWidth={1.8} />
                    </div>
                  ) : member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[#E5E3E0] flex items-center justify-center text-[11px] font-semibold text-[#68645F]">
                      {(member.name || 'BS')
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[#494541]">{member.name}</p>
                    <p className="truncate text-[11px] text-[#716D68]">{member.role}</p>
                  </div>

                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      (member.status || '').toLowerCase() === 'busy'
                        ? 'bg-[#FFAA00]'
                        : 'bg-[#20C96B]'
                    }`}
                  />
                </div>
              ))}
            </div>

            <div
              className="relative mt-8 h-[184px] overflow-hidden rounded-[18px] bg-[#E5E1DC] bg-cover bg-center shadow-[0_3px_12px_rgba(55,48,42,0.06)]"
              style={{ backgroundImage: `url(${data.announcement?.imageUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#E8E5E0]/95 via-[#EFEDE8]/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-[#504C48]">
                <p className="text-[12px] font-medium">{data.announcement?.title}</p>
                <p className="mt-1 text-[11px] leading-[1.45]">{data.announcement?.subtitle}</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
};
