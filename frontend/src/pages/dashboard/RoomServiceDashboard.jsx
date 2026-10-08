import React, { useEffect, useMemo, useState } from 'react';
import { InteractiveMapModal } from '../../components/dashboard/Modals';
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
  const { t } = useLanguage();
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const [data, setData] = useState({
    ...INITIAL_ROOM_SERVICE_DATA,
    orders: INITIAL_ROOM_SERVICE_DATA.orders.map(normalizeOrder),
    deliveryFleet: INITIAL_ROOM_SERVICE_DATA.deliveryFleet.map(normalizeFleet),
    lowStockAlerts: INITIAL_ROOM_SERVICE_DATA.lowStockAlerts.map(normalizeStock),
  });
  const [filter, setFilter] = useState('All');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const response = await fetchRoomServiceDashboard();
      if (!response) return;

      const hasLiveOrders = Array.isArray(response.orders) && response.orders.length > 0;
      const hasLiveFleet =
        Array.isArray(response.delivery_fleet) && response.delivery_fleet.length > 0;
      const hasLiveStock =
        Array.isArray(response.low_stock_alerts) && response.low_stock_alerts.length > 0;

      setData((previous) => ({
        ...previous,
        kpis: hasLiveOrders && response.kpis ? response.kpis : previous.kpis,
        orders: hasLiveOrders ? response.orders.map(normalizeOrder) : previous.orders,
        deliveryFleet: hasLiveFleet
          ? response.delivery_fleet.map(normalizeFleet)
          : previous.deliveryFleet,
        lowStockAlerts: hasLiveStock
          ? response.low_stock_alerts.map(normalizeStock)
          : previous.lowStockAlerts,
      }));
    };

    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    if (filter === 'All') return data.orders || [];
    const filterLower = filter.toLowerCase();
    return (data.orders || []).filter((order) => {
      const s = (order.status || '').toLowerCase();
      if (filterLower === 'pending') return s === 'pending' || s === 'unassigned';
      if (filterLower === 'cooking') return s === 'cooking' || s === 'in preparation' || s === 'in progress' || s === 'sent to kitchen' || s === 'ready';
      if (filterLower === 'delivering') return s === 'delivering' || s === 'in transit';
      if (filterLower === 'completed') return s === 'completed' || s === 'delivered';
      return s === filterLower;
    });
  }, [data.orders, filter]);

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
    onNotify(`Đã kiểm tra và chuyển đơn #${order.id} sang cho Bếp chế biến!`);
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
    onNotify(`Bếp đã nhận và bắt đầu nấu đơn #${order.id}`);
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
    onNotify(`Món ăn đơn #${order.id} đã nấu xong! Thông báo Room Service lấy món.`);
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
    onNotify(`Room Service đã lấy món, chuẩn bị dụng cụ và đang giao lên phòng ${order.room}`);
  };

  const handleReject = async (order) => {
    updateOrderLocally(order.id, { status: 'Rejected' });
    await updateRoomServiceOrderStatus(order.rawId || order.id, { status: 'Rejected' });
    onNotify(`Từ chối đơn #${order.id}`);
  };

  const handleCompleteOrder = async (order) => {
    updateOrderLocally(order.id, { status: 'Completed', progress: 100, assignedTo: staffName });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Completed',
      progress: 100,
      assigned_staff_name: staffName,
    });
    onNotify(`Đã giao thành công và hoàn tất đơn hàng #${order.id}!`);
  };

  const kpis = data.kpis || INITIAL_ROOM_SERVICE_DATA.kpis;

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-4 md:px-8 pt-3 pb-8">
        <header>
          <h2 className="text-[15px] font-semibold text-[#2C2926]">{t('rsTitle')}</h2>
          <p className="mt-0.5 text-[12px] text-[#77726D]">
            {t('rsSubtitle')}
          </p>
        </header>

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

        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,2.12fr)_minmax(225px,0.9fr)] gap-5">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-[13px] font-semibold text-[#36322F]">{t('activeOrders')}</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {['All', 'Pending', 'Cooking', 'Delivering', 'Completed'].map((tab) => (
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
                      : tab === 'Cooking'
                      ? t('inProgress')
                      : tab === 'Delivering'
                      ? t('delivering')
                      : t('completed')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-white px-5 py-10 text-center text-[12px] text-[#777] border border-[#E8E5E0]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredOrders.map((order) => {
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
                          <span className="rounded bg-[#E3E0DB] px-1.5 py-0.5 text-[10px] text-[#69645E]">
                            {order.room}
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
                            ? 'Chờ Tiếp Nhận'
                            : isSentToKitchen
                            ? 'Đã Chuyển Bếp'
                            : isCooking
                            ? 'Bếp Đang Nấu'
                            : isReady
                            ? 'Món Đã Nấu Xong'
                            : isDelivering
                            ? 'Đang Giao Phòng'
                            : 'Đã Hoàn Tất'}
                        </span>
                      </div>

                      <p className="text-[10px] text-[#888]">
                        {order.orderedAt || 'Vừa đặt'}
                      </p>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-[12px] font-semibold text-[#322F2C]">
                            {order.name || (Array.isArray(order.items) && order.items.map(it => it.name).join(', ')) || 'Yêu cầu Room Service'}
                          </h4>
                          <p className="text-[11px] text-[#746F69]">
                            {order.notes || 'Không có ghi chú đặc biệt'}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-[#444]">x{order.qty || 1}</span>
                      </div>

                      <div className="pt-3 border-t border-[#F0ECE6] flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stone-500 font-medium">
                          {isPending
                            ? 'Room Service kiểm tra đơn'
                            : isSentToKitchen
                            ? 'Chờ Bếp chế biến'
                            : isCooking
                            ? 'Bếp đang làm món'
                            : isReady
                            ? 'Lấy món & chuẩn bị dụng cụ'
                            : isDelivering
                            ? 'Đang giao lên phòng'
                            : 'Hoàn tất'}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* 1. Pending: Reject & Chuyển Sang Bếp */}
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
                              >
                                Chuyển Sang Bếp
                              </button>
                            </>
                          )}

                          {/* 2. Sent to Kitchen (Chờ Bếp, Room Service không bấm được) */}
                          {isSentToKitchen && (
                            <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1.5">
                              <span>⏳ Chờ Bếp Nhận Nấu</span>
                            </span>
                          )}

                          {/* 3. Cooking (Bếp đang nấu, Room Service chỉ xem) */}
                          {isCooking && (
                            <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1.5">
                              <span>🔥 Bếp Đang Nấu Món...</span>
                            </span>
                          )}

                          {/* 4. Ready -> Lấy Món & Giao Phòng */}
                          {isReady && (
                            <button
                              type="button"
                              onClick={() => handleStartDelivery(order)}
                              className="rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                            >
                              Lấy Món & Giao Phòng
                            </button>
                          )}

                          {/* 5. Delivering -> Xác Nhận Đã Giao */}
                          {isDelivering && (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-[11px] font-bold text-white cursor-pointer shadow-xs"
                            >
                              Xác Nhận Đã Giao
                            </button>
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
          </div>

          <aside className="space-y-4">
            <article className="rounded-xl bg-[#F4F3F0] p-4 border border-[#E8E5E0]">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#3E3A36]">{t('rsRobotChannel')}</h3>

              <div className="mt-3 p-3 rounded-lg bg-white border border-[#E0DDD8] flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#2C2926]">HCRobot Unit 01</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">{t('rsRobotOnline')}</p>
                </div>
                <span className="text-[11px] font-mono font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                  96%
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="mt-3 w-full rounded-lg border border-[#D3CFCA] bg-white py-2 text-[11px] font-semibold text-[#444] hover:bg-[#FAF9F7] cursor-pointer"
              >
                {t('rsViewMap')}
              </button>
            </article>

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

      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="HCRobot Delivery Fleet Live Map"
      />
    </main>
  );
};

