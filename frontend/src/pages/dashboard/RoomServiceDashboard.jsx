import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, UtensilsCrossed, CheckCircle2, Clock, Phone, User } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { RejectReasonModal } from '../../components/dashboard/RejectReasonModal';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import {
  fetchRoomServiceDashboard,
  updateRoomServiceOrderStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';

const initialOrdersByNumber = new Map(
  INITIAL_ROOM_SERVICE_DATA.orders.map((order) => [order.id, order])
);

const normalizeOrder = (order) => {
  const orderNumber = order.order_number || order.id;
  const initialOrder = initialOrdersByNumber.get(orderNumber) || {};

  return {
    ...initialOrder,
    ...order,
    id: orderNumber,
    rawId: order.id,
    room: order.room_number || order.room || initialOrder.room,
    imageUrl: order.image_url || order.imageUrl || initialOrder.imageUrl,
    isServiceRequest:
      order.is_service_request ?? order.isServiceRequest ?? initialOrder.isServiceRequest ?? false,
    estCompletion: order.est_completion || order.estCompletion || initialOrder.estCompletion,
    assignedTo: order.assigned_staff_name || order.assignedTo,
    orderedAt: order.orderedAt || initialOrder.orderedAt || 'Just now',
    guestName: order.guest_name || order.guestName || initialOrder.guestName,
    guest_name: order.guest_name || order.guestName || initialOrder.guestName,
    guestPhone: order.guest_phone || order.guestPhone || initialOrder.guestPhone,
    guest_phone: order.guest_phone || order.guestPhone || initialOrder.guestPhone,
    roomPhone: order.room_phone || order.roomPhone || initialOrder.roomPhone || `Ext ${order.room_number || order.room}`,
    room_phone: order.room_phone || order.roomPhone || initialOrder.roomPhone || `Ext ${order.room_number || order.room}`,
  };
};

const normalizeFleet = (unit) => ({
  ...unit,
  rawId: unit.id,
  id: unit.unit_code || unit.id,
  statusColor: unit.status_color || unit.statusColor,
  battery: unit.battery_level ?? unit.battery,
});

const matchesOrder = (order, orderId) => order.id === orderId || order.rawId === orderId;

const KpiCard = ({ label, value, detail }) => {
  return (
    <article className="rounded-xl bg-white p-4 border border-[#E8E5E0]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#777]">{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[18px] font-bold text-[#222]">{value}</span>
        {detail && <span className="text-[10px] text-[#777]">{detail}</span>}
      </div>
    </article>
  );
};

export const RoomServiceDashboard = ({ currentUser, onNotify = () => {} }) => {
  const st = useStaffText();
  const { t } = useLanguage();
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
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="staff-page-container w-full max-w-[1180px] mx-auto px-4 md:px-8 pt-3 pb-8">
        <StaffPageHeader className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2C2926]">{t('rsTitle')}</h2>
            <p className="mt-0.5 text-[12px] text-[#77726D]">
              {t('rsSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4D0CB] bg-white hover:bg-[#F7F5F2] text-[11px] font-semibold text-[#444] transition-colors cursor-pointer shadow-xs active:scale-95"
            title={st("Refresh room service orders")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-stone-500'}`} />
            <span>{isRefreshing ? st("Loading...") : st("Refresh")}</span>
          </button>
        </StaffPageHeader>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={st("Pending Orders") || "Chờ tiếp nhận"}
            value={tabCounts.Pending}
          />
          <KpiCard
            label={st("In Progress") || "Đang xử lý"}
            value={tabCounts.InProgress}
            detail="avg 10m"
          />
          <KpiCard
            label={st("Completed Today") || "Hoàn thành hôm nay"}
            value={tabCounts.Completed}
          />
          <KpiCard
            label={st("Total Requests") || "Tổng yêu cầu"}
            value={tabCounts.All}
          />
        </section>

        <section className="mt-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-semibold text-[#36322F]">{t('activeOrders')}</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'All', label: st("All") || "Tất cả" },
                  { key: 'Pending', label: st("Pending") || "Chờ tiếp nhận" },
                  { key: 'InProgress', label: st("In Progress") || "Đang xử lý" },
                  { key: 'Completed', label: st("Completed") || "Hoàn tất" },
                ].map(({ key, label }) => {
                  const count = tabCounts[key] || 0;
                  const isPendingTab = key === 'Pending';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${filter === key
                          ? 'bg-[#EAE8E4] text-[#2C2926] shadow-xs'
                          : 'text-[#77726D] hover:bg-[#F0EEEA]'
                        }`}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            isPendingTab
                              ? 'bg-amber-600 text-white'
                              : key === 'InProgress'
                              ? 'bg-indigo-600 text-white'
                              : key === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-white px-5 py-10 text-center text-[12px] text-[#777] border border-[#E8E5E0]">
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

                  return (
                    <article
                      key={order.id}
                      className="rounded-xl bg-white p-4 border border-[#E8E5E0] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-[#3A3530]">
                          <span>#{order.id}</span>
                          <span className="rounded bg-[#E3E0DB] px-1.5 py-0.5 text-[10px] text-[#69645E]">{st("Room")} {order.room}
                          </span>
                          {((order.note || '').includes('Gộp thêm') || order.is_merged) && (
                            <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-bold">
                              Đơn gộp
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isPending
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : isInProgress
                                ? 'bg-sky-100 text-sky-800 border-sky-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                        >
                          {isPending
                            ? (st("Pending") || "Chờ tiếp nhận")
                            : isInProgress
                            ? (st("In Progress") || "Đang xử lý")
                            : (st("Completed") || "Hoàn tất")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100/80 text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-stone-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-stone-500" />
                            <span>{order.guest_name || order.guestName || st("Hotel guest")}</span>
                          </span>
                          {(order.guest_phone || order.guestPhone) && (
                            <a
                              href={`tel:${order.guest_phone || order.guestPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer shadow-2xs"
                              title={st("Call the guest to confirm the order")}
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{st("Phone:")} {order.guest_phone || order.guestPhone}</span>
                            </a>
                          )}
                          <span
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium shadow-2xs"
                            title={st("Room extension")}
                          >
                            <Phone className="w-3 h-3 text-amber-600" />
                            <span>{order.room_phone || order.roomPhone || `Ext ${order.room}`}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-[#888]">{order.orderedAt === 'Just now' ? st('Just now') : order.orderedAt || st('Just now')}</span>
                      </div>

                      {(() => {
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
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              {displayItems.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {displayItems.map(([name, q], idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1.5 bg-[#F7F5F0] text-[#322F2C] border border-[#E8E5E0] px-2 py-0.5 rounded-md text-[11px] font-medium"
                                    >
                                      <span className="font-bold text-amber-800 bg-amber-100/80 px-1 py-0.2 rounded text-[10px]">
                                        {q}x
                                      </span>
                                      <span>{name}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <h4 className="text-[12px] font-semibold text-[#322F2C]">
                                  {order.name || st("Room Service request")}
                                </h4>
                              )}
                              <p className="text-[11px] text-[#746F69]">
                                {order.notes || st("No special notes")}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-[#444] shrink-0 pt-0.5">x{totalQty}</span>
                          </div>
                        );
                      })()}

                      <div className="pt-3 border-t border-[#F0ECE6] flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-500 font-medium">
                          {isPending
                            ? (st("Awaiting acceptance") || "Chờ nhân viên tiếp nhận")
                            : isInProgress
                            ? (st("In progress") || "Đang xử lý yêu cầu")
                            : (st("Completed") || "Đã hoàn thành")}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* 1. Pending: Từ chối hoặc Tiếp nhận xử lý */}
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(order)}
                                className="rounded-lg border border-[#D4D0CB] bg-white px-3 py-1.5 text-[11px] text-[#444] hover:bg-[#F7F5F2] cursor-pointer"
                              >
                                {t('reject') || st("Reject") || "Từ chối"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptServiceRequest(order)}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                              >
                                {st("Accept request") || "Tiếp nhận"}
                              </button>
                            </>
                          )}

                          {/* 2. In Progress: Đang xử lý -> Hoàn thành */}
                          {isInProgress && (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{st("Complete") || "Hoàn thành"}</span>
                            </button>
                          )}

                          {/* 3. Completed: Đã hoàn tất */}
                          {isCompleted && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{st("Completed") || "Đã hoàn tất"}</span>
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
            {filteredOrders.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName={st("orders")}
                className="mt-3 rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
              />
            )}
          </div>

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

