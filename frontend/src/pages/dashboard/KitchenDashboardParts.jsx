import React from 'react';
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  Timer,
  SlidersHorizontal,
  Phone,
  PhoneCall,
  User,
} from 'lucide-react';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import { formatTimeAgo } from '../../utils/timeAgo';

const initialOrdersByNumber = new Map(
  INITIAL_ROOM_SERVICE_DATA.orders.map((order) => [order.id, order])
);

export const normalizeOrder = (order) => {
  const orderNumber = order.order_number || order.id;
  const initialOrder = initialOrdersByNumber.get(orderNumber) || {};

  return {
    ...initialOrder,
    ...order,
    id: orderNumber,
    rawId: order.id,
    room: order.room_number || order.room || initialOrder.room,
    guestName: order.guest_name || order.guestName || initialOrder.guestName || 'Khách lưu trú',
    guestPhone: order.guest_phone || order.guestPhone || initialOrder.guestPhone || '',
    roomPhone: order.room_phone || order.roomPhone || initialOrder.roomPhone || '',
    imageUrl: order.image_url || order.imageUrl || initialOrder.imageUrl,
    isServiceRequest:
      order.is_service_request ?? order.isServiceRequest ?? initialOrder.isServiceRequest ?? false,
    estCompletion: order.est_completion || order.estCompletion || initialOrder.estCompletion || '15 mins',
    assignedTo: order.assigned_staff_name || order.assignedTo,
    created_at: order.created_at || order.createdAt || initialOrder.created_at,
    orderedAt: formatTimeAgo(order.created_at || order.createdAt, order.orderedAt || initialOrder.orderedAt || 'Vừa đặt', 'vi'),
  };
};

export const normalizeFleet = (unit) => ({
  ...unit,
  rawId: unit.id,
  id: unit.unit_code || unit.id,
  statusColor: unit.status_color || unit.statusColor,
  battery: unit.battery_level ?? unit.battery ?? 92,
});

export const normalizeStock = (item) => ({
  ...item,
  count: item.count_label || item.count,
});

export const matchesOrder = (order, orderId) => order.id === orderId || order.rawId === orderId;

export const KpiCard = ({ label, value, detail, active = false, onClick }) => (
  <article
    onClick={onClick}
    className={`rounded-xl bg-white px-5 py-4 border transition-all ${
      onClick ? 'cursor-pointer' : ''
    } ${
      active
        ? 'border-[#1A1917] ring-1 ring-[#1A1917]/20'
        : 'border-[#E8E5E0] hover:border-[#BDB7AE]'
    }`}
  >
    <span className="text-[11px] font-semibold uppercase text-[#8C8C8C]">{label}</span>
    <p className="mt-2 text-[22px] font-bold text-[#262626]">{value}</p>
    {detail && <p className="mt-1 text-[11px] text-[#777]">{detail}</p>}
  </article>
);

export const KitchenKpiGrid = ({
  language,
  filter,
  setFilter,
  pendingCount,
  inProgressCount,
  completedCount,
  totalCount,
}) => (
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <KpiCard
      label={language === 'EN' ? 'Pending Orders' : 'Chờ Tiếp Nhận'}
      value={pendingCount}
      detail={language === 'EN' ? 'needs chef confirmation' : 'chờ bếp tiếp nhận'}
      active={filter === 'Pending'}
      onClick={() => setFilter('Pending')}
    />
    <KpiCard
      label={language === 'EN' ? 'Cooking Now' : 'Đang Chế Biến'}
      value={inProgressCount}
      detail={language === 'EN' ? 'avg 12m prep' : 'bếp đang nấu'}
      active={filter === 'InProgress'}
      onClick={() => setFilter('InProgress')}
    />
    <KpiCard
      label={language === 'EN' ? 'Completed Today' : 'Hoàn Tất Hôm Nay'}
      value={completedCount}
      detail={language === 'EN' ? 'served to guests' : 'đã phục vụ xong'}
      active={filter === 'Completed'}
      onClick={() => setFilter('Completed')}
    />
    <KpiCard
      label={language === 'EN' ? 'Total Food Orders' : 'Tổng Món Hôm Nay'}
      value={totalCount}
      detail={language === 'EN' ? 'all kitchen orders' : 'toàn bộ đơn ẩm thực'}
      active={filter === 'All'}
      onClick={() => setFilter('All')}
    />
  </section>
);

export const KitchenOrdersToolbar = ({
  language,
  st,
  t,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  totalCount,
  pendingCount,
  inProgressCount,
  completedCount,
}) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-[13px] font-semibold text-[#403D39]">
        {language === 'EN' ? 'Active Kitchen Orders' : 'Danh sách Đơn Đặt Món (KOT)'}
      </h3>
      <p className="text-[11px] text-[#77736E]">
        {st('Open requests first, oldest first. Updates every 15 seconds.')}
      </p>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-52">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'EN' ? 'Search room, ticket, dish...' : 'Tìm phòng, mã đơn, món...'}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#BFBFBD] text-[11px] text-[#262626] placeholder:text-[#8C8C8C] focus:outline-none focus:border-[#262626]"
        />
      </div>

      <div className="staff-request-filters" role="group" aria-label={t('activeRequests')}>
        {[
          { id: 'All', label: language === 'EN' ? 'All' : 'Tất Cả', count: totalCount },
          { id: 'Pending', label: language === 'EN' ? 'Pending' : 'Chờ Tiếp Nhận', count: pendingCount },
          { id: 'InProgress', label: language === 'EN' ? 'Cooking' : 'Đang Chế Biến', count: inProgressCount },
          { id: 'Completed', label: language === 'EN' ? 'Done' : 'Đã Hoàn Tất', count: completedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            aria-pressed={filter === tab.id}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
    </div>
  </div>
);

const groupOrderDishes = (rawItems) => {
  const groupedItems = [];
  const itemMap = new Map();
  for (const it of rawItems) {
    const itemName = it.name || it.item_name || 'Món ăn';
    const qty = Number(it.qty || it.quantity || 1);
    const note = it.notes || it.note || '';
    if (itemMap.has(itemName)) {
      const existing = itemMap.get(itemName);
      existing.qty += qty;
      if (note && !existing.note.includes(note)) {
        existing.note = existing.note ? `${existing.note}; ${note}` : note;
      }
    } else {
      const entry = { name: itemName, qty, note };
      itemMap.set(itemName, entry);
      groupedItems.push(entry);
    }
  }
  return groupedItems;
};

export const KitchenOrderTicketCard = ({
  order,
  t,
  onOpenReject,
  onStartCooking,
  onCompleteOrder,
}) => {
  const normalizedStatus = (order.status || '').toLowerCase().trim();
  const isPending =
    normalizedStatus === 'pending' ||
    normalizedStatus === 'unassigned' ||
    normalizedStatus === 'sent to kitchen' ||
    normalizedStatus === 'sent_to_kitchen' ||
    normalizedStatus === 'chờ tiếp nhận';
  const isCompleted =
    normalizedStatus === 'completed' ||
    normalizedStatus === 'delivered' ||
    normalizedStatus === 'hoàn tất' ||
    normalizedStatus === 'hoàn thành';
  const isInProgress = !isPending && !isCompleted;

  const rawItems = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
  const groupedItems = groupOrderDishes(rawItems);

  return (
    <article
      key={order.id}
      className="rounded-xl bg-white px-5 py-4 border border-[#BFBFBD] transition-all"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-[#1A1917] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E2DFD9]">
            #{order.id}
          </span>
          <span className="rounded bg-[#262626] text-white px-2 py-0.5 text-[11px] font-bold">
            Phòng {order.room || 'Khách'}
          </span>
          <span className="text-[11px] text-[#777] font-medium">
            • {formatTimeAgo(order.created_at || order.orderedAt, 'Vừa đặt', 'vi')}
          </span>
          {((order.note || '').includes('Gộp thêm') || order.is_merged) && (
            <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold">
              Đơn gộp món (Giao 1 chuyến)
            </span>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold inline-flex items-center gap-1 ${
            isPending
              ? 'bg-amber-100 text-amber-800'
              : isInProgress
              ? 'bg-sky-100 text-sky-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {isInProgress && <Flame className="w-3 h-3 text-sky-700" />}
          {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
          {isPending ? 'Chờ Tiếp Nhận' : isInProgress ? 'Đang Chế Biến' : 'Đã Hoàn Tất'}
        </span>
      </div>

      {/* Guest Info & Direct Contact */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#EFECE6] text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#3F3B38] inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-[#777]" />
            <span>{order.guestName || order.guest_name || 'Khách lưu trú'}</span>
          </span>

          {(order.guestPhone || order.guest_phone) && (
            <a
              href={`tel:${order.guestPhone || order.guest_phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer"
              title="Bấm để gọi điện thoại trực tiếp cho khách"
            >
              <Phone className="w-3 h-3 text-emerald-700" />
              <span>SĐT: {order.guestPhone || order.guest_phone}</span>
            </a>
          )}

          <span
            className="inline-flex items-center gap-1 bg-[#FAF9F6] text-[#403D39] border border-[#E2DFD9] px-2 py-0.5 rounded text-[11px] font-mono font-medium"
            title="Số máy nhánh điện thoại bàn trong phòng khách"
          >
            <PhoneCall className="w-3 h-3 text-[#777]" />
            <span>{order.roomPhone || order.room_phone || (order.room ? `Ext ${order.room}` : 'Máy nhánh')}</span>
          </span>
        </div>

        <span className="text-[10px] text-[#8C8C8C] font-medium">
          Nhân viên liên lạc trực tiếp
        </span>
      </div>

      {/* Dish List */}
      <div className="mt-3 space-y-2">
        {groupedItems.length > 0 ? (
          groupedItems.map((it, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-[#EFECE6] bg-[#FAF9F6]"
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <span className="w-6 h-6 rounded font-mono text-[11px] font-bold flex items-center justify-center shrink-0 bg-[#EFECE6] text-[#262626]">
                  {it.qty}x
                </span>

                <div className="flex-1 min-w-0">
                  <h4 className="text-[12px] font-bold text-[#2B2927]">{it.name}</h4>
                  {it.note && (
                    <p className="mt-0.5 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                      Ghi chú: {it.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EFECE6] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#2B2927]">
              {order.name || 'Set Ăn Room Service & Đồ Uống'}
            </span>
            <span className="text-[12px] font-bold text-[#555]">x{order.qty || 1}</span>
          </div>
        )}

        {(order.note || order.notes) && (
          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-[12px] text-amber-900 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Yêu cầu từ khách: </span>
              <span>{order.note || order.notes}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-[#777] flex items-center gap-1">
          <Timer className="w-3.5 h-3.5 shrink-0" />
          <span>
            {isPending
              ? 'Chờ đầu bếp bấm nhận đơn để chuẩn bị nguyên liệu'
              : isInProgress
              ? 'Bếp đang chế biến món ăn'
              : 'Đã hoàn tất chu đáo'}
          </span>
        </span>

        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <button
                type="button"
                onClick={() => onOpenReject(order)}
                className="rounded-lg border border-[#DDD] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#555] hover:bg-[#F7F5F2] cursor-pointer"
              >
                {t('reject') || 'Từ Chối'}
              </button>
              <button
                type="button"
                onClick={() => onStartCooking(order)}
                className="rounded-lg bg-[#262626] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#404040] cursor-pointer inline-flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Tiếp Nhận & Chế Biến</span>
              </button>
            </>
          )}

          {isInProgress && (
            <button
              type="button"
              onClick={() => onCompleteOrder(order)}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hoàn Thành</span>
            </button>
          )}

          {isCompleted && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã Hoàn Tất</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const KitchenRightSidebar = ({ lowStockAlerts, quickDishes, toggleDishAvailability }) => (
  <aside className="min-w-0 space-y-4">
    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Cảnh Báo Tồn Kho Bếp</span>
        </h3>
        <span className="text-[10px] text-[#777] font-semibold">5 mục cần lưu ý</span>
      </div>

      <div className="mt-3 space-y-2">
        {lowStockAlerts.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#EFECE6] last:border-0"
          >
            <span className="font-medium text-[#333]">{item.name}</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                item.level === 'danger'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </section>

    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39] flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#555]" />
          <span>Trạng Thái Món Chính</span>
        </h3>
        <span className="text-[10px] text-[#777] font-semibold">Bếp trưởng</span>
      </div>

      <div className="space-y-2">
        {quickDishes.map((dish) => (
          <div
            key={dish.id}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EFECE6] text-[11px]"
          >
            <div className="min-w-0 pr-2">
              <p className="font-bold text-[#2B2927] leading-tight truncate">{dish.name}</p>
              <p className="text-[10px] text-[#777] mt-0.5">{dish.category}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleDishAvailability(dish.id)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                dish.available
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-[#E3E0DC] text-[#555] hover:bg-[#D5D1CC]'
              }`}
            >
              {dish.available ? 'Còn Món' : 'Tạm Hết'}
            </button>
          </div>
        ))}
      </div>
    </section>
  </aside>
);
