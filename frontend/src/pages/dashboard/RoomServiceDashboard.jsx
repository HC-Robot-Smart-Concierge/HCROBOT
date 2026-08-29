import React, { useState, useEffect } from 'react';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { AssignStaffModal, InteractiveMapModal } from '../../components/dashboard/Modals';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import {
  fetchRoomServiceDashboard,
  updateRoomServiceOrderStatus,
  assignRobotToOrder,
} from '../../services/operationsApi';
import {
  FileText,
  CookingPot,
  CheckCircle2,
  AlertCircle,
  UtensilsCrossed,
  MapPin,
  Bot,
  Map,
  Clock,
  Sparkles,
} from 'lucide-react';

export const RoomServiceDashboard = ({ currentUser, onNotify = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Elena Rossi';
  const staffId = currentUser?.id || currentUser?.username || 'user';

  const [data, setData] = useState(INITIAL_ROOM_SERVICE_DATA);
  const [filter, setFilter] = useState('All'); // 'All' | 'Pending' | 'Cooking'
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Load live data from PostgreSQL on mount
  useEffect(() => {
    const loadData = async () => {
      const res = await fetchRoomServiceDashboard();
      if (res && res.orders) {
        setData((prev) => ({
          ...prev,
          kpis: res.kpis || prev.kpis,
          orders: res.orders.length > 0 ? res.orders : prev.orders,
          deliveryFleet: res.delivery_fleet?.length > 0 ? res.delivery_fleet : prev.deliveryFleet,
          lowStockAlerts: res.low_stock_alerts?.length > 0 ? res.low_stock_alerts : prev.lowStockAlerts,
        }));
      }
    };
    loadData();
  }, []);

  // Filter orders
  const filteredOrders = (data.orders || []).filter((order) => {
    if (filter === 'All') return true;
    const s = (order.status || '').toLowerCase().trim();
    if (filter === 'Pending') return s === 'pending' || s === 'unassigned';
    if (filter === 'Cooking') return s === 'cooking';
    if (filter === 'Ready') return s === 'ready';
    if (filter === 'Delivering') return s === 'delivering';
    if (filter === 'Completed') return s === 'completed' || s === 'delivered' || s === 'done';
    if (filter === 'VIP Priority') return Boolean(order.isVip);
    return s === filter.toLowerCase();
  });

  // Action: Self-Claim & Start Preparation -> Persists in PostgreSQL with Staff Identity
  const handleStartPrep = async (orderId) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        (o.id === orderId || o.order_number === orderId)
          ? {
              ...o,
              status: 'Cooking',
              progress: 25,
              estCompletion: '12 mins',
              assignedStaff: staffName,
            }
          : o
      ),
    }));
    await updateRoomServiceOrderStatus(orderId, {
      status: 'Cooking',
      progress: 25,
      est_completion: '12 mins',
      assigned_staff_name: staffName,
      assigned_staff_id: staffId,
    });
    onNotify(`Bạn (${staffName}) đã nhận đơn #${orderId} & Đang nấu món`);
  };

  // Action: Mark Ready for Delivery -> Persists in PostgreSQL
  const handleMarkReady = async (orderId) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        (o.id === orderId || o.order_number === orderId)
          ? { ...o, status: 'Ready', progress: 100 }
          : o
      ),
    }));
    await updateRoomServiceOrderStatus(orderId, { status: 'Ready', progress: 100 });
    onNotify(`Đơn #${orderId} đã nấu xong, sẵn sàng đặt vào HCRobot!`);
  };

  // Action: Reject Order -> Persists in PostgreSQL
  const handleReject = async (orderId) => {
    setData((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== orderId && o.order_number !== orderId),
    }));
    await updateRoomServiceOrderStatus(orderId, { status: 'Rejected' });
    onNotify(`Đã hủy đơn #${orderId}`);
  };

  // Action: Assign to HCRobot -> Persists in PostgreSQL
  const handleAssignBot = async (order) => {
    const robotName = 'HCRobot Unit 01';
    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        (o.id === order.id || o.order_number === order.id)
          ? { ...o, status: 'Delivering', assignedTo: robotName }
          : o
      ),
    }));
    await assignRobotToOrder(order.id, {
      robot_id: 'bot_01',
      robot_name: robotName,
    });
    onNotify(`Đã điều phối ${robotName} giao đơn #${order.id} tới phòng!`);
  };

  // Action: Confirm assignment from AssignStaffModal
  const handleConfirmAssignment = async (assignee) => {
    if (!selectedTaskForAssign) return;
    const orderId = selectedTaskForAssign.id;
    const isBot = typeof assignee === 'object' && assignee.name;
    const assigneeName = isBot ? assignee.name : assignee;

    setData((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        (o.id === orderId || o.order_number === orderId)
          ? {
              ...o,
              status: isBot ? 'Delivering' : 'Cooking',
              assignedTo: assigneeName,
              assignedStaff: !isBot ? assigneeName : o.assignedStaff,
            }
          : o
      ),
    }));

    if (isBot) {
      await assignRobotToOrder(orderId, {
        robot_id: assignee.id || 'bot_01',
        robot_name: assigneeName,
      });
      onNotify(`Đã phân công ${assigneeName} giao đơn #${orderId}!`);
    } else {
      await updateRoomServiceOrderStatus(orderId, {
        assigned_staff_name: assigneeName,
      });
      onNotify(`Đã phân công nhân viên ${assigneeName} phụ trách đơn #${orderId}!`);
    }
    setSelectedTaskForAssign(null);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Title & Description */}
        <div>
          <h2 className="text-xl font-bold text-[#1A1917]">Room Service / F&B</h2>
          <p className="text-xs text-[#78716C] mt-1 max-w-2xl leading-relaxed">
            Monitor incoming orders, manage preparation queues, and coordinate with robotic delivery units for timely guest service.
          </p>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="PENDING ORDERS"
            value={data.kpis.pendingOrders.value}
            delta={data.kpis.pendingOrders.delta}
            deltaType="negative"
            icon={FileText}
          />
          <MetricCard
            title="IN PREPARATION"
            value={data.kpis.inPreparation.value}
            subText={`avg ${data.kpis.inPreparation.avgTime}`}
            icon={CookingPot}
          />
          <MetricCard
            title="COMPLETED TODAY"
            value={data.kpis.completedToday.value}
            variant="dark"
            icon={CheckCircle2}
          />
          <MetricCard
            title="HIGH PRIORITY"
            value={data.kpis.highPriority.count}
            subText={data.kpis.highPriority.label}
            variant="danger-gradient"
            icon={AlertCircle}
          />
        </div>

        {/* Main Content: Active Orders & Right Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left: Active Orders Section */}
          <div className="lg:col-span-8 space-y-4">
            {/* Header & Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1A1917] shrink-0">Active Orders</h3>
              <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] overflow-x-auto no-scrollbar max-w-full">
                {['All', 'Pending', 'Cooking', 'Ready', 'Delivering', 'Completed', 'VIP Priority'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab);
                      onNotify(`Đã lọc danh sách đơn bếp theo: ${tab}`);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filter === tab
                        ? 'bg-[#18181B] text-white shadow-sm'
                        : 'text-[#78716C] hover:text-[#1A1917]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
                  No orders found in {filter} status.
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isVipOrder = order.isVip;
                  const isCooking = order.status.toLowerCase() === 'cooking';

                  return (
                    <div
                      key={order.id}
                      className={`relative bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm transition-all hover:shadow-md overflow-hidden ${
                        isVipOrder ? 'border-l-4 border-l-red-500' : ''
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE3]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1A1917]">#{order.id}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              order.isVip
                                ? 'bg-red-100 text-red-700'
                                : 'bg-[#EFECE6] text-[#44403C]'
                            }`}
                          >
                            {order.isVip ? `VIP • ${order.room}` : order.room}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#78716C] font-medium">
                          <span className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCooking
                                  ? 'bg-sky-500 animate-pulse'
                                  : 'bg-stone-400'
                              }`}
                            />
                            <span className="font-semibold text-stone-700">{order.status}</span>
                          </span>
                          <span>•</span>
                          <span>Ordered {order.orderedAt}</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="py-4 flex gap-4 items-center">
                        {order.imageUrl ? (
                          <img
                            src={order.imageUrl}
                            alt="Food order"
                            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#E5E1D8]"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-[#F5F2EB] flex items-center justify-center shrink-0 border border-[#E5E1D8] text-stone-600">
                            <UtensilsCrossed className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="font-bold text-[#1A1917] truncate">{item.name}</span>
                              <span className="font-semibold text-stone-600 ml-2">{item.qty}</span>
                            </div>
                          ))}

                          {order.note && (
                            <p className="text-[11px] text-[#78716C] italic mt-1.5">{order.note}</p>
                          )}

                          {/* Cooking Progress */}
                          {isCooking && order.progress !== undefined && (
                            <div className="mt-3">
                              <div className="w-full bg-[#EFECE6] h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-sky-500 h-full rounded-full transition-all duration-700"
                                  style={{ width: `${order.progress}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] font-semibold text-stone-500 mt-1">
                                <span>Est. completion: {order.estCompletion}</span>
                                <span>{order.progress}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-2 flex items-center justify-end gap-2.5">
                        {order.status === 'Pending' && !order.isServiceRequest && (
                          <>
                            <button
                              onClick={() => handleReject(order.id)}
                              className="px-4 py-1.5 rounded-full text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleStartPrep(order.id)}
                              className="px-5 py-1.5 rounded-full text-xs font-bold text-white bg-[#18181B] hover:bg-black transition-all shadow-sm"
                            >
                              Start Preparation
                            </button>
                          </>
                        )}

                        {order.status === 'Cooking' && (
                          <button
                            onClick={() => handleMarkReady(order.id)}
                            className="px-5 py-1.5 rounded-full text-xs font-bold text-white bg-[#18181B] hover:bg-black transition-all shadow-sm"
                          >
                            Mark Ready for Delivery
                          </button>
                        )}

                        {order.isServiceRequest && (
                          <button
                            onClick={() => handleAssignBot(order)}
                            className="px-5 py-1.5 rounded-full text-xs font-bold text-white bg-[#18181B] hover:bg-black transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Assign to HCRobot</span>
                          </button>
                        )}

                        {order.status === 'Ready' && (
                          <button
                            onClick={() => handleAssignBot(order)}
                            className="px-5 py-1.5 rounded-full text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Dispatch HCRobot Unit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Delivery Fleet & Low Stock Panels */}
          <div className="lg:col-span-4 space-y-4">
            {/* Delivery Fleet Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917] flex items-center gap-2">
                  <span>Delivery Fleet</span>
                </h3>
                <Bot className="w-4 h-4 text-stone-500" />
              </div>

              <div className="space-y-3">
                {data.deliveryFleet.map((fleet) => (
                  <div
                    key={fleet.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EFECE6]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EAE6DE] flex items-center justify-center font-bold text-xs text-[#1A1917]">
                        {fleet.id}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1A1917]">{fleet.name}</p>
                        <p
                          className={`text-[11px] font-semibold ${
                            fleet.statusColor === 'emerald'
                              ? 'text-emerald-600'
                              : fleet.statusColor === 'sky'
                              ? 'text-sky-600'
                              : 'text-stone-500'
                          }`}
                        >
                          {fleet.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-[#78716C]">{fleet.location}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsMapModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-[#F5F2EB] hover:bg-[#EAE6DE] text-xs font-bold text-[#1A1917] border border-[#DDD8CE] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Map className="w-3.5 h-3.5 text-stone-600" />
                <span>View Fleet Map</span>
              </button>
            </div>

            {/* Low Stock Alerts Card */}
            <div className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1917]">
                Low Stock Alerts
              </h3>

              <div className="space-y-2.5">
                {data.lowStockAlerts.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-700">{item.name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        item.level === 'danger'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      <AssignStaffModal
        isOpen={!!selectedTaskForAssign}
        onClose={() => setSelectedTaskForAssign(null)}
        task={selectedTaskForAssign}
        robotUnits={data.deliveryFleet}
        onAssign={handleConfirmAssignment}
      />

      {/* Fleet Map Modal */}
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="HCRobot Delivery Fleet Live Map"
      />
    </div>
  );
};
