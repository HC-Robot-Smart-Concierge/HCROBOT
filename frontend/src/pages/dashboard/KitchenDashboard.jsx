import React, { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, RefreshCw } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { RejectReasonModal } from '../../components/dashboard/RejectReasonModal';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import {
  fetchRoomServiceDashboard,
  updateRoomServiceOrderStatus,
} from '../../services/operationsApi';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText } from '../../context/StaffLanguage';

import {
  normalizeOrder,
  normalizeFleet,
  matchesOrder,
  KitchenKpiGrid,
  KitchenOrdersToolbar,
  KitchenOrderTicketCard,
  KitchenRightSidebar,
} from './KitchenDashboardParts';

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

  const applyOrderTransition = async (order, status, progress, estCompletion, message) => {
    try {
      updateOrderLocally(order.id, { status, progress, estCompletion, assignedTo: staffName });
      await updateRoomServiceOrderStatus(order.rawId || order.id, {
        status,
        progress,
        est_completion: estCompletion,
        assigned_staff_name: staffName,
      });
      onNotify(message);
    } catch (err) {
      onNotify(`Không thể cập nhật đơn #${order.id}: ${err?.message || 'Lỗi mạng'}`);
    }
  };

  const handleStartCooking = (order) =>
    applyOrderTransition(order, 'Cooking', 50, '15 mins', `Bếp đã tiếp nhận đơn #${order.id} và bắt đầu chế biến!`);

  const handleMarkReady = (order) =>
    applyOrderTransition(order, 'Ready', 75, 'Đã nấu xong', `Món ăn đơn #${order.id} đã hoàn tất, sẵn sàng giao lên phòng!`);

  const handleStartDelivery = (order) =>
    applyOrderTransition(order, 'Delivering', 85, '5 mins', `Đang giao món đơn #${order.id} lên phòng ${order.room}!`);

  const handleCompleteOrder = (order) =>
    applyOrderTransition(order, 'Completed', 100, 'Hoàn tất', `Đã giao thành công món ăn đơn #${order.id} lên phòng ${order.room}!`);

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

        <KitchenKpiGrid
          language={language}
          filter={filter}
          setFilter={setFilter}
          pendingCount={pendingCount}
          inProgressCount={inProgressCount}
          completedCount={completedCount}
          totalCount={kitchenScopedOrders.length}
        />

        {/* 2-Column Layout matching Admin / Bellman / Maintenance */}
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          {/* Left Column: Kitchen Order Tickets */}
          <div className="min-w-0">
            <KitchenOrdersToolbar
              language={language}
              st={st}
              t={t}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filter={filter}
              setFilter={setFilter}
              totalCount={kitchenScopedOrders.length}
              pendingCount={pendingCount}
              inProgressCount={inProgressCount}
              completedCount={completedCount}
            />

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
                paginatedOrders.map((order) => (
                  <KitchenOrderTicketCard
                    key={order.id}
                    order={order}
                    t={t}
                    onOpenReject={handleOpenRejectModal}
                    onStartCooking={handleStartCooking}
                    onCompleteOrder={handleCompleteOrder}
                  />
                ))
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

          <KitchenRightSidebar
            lowStockAlerts={data.lowStockAlerts}
            quickDishes={quickDishes}
            toggleDishAvailability={toggleDishAvailability}
          />
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
