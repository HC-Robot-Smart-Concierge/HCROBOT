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
import { handleNumberInputBlockExponent } from '../../utils/numberInputHelper';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { Pagination } from '../../components/common/Pagination';

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
      onNotify('Không thể tải dữ liệu thực đơn từ máy chủ');
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

  // Pagination states matching Admin portal standard
  const gridPageSize = 9;
  const listPageSize = 10;
  const [foodsPage, setFoodsPage] = useState(1);
  const [menusPage, setMenusPage] = useState(1);
  const [menuItemsPage, setMenuItemsPage] = useState(1);

  const totalFoodsPages = Math.max(1, Math.ceil(filteredFoods.length / listPageSize));
  const totalMenusPages = Math.max(1, Math.ceil(filteredMenus.length / gridPageSize));
  const totalMenuItemsPages = Math.max(1, Math.ceil(filteredMenuItems.length / listPageSize));

  useEffect(() => {
    setFoodsPage(1);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    setMenusPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setMenuItemsPage(1);
  }, [searchQuery, selectedMenuId]);

  useEffect(() => {
    if (foodsPage > totalFoodsPages) setFoodsPage(totalFoodsPages);
  }, [foodsPage, totalFoodsPages]);

  useEffect(() => {
    if (menusPage > totalMenusPages) setMenusPage(totalMenusPages);
  }, [menusPage, totalMenusPages]);

  useEffect(() => {
    if (menuItemsPage > totalMenuItemsPages) setMenuItemsPage(totalMenuItemsPages);
  }, [menuItemsPage, totalMenuItemsPages]);

  const paginatedFoods = useMemo(() => {
    const start = (foodsPage - 1) * listPageSize;
    return filteredFoods.slice(start, start + listPageSize);
  }, [filteredFoods, foodsPage]);

  const paginatedMenus = useMemo(() => {
    const start = (menusPage - 1) * gridPageSize;
    return filteredMenus.slice(start, start + gridPageSize);
  }, [filteredMenus, menusPage]);

  const paginatedMenuItems = useMemo(() => {
    const start = (menuItemsPage - 1) * listPageSize;
    return filteredMenuItems.slice(start, start + listPageSize);
  }, [filteredMenuItems, menuItemsPage]);

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
      onNotify('Vui lòng nhập tên món ăn');
      return;
    }

    try {
      if (editingFood) {
        // Update
        const updated = await updateKitchenFoodItem(editingFood.id, foodForm);
        setFoodItems((prev) => prev.map((f) => (f.id === editingFood.id ? { ...f, ...updated } : f)));
        onNotify(`Đã cập nhật món: ${foodForm.name}`);
      } else {
        // Create
        const created = await createKitchenFoodItem(foodForm);
        setFoodItems((prev) => [created, ...prev]);
        onNotify(`Đã thêm món mới vào kho gốc: ${foodForm.name}`);
      }
      setFoodModalOpen(false);
    } catch (err) {
      console.error('Error saving food item:', err);
      onNotify('Lỗi khi lưu món ăn. Vui lòng thử lại!');
    }
  };

  const handleToggleFoodAvailability = async (food) => {
    const nextVal = !food.is_available;
    try {
      await updateKitchenFoodItem(food.id, { is_available: nextVal });
      setFoodItems((prev) =>
        prev.map((f) => (f.id === food.id ? { ...f, is_available: nextVal } : f))
      );
      onNotify(`${nextVal ? 'Mở phục vụ' : 'Tạm ngưng món'}: ${food.name}`);
    } catch {
      onNotify('Lỗi khi cập nhật trạng thái món ăn');
    }
  };

  const handleDeleteFoodItem = async (foodId) => {
    try {
      await deleteKitchenFoodItem(foodId);
      setFoodItems((prev) => prev.filter((f) => f.id !== foodId));
      onNotify('Đã xóa món ăn khỏi kho dữ liệu gốc');
      setDeleteConfirm(null);
    } catch {
      onNotify('Không thể xóa món ăn');
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
      onNotify('Vui lòng nhập tên thực đơn');
      return;
    }

    try {
      if (editingMenu) {
        const updated = await updateKitchenMenu(editingMenu.id, menuForm);
        setMenus((prev) => prev.map((m) => (m.id === editingMenu.id ? { ...m, ...updated } : m)));
        onNotify(`Đã cập nhật thực đơn: ${menuForm.name}`);
      } else {
        const created = await createKitchenMenu(menuForm);
        setMenus((prev) => [...prev, created]);
        setSelectedMenuId(created.id);
        onNotify(`Đã tạo thực đơn mới: ${menuForm.name}`);
      }
      setMenuModalOpen(false);
    } catch {
      onNotify('Lỗi khi lưu thực đơn');
    }
  };

  const handleToggleMenuStatus = async (menu) => {
    const nextVal = !menu.is_active;
    try {
      await updateKitchenMenu(menu.id, { is_active: nextVal });
      setMenus((prev) =>
        prev.map((m) => (m.id === menu.id ? { ...m, is_active: nextVal } : m))
      );
      onNotify(`${nextVal ? 'Kích hoạt' : 'Tạm dừng thực đơn'}: ${menu.name}`);
    } catch {
      onNotify('Lỗi khi cập nhật trạng thái thực đơn');
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
      onNotify('Đã xóa thực đơn');
      setDeleteConfirm(null);
    } catch {
      onNotify('Lỗi khi xóa thực đơn');
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: Menu Items (Items inside Menu)
  // -------------------------------------------------------------
  const handleOpenAssignModal = () => {
    if (!selectedMenuId) {
      onNotify('Vui lòng chọn một thực đơn trước');
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
      onNotify('Vui lòng chọn món ăn từ kho gốc');
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
      onNotify(`Đã gán món vào thực đơn: ${currentMenu?.name}`);
      setAssignModalOpen(false);
    } catch {
      onNotify('Lỗi khi gán món vào thực đơn');
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
      onNotify('Đã cập nhật giá và thông tin món trong thực đơn');
      setEditingMenuItem(null);
    } catch {
      onNotify('Lỗi khi cập nhật món trong thực đơn');
    }
  };

  const handleToggleMenuItemAvailability = async (item) => {
    const nextVal = !item.is_available;
    try {
      await updateKitchenMenuItem(selectedMenuId, item.id, { is_available: nextVal });
      setMenuItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_available: nextVal } : it))
      );
      onNotify(`${nextVal ? 'Mở phục vụ' : 'Tạm dừng phục vụ món'}: ${item.name || item.food_item?.name}`);
    } catch {
      onNotify('Lỗi cập nhật trạng thái món');
    }
  };

  const handleRemoveItemFromMenu = async (menuItemId) => {
    try {
      await removeKitchenMenuItem(selectedMenuId, menuItemId);
      setMenuItems((prev) => prev.filter((it) => it.id !== menuItemId));
      onNotify('Đã gỡ món khỏi thực đơn');
      setDeleteConfirm(null);
    } catch {
      onNotify('Lỗi khi gỡ món khỏi thực đơn');
    }
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar font-sans">
      <div className="staff-page-container space-y-5">
        {/* Top Header */}
        <StaffPageHeader className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1>Quản Lý Thực Đơn &amp; Danh Mục Món Ăn</h1>
            <p>
              Quản lý kho món ăn gốc, các bộ thực đơn và phân bổ món ăn vào menu phục vụ khách.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Làm mới dữ liệu"
              className="inline-flex items-center gap-1.5 rounded border border-[#BFBFBD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#403D39] hover:bg-[#F0EFEC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {activeTab === 'food_items' && (
              <button
                type="button"
                onClick={() => handleOpenFoodModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Món Gốc Mới</span>
              </button>
            )}

            {activeTab === 'menus' && (
              <button
                type="button"
                onClick={() => handleOpenMenuModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo Thực Đơn Mới</span>
              </button>
            )}

            {activeTab === 'menu_items' && (
              <button
                type="button"
                onClick={handleOpenAssignModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Gán Món Vào Thực Đơn</span>
              </button>
            )}
          </div>
        </StaffPageHeader>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <article className="bg-white px-5 py-4 rounded-xl border border-[#BFBFBD]">
            <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Kho Món Ăn Gốc</p>
            <p className="text-[22px] font-bold text-[#262626] mt-2">
              {totalFoods} <span className="text-[11px] font-medium text-[#777]">món</span>
            </p>
          </article>

          <article className="bg-white px-5 py-4 rounded-xl border border-[#BFBFBD]">
            <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Bộ Thực Đơn</p>
            <p className="text-[22px] font-bold text-[#262626] mt-2">
              {totalMenus} <span className="text-[11px] font-medium text-[#777]">menu</span>
            </p>
          </article>

          <article className="bg-white px-5 py-4 rounded-xl border border-[#BFBFBD]">
            <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Menu Đang Áp Dụng</p>
            <p className="text-[22px] font-bold text-emerald-700 mt-2">
              {activeMenus} <span className="text-[11px] font-medium text-[#777]">/{totalMenus}</span>
            </p>
          </article>

          <article className="bg-white px-5 py-4 rounded-xl border border-[#BFBFBD]">
            <p className="text-[11px] font-semibold uppercase text-[#8C8C8C]">Món Sẵn Sàng</p>
            <p className="text-[22px] font-bold text-[#262626] mt-2">
              {availableFoods} <span className="text-[11px] font-medium text-[#777]">/{totalFoods}</span>
            </p>
          </article>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar border-b border-[#E8E5E0] pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('food_items');
              setSearchQuery('');
            }}
            className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
              activeTab === 'food_items'
                ? 'bg-[#262626] text-white border-[#262626]'
                : 'bg-white text-[#494540] border-[#E8E5E0] hover:bg-[#F4F2EE]'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>1. Kho Món Ăn Gốc</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'food_items' ? 'bg-white/20 text-white' : 'bg-[#F0EEEB] text-[#494540]'}`}>
              {totalFoods}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('menus');
              setSearchQuery('');
            }}
            className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
              activeTab === 'menus'
                ? 'bg-[#262626] text-white border-[#262626]'
                : 'bg-white text-[#494540] border-[#E8E5E0] hover:bg-[#F4F2EE]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Danh Sách Thực Đơn</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'menus' ? 'bg-white/20 text-white' : 'bg-[#F0EEEB] text-[#494540]'}`}>
              {totalMenus}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('menu_items');
              setSearchQuery('');
            }}
            className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer border ${
              activeTab === 'menu_items'
                ? 'bg-[#262626] text-white border-[#262626]'
                : 'bg-white text-[#494540] border-[#E8E5E0] hover:bg-[#F4F2EE]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Món Ăn Trong Thực Đơn</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'menu_items' ? 'bg-white/20 text-white' : 'bg-[#F0EEEB] text-[#494540]'}`}>
              {menuItems.length}
            </span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 rounded-xl bg-white border border-[#BFBFBD] flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#777] absolute left-3 top-1/2 -translate-y-1/2" />
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
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#DDD8CE] text-xs font-medium text-[#262626] outline-none focus:border-[#262626]"
            />
          </div>

          {activeTab === 'food_items' && (
            <div className="staff-request-filters w-full md:w-auto">
              {FOOD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'menu_items' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs font-semibold text-[#403D39] shrink-0">Chọn thực đơn:</label>
              <select
                value={selectedMenuId}
                onChange={(e) => setSelectedMenuId(e.target.value)}
                className="w-full md:w-64 px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#DDD8CE] text-xs font-semibold text-[#262626] outline-none cursor-pointer focus:border-[#262626]"
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
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <ChefHat className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Không tìm thấy món ăn nào phù hợp trong danh mục gốc.</p>
                <button
                  onClick={() => handleOpenFoodModal()}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Thêm món ăn đầu tiên
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
                <div className="divide-y divide-stone-100">
                  {paginatedFoods.map((food) => (
                    <div
                      key={food.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 relative">
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
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <UtensilsCrossed className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-stone-900">{food.name}</h4>
                            <span className="px-2 py-0.2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold">
                              {food.category || 'Món chính'}
                            </span>
                            <span
                              className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                                food.is_available
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {food.is_available ? 'Còn phục vụ' : 'Tạm ngưng'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#262626]">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>{food.prep_time_minutes || 15} phút</span>
                            </span>
                            <span className="font-mono text-[11px] text-stone-400">• #{food.id}</span>
                            {food.description && (
                              <span className="text-stone-600 line-clamp-1">{food.description}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => handleToggleFoodAvailability(food)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            food.is_available
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {food.is_available ? 'Tạm Ngưng' : 'Mở Lại'}
                        </button>

                        <button
                          onClick={() => handleOpenFoodModal(food)}
                          title="Chỉnh sửa món"
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-[#BFBFBD] text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh Sửa</span>
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'food', id: food.id, name: food.name })}
                          title="Xóa món khỏi kho"
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#BFBFBD] text-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  currentPage={foodsPage}
                  totalItems={filteredFoods.length}
                  pageSize={listPageSize}
                  onPageChange={setFoodsPage}
                  itemName="món"
                />
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
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Chưa có thực đơn nào được tạo.</p>
                <button
                  onClick={() => handleOpenMenuModal()}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Tạo thực đơn đầu tiên
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedMenus.map((menu) => (
                    <div
                      key={menu.id}
                      className="bg-white rounded-xl border border-[#BFBFBD] p-5 transition-all flex flex-col justify-between space-y-4"
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
                <Pagination
                  currentPage={menusPage}
                  totalItems={filteredMenus.length}
                  pageSize={gridPageSize}
                  onPageChange={setMenusPage}
                  itemName="thực đơn"
                  className="rounded-xl border overflow-hidden"
                />
              </>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: MÓN TRONG THỰC ĐƠN (MENU ITEMS)
            ------------------------------------------------------------- */}
        {activeTab === 'menu_items' && (
          <div className="space-y-4">
            {filteredMenuItems.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-[#BFBFBD] text-xs text-stone-500 space-y-2">
                <UtensilsCrossed className="w-8 h-8 text-stone-300 mx-auto" />
                <p>Thực đơn này hiện chưa có món ăn nào.</p>
                <button
                  onClick={handleOpenAssignModal}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-[#262626] text-white text-xs font-bold"
                >
                  Gán món từ kho gốc vào thực đơn này
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
                <div className="divide-y divide-stone-100">
                  {paginatedMenuItems.map((item, idx) => {
                    const name = item.name || item.food_item?.name || 'Món ăn';
                    const category = item.category || item.food_item?.category || 'Món chính';
                    const img = item.image_url || item.food_item?.image_url;

                    return (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
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
                              <span className="font-bold text-[#262626] text-sm">
                                {Number(item.price || 0).toLocaleString('vi-VN')} ₫
                              </span>
                              <span>• Thứ tự: #{item.display_order || (menuItemsPage - 1) * listPageSize + idx + 1}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => handleToggleMenuItemAvailability(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 border border-[#BFBFBD] text-stone-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
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
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#BFBFBD] text-rose-600 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pagination
                  currentPage={menuItemsPage}
                  totalItems={filteredMenuItems.length}
                  pageSize={listPageSize}
                  onPageChange={setMenuItemsPage}
                  itemName="món"
                />
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
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setFoodForm({ ...foodForm, prep_time_minutes: Math.max(1, Number(e.target.value) || 1) })}
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
                    onKeyDown={(e) => handleNumberInputBlockExponent(e)}
                    onChange={(e) => setAssignForm({ ...assignForm, price: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-xs font-bold text-amber-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                  <input
                    type="number"
                    min="0"
                    value={assignForm.display_order}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setAssignForm({ ...assignForm, display_order: Math.max(0, Number(e.target.value) || 0) })}
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
                  onKeyDown={(e) => handleNumberInputBlockExponent(e)}
                  onChange={(e) => setEditItemForm({ ...editItemForm, price: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-stone-300 text-sm font-black text-amber-900 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Thứ tự hiển thị:</label>
                <input
                  type="number"
                  min="0"
                  value={editItemForm.display_order}
                  onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                  onChange={(e) => setEditItemForm({ ...editItemForm, display_order: Math.max(0, Number(e.target.value) || 0) })}
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
                    - Món ăn trong <strong>Kho Món Ăn Gốc</strong> vẫn được giữ nguyên.
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
