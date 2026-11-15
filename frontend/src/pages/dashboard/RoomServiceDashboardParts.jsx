import React from 'react';
import { RefreshCw, CheckCircle2, Clock, Bot, Phone, User } from 'lucide-react';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
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
    imageUrl: order.image_url || order.imageUrl || initialOrder.imageUrl,
    isServiceRequest:
      order.is_service_request ?? order.isServiceRequest ?? initialOrder.isServiceRequest ?? false,
    estCompletion: order.est_completion || order.estCompletion || initialOrder.estCompletion,
    assignedTo: order.assigned_staff_name || order.assignedTo,
    created_at: order.created_at || order.createdAt || initialOrder.created_at,
    orderedAt: formatTimeAgo(order.created_at || order.createdAt, order.orderedAt || initialOrder.orderedAt || 'Just now', 'vi'),
    guestName: order.guest_name || order.guestName || initialOrder.guestName,
    guest_name: order.guest_name || order.guestName || initialOrder.guestName,
    guestPhone: order.guest_phone || order.guestPhone || initialOrder.guestPhone,
    guest_phone: order.guest_phone || order.guestPhone || initialOrder.guestPhone,
    roomPhone: order.room_phone || order.roomPhone || initialOrder.roomPhone || `Ext ${order.room_number || order.room}`,
    room_phone: order.room_phone || order.roomPhone || initialOrder.roomPhone || `Ext ${order.room_number || order.room}`,
  };
};

export const normalizeFleet = (unit) => ({
  ...unit,
  rawId: unit.id,
  id: unit.unit_code || unit.id,
  statusColor: unit.status_color || unit.statusColor,
  battery: unit.battery_level ?? unit.battery,
});

export const matchesOrder = (order, orderId) => order.id === orderId || order.rawId === orderId;

const KpiCard = ({ label, value, detail, active = false, onClick }) => {
  return (
    <article
      onClick={onClick}
      className={`rounded-xl bg-white px-5 py-4 border transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? '!border-[#1A1917] ring-1 ring-[#1A1917]/20'
          : 'border-[#BFBFBD] hover:border-[#8C8C8C]'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[22px] font-bold text-[#262626]">{value}</span>
        {detail && <span className="text-[11px] text-[#77736E]">{detail}</span>}
      </div>
    </article>
  );
};

export const RoomServiceHeaderAndKpis = ({
  language,
  st,
  isRefreshing,
  onRefresh,
  filter,
  setFilter,
  tabCounts,
}) => (
  <>
    <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1>{language === 'EN' ? 'Room Service Operations' : 'Dịch Vụ Buồng Phòng (Room Service)'}</h1>
        <p>
          {language === 'EN'
            ? 'Coordinate guest room amenity requests, preparation queues and room delivery.'
            : 'Tiếp nhận yêu cầu tiện nghi buồng phòng, chuẩn bị và giao phục vụ kịp thời cho khách.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="staff-header-details rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#77736E]">
          {language === 'EN' ? 'Live Service Queue' : 'Điều phối trực tiếp'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#403D39] hover:bg-[#F0EFEC] cursor-pointer"
          title={st("Refresh room service orders")}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? st("Loading...") : st("Refresh")}</span>
        </button>
      </div>
    </StaffPageHeader>

    {/* KPI Cards */}
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label={st("Pending Orders") || "Chờ tiếp nhận"}
        value={tabCounts.Pending}
        active={filter === 'Pending'}
        onClick={() => setFilter('Pending')}
      />
      <KpiCard
        label={st("In Progress") || "Đang xử lý"}
        value={tabCounts.InProgress}
        active={filter === 'InProgress'}
        onClick={() => setFilter('InProgress')}
      />
      <KpiCard
        label={st("Completed Today") || "Hoàn thành hôm nay"}
        value={tabCounts.Completed}
        active={filter === 'Completed'}
        onClick={() => setFilter('Completed')}
      />
      <KpiCard
        label={st("Total Requests") || "Tổng yêu cầu"}
        value={tabCounts.All}
        active={filter === 'All'}
        onClick={() => setFilter('All')}
      />
    </section>
  </>
);

export const RoomServiceQueueToolbar = ({
  language,
  st,
  t,
  filter,
  setFilter,
  tabCounts,
}) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-[13px] font-semibold text-[#403D39]">
        {language === 'EN' ? 'Active Room Service Requests' : 'Danh sách Yêu cầu Dịch vụ Phòng'}
      </h3>
      <p className="text-[11px] text-[#77736E]">
        {st('Open requests first, oldest first. Updates every 15 seconds.')}
      </p>
    </div>
    <div className="staff-request-filters" role="group" aria-label={t('activeOrders')}>
      {[
        { key: 'All', label: st("All") || t('all') },
        { key: 'Pending', label: st("Pending") || t('pending') },
        { key: 'InProgress', label: st("In Progress") || t('inProgress') },
        { key: 'Completed', label: st("Completed") || t('completed') },
      ].map(({ key, label }) => {
        const count = tabCounts[key] || 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  </div>
);

export const RoomServiceOrderBody = ({
  order,
  displayItems,
  totalQty,
  isPending,
  isInProgress,
  isCompleted,
  st,
  language,
}) => (
  <>
    {displayItems.length > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 items-center">
          {displayItems.map(([name, q], idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 bg-[#FAF9F6] text-[#2B2927] border border-[#E2DFD9] px-2.5 py-1 rounded-lg text-[12px] font-bold"
            >
              <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded">
                {q}x
              </span>
              <span>{name}</span>
            </span>
          ))}
        </div>
        <span className="text-[11px] font-mono font-bold text-[#555]">x{totalQty}</span>
      </div>
    ) : (
      <h4 className="text-[14px] font-bold text-[#2B2927] break-words">
        {order.name || st("Room Service request")}
      </h4>
    )}

    <div className="mt-2 text-[12px] text-[#666] flex flex-wrap items-center gap-2 break-words">
      <span className="inline-flex items-center gap-1 font-medium text-[#3F3B38]">
        <User className="w-3.5 h-3.5 text-[#777]" />
        <span>{order.guest_name || order.guestName || st("Hotel guest")}</span>
      </span>
      <span
        className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium"
        title={st("Room extension")}
      >
        <Phone className="w-3 h-3 text-amber-600" />
        <span>{order.room_phone || order.roomPhone || `Ext ${order.room}`}</span>
      </span>
      {(order.guest_phone || order.guestPhone) && (
        <a
          href={`tel:${order.guest_phone || order.guestPhone}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer"
          title={st("Call the guest to confirm the order")}
        >
          <Phone className="w-3 h-3 text-emerald-600" />
          <span>{order.guest_phone || order.guestPhone}</span>
        </a>
      )}
      {order.assignedTo && (
        <span className="text-emerald-700 font-semibold">
          • {st("Assigned:")} {order.assignedTo}
        </span>
      )}
      <span className="text-[11px] text-[#888]">
        • {formatTimeAgo(order.created_at || order.orderedAt, st('Just now'), language)}
      </span>
    </div>

    <p className="mt-2 text-[12px] leading-relaxed text-[#444] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#EFECE6] break-words">
      {order.notes || st("No special notes")}
    </p>

    <div className="mt-2 flex justify-end sm:hidden">
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
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
  </>
);

export const RoomServiceOrderFooter = ({
  order,
  isPending,
  isInProgress,
  isCompleted,
  st,
  t,
  onOpenRejectModal,
  onAcceptOrder,
  onCompleteOrder,
}) => (
  <div className="mt-4 pt-3 border-t border-[#E9E5DC] flex flex-wrap items-center justify-between gap-3">
    <span className="text-[11px] text-[#777] flex items-center gap-1">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>
        {isPending
          ? (st("Awaiting acceptance") || "Chờ nhân viên tiếp nhận")
          : isInProgress
          ? (st("In progress") || "Đang xử lý yêu cầu")
          : (st("Completed") || "Đã hoàn thành")}
      </span>
    </span>

    <div className="flex items-center gap-2">
      {isPending && (
        <>
          <button
            type="button"
            onClick={() => onOpenRejectModal(order)}
            className="rounded-lg border border-[#DDD] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#555] hover:bg-[#F7F5F2] cursor-pointer"
          >
            {t('reject') || st("Reject") || "Từ chối"}
          </button>
          <button
            type="button"
            onClick={() => onAcceptOrder(order)}
            className="rounded-lg bg-[#262626] hover:bg-[#404040] px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer"
          >
            {st("Accept request") || "Tiếp nhận"}
          </button>
        </>
      )}

      {isInProgress && (
        <button
          type="button"
          onClick={() => onCompleteOrder(order)}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-[11px] font-bold text-white cursor-pointer inline-flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{st("Complete") || "Hoàn thành"}</span>
        </button>
      )}

      {isCompleted && (
        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{st("Completed") || "Đã hoàn tất"}</span>
        </span>
      )}
    </div>
  </div>
);

export const RoomServiceFleetSidebar = ({ deliveryFleet, language, st }) => (
  <aside className="min-w-0 space-y-4">
    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD]">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39] flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-[#555]" />
          <span>{language === 'EN' ? 'Delivery Robot Units' : 'Đội Robot Giao Phòng'}</span>
        </h3>
        <span className="text-[10px] text-[#777] font-semibold">
          {(deliveryFleet || []).length} {language === 'EN' ? 'units' : 'thiết bị'}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {(deliveryFleet || []).map((unit) => {
          const statusLower = String(unit.status || '').toLowerCase();
          const dotClass =
            statusLower === 'available'
              ? 'bg-emerald-500'
              : statusLower === 'delivering'
              ? 'bg-sky-500'
              : 'bg-amber-500';

          return (
            <div
              key={unit.id || unit.name}
              className="flex items-center justify-between text-[11px] py-1.5 border-b border-[#E1DEDA] last:border-0"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#333] break-words">{unit.name}</p>
                <p className="text-[10px] text-[#777]">
                  {unit.location} {unit.battery != null ? `• ${unit.battery}%` : ''}
                </p>
              </div>
              <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-[#666]">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {st(unit.status)}
              </span>
            </div>
          );
        })}
      </div>
    </section>

    <section className="rounded-xl bg-white p-4 border border-[#BFBFBD] space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#403D39]">
        {language === 'EN' ? 'Room Service Workflow' : 'Quy Chuẩn Phục Vụ Buồng Phòng'}
      </h3>
      <div className="space-y-2.5 text-[11px] text-[#555]">
        <div className="p-2.5 rounded-lg bg-sky-50/60 border border-sky-100">
          <p className="font-bold text-sky-900">
            {language === 'EN' ? '1. Accept Room Request' : '1. Tiếp nhận yêu cầu phòng'}
          </p>
          <p className="mt-0.5 text-sky-800/90">
            {language === 'EN'
              ? 'Receive room amenity or housekeeping requests from Kiosk -> Prepare items at pantry.'
              : 'Nhận yêu cầu khăn, gối, dọn phòng từ Kiosk -> Chuẩn bị vật dụng đúng tiêu chuẩn.'}
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
          <p className="font-bold text-emerald-900">
            {language === 'EN' ? '2. Deliver & Complete' : '2. Giao phòng & Hoàn tất'}
          </p>
          <p className="mt-0.5 text-emerald-800/90">
            {language === 'EN'
              ? 'Coordinate delivery to the guest room (direct staff or HCRobot) -> Mark completed.'
              : 'Giao vật dụng lên đúng số phòng khách (nhân viên hoặc Robot) -> Xác nhận hoàn thành.'}
          </p>
        </div>
      </div>
    </section>
  </aside>
);
