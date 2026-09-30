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
} from '../../services/restaurantApi';

export const RestaurantDashboard = ({ currentUser, onNotify = () => {} }) => {
  const [activeTab, setActiveTab] = useState('reservations'); // 'reservations' | 'preorders' | 'menus'
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

  // Modals state
  const [isResModalOpen, setIsResModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  // Form states
  const [resForm, setResForm] = useState({
    guest_name: '',
    room_number: '',
    party_size: 2,
    reservation_time: '',
    table_number: '',
    special_note: '',
  });

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

  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'A La Carte',
    description: '',
    is_active: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dashData, resData, preData, menuData, itemData] = await Promise.all([
        fetchRestaurantDashboard(),
        fetchRestaurantReservations(),
        fetchRestaurantPreOrders(),
        fetchRestaurantMenus(),
        fetchRestaurantMenuItems(),
      ]);

      if (dashData?.kpis) {
        setKpis(dashData.kpis);
      }
      setReservations(Array.isArray(resData) ? resData : []);
      setPreOrders(Array.isArray(preData) ? preData : []);
      setMenus(Array.isArray(menuData) ? menuData : []);
      setMenuItems(Array.isArray(itemData) ? itemData : []);
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
    if (!itemForm.name.trim()) {
      onNotify('Vui lòng nhập tên món ăn');
      return;
    }
    const result = await createRestaurantMenuItem(itemForm);
    if (result) {
      onNotify(`Đã thêm món ăn: ${result.name}`);
      setIsItemModalOpen(false);
      setItemForm({
        menu_id: '',
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

        {/* TAB 3: MENUS & ITEMS */}
        {activeTab === 'menus' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-palette-charcoal">Món Ăn & Thực Đơn</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMenuModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-palette-silver hover:bg-palette-stone text-palette-charcoal text-xs font-semibold transition-all"
                >
                  Tạo thực đơn
                </button>
                <button
                  onClick={() => setIsItemModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-palette-charcoal hover:bg-neutral-800 text-palette-cream text-xs font-semibold transition-all shadow-sm"
                >
                  Thêm món mới
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-palette-silver p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-0.5 rounded">
                        {item.category || 'Món ăn'}
                      </span>
                      <h3 className="font-bold text-palette-charcoal text-sm mt-1">{item.name}</h3>
                      <p className="text-xs text-palette-slate mt-0.5 line-clamp-2">{item.description}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-palette-charcoal bg-palette-stone border border-palette-silver px-2 py-1 rounded">
                      {item.price?.toLocaleString('vi-VN')} {item.currency || 'VND'}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-palette-silver/50 flex items-center justify-between text-[11px] text-palette-slate">
                    <span>Chuẩn bị: {item.prep_time_minutes || 15} phút</span>
                    <span className={item.is_available ? 'text-palette-charcoal font-bold' : 'text-palette-slate'}>
                      {item.is_available ? 'Đang phục vụ' : 'Hết món'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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

      {/* MODAL: THÊM MÓN ĂN MỚI */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-palette-charcoal/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-palette-silver">
            <h2 className="text-base font-bold text-palette-charcoal mb-4">Thêm Món Ăn Mới</h2>
            <form onSubmit={handleCreateMenuItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Tên món *</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Vd: Bò Wagyu Nướng"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Giá (VND)</label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-palette-charcoal">Danh mục</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal bg-white"
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Khai vị">Khai vị</option>
                    <option value="Tráng miệng">Tráng miệng</option>
                    <option value="Đồ uống">Đồ uống</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Mô tả món</label>
                <textarea
                  rows="2"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
                  placeholder="Mô tả nguyên liệu, hương vị..."
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
                  Thêm món
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
                  placeholder="Vd: Menu Bữa Tối Lãng Mạn"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-palette-charcoal">Mô tả</label>
                <textarea
                  rows="2"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-palette-silver rounded-lg text-xs outline-none focus:border-palette-charcoal"
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
