import { useStaffText } from '../../context/StaffLanguage';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ConciergeBell, MapPin } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { RejectReasonModal } from '../../components/dashboard/RejectReasonModal';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import {
  fetchRoomServiceDashboard,
  updateRoomServiceOrderStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import {
  normalizeOrder,
  normalizeFleet,
  matchesOrder,
  RoomServiceHeaderAndKpis,
  RoomServiceQueueToolbar,
  RoomServiceOrderBody,
  RoomServiceOrderFooter,
  RoomServiceFleetSidebar,
} from './RoomServiceDashboardParts';

export const RoomServiceDashboard = ({ currentUser, onNotify = () => {} }) => {
  const st = useStaffText();
  const { t, language } = useLanguage();
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const [data, setData] = useState({
    ...INITIAL_ROOM_SERVICE_DATA,
    orders: [],
    deliveryFleet: INITIAL_ROOM_SERVICE_DATA.deliveryFleet.map(normalizeFleet),
  });
  const [filter, setFilter] = useState('All');
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const response = await fetchRoomServiceDashboard({ is_service_request: true });
      if (!response) return;

      const hasLiveOrders = Array.isArray(response.orders);
      const hasLiveFleet =
        Array.isArray(response.delivery_fleet) && response.delivery_fleet.length > 0;

      setData((previous) => ({
        ...previous,
        kpis: response.kpis || previous.kpis,
        orders: hasLiveOrders ? response.orders.map(normalizeOrder) : [],
        deliveryFleet: hasLiveFleet
          ? response.delivery_fleet.map(normalizeFleet)
          : previous.deliveryFleet,
      }));
    } catch (err) {
      console.error('Error fetching room service dashboard:', err);
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, []);

  // Tự động làm mới dữ liệu dự phòng mỗi 15 giây (Fallback Polling)
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time WebSocket Listeners for Instant Live Updates
  useEffect(() => {
    const handleLiveEvent = () => {
      loadData(false);
    };

    window.addEventListener('app:task_status_updated', handleLiveEvent);
    window.addEventListener('app:order_created', handleLiveEvent);
    window.addEventListener('app:orders_cleared', handleLiveEvent);

    return () => {
      window.removeEventListener('app:task_status_updated', handleLiveEvent);
      window.removeEventListener('app:order_created', handleLiveEvent);
      window.removeEventListener('app:orders_cleared', handleLiveEvent);
    };
  }, [loadData]);

  // Cô lập triệt để đơn hàng: Room Service CHỈ nhận và quản lý các yêu cầu Dịch Vụ Phòng, TUYỆT ĐỐI KHÔNG nhận món ăn của Bếp
  const roomServiceScopedOrders = useMemo(() => {
    return (data.orders || []).filter((order) => Boolean(order.isServiceRequest));
  }, [data.orders]);

  // Thống kê số lượng theo từng phân loại Tab (Chỉ tính các yêu cầu Dịch Vụ Phòng)
  const tabCounts = useMemo(() => {
    const orders = roomServiceScopedOrders;
    return {
      All: orders.length,
      Pending: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'unassigned' || s === 'chờ tiếp nhận';
      }).length,
      InProgress: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return (
          s === 'in progress' ||
          s === 'in_progress' ||
          s === 'cooking' ||
          s === 'in preparation' ||
          s === 'preparing' ||
          s === 'ready' ||
          s === 'delivering' ||
          s === 'in transit' ||
          s === 'đang xử lý' ||
          s === 'đang chuẩn bị' ||
          s === 'đang giao' ||
          s === 'đang mang lên'
        );
      }).length,
      Completed: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'completed' || s === 'delivered' || s === 'hoàn tất' || s === 'hoàn thành' || s === 'đã giao';
      }).length,
    };
  }, [roomServiceScopedOrders]);

  const filteredOrders = useMemo(() => {
    let list = roomServiceScopedOrders;
    if (filter !== 'All') {
      const filterLower = filter.toLowerCase().trim();
      list = list.filter((order) => {
        const s = (order.status || '').toLowerCase().trim();
        if (filterLower === 'pending') {
          return s === 'pending' || s === 'unassigned' || s === 'chờ tiếp nhận';
        }
        if (filterLower === 'inprogress' || filterLower === 'in progress' || filterLower === 'đang xử lý') {
          return (
            s === 'in progress' ||
            s === 'in_progress' ||
            s === 'cooking' ||
            s === 'in preparation' ||
            s === 'preparing' ||
            s === 'ready' ||
            s === 'delivering' ||
            s === 'in transit' ||
            s === 'đang xử lý' ||
            s === 'đang chuẩn bị' ||
            s === 'đang giao' ||
            s === 'đang mang lên'
          );
        }
        if (filterLower === 'completed') {
          return s === 'completed' || s === 'delivered' || s === 'hoàn tất' || s === 'hoàn thành' || s === 'đã giao';
        }
        return s === filterLower;
      });
    }

    // Sắp xếp: Chờ tiếp nhận (Pending) và Đang xử lý (In Progress) đưa lên đầu
    return [...list].sort((a, b) => {
      const sA = (a.status || '').toLowerCase().trim();
      const sB = (b.status || '').toLowerCase().trim();

      const getPriority = (st) => {
        if (st === 'pending' || st === 'unassigned' || st === 'chờ tiếp nhận') return 1;
        if (['in progress', 'in_progress', 'cooking', 'in preparation', 'delivering', 'in transit', 'ready', 'đang xử lý'].includes(st)) return 2;
        return 3;
      };

      return getPriority(sA) - getPriority(sB);
    });
  }, [roomServiceScopedOrders, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const updateKpisForStatusChange = (previous, oldStatus, nextStatus) => {
    const oldNormalized = (oldStatus || '').toLowerCase();
    const nextNormalized = (nextStatus || '').toLowerCase();
    const kpis = previous.kpis || INITIAL_ROOM_SERVICE_DATA.kpis;

    return {
      ...kpis,
      pendingOrders: {
        ...kpis.pendingOrders,
        value: Math.max(
          0,
          (kpis.pendingOrders?.value || 0) -
          (oldNormalized === 'pending' ? 1 : 0) +
          (nextNormalized === 'pending' ? 1 : 0)
        ),
      },
      inPreparation: {
        ...kpis.inPreparation,
        value: Math.max(
          0,
          (kpis.inPreparation?.value || 0) -
          (oldNormalized === 'cooking' ? 1 : 0) +
          (nextNormalized === 'cooking' ? 1 : 0)
        ),
      },
      completedToday: {
        ...kpis.completedToday,
        value:
          (kpis.completedToday?.value || 0) +
          (['ready', 'completed', 'delivered'].includes(nextNormalized) &&
            !['ready', 'completed', 'delivered'].includes(oldNormalized)
            ? 1
            : 0),
      },
    };
  };

  const updateOrderLocally = (orderId, nextValues) => {
    setData((previous) => {
      const currentOrder = previous.orders.find((order) => matchesOrder(order, orderId));
      return {
        ...previous,
        kpis:
          nextValues.status && currentOrder
            ? updateKpisForStatusChange(previous, currentOrder.status, nextValues.status)
            : previous.kpis,
        orders: previous.orders.map((order) =>
          matchesOrder(order, orderId) ? { ...order, ...nextValues } : order
        ),
      };
    });
  };

  const handleAcceptServiceRequest = async (order) => {
    updateOrderLocally(order.id, {
      status: 'In Progress',
      progress: 50,
      estCompletion: 'Đang xử lý',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'In Progress',
      progress: 50,
      est_completion: 'Đang xử lý',
      assigned_staff_name: staffName,
    });
    onNotify(st("Đã tiếp nhận yêu cầu phòng {0}, đang xử lý.", order.room));
  };

  const handleCompleteOrder = async (order) => {
    updateOrderLocally(order.id, { status: 'Completed', progress: 100, assignedTo: staffName, estCompletion: 'Hoàn tất' });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Completed',
      progress: 100,
      est_completion: 'Hoàn tất',
      assigned_staff_name: staffName,
    });
    onNotify(st("Yêu cầu của phòng {0} đã hoàn thành.", order.room));
  };

  const handleOpenRejectModal = (order) => {
    setRejectingOrder(order);
  };
  const handleReject = handleOpenRejectModal;

  const handleConfirmReject = async (reason) => {
    if (!rejectingOrder) return;
    const targetOrder = rejectingOrder;
    setRejectingOrder(null);
    try {
      updateOrderLocally(targetOrder.id, { status: 'Rejected', note: reason, reject_reason: reason });
      await updateRoomServiceOrderStatus(targetOrder.rawId || targetOrder.id, {
        status: 'Rejected',
        note: reason,
        reject_reason: reason,
      });
      onNotify(st("Yêu cầu #{0} đã bị từ chối: {1}", targetOrder.id, reason));
    } catch (err) {
      onNotify(`Không thể từ chối yêu cầu #${targetOrder.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  const kpis = data.kpis || INITIAL_ROOM_SERVICE_DATA.kpis;

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        <RoomServiceHeaderAndKpis
          language={language}
          st={st}
          isRefreshing={isRefreshing}
          onRefresh={() => loadData(true)}
          filter={filter}
          setFilter={setFilter}
          tabCounts={tabCounts}
        />

        {/* 2-Column Layout matching Bellman & Maintenance */}
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="min-w-0">
            <RoomServiceQueueToolbar
              language={language}
              st={st}
              t={t}
              filter={filter}
              setFilter={setFilter}
              tabCounts={tabCounts}
            />

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#777] border border-[#BFBFBD]">
                  {t('noDataMatch')}
                </div>
              ) : (
                paginatedOrders.map((order) => {
                  const normalizedStatus = (order.status || '').toLowerCase().trim();
                  const isPending =
                    normalizedStatus === 'pending' ||
                    normalizedStatus === 'unassigned' ||
                    normalizedStatus === 'chờ tiếp nhận';
                  const isCompleted =
                    normalizedStatus === 'completed' ||
                    normalizedStatus === 'delivered' ||
                    normalizedStatus === 'hoàn tất' ||
                    normalizedStatus === 'hoàn thành' ||
                    normalizedStatus === 'đã giao';
                  const isInProgress = !isPending && !isCompleted;

                  const rawItems = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
                  const groupedMap = new Map();
                  for (const it of rawItems) {
                    const itemName = it.name || it.item_name || (typeof it === 'string' ? it : null);
                    if (!itemName) continue;
                    const q = Number(it.qty || it.quantity || 1);
                    groupedMap.set(itemName, (groupedMap.get(itemName) || 0) + q);
                  }
                  const displayItems = Array.from(groupedMap.entries());
                  const totalQty = displayItems.reduce((acc, [, q]) => acc + q, 0) || order.qty || 1;

                  return (
                    <article
                      key={order.id}
                      className="rounded-xl bg-white px-5 py-4 border border-[#BFBFBD] transition-all"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="font-mono text-[11px] font-bold text-[#1A1917] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E2DFD9]">
                              #{order.id}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                              <ConciergeBell className="w-3 h-3" />
                              <span>{language === 'EN' ? 'Room Service' : 'Phục vụ buồng phòng'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#555]">
                              <MapPin className="w-3 h-3 text-[#888]" />
                              <span>{st("Room")} {order.room}</span>
                            </span>
                            {((order.note || '').includes('Gộp thêm') || order.is_merged) && (
                              <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold">
                                Đơn gộp
                              </span>
                            )}
                          </div>

                          <RoomServiceOrderBody
                            order={order}
                            displayItems={displayItems}
                            totalQty={totalQty}
                            isPending={isPending}
                            isInProgress={isInProgress}
                            isCompleted={isCompleted}
                            st={st}
                            language={language}
                          />
                        </div>

                        <span
                          className={`hidden sm:inline-block shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPending
                            ? (st("Pending") || "Chờ tiếp nhận")
                            : isInProgress
                            ? (st("In Progress") || "Đang xử lý")
                            : (st("Completed") || "Hoàn tất")}
                        </span>
                      </div>

                      <RoomServiceOrderFooter
                        order={order}
                        isPending={isPending}
                        isInProgress={isInProgress}
                        isCompleted={isCompleted}
                        st={st}
                        t={t}
                        onOpenRejectModal={handleOpenRejectModal}
                        onAcceptOrder={handleAcceptServiceRequest}
                        onCompleteOrder={handleCompleteOrder}
                      />
                    </article>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            {filteredOrders.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName={st("requests")}
                className="mt-3 rounded-xl border border-[#BFBFBD]"
              />
            )}
          </div>

          <RoomServiceFleetSidebar
            deliveryFleet={data.deliveryFleet}
            language={language}
            st={st}
          />
        </section>
      </div>

      <RejectReasonModal
        isOpen={Boolean(rejectingOrder)}
        onClose={() => setRejectingOrder(null)}
        onConfirm={handleConfirmReject}
        order={rejectingOrder}
        department="room_service"
      />
    </div>
  );
};
