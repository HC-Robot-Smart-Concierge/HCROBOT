import React, { useEffect, useMemo, useState } from 'react';
import {
  Luggage,
  SearchCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  X,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchBellServicesDashboard,
  createBellRequest,
  updateBellRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText, staffStatusLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';

// English labels, translated by useStaffText. Keys match backend BELL_SERVICES.
const BELL_SERVICE_LABELS = {
  luggage_delivery: 'Bring luggage to room',
  luggage_pickup: 'Take luggage down to lobby',
  luggage_storage: 'Store luggage',
  luggage_retrieval: 'Retrieve stored luggage',
  room_move: 'Room move assistance',
};

const inferFlowType = (request) => {
  const rawType = (request.request_type || request.type || '').toLowerCase();
  if (['lost_found', 'room_move'].includes(rawType)) {
    return rawType;
  }
  const text = `${request.title || ''} ${request.description || ''}`.toLowerCase();
  if (
    ['thất lạc', 'quên đồ', 'mất đồ', 'rơi đồ', 'lost', 'missing', 'forgot'].some((k) =>
      text.includes(k)
    )
  ) {
    return 'lost_found';
  }
  if (['đổi phòng', 'chuyển phòng', 'room move'].some((k) => text.includes(k))) {
    return 'room_move';
  }
  return 'luggage';
};

const normalizeRequest = (request) => {
  const flowType = inferFlowType(request);
  return {
    ...request,
    id: request.ticket_code || request.id,
    type: flowType,
    request_type: flowType,
    serviceKey: request.bell_service || null,
    guestName: request.guest_name || request.guestName || 'Hotel Guest',
    assignedTo: request.assigned_to || request.assignedTo || null,
  };
};

const getStatusLabel = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'in progress' || normalized === 'on job') return 'In Progress';
  if (normalized === 'completed') return 'Completed';
  return 'Pending';
};

const createdTime = (request) => new Date(request.created_at || 0).getTime();

// Open requests first and oldest first (FIFO); completed history newest first.
const queueOrder = (a, b) => {
  const aDone = getStatusLabel(a.status) === 'Completed';
  const bDone = getStatusLabel(b.status) === 'Completed';
  if (aDone !== bDone) return aDone ? 1 : -1;
  return aDone ? createdTime(b) - createdTime(a) : createdTime(a) - createdTime(b);
};

const FLOW_TABS = [
  {
    id: 'all',
    label: 'Tất cả nghiệp vụ',
    icon: Sparkles,
  },
  {
    id: 'luggage',
    label: 'Hỗ trợ hành lý',
    icon: Luggage,
  },
  {
    id: 'lost_found',
    label: 'Báo cáo đồ thất lạc',
    icon: SearchCheck,
  },
];

export const BellServicesDashboard = ({ currentUser, onNotify = () => {} }) => {
  const { t } = useLanguage();
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Marcus T.';
  const [data, setData] = useState({
    kpis: { pending: 0, onJob: 0, completed: 0, activeFleet: 0 },
    requests: [],
    teamStatus: [],
  });
  const [activeFlow, setActiveFlow] = useState('all');
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const pageSize = 10;

  // Modal state for creating/receiving a request in either Bellman flow
  const [modalFlow, setModalFlow] = useState(null); // 'luggage' | 'lost_found' | null
  const [formState, setFormState] = useState({
    location: '',
    guestName: '',
    subCategory: 'Mang hành lý lên phòng',
    luggageCount: '2',
    itemName: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll every 15 s after each load completes; an empty queue stays empty (no mock data).
  useEffect(() => {
    let cancelled = false;
    let timer;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetchBellServicesDashboard();
        if (cancelled) return;
        setLoadFailed(!response?.requests);
        if (response?.requests) {
          setData((previous) => ({
            ...previous,
            kpis: response.kpis || previous.kpis,
            requests: response.requests
              .map(normalizeRequest)
              .filter((r) => ['luggage', 'lost_found', 'room_move'].includes(r.type)),
            teamStatus:
              response.team_status?.length > 0
                ? response.team_status
                : previous.teamStatus,
            announcement: response.announcement || previous.announcement,
          }));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          timer = setTimeout(loadData, 15000);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, activeFlow]);

  const flowCounts = useMemo(() => {
    const list = data.requests || [];
    return {
      all: list.length,
      luggage: list.filter((r) => r.type === 'luggage' || r.type === 'room_move').length,
      lost_found: list.filter((r) => r.type === 'lost_found').length,
    };
  }, [data.requests]);

  const filteredRequests = useMemo(() => {
    const list = [...(data.requests || [])].sort(queueOrder);
    return list.filter((r) => {
      // 1. Filter by Bellman workflow tab
      if (activeFlow === 'luggage' && r.type !== 'luggage' && r.type !== 'room_move') {
        return false;
      }
      if (activeFlow === 'lost_found' && r.type !== 'lost_found') {
        return false;
      }

      // 2. Filter by status
      if (filter === 'All') return true;
      const s = getStatusLabel(r.status);
      return s === filter;
    });
  }, [data.requests, activeFlow, filter]);

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
    const targetReq = (data.requests || []).find((r) => r.id === requestId);
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

    if (targetReq?.type === 'lost_found') {
      onNotify(`Đã tiếp nhận báo cáo đồ thất lạc ${requestId} và bắt đầu xác minh/tìm kiếm`);
    } else {
      onNotify(st('Request {0} claimed.', requestId));
    }
    setRefreshKey((key) => key + 1);
  };

  const handleComplete = async (requestId) => {
    const targetReq = (data.requests || []).find((r) => r.id === requestId);
    updateRequestLocally(requestId, 'Completed', staffName);
    await updateBellRequestStatus(requestId, {
      status: 'Completed',
      assigned_to: staffName,
    });

    if (targetReq?.type === 'lost_found') {
      onNotify(`Đã hoàn tất tìm kiếm & trao trả đồ thất lạc (${requestId})`);
    } else {
      onNotify(st('Request {0} completed.', requestId));
    }
    setRefreshKey((key) => key + 1);
  };

  const openCreateModal = (flowType) => {
    setModalFlow(flowType);
    setFormState({
      location: 'Room 302',
      guestName: '',
      subCategory:
        flowType === 'room_move'
          ? 'Hỗ trợ chuyển phòng'
          : 'Mang hành lý lên phòng',
      luggageCount: '2',
      itemName: '',
      description: '',
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!modalFlow) return;
    setIsSubmitting(true);

    try {
      const loc = formState.location.trim() || 'Main Lobby';
      const guest = formState.guestName.trim() || 'Hotel Guest';
      let payload;

      if (modalFlow === 'lost_found') {
        const itemLabel = formState.itemName.trim() || 'Vật dụng cá nhân';
        payload = {
          title: `Báo cáo đồ thất lạc: ${itemLabel}`,
          location: loc,
          guest_name: guest,
          reporter: `Bellman (${staffName})`,
          description:
            formState.description.trim() ||
            `Khách báo thất lạc "${itemLabel}" tại khu vực ${loc}. Cần kiểm tra camera/kho Lost & Found và liên hệ xác minh.`,
          request_type: 'lost_found',
        };
      } else {
        const isRoomMove = formState.subCategory.toLowerCase().includes('chuyển phòng');
        payload = {
          title: `${formState.subCategory} (${formState.luggageCount || 1} kiện)`,
          location: loc,
          guest_name: guest,
          reporter: `Bellman (${staffName})`,
          description:
            formState.description.trim() ||
            `${formState.subCategory} cho khách ${guest} tại ${loc} (${formState.luggageCount || 1} kiện hành lý).`,
          request_type: isRoomMove ? 'room_move' : 'luggage',
        };
      }

      const created = await createBellRequest(payload);
      const normalizedCreated = normalizeRequest({
        ...payload,
        ...(created || {}),
        id: created?.ticket_code || created?.id || `BS-${Date.now().toString().slice(-4)}`,
        status: 'Pending',
      });

      setData((prev) => ({
        ...prev,
        requests: [normalizedCreated, ...(prev.requests || [])],
      }));
      setActiveFlow(modalFlow);
      setModalFlow(null);
      setRefreshKey((key) => key + 1);
      onNotify(`Đã tiếp nhận phiếu mới: ${normalizedCreated.id}`);
    } catch {
      onNotify(st('Could not load live requests. Showing the last update.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFlowBadge = (type) => {
    if (type === 'lost_found') {
      return {
        label: 'Báo cáo đồ thất lạc',
        className: 'bg-amber-50 text-amber-800 border border-amber-200',
        icon: SearchCheck,
      };
    }
    if (type === 'room_move') {
      return {
        label: 'Hỗ trợ chuyển phòng & hành lý',
        className: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
        icon: ArrowRightLeft,
      };
    }
    return {
      label: 'Hỗ trợ hành lý',
      className: 'bg-sky-50 text-sky-800 border border-sky-200',
      icon: Luggage,
    };
  };

  const getAcceptButtonLabel = (type) => {
    if (type === 'lost_found') return 'Tiếp nhận & Tìm kiếm đồ';
    return t('acceptTask') || 'Tiếp nhận hỗ trợ hành lý';
  };

  const getCompleteButtonLabel = (type) => {
    if (type === 'lost_found') return 'Đã tìm thấy & Trao trả khách';
    return t('completeTask') || 'Hoàn tất bàn giao';
  };

  const metrics = [
    {
      label: 'Hỗ trợ hành lý',
      subLabel: t('kpiPending'),
      value: flowCounts.luggage,
      flowId: 'luggage',
    },
    {
      label: 'Báo cáo đồ thất lạc',
      subLabel: 'Lost & Found',
      value: flowCounts.lost_found,
      flowId: 'lost_found',
    },
    {
      label: t('kpiActiveFleet'),
      subLabel: `${t('kpiOnJob')}: ${data.kpis?.onJob ?? 0} • ${t('kpiCompleted')}: ${data.kpis?.completed ?? 0}`,
      value: data.kpis?.activeFleet ?? data.teamStatus?.length ?? 2,
      flowId: 'all',
    },
  ];

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1>{t('bsTitle')}</h1>
            <p>{st('Coordinate luggage assistance, guest requests and the Bell Services team.')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="staff-header-details rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#77736E]">
              {t('bsActiveOps')}
            </span>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#403D39] hover:bg-[#F0EFEC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{st('Refresh')}</span>
            </button>
          </div>
        </StaffPageHeader>

        {loadFailed && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            {st('Could not load live requests. Showing the last update.')}
          </p>
        )}

        {/* Quick Action Buttons for the 2 Bellman Workflows */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[#666]">
            Điều phối 2 luồng nghiệp vụ Bellman: Hỗ trợ hành lý và Báo cáo đồ thất lạc (Lost &amp; Found).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCreateModal('luggage')}
              className="rounded-lg bg-[#1A1917] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#333] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tiếp nhận hỗ trợ hành lý</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateModal('lost_found')}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 flex items-center gap-1.5 cursor-pointer"
            >
              <SearchCheck className="w-3.5 h-3.5" />
              <span>Tiếp nhận báo cáo đồ thất lạc</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {metrics.map(({ label, subLabel, value, flowId }) => {
            const isSelected = activeFlow === flowId;
            return (
              <article
                key={label}
                onClick={() => setActiveFlow(flowId)}
                className={`rounded-xl px-5 py-4 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#1A1917] ring-1 ring-[#1A1917]/20'
                    : 'bg-white border-[#E8E5E0] hover:border-[#BDB7AE]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#666]">
                    {label}
                  </span>
                </div>
                <p className="mt-2 text-[22px] font-bold text-[#262626]">
                  {value}
                </p>
                {subLabel && (
                  <p className="mt-1 text-[11px] text-[#777]">{subLabel}</p>
                )}
              </article>
            );
          })}
        </section>

        {/* 2 Specialized Bellman Flow Tabs */}
        <section className="flex items-center gap-2 overflow-x-auto custom-scrollbar border-b border-[#E8E5E0] pb-3">
          {FLOW_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeFlow === tab.id;
            const count = flowCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFlow(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
                  isSelected
                    ? 'bg-[#1A1917] text-white border-[#1A1917]'
                    : 'bg-white text-[#494540] border-[#E8E5E0] hover:bg-[#F4F2EE]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F0EEEB] text-[#494540]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-[#403D39]">
                  {activeFlow === 'luggage'
                    ? 'Danh sách Yêu cầu Hỗ trợ Hành lý & Chuyển phòng'
                    : activeFlow === 'lost_found'
                    ? 'Danh sách Báo cáo Đồ thất lạc (Lost & Found)'
                    : t('activeRequests')}
                </h3>
                <p className="text-[11px] text-[#77736E]">
                  {st('Open requests first, oldest first. Updates every 15 seconds.')}
                </p>
              </div>
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
                  const badge = getFlowBadge(request.type);
                  const BadgeIcon = badge.icon;
                  const displayTitle =
                    request.serviceKey && BELL_SERVICE_LABELS[request.serviceKey]
                      ? st(BELL_SERVICE_LABELS[request.serviceKey])
                      : request.title;

                  return (
                    <article
                      key={request.id}
                      className="rounded-xl bg-white px-5 py-4 border border-[#BFBFBD] transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-mono text-[11px] font-bold text-[#1A1917] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E2DFD9]">
                              #{request.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}
                            >
                              <BadgeIcon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#555]">
                              <MapPin className="w-3 h-3 text-[#888]" />
                              <span>{request.location}</span>
                            </span>
                          </div>

                          <h4 className="text-[14px] font-bold text-[#2B2927] break-words">
                            {displayTitle}
                          </h4>

                          <p className="mt-1 text-[12px] text-[#666] flex flex-wrap items-center gap-2 break-words">
                            <span className="inline-flex items-center gap-1 font-medium text-[#3F3B38]">
                              <User className="w-3.5 h-3.5 text-[#777]" />
                              <span>{st('Guest:')} {request.guestName}</span>
                            </span>
                            {request.reporter && (
                              <span className="text-[#888]">• Nguồn: {request.reporter}</span>
                            )}
                            {request.assignedTo && (
                              <span className="text-emerald-700 font-semibold">
                                • {st('Assigned:')} {request.assignedTo}
                              </span>
                            )}
                          </p>

                          <p className="mt-2 text-[12px] leading-relaxed text-[#444] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#EFECE6] break-words">
                            {request.description}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {status === 'Completed'
                            ? t('completed')
                            : isInProgress
                            ? t('inProgress')
                            : t('pending')}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-[#777] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {request.type === 'lost_found'
                              ? isPending
                                ? 'Bước 1/2: Chờ Bellman tiếp nhận xác minh đồ thất lạc'
                                : isInProgress
                                ? 'Bước 2/2: Đang tìm kiếm & đối chiếu kho Lost & Found'
                                : 'Đã bàn giao lại đồ thất lạc cho khách'
                              : isPending
                              ? 'Chờ phân công xe đẩy / nhân viên Bellman'
                              : isInProgress
                              ? 'Đang vận chuyển hành lý cho khách'
                              : 'Đã hoàn tất bàn giao hành lý'}
                          </span>
                        </span>

                        <div className="flex items-center gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleAccept(request.id)}
                              className={`rounded-lg px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer ${
                                request.type === 'lost_found'
                                  ? 'bg-amber-600 hover:bg-amber-700'
                                  : 'bg-[#262626] hover:bg-[#404040]'
                              }`}
                            >
                              {getAcceptButtonLabel(request.type)}
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              type="button"
                              onClick={() => handleComplete(request.id)}
                              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              {getCompleteButtonLabel(request.type)}
                            </button>
                          )}

                          {status === 'Completed' && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t('taskCompleted')}</span>
                            </span>
                          )}
                        </div>
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
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">
                {t('bsTeamStatus')}
              </h3>

              <div className="mt-3 space-y-2">
                {(data.teamStatus || []).slice(0, 4).map((member) => (
                  <div
                    key={member.id || member.name}
                    className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#E1DEDA] last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#333] break-words">{member.name}</p>
                      <p className="text-[10px] text-[#777]">{st(member.role)}</p>
                    </div>
                    {member.status && (
                      <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[#777]">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${
                            staffStatusLabel(member.status) === 'Available'
                              ? 'bg-emerald-500'
                              : staffStatusLabel(member.status) === 'Busy'
                              ? 'bg-amber-500'
                              : 'bg-stone-400'
                          }`}
                        />
                        {st(staffStatusLabel(member.status))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Guide Card for the 3 Bellman Workflows */}
            <section className="rounded-xl bg-white p-4 border border-[#BFBFBD] space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">
                Quy chuẩn 3 Luồng Nghiệp vụ Bellman
              </h3>
              <div className="space-y-2.5 text-[11px] text-[#555]">
                <div className="p-2.5 rounded-lg bg-sky-50/60 border border-sky-100">
                  <p className="font-bold text-sky-900">1. Tiếp nhận hỗ trợ hành lý</p>
                  <p className="mt-0.5 text-sky-800/90">
                    Nhận phiếu từ Kiosk/Lễ tân → Điều xe đẩy nhận hành lý tại sảnh hoặc phòng → Bàn giao &amp; hoàn tất.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                  <p className="font-bold text-amber-900">2. Tiếp nhận báo cáo đồ thất lạc</p>
                  <p className="mt-0.5 text-amber-800/90">
                    Ghi nhận mô tả đồ thất lạc &amp; vị trí → Kiểm tra khu vực sảnh/phòng &amp; tủ Lost &amp; Found → Xác minh &amp; trao trả khách.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>

      {/* Modal Tiếp Nhận Yêu Cầu Cho 2 Luồng Nghiệp Vụ */}
      {modalFlow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#E5E1D8] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#FAF8F5] border-b border-[#E5E1D8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {modalFlow === 'lost_found' ? (
                  <SearchCheck className="w-5 h-5 text-amber-600" />
                ) : (
                  <Luggage className="w-5 h-5 text-[#1A1917]" />
                )}
                <h3 className="text-[14px] font-bold text-[#1A1917]">
                  {modalFlow === 'lost_found'
                    ? 'Tiếp nhận Báo cáo Đồ thất lạc (Lost & Found)'
                    : 'Tiếp nhận Yêu cầu Hỗ trợ Hành lý'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalFlow(null)}
                className="p-1 rounded-lg text-[#777] hover:text-[#1A1917] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-[12px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#403D39] mb-1">
                    Số phòng / Vị trí *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.location}
                    onChange={(e) => setFormState((s) => ({ ...s, location: e.target.value }))}
                    placeholder="VD: Room 302 hoặc Main Lobby Kiosk"
                    className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#403D39] mb-1">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    value={formState.guestName}
                    onChange={(e) => setFormState((s) => ({ ...s, guestName: e.target.value }))}
                    placeholder="VD: Mr. Nguyễn Văn A"
                    className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                  />
                </div>
              </div>

              {modalFlow === 'luggage' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#403D39] mb-1">
                      Loại hỗ trợ hành lý
                    </label>
                    <select
                      value={formState.subCategory}
                      onChange={(e) => setFormState((s) => ({ ...s, subCategory: e.target.value }))}
                      className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                    >
                      <option value="Mang hành lý lên phòng">Mang hành lý lên phòng (Check-in)</option>
                      <option value="Thu nhận hành lý trả phòng">Thu nhận hành lý xuống sảnh (Check-out)</option>
                      <option value="Gửi giữ hành lý tại sảnh">Gửi giữ hành lý tại quầy Bellman</option>
                      <option value="Hỗ trợ chuyển phòng">Hỗ trợ chuyển phòng &amp; hành lý</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#403D39] mb-1">
                      Số lượng kiện hành lý
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={formState.luggageCount}
                      onChange={(e) => setFormState((s) => ({ ...s, luggageCount: e.target.value }))}
                      className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                    />
                  </div>
                </div>
              )}

              {modalFlow === 'lost_found' && (
                <div>
                  <label className="block font-semibold text-[#403D39] mb-1">
                    Tên &amp; đặc điểm đồ vật thất lạc *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.itemName}
                    onChange={(e) => setFormState((s) => ({ ...s, itemName: e.target.value }))}
                    placeholder="VD: Ví da màu đen / Điện thoại iPhone / Túi xách..."
                    className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#403D39] mb-1">
                  Ghi chú chi tiết
                </label>
                <textarea
                  rows={3}
                  value={formState.description}
                  onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                  placeholder={
                    modalFlow === 'lost_found'
                      ? 'Mô tả vị trí khách nghi ngờ để quên, thời gian, số điện thoại liên hệ...'
                      : 'Ghi chú thêm về hành lý dễ vỡ, thời gian khách cần lấy...'
                  }
                  className="w-full rounded-xl border border-[#DEDAD2] px-3 py-2 text-[#1A1917] outline-none focus:border-[#1A1917]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalFlow(null)}
                  className="px-4 py-2 rounded-xl border border-[#DEDAD2] text-[#494540] font-semibold hover:bg-[#F4F2EE] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer ${
                    modalFlow === 'lost_found'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#1A1917] hover:bg-[#333]'
                  }`}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Xác nhận tiếp nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
