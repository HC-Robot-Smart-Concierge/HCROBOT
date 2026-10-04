import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Calendar,
  Users,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  ChefHat,
  Search,
  Filter,
  DollarSign,
  Coffee,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import {
  fetchRestaurantDashboard,
  fetchRestaurantReservations,
  createRestaurantReservation,
  updateReservationStatus,
  fetchRestaurantPreOrders,
  createRestaurantPreOrder,
  fetchRestaurantMenus,
  createRestaurantMenu,
  fetchRestaurantMenuItems,
  createRestaurantMenuItem,
  fetchRestaurantFoodItems,
  createRestaurantFoodItem,
  assignFoodItemToMenu,
  removeFoodItemFromMenu,
} from '../../services/restaurantApi';

export const RestaurantDashboard = ({ currentUser, onNotify = () => {} }) => {
  const [activeTab, setActiveTab] = useState('reservations'); // 'reservations' | 'preorders' | 'menus'
  const [menuSubTab, setMenuSubTab] = useState('menu_items'); // 'menu_items' | 'master_catalog'
  const [selectedMenuFilter, setSelectedMenuFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [kpis, setKpis] = useState({
    totalReservations: 0,
    totalPreOrders: 0,
    seatedGuests: 0,
    pendingPreOrders: 0,
  });

  const [reservations, setReservations] = useState([]);
  const [preOrders, setPreOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [foodItems, setFoodItems] = useState([]);

  // Modals state
  const [isResModalOpen, setIsResModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);

  // Form states
  const [resForm, setResForm] = useState({
    guest_name: '',
    room_number: '',
    party_size: 2,
    reservation_time: '',
    table_number: '',
    special_note: '',
  });

  const [itemMode, setItemMode] = useState('existing'); // 'existing' | 'new'
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [itemForm, setItemForm] = useState({
    menu_id: '',
    name: '',
    price: 150000,
    currency: 'VND',
    category: 'Món chính',
    prep_time_minutes: 15,
    description: '',
    is_available: true,
  });

  const [foodForm, setFoodForm] = useState({
    name: '',
    category: 'Món chính',
    base_price: 150000,
    currency: 'VND',
    prep_time_minutes: 15,
    description: '',
    image_url: '',
    is_available: true,
  });

  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'A La Carte',
    description: '',
    is_active: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dashData, resData, preData, menuData, itemData, foodsData] = await Promise.all([
        fetchRestaurantDashboard(),
        fetchRestaurantReservations(),
        fetchRestaurantPreOrders(),
        fetchRestaurantMenus(),
        fetchRestaurantMenuItems(),
        fetchRestaurantFoodItems(),
      ]);

      if (dashData?.kpis) {
        setKpis(dashData.kpis);
      }
      setReservations(Array.isArray(resData) ? resData : []);
      setPreOrders(Array.isArray(preData) ? preData : []);
      setMenus(Array.isArray(menuData) ? menuData : []);
      setMenuItems(Array.isArray(itemData) ? itemData : []);
      setFoodItems(Array.isArray(foodsData) ? foodsData : []);
      
      // Auto select first menu for itemForm if available
      if (Array.isArray(menuData) && menuData.length > 0 && !itemForm.menu_id) {
        setItemForm((prev) => ({ ...prev, menu_id: menuData[0].id }));
      }
    } catch (err) {
      console.error('[RestaurantDashboard] Load data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!resForm.guest_name.trim()) {
      onNotify('Vui lòng nhập tên khách hàng');
      return;
    }
    const result = await createRestaurantReservation(resForm);
    if (result) {
      onNotify(`Đã đặt bàn thành công mã: ${result.reservation_code || result.id}`);
      setIsResModalOpen(false);
      setResForm({
        guest_name: '',
        room_number: '',
        party_size: 2,
        reservation_time: '',
        table_number: '',
        special_note: '',
      });
      loadData();
    }
  };

  const handleStatusChange = async (resId, newStatus) => {
    const updated = await updateReservationStatus(resId, newStatus);
    if (updated) {
      onNotify(`Cập nhật trạng thái bàn sang: ${newStatus}`);
      setReservations((prev) =>
        prev.map((r) => (r.id === resId ? { ...r, status: newStatus } : r))
      );
    }
  };

  const handleCreateMenuItem = async (e) => {
    e.preventDefault();
    if (!itemForm.menu_id) {
      onNotify('Vui lòng chọn thực đơn trước');
      return;
    }

    if (itemMode === 'existing') {
      if (!selectedFoodId) {
        onNotify('Vui lòng chọn món ăn từ danh mục gốc');
        return;
      }
      const result = await assignFoodItemToMenu(itemForm.menu_id, {
        food_item_id: selectedFoodId,
        price: itemForm.price,
      });
      if (result) {
        onNotify(`Đã gán món vào thực đơn thành công`);
        setIsItemModalOpen(false);
        setSelectedFoodId('');
        loadData();
      }
    } else {
      if (!itemForm.name.trim()) {
        onNotify('Vui lòng nhập tên món ăn');
        return;
      }
      const result = await createRestaurantMenuItem(itemForm);
      if (result) {
        onNotify(`Đã thêm món ăn: ${result.name}`);
        setIsItemModalOpen(false);
        setItemForm({
          menu_id: menus[0]?.id || '',
          name: '',
          price: 150000,
          currency: 'VND',
          category: 'Món chính',
          prep_time_minutes: 15,
          description: '',
          is_available: true,
        });
        loadData();
      }
    }
  };

  const handleCreateFoodItem = async (e) => {
    e.preventDefault();
    if (!foodForm.name.trim()) {
      onNotify('Vui lòng nhập tên món ăn');
      return;
    }
    const result = await createRestaurantFoodItem(foodForm);
    if (result) {
      onNotify(`Đã thêm món mới vào Kho Gốc: ${result.name}`);
      setIsFoodModalOpen(false);
      setFoodForm({
        name: '',
        category: 'Món chính',
        base_price: 150000,
        currency: 'VND',
        prep_time_minutes: 15,
        description: '',
        image_url: '',
        is_available: true,
      });
      loadData();
    }
  };

  const handleRemoveFromMenu = async (menuId, menuItemId) => {
    if (!window.confirm('Bạn có chắc muốn gỡ món này khỏi thực đơn không? (Món trong kho gốc vẫn được giữ nguyên)')) {
      return;
    }
    const result = await removeFoodItemFromMenu(menuId, menuItemId);
    if (result) {
      onNotify('Đã gỡ món khỏi thực đơn');
      loadData();
    }
  };

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    if (!menuForm.name.trim()) {
      onNotify('Vui lòng nhập tên thực đơn');
      return;
    }
    const result = await createRestaurantMenu(menuForm);
    if (result) {
      onNotify(`Đã tạo thực đơn: ${result.name}`);
      setIsMenuModalOpen(false);
      setMenuForm({
        name: '',
        category: 'A La Carte',
        description: '',
        is_active: true,
      });
      loadData();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-palette-cream">
      {/* Top Header & Metrics Bar */}
      <div className="bg-white border-b border-palette-silver px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-palette-charcoal flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-palette-charcoal" />
              Bộ phận Nhà hàng & Đặt bàn (Restaurant Operations)
            </h1>
            <p className="text-xs text-palette-slate mt-0.5">
              Quản lý đặt bàn ăn trước, điều phối phục vụ và thực đơn ẩm thực khách sạn
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-palette-stone text-palette-charcoal hover:bg-palette-silver border border-palette-silver text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              onClick={() => setIsResModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Đặt bàn mới
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
            <div className="text-[11px] font-semibold text-palette-slate">Tổng đặt bàn</div>
            <div className="text-xl font-bold text-palette-charcoal mt-1">
              {reservations.length || kpis.totalReservations}
            </div>
          </div>
          <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
            <div className="text-[11px] font-semibold text-palette-slate">Khách đang ngồi</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {reservations.filter((r) => r.status === 'Seated').length || kpis.seatedGuests}
            </div>
          </div>
          <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
            <div className="text-[11px] font-semibold text-palette-slate">Món gọi trước</div>
            <div className="text-xl font-bold text-palette-charcoal mt-1">
              {preOrders.length || kpis.totalPreOrders}
            </div>
          </div>
          <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3">
            <div className="text-[11px] font-semibold text-palette-slate">Món trong Menu</div>
            <div className="text-xl font-bold text-palette-charcoal mt-1">
              {menuItems.length}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 border-t border-palette-silver/50 pt-3">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reservations'
                ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
            }`}
          >
            Danh sách Đặt bàn ({reservations.length})
          </button>
          <button
            onClick={() => setActiveTab('preorders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'preorders'
                ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
            }`}
          >
            Món gọi trước ({preOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('menus')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'menus'
                ? 'bg-palette-charcoal text-palette-cream shadow-sm'
                : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
            }`}
          >
            Thực đơn & Món ăn ({menuItems.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: RESERVATIONS */}
        {activeTab === 'reservations' && (
          <div className="bg-white rounded-xl border border-palette-silver overflow-hidden shadow-sm">
            <div className="p-4 border-b border-palette-silver/50 flex items-center justify-between">
              <span className="text-xs font-bold text-palette-charcoal">Lịch Đặt Bàn Nhà Hàng</span>
            </div>

            {reservations.length === 0 ? (
              <div className="p-8 text-center text-xs text-palette-slate">
                Chưa có yêu cầu đặt bàn nào trong hệ thống.
              </div>
            ) : (
              <div className="divide-y divide-palette-silver/30">
                {reservations.map((res) => (
                  <div key={res.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-palette-cream/40 transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                          {res.reservation_code || res.id}
                        </span>
                        <span className="text-xs font-bold text-palette-charcoal">
                          {res.guest_name}
                        </span>
                        {res.room_number && (
                          <span className="text-[11px] text-palette-slate">
                            (Phòng {res.room_number})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-palette-slate mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {res.party_size} khách
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {res.reservation_time || 'Chưa định giờ'}
                        </span>
                        <span>Bàn: {res.table_number || 'Sắp xếp khi đến'}</span>
                      </div>
                      {res.special_note && (
                        <div className="text-[11px] text-palette-charcoal bg-palette-stone/70 border border-palette-silver rounded px-2 py-0.5 mt-1.5 inline-block">
                          Ghi chú: {res.special_note}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          res.status === 'Confirmed'
                            ? 'bg-palette-stone text-palette-charcoal border border-palette-silver'
                            : res.status === 'Seated'
                            ? 'bg-emerald-100 text-emerald-800'
                            : res.status === 'Completed'
                            ? 'bg-palette-stone text-palette-slate'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {res.status}
                      </span>
                      {res.status === 'Confirmed' && (
                        <button
                          onClick={() => handleStatusChange(res.id, 'Seated')}
                          className="px-2.5 py-1 text-[11px] font-bold rounded bg-palette-charcoal hover:bg-neutral-800 text-palette-cream transition-all shadow-sm"
                        >
                          Xếp bàn
                        </button>
                      )}
                      {res.status === 'Seated' && (
                        <button
                          onClick={() => handleStatusChange(res.id, 'Completed')}
                          className="px-2.5 py-1 text-[11px] font-bold rounded bg-neutral-700 hover:bg-neutral-800 text-white transition-all shadow-sm"
                        >
                          Hoàn tất
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PRE-ORDERS */}
        {activeTab === 'preorders' && (
          <div className="bg-white rounded-xl border border-palette-silver overflow-hidden shadow-sm">
            <div className="p-4 border-b border-palette-silver/50">
              <span className="text-xs font-bold text-palette-charcoal">Danh Sách Món Gọi Trước</span>
            </div>

            {preOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-palette-slate">
                Chưa có đơn gọi món trước nào.
              </div>
            ) : (
              <div className="divide-y divide-palette-silver/30">
                {preOrders.map((order) => (
                  <div key={order.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-palette-cream/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                          {order.order_code || order.id}
                        </span>
                        <span className="text-xs font-bold text-palette-charcoal">{order.guest_name}</span>
                        {order.room_number && (
                          <span className="text-[11px] text-palette-slate">(Phòng {order.room_number})</span>
                        )}
                      </div>
                      <div className="text-xs text-palette-slate mt-1">
                        Tổng cộng:{' '}
                        <span className="font-bold text-palette-charcoal">
                          {order.total_price?.toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-palette-stone text-palette-charcoal border border-palette-silver">
                      {order.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MENUS & ITEMS (DIAGRAM 2 ARCHITECTURE) */}
        {activeTab === 'menus' && (
          <div className="space-y-4">
            {/* Sub-tab switcher & Action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-palette-silver shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMenuSubTab('menu_items')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    menuSubTab === 'menu_items'
                      ? 'bg-palette-charcoal text-palette-cream shadow-xs'
                      : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
                  }`}
                >
                  Theo Thực Đơn ({menuItems.length})
                </button>
                <button
                  onClick={() => setMenuSubTab('master_catalog')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    menuSubTab === 'master_catalog'
                      ? 'bg-palette-charcoal text-palette-cream shadow-xs'
                      : 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Kho Món Gốc ({foodItems.length} món)
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {menuSubTab === 'menu_items' && (
                  <select
                    value={selectedMenuFilter}
                    onChange={(e) => setSelectedMenuFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-palette-silver text-xs bg-white text-palette-charcoal outline-none font-medium"
                  >
                    <option value="ALL">Tất cả thực đơn ({menuItems.length})</option>
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setIsMenuModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-palette-silver hover:bg-palette-stone text-palette-charcoal text-xs font-semibold transition-all"
                >
                  Tạo thực đơn
                </button>
                {menuSubTab === 'master_catalog' ? (
                  <button
                    onClick={() => setIsFoodModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold transition-all shadow-sm flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm món vào Kho Gốc
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setItemMode('existing');
                      if (foodItems.length > 0) setSelectedFoodId(foodItems[0].id);
                      setIsItemModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold transition-all shadow-sm flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm món vào Menu
                  </button>
                )}
              </div>
            </div>

            {/* SUB-VIEW 1: THEO THỰC ĐƠN (MENU ITEMS) */}
            {menuSubTab === 'menu_items' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {menuItems
                  .filter((item) => selectedMenuFilter === 'ALL' || item.menu_id === selectedMenuFilter)
                  .map((item) => {
                    const parentMenu = menus.find((m) => m.id === item.menu_id);
                    return (
                      <div key={item.id} className="bg-white rounded-xl border border-palette-silver p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                                {item.category || item.food_item?.category || 'Món ăn'}
                              </span>
                              {parentMenu && (
                                <span className="text-[10px] font-medium text-palette-slate bg-palette-stone/60 border border-palette-silver/60 px-1.5 py-0.5 rounded truncate max-w-[130px]">
                                  {parentMenu.name}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-1 rounded shrink-0">
                              {item.price?.toLocaleString('vi-VN')} {item.currency || 'VND'}
                            </span>
                          </div>
                          <h3 className="font-bold text-palette-charcoal text-sm mt-2">{item.name || item.food_item?.name}</h3>
                          <p className="text-xs text-palette-slate mt-0.5 line-clamp-2">{item.description || item.food_item?.description}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-palette-silver/50 flex items-center justify-between text-[11px] text-palette-slate">
                          <span>Chuẩn bị: {item.prep_time_minutes || item.food_item?.prep_time_minutes || 15} phút</span>
                          <div className="flex items-center gap-2">
                            <span className={item.is_available ? 'text-emerald-600 font-semibold' : 'text-palette-slate'}>
                              {item.is_available ? 'Đang phục vụ' : 'Hết món'}
                            </span>
                            <button
                              onClick={() => handleRemoveFromMenu(item.menu_id, item.id)}
                              className="text-[10px] text-red-500 hover:text-red-700 hover:underline transition-all"
                              title="Gỡ món khỏi thực đơn này"
                            >
                              Gỡ
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* SUB-VIEW 2: KHO MÓN ĂN GỐC (MASTER FOOD CATALOG) */}
            {menuSubTab === 'master_catalog' && (
              <div className="space-y-3">
                <div className="bg-palette-stone/40 border border-palette-silver rounded-xl p-3 flex items-center justify-between text-xs text-palette-slate">
                  <span>
                    💡 <strong>Kho Món Gốc (Master Catalog):</strong> Quản lý toàn bộ {foodItems.length} món ăn & thức uống của khách sạn. Bạn có thể gán bất kỳ món nào vào nhiều thực đơn với giá bán riêng biệt.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {foodItems.map((food) => (
                    <div key={food.id} className="bg-white rounded-xl border border-palette-silver p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                            {food.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-1 rounded">
                            Giá gốc: {food.base_price?.toLocaleString('vi-VN')} {food.currency}
                          </span>
                        </div>
                        <h3 className="font-bold text-palette-charcoal text-sm mt-2">{food.name}</h3>
                        <p className="text-xs text-palette-slate mt-0.5 line-clamp-2">{food.description || 'Chưa có mô tả chi tiết'}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-palette-silver/50 flex items-center justify-between text-[11px]">
                        <span className="text-palette-slate">Bếp chuẩn bị: {food.prep_time_minutes}p</span>
                        <button
                          onClick={() => {
                            setItemMode('existing');
                            setSelectedFoodId(food.id);
                            setItemForm((prev) => ({ ...prev, price: food.base_price }));
                            setIsItemModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-palette-stone hover:bg-palette-silver text-palette-charcoal text-[11px] font-semibold border border-palette-silver transition-all"
                        >
                          + Gán vào thực đơn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: ĐẶT BÀN MỚI */}
      {isResModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Đặt Bàn Mới Tại Nhà Hàng</h2>
            <form onSubmit={handleCreateReservation} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên khách hàng *</label>
                <input
                  type="text"
                  required
                  value={resForm.guest_name}
                  onChange={(e) => setResForm({ ...resForm, guest_name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Nguyễn Văn A"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số phòng</label>
                  <input
                    type="text"
                    value={resForm.room_number}
                    onChange={(e) => setResForm({ ...resForm, room_number: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 402"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Số người</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={resForm.party_size}
                    onChange={(e) => setResForm({ ...resForm, party_size: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Thời gian đặt</label>
                  <input
                    type="text"
                    value={resForm.reservation_time}
                    onChange={(e) => setResForm({ ...resForm, reservation_time: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: 19:30 Tối nay"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Bàn số (tuỳ chọn)</label>
                  <input
                    type="text"
                    value={resForm.table_number}
                    onChange={(e) => setResForm({ ...resForm, table_number: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                    placeholder="Vd: Bàn 08"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Ghi chú đặc biệt</label>
                <textarea
                  rows="2"
                  value={resForm.special_note}
                  onChange={(e) => setResForm({ ...resForm, special_note: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Ghế gần cửa sổ, ăn chay..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsResModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Xác nhận đặt bàn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM MÓN VÀO THỰC ĐƠN (MENU ITEM - DIAGRAM 2) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-3">Thêm Món Vào Thực Đơn</h2>
            
            {/* Mode switcher: Chọn từ kho món gốc vs Tạo món mới */}
            <div className="flex items-center gap-2 p-1 bg-palette-stone rounded-lg mb-3">
              <button
                type="button"
                onClick={() => setItemMode('existing')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                  itemMode === 'existing' ? 'bg-white text-palette-charcoal shadow-xs' : 'text-palette-slate'
                }`}
              >
                Chọn từ Kho Món Gốc
              </button>
              <button
                type="button"
                onClick={() => setItemMode('new')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                  itemMode === 'new' ? 'bg-white text-palette-charcoal shadow-xs' : 'text-palette-slate'
                }`}
              >
                Tạo món mới
              </button>
            </div>

            <form onSubmit={handleCreateMenuItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Chọn Thực đơn đích *</label>
                <select
                  required
                  value={itemForm.menu_id}
                  onChange={(e) => setItemForm({ ...itemForm, menu_id: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white font-medium"
                >
                  <option value="">-- Chọn thực đơn --</option>
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              {itemMode === 'existing' ? (
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Chọn món từ Kho Món Gốc *</label>
                  <select
                    required
                    value={selectedFoodId}
                    onChange={(e) => {
                      const fId = e.target.value;
                      setSelectedFoodId(fId);
                      const f = foodItems.find((x) => x.id === fId);
                      if (f) setItemForm((prev) => ({ ...prev, price: f.base_price }));
                    }}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white font-medium"
                  >
                    <option value="">-- Chọn món ăn --</option>
                    {foodItems.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} - [{f.category}] - Giá gốc: {f.base_price?.toLocaleString('vi-VN')} {f.currency}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-palette-charcoal">Tên món mới *</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                      placeholder="Vd: Bò Wagyu Nướng"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-palette-charcoal">Phân loại món</label>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                    >
                      <option value="Món chính">Món chính</option>
                      <option value="Khai vị">Khai vị</option>
                      <option value="Tráng miệng">Tráng miệng</option>
                      <option value="Đồ uống">Đồ uống</option>
                      <option value="Ăn nhẹ">Ăn nhẹ</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Đơn giá bán tại thực đơn này (VND)</label>
                <input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  {itemMode === 'existing' ? 'Gán vào thực đơn' : 'Tạo và thêm món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM MÓN VÀO KHO GỐC (MASTER FOOD ITEM) */}
      {isFoodModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-1">Thêm Món Ăn Vào Kho Gốc</h2>
            <p className="text-xs text-palette-slate mb-4">Món ăn này sẽ được lưu vào danh mục toàn khách sạn (Master Catalog)</p>
            <form onSubmit={handleCreateFoodItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên món ăn *</label>
                <input
                  type="text"
                  required
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Phở Gà Thang Long"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Giá niêm yết gốc (VND)</label>
                  <input
                    type="number"
                    value={foodForm.base_price}
                    onChange={(e) => setFoodForm({ ...foodForm, base_price: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Phân loại món</label>
                  <select
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Khai vị">Khai vị</option>
                    <option value="Tráng miệng">Tráng miệng</option>
                    <option value="Đồ uống">Đồ uống</option>
                    <option value="Ăn nhẹ">Ăn nhẹ</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Thời gian bếp chuẩn bị (phút)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={foodForm.prep_time_minutes}
                  onChange={(e) => setFoodForm({ ...foodForm, prep_time_minutes: parseInt(e.target.value) || 15 })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Mô tả nguyên liệu / hương vị</label>
                <textarea
                  rows="2"
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Thành phần, vị giác hoặc lưu ý dị ứng..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsFoodModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Lưu vào Kho Gốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TẠO THỰC ĐƠN */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Tạo Thực Đơn Mới</h2>
            <form onSubmit={handleCreateMenu} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên thực đơn *</label>
                <input
                  type="text"
                  required
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Thực đơn Bữa Tối Lãng Mạn"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Phân loại thực đơn</label>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                >
                  <option value="Food">Đồ ăn (Food)</option>
                  <option value="Beverage">Đồ uống (Beverage)</option>
                  <option value="Dessert">Tráng miệng (Dessert)</option>
                  <option value="Combo">Set Combo</option>
                  <option value="Room Service">Room Service</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Mô tả thực đơn</label>
                <textarea
                  rows="2"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Khung giờ phục vụ, đối tượng..."
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-palette-silver/50">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-palette-slate hover:text-palette-charcoal hover:bg-palette-stone rounded-lg font-semibold transition-all"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-palette-charcoal hover:bg-neutral-800 text-palette-cream rounded-lg font-semibold transition-all shadow-sm"
                >
                  Lưu thực đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
