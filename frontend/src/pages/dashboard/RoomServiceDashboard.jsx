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
    return (data.orders || []).filter(
      (order) => (order.status || '').toLowerCase() === filter.toLowerCase()
    );
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

  const kpis = data.kpis || INITIAL_ROOM_SERVICE_DATA.kpis;

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1180px] mx-auto px-8 pt-3 pb-8">
        <header>
          <h2 className="text-[15px] font-medium text-[#2C2926]">Room Service / F&amp;B</h2>
          <p className="mt-1 max-w-[610px] text-[11px] leading-[1.55] text-[#77726D]">
            Monitor incoming orders, manage preparation queues, and coordinate with robotic
            delivery units for timely guest service.
          </p>
        </header>

        <section className="mt-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Pending Orders"
            value={kpis.pendingOrders?.value ?? 0}
            detail={kpis.pendingOrders?.delta}
            icon={FileText}
          />
          <KpiCard
            label="In Preparation"
            value={kpis.inPreparation?.value ?? 0}
            detail={`avg ${kpis.inPreparation?.avgTime || '12m'}`}
            icon={CookingPot}
          />
          <KpiCard
            label="Delivering"
            value={kpis.delivering?.value ?? 0}
            detail={kpis.delivering?.label || 'In Transit'}
            icon={Bot}
          />
          <KpiCard
            label="Completed Today"
            value={kpis.completedToday?.value ?? 0}
            icon={CheckCircle2}
            tone="dark"
          />
        </section>

        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,2.12fr)_minmax(225px,0.9fr)] gap-5">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-[12px] font-medium text-[#36322F]">Active Orders</h3>
              <div className="flex items-center gap-1">
                {['All', 'Pending', 'Cooking'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-[9px] px-3.5 py-2 text-[10px] transition-colors ${
                      filter === tab
                        ? 'bg-[#EAE8E4] text-[#494540]'
                        : 'text-[#77726D] hover:bg-[#F0EEEA]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="rounded-[18px] bg-[#F0EFEC] px-5 py-12 text-center text-[11px] text-[#77726D]">
                  No orders in this queue.
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const normalizedStatus = (order.status || '').toLowerCase();
                  const isPending = normalizedStatus === 'pending';
                  const isCooking = normalizedStatus === 'cooking';
                  const isReady = normalizedStatus === 'ready';

                  return (
                    <article
                      key={order.rawId || order.id}
                      className="relative overflow-hidden rounded-[18px] bg-[#F0EFEC] px-5 py-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-medium text-[#4F4A45]">#{order.id}</span>
                            <span className="rounded-[5px] bg-[#E0DEDA] px-2 py-1 text-[9px] font-medium tracking-[0.03em] text-[#5F5B56]">
                              {order.room}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] text-[#77726D]">Ordered {order.orderedAt}</p>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[#6E6964]">
                          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(order.status)}`} />
                          {order.status}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4">
                        {order.imageUrl ? (
                          <img
                            src={order.imageUrl}
                            alt={order.items?.[0]?.name || 'Room service order'}
                            className="h-[72px] w-[72px] shrink-0 rounded-[9px] object-cover"
                          />
                        ) : (
                          <div className="h-[58px] w-[58px] shrink-0 rounded-[9px] bg-[#E5E3DF] flex items-center justify-center text-[#706B66]">
                            <UtensilsCrossed className="h-5 w-5" strokeWidth={1.7} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="space-y-1.5">
                            {(order.items || []).map((item, index) => (
                              <div
                                key={`${item.name}-${index}`}
                                className="flex items-start justify-between gap-4 text-[10px]"
                              >
                                <span className="font-medium leading-[1.45] text-[#393531]">{item.name}</span>
                                <span className="shrink-0 text-[#6E6964]">{item.qty}</span>
                              </div>
                            ))}
                          </div>

                          {order.note && (
                            <p className="mt-2 text-[10px] leading-[1.45] text-[#77726D]">{order.note}</p>
                          )}

                          {isCooking && (
                            <div className="mt-4">
                              <div className="h-[3px] overflow-hidden rounded-full bg-[#D7D4CF]">
                                <div
                                  className="h-full rounded-full bg-[#3988EE] transition-all duration-500"
                                  style={{ width: `${order.progress || 0}%` }}
                                />
                              </div>
                              <div className="mt-2 flex justify-between text-[9px] text-[#706B66]">
                                <span>Est. completion: {order.estCompletion || '12 mins'}</span>
                                <span>{order.progress || 0}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex justify-end gap-2.5">
                        {isPending && !order.isServiceRequest && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReject(order)}
                              className="rounded-[9px] border border-[#D4D0CB] bg-[#F8F7F5] px-5 py-2.5 text-[10px] text-[#4D4844] hover:bg-white"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartPreparation(order)}
                              className="rounded-[9px] bg-black px-5 py-2.5 text-[10px] text-white hover:bg-[#252525]"
                            >
                              Start Preparation
                            </button>
                          </>
                        )}

                        {isCooking && (
                          <button
                            type="button"
                            onClick={() => handleMarkReady(order)}
                            className="rounded-[9px] bg-black px-5 py-2.5 text-[10px] text-white hover:bg-[#252525]"
                          >
                            Mark Ready for Delivery
                          </button>
                        )}

                        {(order.isServiceRequest || isReady) && (
                          <button
                            type="button"
                            onClick={() => handleAssignRobot(order)}
                            className="rounded-[9px] bg-black px-5 py-2.5 text-[10px] text-white hover:bg-[#252525]"
                          >
                            Assign to HCRobot
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <article className="rounded-[18px] bg-[#F0EFEC] px-5 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-medium text-[#3E3A36]">Delivery Fleet</h3>
                <Bot className="h-4 w-4 text-[#6F6A65]" strokeWidth={1.7} />
              </div>

              <div className="mt-5 space-y-4">
                {(data.deliveryFleet || []).map((unit) => (
                  <div key={unit.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-[#E3E1DD] flex items-center justify-center text-[10px] font-medium text-[#77726D]">
                      {unit.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium text-[#48443F]">{unit.name}</p>
                      <p
                        className={`mt-0.5 text-[9px] ${
                          unit.statusColor === 'emerald'
                            ? 'text-[#32A862]'
                            : unit.statusColor === 'sky'
                            ? 'text-[#3E7DD4]'
                            : 'text-[#AAA6A1]'
                        }`}
                      >
                        {unit.status}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[9px] text-[#716C67]">
                      {unit.location}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsMapModalOpen(true)}
                className="mt-5 w-full rounded-[9px] border border-[#D3CFCA] bg-[#F7F6F4] py-2.5 text-[10px] text-[#494540] hover:bg-white"
              >
                View Fleet Map
              </button>
            </article>

            <article className="rounded-[18px] bg-[#E9E7E3] px-5 py-5">
              <h3 className="text-[11px] font-medium text-[#3E3A36]">Low Stock Alerts</h3>
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
