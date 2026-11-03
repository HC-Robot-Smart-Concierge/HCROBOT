import React, { useEffect, useMemo, useState } from 'react';
import {
  ChefHat,
  Flame,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Sparkles,
  MapPin,
  Coffee,
  Check,
  Timer,
  Bell,
  Eye,
  SlidersHorizontal,
  Phone,
  PhoneCall,
  User,
  Truck,
} from 'lucide-react';
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
    guestName: order.guest_name || order.guestName || initialOrder.guestName || 'Khách lưu trú',
    guestPhone: order.guest_phone || order.guestPhone || initialOrder.guestPhone || '',
    roomPhone: order.room_phone || order.roomPhone || initialOrder.roomPhone || '',
    imageUrl: order.image_url || order.imageUrl || initialOrder.imageUrl,
    isServiceRequest:
      order.is_service_request ?? order.isServiceRequest ?? initialOrder.isServiceRequest ?? false,
    estCompletion: order.est_completion || order.estCompletion || initialOrder.estCompletion || '15 mins',
    assignedTo: order.assigned_staff_name || order.assignedTo,
    orderedAt: order.orderedAt || initialOrder.orderedAt || 'Vừa đặt',
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

const KpiCard = ({ label, value, detail, icon: Icon, badgeColor = 'bg-stone-100 text-stone-700' }) => {
  return (
    <article className="rounded-2xl bg-white p-4 md:p-5 border border-[#E8E5E0] shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#77726D]">{label}</span>
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${badgeColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[22px] font-black text-[#1A1917] tracking-tight">{value}</span>
        {detail && <span className="text-[11px] font-semibold text-[#888]">{detail}</span>}
      </div>
    </article>
  );
};

export const KitchenDashboard = ({ currentUser, onNotify = () => {} }) => {
  const { t, language } = useLanguage();
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
      const response = await fetchRoomServiceDashboard();
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
        const s = (order.status || '').toLowerCase();
        if (filterLower === 'pending') {
          return (
            s === 'pending' ||
            s === 'sent to kitchen' ||
            s === 'sent_to_kitchen' ||
            s === 'đã chuyển bếp' ||
            s === 'chờ tiếp nhận' ||
            s === 'unassigned'
          );
        }
        if (filterLower === 'cooking') {
          return s === 'cooking' || s === 'in preparation' || s === 'in progress';
        }
        if (filterLower === 'ready') {
          return s === 'ready' || s === 'món đã nấu xong' || s === 'sẵn sàng';
        }
        if (filterLower === 'delivering') {
          return s === 'delivering' || s === 'in transit' || s === 'đang giao';
        }
        if (filterLower === 'completed') {
          return s === 'completed' || s === 'delivered' || s === 'hoàn tất';
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

  // 5. Tu choi / Het nguyen lieu (Reject)
  const handleReject = async (order) => {
    try {
      updateOrderLocally(order.id, { status: 'Rejected' });
      await updateRoomServiceOrderStatus(order.rawId || order.id, { status: 'Rejected' });
      onNotify(`Bếp từ chối tiếp nhận đơn #${order.id}`);
    } catch (err) {
      onNotify(`Không thể từ chối đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
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

  // Tinh toan KPIs thuc te dua tren danh sach don Bep
  const pendingCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return (
      s === 'pending' ||
      s === 'sent to kitchen' ||
      s === 'sent_to_kitchen' ||
      s === 'đã chuyển bếp' ||
      s === 'chờ tiếp nhận' ||
      s === 'unassigned'
    );
  }).length;

  const cookingCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return s === 'cooking' || s === 'in preparation' || s === 'in progress';
  }).length;

  const readyCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return s === 'ready' || s === 'món đã nấu xong' || s === 'sẵn sàng';
  }).length;

  const deliveringCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return s === 'delivering' || s === 'in transit' || s === 'đang giao';
  }).length;

  const completedCount = kitchenScopedOrders.filter((o) => {
    const s = (o.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'delivered' || s === 'hoàn tất';
  }).length;

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#FCFAF7] font-sans">
      <div className="w-full max-w-[1240px] mx-auto px-4 md:px-8 pt-4 pb-12">
        {/* Header Bộ Phận Bếp */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EBE7DF]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <ChefHat className="w-5 h-5" />
              </div>
              <h1 className="text-[17px] md:text-[19px] font-black text-[#2C2926] tracking-tight">
                {language === 'EN' ? 'Kitchen Operations & Culinary Hub' : 'Bộ Phận Bếp & Chế Biến Ẩm Thực'}
              </h1>
            </div>
            <p className="mt-1 text-[12px] text-[#77726D]">
              {language === 'EN'
                ? 'Receive real-time order tickets from Room Service & Restaurant, manage cooking queue, and signal runners for delivery.'
                : 'Tiếp nhận vé gọi món thời gian thực từ Room Service & Nhà hàng, quản lý quy trình chế biến và bàn giao món cho nhân viên.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] text-stone-500 font-mono hidden md:inline">
              Cập nhật: {lastUpdated}
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Làm mới dữ liệu đơn bếp"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F2EFE9] border border-[#DDD8CE] text-xs font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
              <span>{isLoading ? 'Đang tải...' : 'Làm Mới'}</span>
            </button>
          </div>
        </header>

        {/* 4 Thẻ KPI Chuẩn Phòng Bếp */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={language === 'EN' ? 'Pending Orders' : 'Đơn Chờ Nấu'}
            value={pendingCount}
            detail={language === 'EN' ? 'transferred to kitchen' : 'chờ bếp nhận nấu'}
            icon={Clock}
            badgeColor="bg-amber-100 text-amber-800"
          />
          <KpiCard
            label={language === 'EN' ? 'Cooking Now' : 'Đang Chế Biến'}
            value={cookingCount}
            detail={language === 'EN' ? 'avg 12m prep' : 'TB ~12 phút'}
            icon={Flame}
            badgeColor="bg-orange-100 text-orange-800"
          />
          <KpiCard
            label={language === 'EN' ? 'Ready for Pickup' : 'Món Đã Nấu Xong'}
            value={readyCount}
            detail={language === 'EN' ? 'at pass counter' : 'chờ phục vụ lấy'}
            icon={CheckCircle2}
            badgeColor="bg-emerald-100 text-emerald-800"
          />
          <KpiCard
            label={language === 'EN' ? 'Completed Today' : 'Đã Hoàn Tất Hôm Nay'}
            value={completedCount}
            detail={language === 'EN' ? 'fulfilled orders' : 'đã xuất xưởng'}
            icon={UtensilsCrossed}
            badgeColor="bg-sky-100 text-sky-800"
          />
        </section>

        {/* Bố Cục 2 Cột (Trái: Danh Sách Vé Bếp KOT, Phải: Robot & Kho Nguyên Liệu) */}
        <section className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,2.15fr)_minmax(280px,0.9fr)] gap-6">
          {/* CỘT TRÁI: DANH SÁCH VÉ BẾP (KITCHEN ORDER TICKETS) */}
          <div className="min-w-0 space-y-4">
            {/* Thanh Tìm Kiếm & Bộ Lọc Trạng Thái */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E8E5E0]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'EN' ? 'Search room, ticket, dish...' : 'Tìm theo phòng, mã đơn, món...'}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DDD8] text-xs text-[#222] placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Tabs Trạng Thái */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                {[
                  { id: 'All', label: language === 'EN' ? 'All' : 'Tất Cả', count: kitchenScopedOrders.length },
                  { id: 'Pending', label: language === 'EN' ? 'To Cook' : 'Chờ Nấu', count: pendingCount },
                  { id: 'Cooking', label: language === 'EN' ? 'Cooking' : 'Đang Nấu', count: cookingCount },
                  { id: 'Ready', label: language === 'EN' ? 'Ready' : 'Món Đã Xong', count: readyCount },
                  { id: 'Delivering', label: language === 'EN' ? 'Delivering' : 'Đang Giao', count: deliveringCount },
                  { id: 'Completed', label: language === 'EN' ? 'Done' : 'Hoàn Tất', count: completedCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      filter === tab.id
                        ? 'bg-[#18181B] text-white shadow-xs'
                        : 'text-[#666] hover:bg-[#F0EEEA]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        filter === tab.id ? 'bg-stone-700 text-stone-200' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Danh Sách Vé Bếp */}
            <div className="space-y-3.5">
              {filteredOrders.length === 0 ? (
                <div className="rounded-2xl bg-white px-6 py-12 text-center border border-[#E8E5E0]">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-700">Không có đơn đặt món nào</h4>
                  <p className="mt-1 text-xs text-stone-500">
                    {searchQuery
                      ? 'Không tìm thấy đơn hàng nào khớp với từ khóa tìm kiếm.'
                      : 'Hàng đợi chế biến hiện đang trống. Bếp sẵn sàng nhận order mới!'}
                  </p>
                </div>
              ) : (
                paginatedOrders.map((order) => {
                  const normalizedStatus = (order.status || '').toLowerCase();
                  const isPending =
                    normalizedStatus === 'pending' ||
                    normalizedStatus === 'unassigned' ||
                    normalizedStatus === 'sent to kitchen' ||
                    normalizedStatus === 'sent_to_kitchen';
                  const isCooking =
                    normalizedStatus === 'cooking' ||
                    normalizedStatus === 'in preparation' ||
                    normalizedStatus === 'in progress';
                  const isReady =
                    normalizedStatus === 'ready' || normalizedStatus === 'món đã nấu xong';
                  const isDelivering =
                    normalizedStatus === 'delivering' || normalizedStatus === 'in transit';
                  const isCompleted =
                    normalizedStatus === 'completed' || normalizedStatus === 'delivered';

                  return (
                    <article
                      key={order.id}
                      className={`rounded-2xl bg-white p-4 md:p-5 border transition-all shadow-2xs hover:shadow-sm ${
                        isCooking
                          ? 'border-amber-300 ring-1 ring-amber-100'
                          : isReady
                          ? 'border-emerald-300 ring-1 ring-emerald-50'
                          : isPending
                          ? 'border-[#E0DDD8]'
                          : 'border-[#E8E5E0]'
                      }`}
                    >
                      {/* Top Header Vé Bếp */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#1A1917]">
                            #{order.id}
                          </span>
                          <span className="rounded-lg bg-stone-900 text-white px-2.5 py-0.5 text-xs font-black shadow-2xs">
                            Phòng {order.room || 'Khách'}
                          </span>
                          <span className="text-[11px] text-stone-500 font-medium">
                            • {order.orderedAt || 'Vừa đặt'}
                          </span>
                          {((order.note || '').includes('Gộp thêm') || order.is_merged) && (
                            <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold">
                              Đơn gộp món (Giao 1 chuyến)
                            </span>
                          )}
                        </div>

                        {/* Badge Trạng Thái */}
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isCooking
                              ? 'bg-orange-50 text-orange-800 border-orange-200'
                              : isReady
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isDelivering
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}
                        >
                          {isCooking && <Flame className="w-3 h-3 text-orange-600 animate-pulse" />}
                          {isReady && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPending
                            ? 'Chờ Bếp Nhận'
                            : isCooking
                            ? 'Bếp Đang Nấu'
                            : isReady
                            ? 'Đã Nấu Xong'
                            : isDelivering
                            ? 'Đang Giao'
                            : 'Đã Hoàn Tất'}
                        </span>
                      </div>

                      {/* Thong tin Khach & So may lien he truc tiep de nhan vien chu dong lien lac */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-100 text-[11px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-stone-900 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-stone-600" />
                            <span>{order.guestName || order.guest_name || 'Khách lưu trú'}</span>
                          </span>

                          {(order.guestPhone || order.guest_phone) && (
                            <a
                              href={`tel:${order.guestPhone || order.guest_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                              title="Bấm để gọi điện thoại trực tiếp cho khách"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>SĐT: {order.guestPhone || order.guest_phone}</span>
                            </a>
                          )}

                          <span
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-medium shadow-2xs"
                            title="Số máy nhánh điện thoại bàn trong phòng khách"
                          >
                            <PhoneCall className="w-3 h-3 text-amber-700" />
                            <span>{order.roomPhone || order.room_phone || (order.room ? `Ext ${order.room}` : 'Máy nhánh')}</span>
                          </span>
                        </div>

                        <span className="text-[10px] text-stone-400 font-medium">
                          Nhân viên liên lạc trực tiếp
                        </span>
                      </div>

                      {/* Chi Tiết Món Ăn Trong Đơn */}
                      <div className="mt-3.5 space-y-2">
                        {Array.isArray(order.items) && order.items.length > 0 ? (
                          order.items.map((it, idx) => {
                            const itemName = it.name || it.item_name || 'Món ăn';

                            return (
                              <div
                                key={idx}
                                className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-[#F0ECE6] bg-[#FAF8F5]"
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className="w-6 h-6 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 bg-amber-100 text-amber-900">
                                    {it.qty || it.quantity || 1}x
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-[#2C2926]">
                                      {itemName}
                                    </h4>
                                    {(it.notes || it.note) && (
                                      <p className="mt-0.5 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                                        Ghi chú: {it.notes || it.note}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F0ECE6] flex items-center justify-between">
                            <span className="text-xs font-bold text-[#2C2926]">
                              {order.name || 'Set Ăn Room Service & Đồ Uống'}
                            </span>
                            <span className="text-xs font-bold text-stone-600">
                              x{order.qty || 1}
                            </span>
                          </div>
                        )}

                        {/* Ghi Chú Tổng Cho Đầu Bếp */}
                        {(order.note || order.notes) && (
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Yêu cầu từ khách: </span>
                              <span>{order.note || order.notes}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tiến Độ & Thao Tác Đầu Bếp */}
                      <div className="mt-4 pt-3 border-t border-[#F0ECE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                          <Timer className="w-3.5 h-3.5 text-stone-400" />
                          <span>
                            {isPending
                              ? 'Chờ đầu bếp bấm nhận đơn để chuẩn bị nguyên liệu'
                              : isCooking
                              ? 'Thời gian ước tính: 15 phút'
                              : isReady
                              ? 'Món tại quầy Ra Đĩa - Sẵn sàng giao lên phòng'
                              : isDelivering
                              ? 'Đang vận chuyển giao món lên phòng khách'
                              : 'Đã hoàn tất chu đáo'}
                          </span>
                        </div>

                        {/* Các Nút Hành Động Trực Tiếp Cho Bếp */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* 1. Trạng thái Chờ Nấu -> Bắt Đầu Nấu */}
                          {isPending && !order.isServiceRequest && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReject(order)}
                                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
                              >
                                {t('reject') || 'Từ Chối'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartCooking(order)}
                                className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                              >
                                <Flame className="w-3.5 h-3.5" />
                                <span>Bắt Đầu Nấu</span>
                              </button>
                            </>
                          )}

                          {/* 2. Trạng thái Đang Nấu -> Nấu Xong */}
                          {isCooking && (
                            isOrderAssignedToMe(order) ? (
                              <button
                                type="button"
                                onClick={() => handleMarkReady(order)}
                                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Nấu Xong (Sẵn Sàng Giao)</span>
                              </button>
                            ) : (
                              <span
                                className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1.5 select-none"
                                title={`Đơn này do ${order.assignedTo || order.assigned_staff_name || 'đầu bếp khác'} nhận nấu.`}
                              >
                                <ChefHat className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>Đang nấu bởi: {order.assignedTo || order.assigned_staff_name || 'Đầu bếp khác'}</span>
                              </span>
                            )
                          )}

                          {/* 3. Trạng thái Đã Nấu Xong -> Bếp tự bấm Giao Phòng hoặc Hoàn Tất */}
                          {isReady && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartDelivery(order)}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                                title="Bấm khi bắt đầu mang món lên phòng khách"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Giao Lên Phòng</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCompleteOrder(order)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1 cursor-pointer shadow-xs transition-all"
                                title="Xác nhận khách đã nhận món"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã Giao Xong</span>
                              </button>
                            </div>
                          )}

                          {/* 4. Trạng thái Đang Giao -> Xác nhận đã giao */}
                          {isDelivering && (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(order)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Xác Nhận Đã Giao</span>
                            </button>
                          )}

                          {/* 5. Trạng thái Hoàn Tất */}
                          {isCompleted && (
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã Phục Vụ Xong</span>
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
            {!isLoading && filteredOrders.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="đơn"
                className="mt-3 rounded-2xl border border-[#E5E1D8] shadow-xs bg-white"
              />
            )}
          </div>

          {/* CỘT PHẢI: TỒN KHO NGUYÊN LIỆU & MENU BẾP */}
          <aside className="space-y-4">
            {/* 1. Cảnh Báo Nguyên Liệu Sắp Hết Trong Bếp (Low Stock Pantry Alerts) */}
            <article className="rounded-2xl bg-white p-4 md:p-5 border border-[#E8E5E0]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2C2926] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Cảnh Báo Tồn Kho Bếp</span>
                </h3>
                <span className="text-[10px] text-stone-500 font-bold">5 mục cần lưu ý</span>
              </div>

              <div className="mt-3.5 space-y-2">
                {data.lowStockAlerts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-[#F0ECE6] last:border-0"
                  >
                    <span className="font-medium text-stone-700">{item.name}</span>
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
            </article>

            {/* 3. Tình Trạng Mở Bán Nhanh Các Món Bếp (Menu Availability Toggle) */}
            <article className="rounded-2xl bg-white p-4 md:p-5 border border-[#E8E5E0]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2C2926] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-stone-600" />
                  <span>Trạng Thái Món Chính</span>
                </h3>
                <span className="text-[10px] text-stone-400">Bếp trưởng</span>
              </div>

              <div className="space-y-2">
                {quickDishes.map((dish) => (
                  <div
                    key={dish.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#FAF8F5] border border-[#F0ECE6] text-xs"
                  >
                    <div>
                      <p className="font-bold text-stone-800 leading-tight">{dish.name}</p>
                      <p className="text-[10px] text-stone-400">{dish.category}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDishAvailability(dish.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                        dish.available
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                      }`}
                    >
                      {dish.available ? 'Còn Món' : 'Tạm Hết'}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
};
