import React, { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Sparkles,
  Timer,
  SlidersHorizontal,
  Phone,
  PhoneCall,
  User,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { RejectReasonModal } from '../../components/dashboard/RejectReasonModal';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import {
  fetchRoomServiceDashboard,
  updateRoomServiceOrderStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText } from '../../context/StaffLanguage';
import { formatTimeAgo } from '../../utils/timeAgo';

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

const normalizeFleet = (unit) => ({
  ...unit,
  rawId: unit.id,
  id: unit.unit_code || unit.id,
  statusColor: unit.status_color || unit.statusColor,
  battery: unit.battery_level ?? unit.battery ?? 92,
});

const normalizeStock = (item) => ({
  ...item,
  count: item.count_label || item.count,
});

const matchesOrder = (order, orderId) => order.id === orderId || order.rawId === orderId;

const KpiCard = ({ label, value, detail, active = false, onClick }) => {
  return (
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
};

export const KitchenDashboard = ({ currentUser, onNotify = () => {} }) => {
  const { t, language } = useLanguage();
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Đầu Bếp Trực Ca';

  const isExecutive =
    currentUser?.department === 'Executive' ||
    String(currentUser?.username || '').toLowerCase() === 'admin' ||
    String(currentUser?.role || '').toLowerCase().includes('admin');

  // Kiểm tra đơn hàng có được phụ trách bởi chính người dùng hiện tại không
  const isOrderAssignedToMe = (order) => {
    if (isExecutive) return true;
    const assigned = order.assignedTo || order.assigned_staff_name;
    if (!assigned) return true;
    const assignedNorm = String(assigned).toLowerCase().trim();
    const staffNameNorm = String(staffName || '').toLowerCase().trim();
    const curNameNorm = String(currentUser?.name || '').toLowerCase().trim();
    const curFullNameNorm = String(currentUser?.full_name || '').toLowerCase().trim();
    const curUserNorm = String(currentUser?.username || '').toLowerCase().trim();

    return (
      assignedNorm === staffNameNorm ||
      (curNameNorm && assignedNorm === curNameNorm) ||
      (curFullNameNorm && assignedNorm === curFullNameNorm) ||
      (curUserNorm && assignedNorm === curUserNorm)
    );
  };

  const [data, setData] = useState({
    ...INITIAL_ROOM_SERVICE_DATA,
    orders: [],
    deliveryFleet: INITIAL_ROOM_SERVICE_DATA.deliveryFleet.map(normalizeFleet),
    lowStockAlerts: [
      { id: 's1', name: 'Bò Wagyu A5 (Thịt tươi)', count: 'Còn 2 phần', level: 'danger' },
      { id: 's2', name: 'Cá hồi Nauy Fillet', count: 'Còn 3 phần', level: 'danger' },
      { id: 's3', name: 'Dầu nấm Truffle đen', count: 'Còn 1 chai', level: 'warning' },
      { id: 's4', name: 'Trứng gà hữu cơ', count: 'Còn 12 quả', level: 'warning' },
      { id: 's5', name: 'Kem tươi Anchor Culinary', count: 'Còn 2 hộp', level: 'warning' },
    ],
  });

  const [filter, setFilter] = useState('All');
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  // Phân trang (Pagination) tương tự như bên RequestsPage (10 requests/vé mỗi trang)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Tự động trở về trang 1 khi thay đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Tình trạng mở bán nhanh các món bếp
  const [quickDishes, setQuickDishes] = useState([
    { id: 'd1', name: 'Bò Bít Tết Wagyu Sốt Tiêu', category: 'Món chính', available: true },
    { id: 'd2', name: 'Cá Hồi Áp Chảo Sốt Bơ Chanh', category: 'Món chính', available: true },
    { id: 'd3', name: 'Mì Ý Tôm Hùm Sốt Cà Cay', category: 'Món chính', available: true },
    { id: 'd4', name: 'Súp Nấm Truffle Khai Vị', category: 'Khai vị', available: false },
    { id: 'd5', name: 'Salad Caesar Lườn Gà', category: 'Khai vị', available: true },
  ]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetchRoomServiceDashboard({ is_service_request: false });
      if (response) {
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
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      // Keep existing data gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time WebSocket listener for instant Kitchen KDS updates
  useEffect(() => {
    const handleLiveEvent = () => {
      loadData();
    };

    window.addEventListener('app:task_status_updated', handleLiveEvent);
    window.addEventListener('app:order_created', handleLiveEvent);
    window.addEventListener('app:orders_cleared', handleLiveEvent);

    return () => {
      window.removeEventListener('app:task_status_updated', handleLiveEvent);
      window.removeEventListener('app:order_created', handleLiveEvent);
      window.removeEventListener('app:orders_cleared', handleLiveEvent);
    };
  }, []);

  // Bo phan Bep tiep nhan va truc tiep quan ly toan bo vong doi don mon an am thuc
  const kitchenScopedOrders = useMemo(() => {
    return (data.orders || []).filter((order) => !order.isServiceRequest);
  }, [data.orders]);

  // Loc va sap xep danh sach don che bien
  const filteredOrders = useMemo(() => {
    let list = kitchenScopedOrders;

    // Loc theo tu khoa tim kiem (so phong, ma don, ten mon, ten khach, sdt)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((order) => {
        const idMatch = String(order.id || '').toLowerCase().includes(q);
        const roomMatch = String(order.room || '').toLowerCase().includes(q);
        const nameMatch = String(order.name || '').toLowerCase().includes(q);
        const guestMatch = String(order.guestName || order.guest_name || '').toLowerCase().includes(q);
        const phoneMatch = String(order.guestPhone || order.guest_phone || '').toLowerCase().includes(q);
        const itemsMatch = Array.isArray(order.items)
          ? order.items.some((it) => String(it.name || '').toLowerCase().includes(q))
          : false;
        return idMatch || roomMatch || nameMatch || guestMatch || phoneMatch || itemsMatch;
      });
    }

    if (filter !== 'All') {
      const filterLower = filter.toLowerCase();
      list = list.filter((order) => {
        const s = (order.status || '').toLowerCase().trim();
        if (filterLower === 'pending') {
          return (
            s === 'pending' ||
            s === 'sent to kitchen' ||
            s === 'sent_to_kitchen' ||
            s === 'chờ tiếp nhận' ||
            s === 'unassigned'
          );
        }
        if (filterLower === 'inprogress' || filterLower === 'in progress' || filterLower === 'cooking' || filterLower === 'đang xử lý') {
          return (
            s === 'cooking' ||
            s === 'in preparation' ||
            s === 'in progress' ||
            s === 'in_progress' ||
            s === 'ready' ||
            s === 'delivering' ||
            s === 'đang nấu' ||
            s === 'đang chế biến' ||
            s === 'đang xử lý'
          );
        }
        if (filterLower === 'completed') {
          return s === 'completed' || s === 'delivered' || s === 'hoàn tất' || s === 'hoàn thành';
        }
        return s === filterLower;
      });
    }

    // Sap xep uu tien cho Bep truc ca:
    // 1. Cooking (Dang nau)
    // 2. Pending (Cho nau/moi nhan)
    // 3. Ready (Nau xong, can xuat giao nong hoi)
    // 4. Delivering (Dang tren duong giao phong)
    // 5. Completed / Done (Da hoan tat)
    return [...list].sort((a, b) => {
      const getCookingStatusRank = (order) => {
        const s = (order.status || '').toLowerCase().trim();
        if (s === 'cooking' || s === 'in preparation' || s === 'in progress') return 1;
        if (s === 'pending' || s === 'sent to kitchen' || s === 'sent_to_kitchen' || s === 'unassigned') return 2;
        if (s === 'ready' || s === 'món đã nấu xong' || s === 'sẵn sàng') return 3;
        if (s === 'delivering' || s === 'in transit' || s === 'đang giao') return 4;
        return 5;
      };

      return getCookingStatusRank(a) - getCookingStatusRank(b);
    });
  }, [kitchenScopedOrders, filter, searchQuery]);

  // Dam bao currentPage luon hop le khi loc danh sach
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Phan trang danh sach don hang
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const updateOrderLocally = (orderId, nextValues) => {
    setData((previous) => {
      return {
        ...previous,
        orders: previous.orders.map((order) =>
          matchesOrder(order, orderId) ? { ...order, ...nextValues } : order
        ),
      };
    });
  };

  // 1. Nhan don & Bat dau nau (Start Cooking)
  const handleStartCooking = async (order) => {
    try {
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
      onNotify(`Bếp đã tiếp nhận đơn #${order.id} và bắt đầu chế biến!`);
    } catch (err) {
      onNotify(`Không thể cập nhật đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  // 2. Nau xong - San sang lay mon (Mark Ready)
  const handleMarkReady = async (order) => {
    try {
      updateOrderLocally(order.id, {
        status: 'Ready',
        progress: 75,
        estCompletion: 'Đã nấu xong',
        assignedTo: staffName,
      });
      await updateRoomServiceOrderStatus(order.rawId || order.id, {
        status: 'Ready',
        progress: 75,
        est_completion: 'Đã nấu xong',
        assigned_staff_name: staffName,
      });
      onNotify(`Món ăn đơn #${order.id} đã hoàn tất, sẵn sàng giao lên phòng!`);
    } catch (err) {
      onNotify(`Không thể cập nhật đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  // 3. Bat dau giao mon len phong (Start Delivery)
  const handleStartDelivery = async (order) => {
    try {
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
      onNotify(`Đang giao món đơn #${order.id} lên phòng ${order.room}!`);
    } catch (err) {
      onNotify(`Không thể cập nhật đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  // 4. Xac nhan da giao thanh cong / Hoan tat (Complete Order)
  const handleCompleteOrder = async (order) => {
    try {
      updateOrderLocally(order.id, {
        status: 'Completed',
        progress: 100,
        estCompletion: 'Hoàn tất',
        assignedTo: staffName,
      });
      await updateRoomServiceOrderStatus(order.rawId || order.id, {
        status: 'Completed',
        progress: 100,
        est_completion: 'Hoàn tất',
        assigned_staff_name: staffName,
      });
      onNotify(`Đã giao thành công món ăn đơn #${order.id} lên phòng ${order.room}!`);
    } catch (err) {
      onNotify(`Không thể hoàn tất đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  // 5. Tu choi / Het nguyen lieu (Reject) voi ly do cu the
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
      onNotify(`Bếp từ chối tiếp nhận đơn #${targetOrder.id}: ${reason}`);
    } catch (err) {
      onNotify(`Không thể từ chối đơn #${targetOrder.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  // Toggle nhanh tình trạng món ăn của bếp
  const toggleDishAvailability = (dishId) => {
    setQuickDishes((prev) =>
      prev.map((d) => (d.id === dishId ? { ...d, available: !d.available } : d))
    );
    const dish = quickDishes.find((d) => d.id === dishId);
    if (dish) {
      onNotify(`Đã chuyển trạng thái món '${dish.name}': ${!dish.available ? 'Còn phục vụ' : 'Tạm ngưng phục vụ'}`);
    }
  };

  // Tinh toan KPIs thuc te dua tren 3 trang thai: Cho tiep nhan, Dang che bien, Hoan tat
  const pendingCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return (
      s === 'pending' ||
      s === 'sent to kitchen' ||
      s === 'sent_to_kitchen' ||
      s === 'chờ tiếp nhận' ||
      s === 'unassigned'
    );
  }).length;

  const inProgressCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return (
      s === 'cooking' ||
      s === 'in preparation' ||
      s === 'in progress' ||
      s === 'in_progress' ||
      s === 'ready' ||
      s === 'delivering' ||
      s === 'đang nấu' ||
      s === 'đang chế biến' ||
      s === 'đang xử lý'
    );
  }).length;

  const completedCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'delivered' || s === 'hoàn tất' || s === 'hoàn thành';
  }).length;

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1>{language === 'EN' ? 'Kitchen Operations' : 'Bộ Phận Bếp & Chế Biến Ẩm Thực'}</h1>
            <p>
              {language === 'EN'
                ? 'Receive real-time order tickets, manage prep queue and track kitchen stock.'
                : 'Tiếp nhận vé gọi món từ Room Service & Kiosk, quản lý quy trình chế biến và tồn kho bếp.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="staff-header-details rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#77736E]">
              {language === 'EN' ? 'Updated:' : 'Cập nhật:'} {lastUpdated}
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Làm mới dữ liệu đơn bếp"
              className="inline-flex items-center gap-1.5 rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#403D39] hover:bg-[#F0EFEC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? (language === 'EN' ? 'Loading...' : 'Đang tải...') : (language === 'EN' ? 'Refresh' : 'Làm Mới')}</span>
            </button>
          </div>
        </StaffPageHeader>

        {/* KPI Cards */}
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
            value={kitchenScopedOrders.length}
            detail={language === 'EN' ? 'all kitchen orders' : 'toàn bộ đơn ẩm thực'}
            active={filter === 'All'}
            onClick={() => setFilter('All')}
          />
        </section>

        {/* 2-Column Layout matching Admin / Bellman / Maintenance */}
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          {/* Left Column: Kitchen Order Tickets */}
          <div className="min-w-0">
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
                    { id: 'All', label: language === 'EN' ? 'All' : 'Tất Cả', count: kitchenScopedOrders.length },
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

            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl bg-white px-6 py-10 text-center text-[12px] text-[#777] border border-[#BFBFBD]">
                  <UtensilsCrossed className="w-6 h-6 text-[#A8A29E] mx-auto mb-2" />
                  <p className="font-semibold text-[#403D39]">Không có đơn đặt món nào</p>
                  <p className="mt-1 text-[11px] text-[#777]">
                    {searchQuery
                      ? 'Không tìm thấy đơn hàng nào khớp với từ khóa tìm kiếm.'
                      : 'Hàng đợi chế biến hiện đang trống. Bếp sẵn sàng nhận order mới.'}
                  </p>
                </div>
              ) : (
                paginatedOrders.map((order) => {
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
                          {isPending
                            ? 'Chờ Tiếp Nhận'
                            : isInProgress
                            ? 'Đang Chế Biến'
                            : 'Đã Hoàn Tất'}
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
                        {(() => {
                          const rawItems = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
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

                          if (groupedItems.length > 0) {
                            return groupedItems.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-[#EFECE6] bg-[#FAF9F6]"
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className="w-6 h-6 rounded font-mono text-[11px] font-bold flex items-center justify-center shrink-0 bg-[#EFECE6] text-[#262626]">
                                    {it.qty}x
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[12px] font-bold text-[#2B2927]">
                                      {it.name}
                                    </h4>
                                    {it.note && (
                                      <p className="mt-0.5 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                        Ghi chú: {it.note}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ));
                          }

                          return (
                            <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#EFECE6] flex items-center justify-between">
                              <span className="text-[12px] font-semibold text-[#2B2927]">
                                {order.name || 'Set Ăn Room Service & Đồ Uống'}
                              </span>
                              <span className="text-[12px] font-bold text-[#555]">
                                x{order.qty || 1}
                              </span>
                            </div>
                          );
                        })()}

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
                                onClick={() => handleOpenRejectModal(order)}
                                className="rounded-lg border border-[#DDD] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#555] hover:bg-[#F7F5F2] cursor-pointer"
                              >
                                {t('reject') || 'Từ Chối'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartCooking(order)}
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
                              onClick={() => handleCompleteOrder(order)}
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
                })
              )}
            </div>

            {!isLoading && filteredOrders.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="đơn"
                className="mt-3 rounded-xl border border-[#BFBFBD] bg-white"
              />
            )}
          </div>

          {/* Right Sidebar: Pantry Alerts & Main Dishes (300px matching Maintenance & Bellman) */}
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
                {data.lowStockAlerts.map((item) => (
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
        </section>
      </div>

      <RejectReasonModal
        isOpen={Boolean(rejectingOrder)}
        onClose={() => setRejectingOrder(null)}
        onConfirm={handleConfirmReject}
        order={rejectingOrder}
        department="kitchen"
      />
    </div>
  );
};
