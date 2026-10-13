import React, { useState, useEffect, useMemo } from 'react';
import {
  UtensilsCrossed,
  ChefHat,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  BookOpen,
  Layers,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Filter,
  Check,
  X,
  Tag,
  DollarSign,
  Image as ImageIcon,
} from 'lucide-react';
import {
  fetchKitchenFoodItems,
  createKitchenFoodItem,
  updateKitchenFoodItem,
  deleteKitchenFoodItem,
  fetchKitchenMenus,
  createKitchenMenu,
  updateKitchenMenu,
  deleteKitchenMenu,
  fetchKitchenMenuItems,
  assignFoodItemToMenu,
  updateKitchenMenuItem,
  removeKitchenMenuItem,
} from '../../services/operationsApi';

export const KitchenMenuManagementPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
  const staffName = currentUser?.full_name || currentUser?.name || 'Đầu Bếp Trực Ca';

  // Active Tab: 'food_items' | 'menus' | 'menu_items'
  const [activeTab, setActiveTab] = useState('food_items');

  // Loading States
  const [isLoading, setIsLoading] = useState(false);

  // Data States
  const [foodItems, setFoodItems] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMenuId, setSelectedMenuId] = useState('');

  // Modals
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null); // null = create, object = edit

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);

  // Delete Confirm Modal
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'food'|'menu'|'menu_item', id, name, menuId }

  // Food Form State
  const [foodForm, setFoodForm] = useState({
    name: '',
    category: 'Món chính',
    description: '',
    image_url: '',
    prep_time_minutes: 15,
    is_available: true,
  });

  // Menu Form State
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'Food',
    description: '',
    is_active: true,
  });

  // Assign Food to Menu Form State
  const [assignForm, setAssignForm] = useState({
    menu_id: '',
    food_item_id: '',
    price: 0,
    display_order: 0,
    is_available: true,
  });

  // Edit Menu Item Form State
  const [editItemForm, setEditItemForm] = useState({
    price: 0,
    display_order: 0,
    is_available: true,
  });

  // Categories list
  const FOOD_CATEGORIES = ['All', 'Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng', 'Ăn nhẹ', 'Món phụ'];
  const MENU_CATEGORIES = ['Food', 'Beverage', 'Dessert', 'Room Service', 'A La Carte', 'Buffet', 'Combo'];

  // Load All Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [foodsData, menusData] = await Promise.all([
        fetchKitchenFoodItems(),
        fetchKitchenMenus(),
      ]);

      if (Array.isArray(foodsData)) setFoodItems(foodsData);
      if (Array.isArray(menusData)) {
        setMenus(menusData);
        // Default select first menu if not selected
        if (!selectedMenuId && menusData.length > 0) {
          setSelectedMenuId(menusData[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading kitchen menu data:', err);
      onNotify('⚠️ Không thể tải dữ liệu thực đơn từ máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  // Load Menu Items when selectedMenuId changes
  const loadMenuItemsForCurrentMenu = async (menuId) => {
    if (!menuId) return;
    try {
      const items = await fetchKitchenMenuItems({ menu_id: menuId });
      if (Array.isArray(items)) {
        setMenuItems(items);
      }
    } catch (err) {
      console.error('Error loading menu items:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMenuId) {
      loadMenuItemsForCurrentMenu(selectedMenuId);
    }
  }, [selectedMenuId]);

  // KPIs
  const totalFoods = foodItems.length;
  const availableFoods = foodItems.filter((f) => f.is_available).length;
  const totalMenus = menus.length;
  const activeMenus = menus.filter((m) => m.is_active).length;

  // Filtered Food Items
  const filteredFoods = useMemo(() => {
    return foodItems.filter((f) => {
      const matchCategory = selectedCategory === 'All' || f.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        (f.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [foodItems, selectedCategory, searchQuery]);

  // Filtered Menus
  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      return (
        !searchQuery.trim() ||
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.category || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [menus, searchQuery]);

  // Filtered Menu Items
  const currentMenu = useMemo(() => {
    return menus.find((m) => m.id === selectedMenuId);
  }, [menus, selectedMenuId]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const itemName = item.name || item.food_item?.name || '';
      return (
        !searchQuery.trim() ||
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [menuItems, searchQuery]);

  // -------------------------------------------------------------
  // ACTIONS: Food Items (Master Catalog)
  // -------------------------------------------------------------
  const handleOpenFoodModal = (food = null) => {
    if (food) {
      setEditingFood(food);
      setFoodForm({
        name: food.name || '',
        category: food.category || 'Món chính',
        description: food.description || '',
        image_url: food.image_url || '',
        prep_time_minutes: food.prep_time_minutes || 15,
        is_available: food.is_available ?? true,
      });
    } else {
      setEditingFood(null);
      setFoodForm({
        name: '',
        category: 'Món chính',
        description: '',
        image_url: '',
        prep_time_minutes: 15,
        is_available: true,
      });
    }
    setFoodModalOpen(true);
  };

  const handleSaveFoodItem = async (e) => {
    e.preventDefault();
    if (!foodForm.name.trim()) {
      onNotify('⚠️ Vui lòng nhập tên món ăn');
      return;
    }

    try {
      if (editingFood) {
        // Update
        const updated = await updateKitchenFoodItem(editingFood.id, foodForm);
        setFoodItems((prev) => prev.map((f) => (f.id === editingFood.id ? { ...f, ...updated } : f)));
        onNotify(`✅ Đã cập nhật món: ${foodForm.name}`);
      } else {
        // Create
        const created = await createKitchenFoodItem(foodForm);
        setFoodItems((prev) => [created, ...prev]);
        onNotify(`✅ Đã thêm món mới vào kho gốc: ${foodForm.name}`);
      }
      setFoodModalOpen(false);
    } catch (err) {
      console.error('Error saving food item:', err);
      onNotify('❌ Lỗi khi lưu món ăn. Vui lòng thử lại!');
    }
  };

  const handleToggleFoodAvailability = async (food) => {
    const nextVal = !food.is_available;
    try {
      await updateKitchenFoodItem(food.id, { is_available: nextVal });
      setFoodItems((prev) =>
        prev.map((f) => (f.id === food.id ? { ...f, is_available: nextVal } : f))
      );
      onNotify(`${nextVal ? '🟢 Mở phục vụ' : '🔴 Tạm ngưng món'}: ${food.name}`);
    } catch {
      onNotify('⚠️ Lỗi khi cập nhật trạng thái món ăn');
    }
  };

  const handleDeleteFoodItem = async (foodId) => {
    try {
      await deleteKitchenFoodItem(foodId);
      setFoodItems((prev) => prev.filter((f) => f.id !== foodId));
      onNotify('🗑️ Đã xóa món ăn khỏi kho dữ liệu gốc');
      setDeleteConfirm(null);
    } catch {
      onNotify('⚠️ Không thể xóa món ăn');
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Menus
  // -------------------------------------------------------------
  const handleOpenMenuModal = (menu = null) => {
    if (menu) {
      setEditingMenu(menu);
      setMenuForm({
        name: menu.name || '',
        category: menu.category || 'Food',
        description: menu.description || '',
        is_active: menu.is_active ?? true,
      });
    } else {
      setEditingMenu(null);
      setMenuForm({
        name: '',
        category: 'Food',
        description: '',
        is_active: true,
      });
    }
    setMenuModalOpen(true);
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    if (!menuForm.name.trim()) {
      onNotify('⚠️ Vui lòng nhập tên thực đơn');
      return;
    }

    try {
      if (editingMenu) {
        const updated = await updateKitchenMenu(editingMenu.id, menuForm);
        setMenus((prev) => prev.map((m) => (m.id === editingMenu.id ? { ...m, ...updated } : m)));
        onNotify(`✅ Đã cập nhật thực đơn: ${menuForm.name}`);
      } else {
        const created = await createKitchenMenu(menuForm);
        setMenus((prev) => [...prev, created]);
        setSelectedMenuId(created.id);
        onNotify(`✅ Đã tạo thực đơn mới: ${menuForm.name}`);
      }
      setMenuModalOpen(false);
    } catch {
      onNotify('❌ Lỗi khi lưu thực đơn');
    }
  };

  const handleToggleMenuStatus = async (menu) => {
    const nextVal = !menu.is_active;
    try {
      await updateKitchenMenu(menu.id, { is_active: nextVal });
      setMenus((prev) =>
        prev.map((m) => (m.id === menu.id ? { ...m, is_active: nextVal } : m))
      );
      onNotify(`${nextVal ? '🟢 Kích hoạt' : '⏸️ Tạm dừng thực đơn'}: ${menu.name}`);
    } catch {
      onNotify('⚠️ Lỗi khi cập nhật trạng thái thực đơn');
    }
  };

  const handleDeleteMenu = async (menuId) => {
    try {
      await deleteKitchenMenu(menuId);
      const remaining = menus.filter((m) => m.id !== menuId);
      setMenus(remaining);
      if (selectedMenuId === menuId) {
        setSelectedMenuId(remaining.length > 0 ? remaining[0].id : '');
      }
      onNotify('🗑️ Đã xóa thực đơn');
      setDeleteConfirm(null);
    } catch {
      onNotify('⚠️ Lỗi khi xóa thực đơn');
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Menu Items (Items inside Menu)
  // -------------------------------------------------------------
  const handleOpenAssignModal = () => {
    if (!selectedMenuId) {
      onNotify('⚠️ Vui lòng chọn một thực đơn trước');
      return;
    }
    setAssignForm({
      menu_id: selectedMenuId,
      food_item_id: foodItems.length > 0 ? foodItems[0].id : '',
      price: 50000,
      display_order: menuItems.length + 1,
      is_available: true,
    });
    setAssignModalOpen(true);
  };

  const handleAssignFoodToMenu = async (e) => {
    e.preventDefault();
    if (!assignForm.food_item_id) {
      onNotify('⚠️ Vui lòng chọn món ăn từ kho gốc');
      return;
    }

    try {
      const assigned = await assignFoodItemToMenu(selectedMenuId, {
        food_item_id: assignForm.food_item_id,
        price: Number(assignForm.price) || 0,
        display_order: Number(assignForm.display_order) || 0,
        is_available: assignForm.is_available,
      });

      // Reload items for current menu
      await loadMenuItemsForCurrentMenu(selectedMenuId);
      onNotify(`✅ Đã gán món vào thực đơn: ${currentMenu?.name}`);
      setAssignModalOpen(false);
    } catch {
      onNotify('❌ Lỗi khi gán món vào thực đơn');
    }
  };

  const handleOpenEditItemModal = (item) => {
    setEditingMenuItem(item);
    setEditItemForm({
      price: item.price || 0,
      display_order: item.display_order || 0,
      is_available: item.is_available ?? true,
    });
  };

  const handleSaveEditMenuItem = async (e) => {
    e.preventDefault();
    if (!editingMenuItem) return;

    try {
      await updateKitchenMenuItem(selectedMenuId, editingMenuItem.id, {
        price: Number(editItemForm.price),
        display_order: Number(editItemForm.display_order),
        is_available: editItemForm.is_available,
      });

      setMenuItems((prev) =>
        prev.map((it) =>
          it.id === editingMenuItem.id
            ? {
                ...it,
                price: Number(editItemForm.price),
                display_order: Number(editItemForm.display_order),
                is_available: editItemForm.is_available,
              }
            : it
        )
      );
      onNotify('✅ Đã cập nhật giá và thông tin món trong thực đơn');
      setEditingMenuItem(null);
    } catch {
      onNotify('❌ Lỗi khi cập nhật món trong thực đơn');
    }
  };

  const handleToggleMenuItemAvailability = async (item) => {
    const nextVal = !item.is_available;
    try {
      await updateKitchenMenuItem(selectedMenuId, item.id, { is_available: nextVal });
      setMenuItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_available: nextVal } : it))
      );
      onNotify(`${nextVal ? '🟢 Mở phục vụ' : '🔴 Tạm dừng phục vụ món'}: ${item.name || item.food_item?.name}`);
    } catch {
      onNotify('⚠️ Lỗi cập nhật trạng thái món');
    }
  };

  const handleRemoveItemFromMenu = async (menuItemId) => {
    try {
      await removeKitchenMenuItem(selectedMenuId, menuItemId);
      setMenuItems((prev) => prev.filter((it) => it.id !== menuItemId));
      onNotify('🗑️ Đã gỡ món khỏi thực đơn');
      setDeleteConfirm(null);
    } catch {
      onNotify('⚠️ Lỗi khi gỡ món khỏi thực đơn');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shadow-xs">
                <UtensilsCrossed className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1917]">
                    Quản Lý Thực Đơn & Danh Mục Món Ăn
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
                    Bếp & Ẩm Thực
                  </span>
                </div>
                <p className="text-xs text-[#78716C] mt-0.5">
                  Quản lý kho món ăn gốc, các bộ thực đơn và phân bổ món ăn vào menu phục vụ khách.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              title="Làm mới dữ liệu"
              className="p-2.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'food_items' && (
              <button
                onClick={() => handleOpenFoodModal()}
                className="px-4 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Món Gốc Mới</span>
              </button>
            )}

            {activeTab === 'menus' && (
              <button
                onClick={() => handleOpenMenuModal()}
                className="px-4 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Thực Đơn Mới</span>
              </button>
            )}

            {activeTab === 'menu_items' && (
              <button
                onClick={handleOpenAssignModal}
                className="px-4 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Gán Món Vào Thực Đơn</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Kho Món Ăn Gốc</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <h3 className="text-2xl font-black text-stone-900">{totalFoods}</h3>
                <span className="text-xs font-bold text-stone-400">món</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center font-bold">
              <ChefHat className="w-5 h-5 text-orange-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Bộ Thực Đơn</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <h3 className="text-2xl font-black text-indigo-700">{totalMenus}</h3>
                <span className="text-xs font-bold text-stone-400">menu</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Menu Đang Áp Dụng</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <h3 className="text-2xl font-black text-emerald-700">{activeMenus}</h3>
                <span className="text-xs font-bold text-stone-400">/{totalMenus}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E5E1D8] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase">Món Sẵn Sàng</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <h3 className="text-2xl font-black text-amber-700">{availableFoods}</h3>
                <span className="text-xs font-bold text-stone-400">/{totalFoods}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="bg-white rounded-2xl border border-[#E5E1D8] p-1.5 shadow-xs flex items-center gap-1.5">
          <button
            onClick={() => {
              setActiveTab('food_items');
              setSearchQuery('');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'food_items'
                ? 'bg-[#18181B] text-white shadow-xs'
                : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-black'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>1. Kho Món Ăn Gốc</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold ${activeTab === 'food_items' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
              {totalFoods}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('menus');
              setSearchQuery('');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'menus'
                ? 'bg-[#18181B] text-white shadow-xs'
                : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-black'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Danh Sách Thực Đơn</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold ${activeTab === 'menus' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
              {totalMenus}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('menu_items');
              setSearchQuery('');
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'menu_items'
                ? 'bg-[#18181B] text-white shadow-xs'
                : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-black'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Món Ăn Trong Thực Đơn</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold ${activeTab === 'menu_items' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
              {menuItems.length}
            </span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E5E1D8] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === 'food_items'
                  ? 'Tìm kiếm theo tên món ăn gốc...'
                  : activeTab === 'menus'
                  ? 'Tìm kiếm tên thực đơn...'
                  : 'Tìm món trong thực đơn hiện tại...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
            />
          </div>

          {activeTab === 'food_items' && (
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-[11px] font-bold text-stone-500 uppercase mr-1">Phân loại:</span>
              {FOOD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-stone-600 border border-[#E0DCD3] hover:bg-[#EFECE6]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'menu_items' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs font-bold text-stone-600 shrink-0">Chọn thực đơn:</label>
              <select
                value={selectedMenuId}
                onChange={(e) => setSelectedMenuId(e.target.value)}
                className="w-full md:w-64 px-3.5 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none cursor-pointer focus:border-stone-400"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.items?.length || 0} món)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------
            TAB 1: KHO MÓN ĂN GỐC (FOOD ITEMS - MASTER CATALOG)
            ------------------------------------------------------------- */}
        {activeTab === 'food_items' && (
          <div className="space-y-4">
            {filteredFoods.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500 space-y-2">
                <ChefHat className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Không tìm thấy món ăn nào phù hợp trong danh mục gốc.</p>
                <button
                  onClick={() => handleOpenFoodModal()}
                  className="mt-2 px-4 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold"
                >
                  Thêm món ăn đầu tiên
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFoods.map((food) => (
                  <div
                    key={food.id}
                    className="bg-white rounded-2xl border border-[#E5E1D8] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Thumbnail Preview */}
                      <div className="h-40 w-full bg-stone-100 relative overflow-hidden">
                        {food.image_url ? (
                          <img
                            src={food.image_url}
                            alt={food.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-stone-300">
                            <UtensilsCrossed className="w-10 h-10 mb-1" />
                            <span className="text-[10px] font-semibold text-stone-400">Chưa có ảnh</span>
                          </div>
                        )}

                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold">
                          {food.category || 'Món chính'}
                        </span>

                        <span
                          className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-xs ${
                            food.is_available
                              ? 'bg-emerald-500/90 text-white border-emerald-400'
                              : 'bg-rose-500/90 text-white border-rose-400'
                          }`}
                        >
                          {food.is_available ? 'Còn phục vụ' : 'Tạm ngưng'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-stone-900 leading-snug">{food.name}</h4>
                          <span className="font-mono text-[10px] text-stone-400 shrink-0">#{food.id}</span>
                        </div>

                        {food.description && (
                          <p className="text-xs text-stone-600 line-clamp-2">{food.description}</p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-stone-500 pt-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span>{food.prep_time_minutes || 15} phút</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleFoodAvailability(food)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          food.is_available
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                        }`}
                      >
                        {food.is_available ? 'Tạm Ngưng' : 'Mở Lại'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenFoodModal(food)}
                          title="Chỉnh sửa món"
                          className="p-1.5 rounded-xl bg-white hover:bg-stone-200 border border-stone-200 text-stone-700 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'food', id: food.id, name: food.name })}
                          title="Xóa món khỏi kho"
                          className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-stone-200 text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: DANH SÁCH THỰC ĐƠN (MENUS)
            ------------------------------------------------------------- */}
        {activeTab === 'menus' && (
          <div className="space-y-4">
            {filteredMenus.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500 space-y-2">
                <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Chưa có thực đơn nào được tạo.</p>
                <button
                  onClick={() => handleOpenMenuModal()}
                  className="mt-2 px-4 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold"
                >
                  Tạo thực đơn đầu tiên
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenus.map((menu) => (
                  <div
                    key={menu.id}
                    className="bg-white rounded-2xl border border-[#E5E1D8] p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold">
                          {menu.category || 'Food'}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            menu.is_active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          {menu.is_active ? '● Đang Áp Dụng' : '○ Tạm Dừng'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-stone-900 leading-snug">{menu.name}</h4>

                      {menu.description && (
                        <p className="text-xs text-stone-600 line-clamp-2">{menu.description}</p>
                      )}

                      <div className="pt-2 flex items-center justify-between text-xs text-stone-600">
                        <span className="font-semibold">Món trong thực đơn:</span>
                        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md">
                          {menu.items?.length || 0} món
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedMenuId(menu.id);
                          setActiveTab('menu_items');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Quản Lý Món</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleMenuStatus(menu)}
                          title={menu.is_active ? 'Tạm ngưng menu' : 'Kích hoạt menu'}
                          className="p-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 transition-all cursor-pointer"
                        >
                          {menu.is_active ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-stone-400" />}
                        </button>

                        <button
                          onClick={() => handleOpenMenuModal(menu)}
                          title="Chỉnh sửa menu"
                          className="p-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'menu', id: menu.id, name: menu.name })}
                          title="Xóa menu"
                          className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-stone-200 text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: MÓN TRONG THỰC ĐƠN (MENU ITEMS)
            ------------------------------------------------------------- */}
        {activeTab === 'menu_items' && (
          <div className="space-y-4">
            {/* Current Menu Banner */}
            {currentMenu && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5 text-amber-800" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{currentMenu.name}</h4>
                    <p className="text-xs text-stone-600">{currentMenu.description || 'Thực đơn phục vụ của khách sạn'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-700 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-2xs">
                    Tổng: {filteredMenuItems.length} món
                  </span>
                  <button
                    onClick={handleOpenAssignModal}
                    className="px-3.5 py-1.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gán Món Mới</span>
                  </button>
                </div>
              </div>
            )}

            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500 space-y-2">
                <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Thực đơn này hiện chưa có món ăn nào.</p>
                <button
                  onClick={handleOpenAssignModal}
                  className="mt-2 px-4 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold"
                >
                  Gán món từ kho gốc vào thực đơn này
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E1D8] overflow-hidden shadow-xs divide-y divide-stone-100">
                {filteredMenuItems.map((item, idx) => {
                  const name = item.name || item.food_item?.name || 'Món ăn';
                  const category = item.category || item.food_item?.category || 'Món chính';
                  const img = item.image_url || item.food_item?.image_url;

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 relative">
                          {img ? (
                            <img src={img} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <UtensilsCrossed className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-stone-900">{name}</h4>
                            <span className="px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold">
                              {category}
                            </span>
                            <span
                              className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                                item.is_available
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {item.is_available ? 'Đang phục vụ' : 'Tạm ngưng'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-stone-500">
                            <span className="font-bold text-amber-900 text-sm">
                              {Number(item.price || 0).toLocaleString('vi-VN')} ₫
                            </span>
                            <span>• Thứ tự: #{item.display_order || idx + 1}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleMenuItemAvailability(item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            item.is_available
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {item.is_available ? 'Tạm Dừng' : 'Mở Lại'}
                        </button>

                        <button
                          onClick={() => handleOpenEditItemModal(item)}
                          title="Đổi giá / Thứ tự"
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Đổi Giá</span>
                        </button>

                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'menu_item',
                              id: item.id,
                              name,
                              menuId: selectedMenuId,
                            })
                          }
                          title="Gỡ khỏi thực đơn này (không xóa món gốc)"
                          className="p-1.5 rounded-xl bg-white hover:bg-rose-50 border border-stone-200 text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
          MODAL 1: THÊM / SỬA MÓN ĂN GỐC (FOOD ITEM)
          ------------------------------------------------------------- */}
      {foodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  {editingFood ? 'Chỉnh Sửa Món Ăn Gốc' : 'Thêm Món Ăn Mới Vào Kho Gốc'}
                </h3>
              </div>
              <button
                onClick={() => setFoodModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFoodItem} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tên món ăn (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bò Wagyu Nướng Sốt Tiêu Đen"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none focus:border-stone-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Phân loại:</label>
                  <select
                    value={foodForm.category}
                    onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Khai vị">Khai vị</option>
                    <option value="Tráng miệng">Tráng miệng</option>
                    <option value="Đồ uống">Đồ uống</option>
                    <option value="Ăn nhẹ">Ăn nhẹ</option>
                    <option value="Món phụ">Món phụ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Thời gian nấu (phút):</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={foodForm.prep_time_minutes}
                    onChange={(e) => setFoodForm({ ...foodForm, prep_time_minutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Đường dẫn ảnh (URL):</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={foodForm.image_url}
                  onChange={(e) => setFoodForm({ ...foodForm, image_url: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Mô tả chi tiết & Thành phần:</label>
                <textarea
                  rows="3"
                  placeholder="Mô tả hương vị, nguyên liệu chính hoặc lưu ý dị ứng..."
                  value={foodForm.description}
                  onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="food_avail"
                  checked={foodForm.is_available}
                  onChange={(e) => setFoodForm({ ...foodForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="food_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Món ăn đang sẵn sàng phục vụ (Available)
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFoodModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  {editingFood ? 'Lưu Thay Đổi' : 'Thêm Vào Kho Gốc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 2: TẠO / SỬA THỰC ĐƠN (MENU)
          ------------------------------------------------------------- */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  {editingMenu ? 'Chỉnh Sửa Bộ Thực Đơn' : 'Tạo Thực Đơn Mới'}
                </h3>
              </div>
              <button
                onClick={() => setMenuModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Tên thực đơn (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Menu Buffet Sáng, Thực Đơn Alacarte..."
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none focus:border-stone-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Phân loại menu:</label>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                >
                  {MENU_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Mô tả thực đơn:</label>
                <textarea
                  rows="3"
                  placeholder="Ví dụ: Phục vụ từ 6h00 - 10h00 tại nhà hàng chính..."
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="menu_active"
                  checked={menuForm.is_active}
                  onChange={(e) => setMenuForm({ ...menuForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="menu_active" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Kích hoạt áp dụng thực đơn này (Active)
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMenuModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  {editingMenu ? 'Lưu Thay Đổi' : 'Tạo Thực Đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 3: GÁN MÓN VÀO THỰC ĐƠN (ASSIGN FOOD TO MENU)
          ------------------------------------------------------------- */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Gán Món Vào Thực Đơn: {currentMenu?.name}</h3>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignFoodToMenu} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Chọn món ăn từ kho gốc (*):
                </label>
                <select
                  required
                  value={assignForm.food_item_id}
                  onChange={(e) => setAssignForm({ ...assignForm, food_item_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-stone-900 outline-none"
                >
                  <option value="">-- Chọn món ăn --</option>
                  {foodItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Giá bán trong Menu (VNĐ) (*):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    placeholder="Ví dụ: 85000"
                    value={assignForm.price}
                    onChange={(e) => setAssignForm({ ...assignForm, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-amber-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                  <input
                    type="number"
                    min="0"
                    value={assignForm.display_order}
                    onChange={(e) => setAssignForm({ ...assignForm, display_order: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assign_avail"
                  checked={assignForm.is_available}
                  onChange={(e) => setAssignForm({ ...assignForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="assign_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Mở bán món trong thực đơn này
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  Gán Vào Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 4: ĐỔI GIÁ & THỨ TỰ MÓN TRONG MENU
          ------------------------------------------------------------- */}
      {editingMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Cập Nhật Giá Món Trong Menu</h3>
              </div>
              <button
                onClick={() => setEditingMenuItem(null)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMenuItem} className="p-6 space-y-4">
              <p className="text-xs font-bold text-stone-900">
                Món: <span className="text-amber-800">{editingMenuItem.name || editingMenuItem.food_item?.name}</span>
              </p>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Giá bán áp dụng riêng (VNĐ):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={editItemForm.price}
                  onChange={(e) => setEditItemForm({ ...editItemForm, price: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-sm font-black text-amber-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                <input
                  type="number"
                  min="0"
                  value={editItemForm.display_order}
                  onChange={(e) => setEditItemForm({ ...editItemForm, display_order: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-semibold text-stone-900 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_avail"
                  checked={editItemForm.is_available}
                  onChange={(e) => setEditItemForm({ ...editItemForm, is_available: e.target.checked })}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <label htmlFor="edit_avail" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Mở bán món trong thực đơn này
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMenuItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#18181B] hover:bg-black text-white shadow-xs cursor-pointer"
                >
                  Lưu Giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL 5: XÁC NHẬN XÓA / GỠ MÓN (CONFIRM DELETE / REMOVE)
          ------------------------------------------------------------- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-700" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">
                {deleteConfirm.type === 'menu_item' ? 'Gỡ Món Khỏi Thực Đơn' : 'Xác Nhận Xóa Dữ Liệu'}
              </h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {deleteConfirm.type === 'menu_item' ? (
                <>
                  Bạn có chắc chắn muốn gỡ món <strong className="text-stone-900">"{deleteConfirm.name}"</strong> khỏi thực đơn này?{' '}
                  <span className="block mt-1 text-emerald-700 font-medium">
                    ✓ Món ăn trong <strong>Kho Món Ăn Gốc</strong> vẫn được giữ nguyên.
                  </span>
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa{' '}
                  <strong className="text-stone-900">"{deleteConfirm.name}"</strong>?
                  {deleteConfirm.type === 'food' && ' Món ăn sẽ bị xóa vĩnh viễn khỏi kho dữ liệu gốc và tự động gỡ khỏi toàn bộ các thực đơn liên quan.'}
                  {deleteConfirm.type === 'menu' && ' Bộ thực đơn sẽ bị xóa. Các món ăn trong Kho Món Ăn Gốc vẫn được giữ nguyên.'}
                </>
              )}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'food') handleDeleteFoodItem(deleteConfirm.id);
                  if (deleteConfirm.type === 'menu') handleDeleteMenu(deleteConfirm.id);
                  if (deleteConfirm.type === 'menu_item') handleRemoveItemFromMenu(deleteConfirm.id);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                {deleteConfirm.type === 'menu_item' ? 'Gỡ Khỏi Thực Đơn' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
