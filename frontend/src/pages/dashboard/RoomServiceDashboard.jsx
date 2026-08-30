import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CookingPot,
  FileText,
  UtensilsCrossed,
} from 'lucide-react';
import { InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import {
  assignRobotToOrder,
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

const statusDotClass = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'cooking') return 'bg-[#408BEE]';
  if (['ready', 'completed', 'delivered'].includes(normalized)) return 'bg-[#42C67A]';
  if (normalized === 'delivering') return 'bg-[#7454D6]';
  return 'bg-[#888580]';
};

const KpiCard = ({ label, value, detail, icon: Icon, tone = 'light' }) => {
  const isDark = tone === 'dark';
  const isDanger = tone === 'danger';

  return (
    <article
      className={`min-h-[126px] rounded-[17px] px-5 py-5 flex flex-col justify-between ${
        isDark
          ? 'bg-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.16)]'
          : isDanger
          ? 'bg-[#FFD2D2] text-[#C52F35]'
          : 'bg-[#F0EFEC] text-[#4D4945]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`max-w-[110px] text-[11px] font-medium leading-[1.45] tracking-[0.09em] uppercase ${
            isDark ? 'text-[#C9C5C0]' : isDanger ? 'text-[#BE3036]' : 'text-[#716D68]'
          }`}
        >
          {label}
        </p>
        <Icon
          className={`h-4 w-4 shrink-0 ${
            isDark ? 'text-[#908C87]' : isDanger ? 'text-[#C93037]' : 'text-[#AAA6A1]'
          }`}
          strokeWidth={1.7}
        />
      </div>

      <div className="flex items-end gap-3">
        <span className="text-[14px] font-medium leading-none">{value}</span>
        {detail && (
          <span
            className={`text-[10px] leading-none ${
              isDark ? 'text-[#B1ACA6]' : isDanger ? 'text-[#D3555B]' : 'text-[#77726D]'
            }`}
          >
            {detail}
          </span>
        )}
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
      if (filterLower === 'cooking') return s === 'cooking' || s === 'in preparation' || s === 'in progress';
      if (filterLower === 'delivering') return s === 'delivering' || s === 'in transit';
      if (filterLower === 'completed') return s === 'completed' || s === 'delivered' || s === 'ready';
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

  const handleStartPreparation = async (order) => {
    const activeOrder = (data.orders || []).find(
      (o) =>
        ['Cooking', 'In Progress'].includes(o.status) &&
        (o.assignedTo === staffName || o.assigned_staff_name === staffName)
    );
    if (activeOrder) {
      onNotify(
        `⚠️ Bạn đang chuẩn bị đơn #${activeOrder.orderNumber || activeOrder.id}. Vui lòng hoàn thành trước khi nhận thêm đơn mới!`
      );
      return;
    }

    updateOrderLocally(order.id, {
      status: 'Cooking',
      progress: 25,
      estCompletion: '12 mins',
      assignedTo: staffName,
    });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Cooking',
      progress: 25,
      est_completion: '12 mins',
      assigned_staff_name: staffName,
    });
    onNotify(`Started preparation for order #${order.id}`);
  };

  const handleMarkReady = async (order) => {
    updateOrderLocally(order.id, { status: 'Ready', progress: 100 });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Ready',
      progress: 100,
    });
    onNotify(`Order #${order.id} is ready for delivery`);
  };

  const handleReject = async (order) => {
    updateOrderLocally(order.id, { status: 'Rejected' });
    await updateRoomServiceOrderStatus(order.rawId || order.id, { status: 'Rejected' });
    onNotify(`Rejected order #${order.id}`);
  };

  const handleAssignRobot = async (order) => {
    const robot =
      data.deliveryFleet.find((unit) => unit.status === 'Available') || data.deliveryFleet[0];
    const robotName = robot?.name || 'HCRobot Unit 01';
    updateOrderLocally(order.id, { status: 'Delivering', assignedTo: robotName });
    await assignRobotToOrder(order.rawId || order.id, {
      robot_id: robot?.rawId || robot?.id || null,
      robot_name: robotName,
    });
    onNotify(`${robotName} assigned to order #${order.id}`);
  };

  const handleCompleteOrder = async (order) => {
    updateOrderLocally(order.id, { status: 'Completed', progress: 100, assignedTo: staffName });
    await updateRoomServiceOrderStatus(order.rawId || order.id, {
      status: 'Completed',
      progress: 100,
      assigned_staff_name: staffName,
    });
    onNotify(`Đã hoàn tất giao đơn hàng #${order.id}!`);
  };

  const kpis = data.kpis || INITIAL_ROOM_SERVICE_DATA.kpis;

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-8 pt-3 pb-8">
        <header>
          <h2 className="text-[15px] font-medium text-[#2C2926]">{t('rsTitle')}</h2>
          <p className="mt-1 max-w-[610px] text-[11px] leading-[1.55] text-[#77726D]">
            {t('rsSubtitle')}
          </p>
        </header>

        <section className="mt-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={t('kpiPendingOrders')}
            value={kpis.pendingOrders?.value ?? 0}
            detail={kpis.pendingOrders?.delta}
            icon={FileText}
          />
          <KpiCard
            label={t('kpiInPreparation')}
            value={kpis.inPreparation?.value ?? 0}
            detail={`avg ${kpis.inPreparation?.avgTime || '12m'}`}
            icon={CookingPot}
          />
          <KpiCard
            label={t('delivering')}
            value={kpis.delivering?.value ?? 0}
            detail={kpis.delivering?.label || 'In Transit'}
            icon={Bot}
          />
          <KpiCard
            label={t('kpiCompletedToday')}
            value={kpis.completedToday?.value ?? 0}
            icon={CheckCircle2}
            tone="dark"
          />
        </section>

        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,2.12fr)_minmax(225px,0.9fr)] gap-5">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-[12px] font-medium text-[#36322F]">{t('activeOrders')}</h3>
              <div className="flex items-center gap-1 flex-wrap">
                {['All', 'Pending', 'Cooking', 'Delivering', 'Completed'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-[9px] px-3.5 py-2 text-[10px] font-medium transition-colors cursor-pointer ${
                      filter === tab
                        ? 'bg-[#EAE8E4] text-[#494540] shadow-xs'
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

            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="rounded-[18px] bg-[#F0EFEC] px-5 py-12 text-center text-[11px] text-[#77726D]">
                  {t('noDataMatch')}
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const normalizedStatus = (order.status || '').toLowerCase();
                  const isPending = normalizedStatus === 'pending' || normalizedStatus === 'unassigned';
                  const isCooking = normalizedStatus === 'cooking' || normalizedStatus === 'in progress' || normalizedStatus === 'in preparation';
                  const isCompleted = normalizedStatus === 'completed' || normalizedStatus === 'ready' || normalizedStatus === 'delivered';

                  return (
                    <article
                      key={order.id}
                      className="rounded-[18px] bg-[#F0EFEC] px-5 py-5 shadow-[0_3px_12px_rgba(55,48,42,0.035)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-[#3A3530]">
                          <span>#{order.id}</span>
                          <span className="rounded-[4px] bg-[#E3E0DB] px-2 py-0.5 text-[9px] text-[#69645E]">
                            {order.room}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-500'
                                : isCooking
                                ? 'bg-amber-500'
                                : 'bg-[#6F6963]'
                            }`}
                          />
                          <span className="text-[10px] font-medium text-[#6F6963]">
                            {isCompleted
                              ? t('completed')
                              : isCooking
                              ? t('inProgress')
                              : t('pending')}
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 text-[9px] text-[#7B756F]">
                        {order.orderedAt || 'Ordered recently'}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {order.image ? (
                            <img
                              src={order.image}
                              alt={order.name}
                              className="h-14 w-14 rounded-[12px] object-cover"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-[12px] bg-[#E2DFD9] flex items-center justify-center text-[#736E67]">
                              {order.isServiceRequest ? (
                                <UtensilsCrossed className="h-5 w-5" strokeWidth={1.8} />
                              ) : (
                                <CookingPot className="h-5 w-5" strokeWidth={1.8} />
                              )}
                            </div>
                          )}

                          <div>
                            <h4 className="text-[11px] font-medium text-[#322F2C]">
                              {order.name}
                            </h4>
                            <p className="text-[10px] text-[#746F69]">
                              {order.notes || 'No special requests'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] text-[#635E58]">{order.qty || 1}</span>
                      </div>

                      <div className="mt-5 flex justify-end gap-2.5">
                        {isPending && !order.isServiceRequest && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReject(order)}
                              className="rounded-[9px] border border-[#D4D0CB] bg-[#F8F7F5] px-5 py-2.5 text-[10px] text-[#4D4844] hover:bg-white cursor-pointer"
                            >
                              {t('reject')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartPreparation(order)}
                              className="rounded-[9px] bg-black px-5 py-2.5 text-[10px] font-bold text-white hover:bg-[#252525] cursor-pointer shadow-sm"
                            >
                              {t('startPrep')}
                            </button>
                          </>
                        )}

                        {isCooking && (
                          <button
                            type="button"
                            onClick={() => handleCompleteOrder(order)}
                            className="rounded-[9px] bg-emerald-600 px-5 py-2.5 text-[10px] font-bold text-white hover:bg-emerald-700 shadow-sm cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('completeOrder')}</span>
                          </button>
                        )}

                        {isCompleted && (
                          <span className="rounded-[9px] bg-emerald-100 text-emerald-800 px-4 py-2 text-[10px] font-bold flex items-center gap-1.5 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t('orderCompleted')}</span>
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-4">
            {/* Single HCRobot Unit Card */}
            <article className="rounded-[18px] bg-[#F0EFEC] px-5 py-5 border border-[#E3E0DB]">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-[#3E3A36] uppercase tracking-wider">{t('rsRobotChannel')}</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-white/70 border border-[#E0DDD8] flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-[#18181B] flex items-center justify-center text-white">
                  <Bot className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#2C2926]">HCRobot Unit 01</p>
                  <p className="text-[9px] text-[#32A862] font-semibold">{t('rsRobotOnline')}</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                  96% 🔋
                </span>
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-[#77726D]">
                {t('rsRobotDesc')}
              </p>

              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="mt-4 w-full rounded-[9px] border border-[#D3CFCA] bg-[#F7F6F4] py-2 text-[10px] font-medium text-[#494540] hover:bg-white cursor-pointer transition-all"
              >
                {t('rsViewMap')}
              </button>
            </article>

            {/* Low Stock Alerts */}
            <article className="rounded-[18px] bg-[#E9E7E3] px-5 py-5">
              <h3 className="text-[11px] font-medium text-[#3E3A36]">{t('rsLowStockAlerts')}</h3>
              <div className="mt-5 space-y-4">
                {(data.lowStockAlerts || []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <span className="text-[10px] text-[#494540]">{item.name}</span>
                    <span
                      className={`rounded-[4px] px-2 py-1 text-[9px] ${
                        item.level === 'danger'
                          ? 'bg-[#FFD8D5] text-[#D3464B]'
                          : 'bg-[#FFE1C6] text-[#D08032]'
                      }`}
                    >
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
