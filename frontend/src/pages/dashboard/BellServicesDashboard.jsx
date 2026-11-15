import React, { useEffect, useMemo, useState } from 'react';
import { SearchCheck, Plus, RefreshCw } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import {
  fetchBellServicesDashboard,
  createBellRequest,
  updateBellRequestStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';

import {
  normalizeRequest,
  getStatusLabel,
  queueOrder,
} from './bellServicesUtils';
import {
  BellKpiAndFlowTabs,
  BellRequestCard,
  BellSidebar,
  BellCreateRequestModal,
} from './BellServicesParts';

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

        <BellKpiAndFlowTabs
          metrics={metrics}
          activeFlow={activeFlow}
          setActiveFlow={setActiveFlow}
          flowCounts={flowCounts}
        />

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
                paginatedRequests.map((request) => (
                  <BellRequestCard
                    key={request.id}
                    request={request}
                    st={st}
                    t={t}
                    onAccept={handleAccept}
                    onComplete={handleComplete}
                  />
                ))
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

          <BellSidebar teamStatus={data.teamStatus} st={st} t={t} />
        </section>
      </div>

      <BellCreateRequestModal
        modalFlow={modalFlow}
        onClose={() => setModalFlow(null)}
        formState={formState}
        setFormState={setFormState}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
