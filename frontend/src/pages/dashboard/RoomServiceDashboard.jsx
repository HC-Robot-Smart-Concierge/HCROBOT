import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, UtensilsCrossed, ChefHat, CheckCircle2, Clock, Phone, User } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
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

const normalizeStock = (item) => ({
  ...item,
  count: item.count_label || item.count,
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
    lowStockAlerts: INITIAL_ROOM_SERVICE_DATA.lowStockAlerts.map(normalizeStock),
  });
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const response = await fetchRoomServiceDashboard();
      if (!response) return;

      const hasLiveOrders = Array.isArray(response.orders);
      const hasLiveFleet =
        Array.isArray(response.delivery_fleet) && response.delivery_fleet.length > 0;
      const hasLiveStock =
        Array.isArray(response.low_stock_alerts) && response.low_stock_alerts.length > 0;

      setData((previous) => ({
        ...previous,
        kpis: response.kpis || previous.kpis,
        orders: hasLiveOrders ? response.orders.map(normalizeOrder) : [],
        deliveryFleet: hasLiveFleet
          ? response.delivery_fleet.map(normalizeFleet)
          : previous.deliveryFleet,
        lowStockAlerts: hasLiveStock
          ? response.low_stock_alerts.map(normalizeStock)
          : previous.lowStockAlerts,
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

  // Thống kê số lượng theo từng phân loại Tab
  const tabCounts = useMemo(() => {
    const orders = data.orders || [];
    return {
      All: orders.length,
      Pending: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'unassigned' || s === 'chờ tiếp nhận';
      }).length,
      Cooking: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return (
          s === 'cooking' ||
          s === 'in preparation' ||
          s === 'in progress' ||
          s === 'sent to kitchen' ||
          s === 'sent_to_kitchen' ||
          s === 'đã chuyển bếp'
        );
      }).length,
      Ready: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return (
          s === 'ready' ||
          s === 'món đã nấu xong' ||
          s === 'food ready' ||
          s === 'sẵn sàng' ||
          s === 'đã nấu xong'
        );
      }).length,
      Delivering: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'delivering' || s === 'in transit' || s === 'đang giao';
      }).length,
      Completed: orders.filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        return s === 'completed' || s === 'delivered' || s === 'hoàn tất';
      }).length,
    };
  }, [data.orders]);

  const filteredOrders = useMemo(() => {
    let list = data.orders || [];
    if (filter !== 'All') {
      const filterLower = filter.toLowerCase().trim();
      list = list.filter((order) => {
        const s = (order.status || '').toLowerCase().trim();
        if (filterLower === 'pending') {
          return s === 'pending' || s === 'unassigned' || s === 'chờ tiếp nhận';
        }
        if (filterLower === 'cooking') {
          return (
            s === 'cooking' ||
            s === 'in preparation' ||
            s === 'in progress' ||
            s === 'sent to kitchen' ||
            s === 'sent_to_kitchen' ||
            s === 'đã chuyển bếp'
          );
        }
        if (filterLower === 'ready') {
          return (
            s === 'ready' ||
            s === 'món đã nấu xong' ||
            s === 'food ready' ||
            s === 'sẵn sàng' ||
            s === 'đã nấu xong'
          );
        }
        if (filterLower === 'delivering') {
          return s === 'delivering' || s === 'in transit' || s === 'đang giao' || s === 'ready';
        }
        if (filterLower === 'completed') {
          return s === 'completed' || s === 'delivered' || s === 'hoàn tất';
        }
        return s === filterLower;
      });
    }

    // Sắp xếp thông minh: Đơn Bếp đã xong (Ready) và Chờ tiếp nhận (Pending) đưa lên đầu tiên để Room Service xử lý ngay
    return [...list].sort((a, b) => {
      const sA = (a.status || '').toLowerCase().trim();
      const sB = (b.status || '').toLowerCase().trim();

      const getPriority = (st) => {
        if (st === 'ready' || st === 'món đã nấu xong' || st === 'food ready' || st === 'đã nấu xong') return 1;
        if (st === 'pending' || st === 'unassigned') return 2;
        if (st === 'delivering' || st === 'in transit') return 3;
        if (st === 'cooking' || st === 'sent to kitchen') return 4;
        return 5;
      };

      return getPriority(sA) - getPriority(sB);
    });
  }, [data.orders, filter]);

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

  const handleSendToKitchen = async (order) => {
    updateOrderLocally(order.id, {
      status: 'Sent to Kitchen',
      progress: 25,
      estCompletion: '20 mins',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Sent to Kitchen',
      progress: 25,
      est_completion: '20 mins',
      assigned_staff_name: staffName,
    });
    onNotify(st("Order #{0} was reviewed and sent to the kitchen.", order.id));
  };

  const handleAcceptServiceRequest = async (order) => {
    updateOrderLocally(order.id, {
      status: 'In Progress',
      progress: 40,
      estCompletion: '10 mins',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'In Progress',
      progress: 40,
      est_completion: '10 mins',
      assigned_staff_name: staffName,
    });
    onNotify(st("Service accepted and being prepared for room {0}.", order.room));
  };

  const handleStartCooking = async (order) => {
    updateOrderLocally(order.id, {
      status: 'Cooking',
      progress: 50,
      estCompletion: '15 mins',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Cooking',
      progress: 50,
      est_completion: '15 mins',
      assigned_staff_name: staffName,
    });
    onNotify(st("The kitchen has started preparing order #{0}.", order.id));
  };

  const handleMarkReady = async (order) => {
    updateOrderLocally(order.id, {
      status: 'Ready',
      progress: 75,
      estCompletion: 'Sẵn sàng',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Ready',
      progress: 75,
      est_completion: 'Sẵn sàng',
      assigned_staff_name: staffName,
    });
    onNotify(st("Order #{0} is ready for Room Service to collect.", order.id));
  };

  const handleStartDelivery = async (order) => {
    updateOrderLocally(order.id, {
      status: 'Delivering',
      progress: 85,
      estCompletion: '5 mins',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Delivering',
      progress: 85,
      est_completion: '5 mins',
      assigned_staff_name: staffName,
    });
    onNotify(st("Room Service is delivering the order to room {0}.", order.room));
  };

  const handleReject = async (order) => {
    updateOrderLocally(order.id, { status: 'Rejected' });
    await updateRoomServiceOrderStatus(order.rawId || order.id, { status: 'Rejected' });
    onNotify(st("Order #{0} rejected.", order.id));
  };

  const handleCompleteOrder = async (order) => {
    updateOrderLocally(order.id, { status: 'Completed', progress: 100, assignedTo: staffName });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Completed',
      progress: 100,
      assigned_staff_name: staffName,
    });
    onNotify(st("Order #{0} delivered and completed.", order.id));
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
            label={t('kpiPendingOrders')}
            value={kpis.pendingOrders?.value ?? 0}
          />
          <KpiCard
            label={t('kpiInPreparation')}
            value={kpis.inPreparation?.value ?? 0}
            detail={`avg ${kpis.inPreparation?.avgTime || '12m'}`}
          />
          <KpiCard
            label={t('delivering')}
            value={kpis.delivering?.value ?? 0}
          />
          <KpiCard
            label={t('kpiCompletedToday')}
            value={kpis.completedToday?.value ?? 0}
          />
        </section>

        <section className="room-service-dashboard-grid mt-4 grid gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-semibold text-[#36322F]">{t('activeOrders')}</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'All', label: t('all') || st("All") },
                  { key: 'Pending', label: t('pending') || st("Pending") },
                  { key: 'Cooking', label: st("In preparation") },
                  { key: 'Ready', label: st("Ready for delivery") },
                  { key: 'Delivering', label: t('delivering') || st("Delivering") },
                  { key: 'Completed', label: t('completed') || st("Completed") },
                ].map(({ key, label }) => {
                  const count = tabCounts[key] || 0;
                  const isReadyTab = key === 'Ready';
                  const isPendingTab = key === 'Pending';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        filter === key
                          ? 'bg-[#EAE8E4] text-[#2C2926] shadow-xs'
                          : 'text-[#77726D] hover:bg-[#F0EEEA]'
                      }`}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            isReadyTab
                              ? 'bg-emerald-600 text-white animate-pulse shadow-xs'
                              : isPendingTab
                              ? 'bg-amber-600 text-white'
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
                  const normalizedStatus = (order.status || '').toLowerCase();
                  const isPending =
                    normalizedStatus === 'pending' || normalizedStatus === 'unassigned';
                  const isSentToKitchen =
                    normalizedStatus === 'sent to kitchen' || normalizedStatus === 'sent_to_kitchen';
                  const isCooking =
                    normalizedStatus === 'cooking' ||
                    normalizedStatus === 'in progress' ||
                    normalizedStatus === 'in preparation';
                  const isReady =
                    normalizedStatus === 'ready' || normalizedStatus === 'món đã nấu xong';
                  const isDelivering =
                    normalizedStatus === 'delivering' || normalizedStatus === 'in transit';
                  const isCompleted =
                    normalizedStatus === 'completed' || normalizedStatus === 'delivered';

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
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isPending
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : isSentToKitchen
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : isCooking
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : isReady
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isDelivering
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isPending
                            ? st("Pending")
                            : isSentToKitchen
                            ? st("Sent to kitchen")
                            : isCooking
                            ? st("In preparation")
                            : isReady
                            ? st("Food ready")
                            : isDelivering
                            ? st("Delivering to room")
                            : st("Completed")}
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

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-[12px] font-semibold text-[#322F2C]">
                            {order.name || (Array.isArray(order.items) && order.items.map(it => it.name).join(', ')) || st("Room Service request")}
                          </h4>
                          <p className="text-[11px] text-[#746F69]">
                            {order.notes || st("No special notes")}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-[#444]">x{order.qty || 1}</span>
                      </div>

                      <div className="pt-3 border-t border-[#F0ECE6] flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-500 font-medium">
                          {isPending
                            ? (order.isServiceRequest ? st("Awaiting service acceptance") : st("Awaiting order review"))
                            : isSentToKitchen
                            ? st("Waiting for kitchen preparation")
                            : isCooking
                            ? (order.isServiceRequest ? st("Preparing service") : st("Kitchen is preparing the food"))
                            : isReady
                            ? st("Collect food and prepare utensils")
                            : isDelivering
                            ? st("Delivery in progress")
                            : st("Complete")}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* 1. Pending: Food -> Reject & Chuyển Sang Bếp */}
                          {isPending && !order.isServiceRequest && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReject(order)}
                                className="rounded-lg border border-[#D4D0CB] bg-white px-3 py-1.5 text-[11px] text-[#444] hover:bg-[#F7F5F2] cursor-pointer"
                              >
                                {t('reject')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendToKitchen(order)}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                              >{st("Send to kitchen")} </button>
                            </>
                          )}

                          {/* 1b. Pending: Direct Service Request -> Reject & Tiếp Nhận */}
                          {isPending && order.isServiceRequest && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReject(order)}
                                className="rounded-lg border border-[#D4D0CB] bg-white px-3 py-1.5 text-[11px] text-[#444] hover:bg-[#F7F5F2] cursor-pointer"
                              >
                                {t('reject')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptServiceRequest(order)}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                              >{st("Accept request")} </button>
                            </>
                          )}

                          {/* 2. Sent to Kitchen (Chờ Bếp, Room Service không bấm được) */}
                          {isSentToKitchen && (
                            <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>{st("Awaiting kitchen acceptance")}</span>
                            </span>
                          )}

                          {/* 3. Cooking / In Progress */}
                          {isCooking && (
                            order.isServiceRequest ? (
                              <button
                                type="button"
                                onClick={() => handleStartDelivery(order)}
                                className="rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                              >{st("Deliver to room")} </button>
                            ) : (
                              <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1.5">
                                <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>{st("Kitchen is cooking...")}</span>
                              </span>
                            )
                          )}

                          {/* 4. Ready -> Lấy Món & Giao Phòng */}
                          {isReady && (
                            <button
                              type="button"
                              onClick={() => handleStartDelivery(order)}
                              className="rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                            >{st("Collect and deliver")} </button>
                          )}

                          {/* 5. Delivering -> Xác Nhận Đã Giao */}
                          {isDelivering && (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                            >{st("Confirm delivery")} </button>
                          )}

                          {/* 6. Completed */}
                          {isCompleted && (
                            <span className="rounded bg-emerald-50 text-emerald-800 px-3 py-1 text-[11px] font-bold border border-emerald-200">
                              {t('orderCompleted')}
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

          <aside className="space-y-4">

            <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#3E3A36]">{t('rsLowStockAlerts')}</h3>
              <div className="mt-3 space-y-2">
                {(data.lowStockAlerts || []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] py-1 border-b border-[#E0DDD8] last:border-0">
                    <span className="text-[#444]">{item.name}</span>
                    <span className="font-semibold text-amber-700">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </div>

    </div>
  );
};

