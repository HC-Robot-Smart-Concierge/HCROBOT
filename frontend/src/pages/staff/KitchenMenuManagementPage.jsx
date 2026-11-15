import React, { useState, useEffect, useMemo } from 'react';
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
import {
  KITCHEN_MENU_GRID_PAGE_SIZE,
  KITCHEN_MENU_LIST_PAGE_SIZE,
  INITIAL_FOOD_FORM,
  INITIAL_MENU_FORM,
  INITIAL_ASSIGN_FORM,
  INITIAL_EDIT_ITEM_FORM,
  buildFoodFormState,
  buildMenuFormState,
  filterFoodItems,
  filterMenus,
  filterMenuItems,
  paginateSlice,
} from './kitchenMenuUtils';
import { KitchenMenuHeaderAndToolbar } from './KitchenMenuHeaderAndToolbar';
import { KitchenMenuTabsView } from './KitchenMenuTabsView';
import { KitchenMenuCrudModals } from './KitchenMenuCrudModals';
import { KitchenMenuAssignAndConfirmModals } from './KitchenMenuAssignAndConfirmModals';

export const KitchenMenuManagementPage = ({ currentUser, onNotify = () => {}, onNavigate = () => {} }) => {
  const [activeTab, setActiveTab] = useState('food_items');
  const [isLoading, setIsLoading] = useState(false);

  const [foodItems, setFoodItems] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMenuId, setSelectedMenuId] = useState('');

  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [foodForm, setFoodForm] = useState({ ...INITIAL_FOOD_FORM });
  const [menuForm, setMenuForm] = useState({ ...INITIAL_MENU_FORM });
  const [assignForm, setAssignForm] = useState({ ...INITIAL_ASSIGN_FORM });
  const [editItemForm, setEditItemForm] = useState({ ...INITIAL_EDIT_ITEM_FORM });

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

  const totalFoods = foodItems.length;
  const availableFoods = foodItems.filter((f) => f.is_available).length;
  const totalMenus = menus.length;
  const activeMenus = menus.filter((m) => m.is_active).length;

  const filteredFoods = useMemo(
    () => filterFoodItems(foodItems, selectedCategory, searchQuery),
    [foodItems, selectedCategory, searchQuery]
  );

  const filteredMenus = useMemo(
    () => filterMenus(menus, searchQuery),
    [menus, searchQuery]
  );

  const currentMenu = useMemo(
    () => menus.find((m) => m.id === selectedMenuId),
    [menus, selectedMenuId]
  );

  const filteredMenuItems = useMemo(
    () => filterMenuItems(menuItems, searchQuery),
    [menuItems, searchQuery]
  );

  const [foodsPage, setFoodsPage] = useState(1);
  const [menusPage, setMenusPage] = useState(1);
  const [menuItemsPage, setMenuItemsPage] = useState(1);

  const totalFoodsPages = Math.max(1, Math.ceil(filteredFoods.length / KITCHEN_MENU_LIST_PAGE_SIZE));
  const totalMenusPages = Math.max(1, Math.ceil(filteredMenus.length / KITCHEN_MENU_GRID_PAGE_SIZE));
  const totalMenuItemsPages = Math.max(1, Math.ceil(filteredMenuItems.length / KITCHEN_MENU_LIST_PAGE_SIZE));

  useEffect(() => { setFoodsPage(1); }, [searchQuery, selectedCategory]);
  useEffect(() => { setMenusPage(1); }, [searchQuery]);
  useEffect(() => { setMenuItemsPage(1); }, [searchQuery, selectedMenuId]);
  useEffect(() => { if (foodsPage > totalFoodsPages) setFoodsPage(totalFoodsPages); }, [foodsPage, totalFoodsPages]);
  useEffect(() => { if (menusPage > totalMenusPages) setMenusPage(totalMenusPages); }, [menusPage, totalMenusPages]);
  useEffect(() => { if (menuItemsPage > totalMenuItemsPages) setMenuItemsPage(totalMenuItemsPages); }, [menuItemsPage, totalMenuItemsPages]);

  const paginatedFoods = useMemo(
    () => paginateSlice(filteredFoods, foodsPage, KITCHEN_MENU_LIST_PAGE_SIZE),
    [filteredFoods, foodsPage]
  );

  const paginatedMenus = useMemo(
    () => paginateSlice(filteredMenus, menusPage, KITCHEN_MENU_GRID_PAGE_SIZE),
    [filteredMenus, menusPage]
  );

  const paginatedMenuItems = useMemo(
    () => paginateSlice(filteredMenuItems, menuItemsPage, KITCHEN_MENU_LIST_PAGE_SIZE),
    [filteredMenuItems, menuItemsPage]
  );

  const handleOpenFoodModal = (food = null) => {
    setEditingFood(food || null);
    setFoodForm(buildFoodFormState(food));
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
        const updated = await updateKitchenFoodItem(editingFood.id, foodForm);
        setFoodItems((prev) => prev.map((f) => (f.id === editingFood.id ? { ...f, ...updated } : f)));
        onNotify(`Đã cập nhật món: ${foodForm.name}`);
      } else {
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

  const handleOpenMenuModal = (menu = null) => {
    setEditingMenu(menu || null);
    setMenuForm(buildMenuFormState(menu));
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
      await assignFoodItemToMenu(selectedMenuId, {
        food_item_id: assignForm.food_item_id,
        price: Number(assignForm.price) || 0,
        display_order: Number(assignForm.display_order) || 0,
        is_available: assignForm.is_available,
      });

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
        <KitchenMenuHeaderAndToolbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isLoading={isLoading}
          loadData={loadData}
          handleOpenFoodModal={handleOpenFoodModal}
          handleOpenMenuModal={handleOpenMenuModal}
          handleOpenAssignModal={handleOpenAssignModal}
          totalFoods={totalFoods}
          availableFoods={availableFoods}
          totalMenus={totalMenus}
          activeMenus={activeMenus}
          menus={menus}
          menuItems={menuItems}
          selectedMenuId={selectedMenuId}
          setSelectedMenuId={setSelectedMenuId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />

        <KitchenMenuTabsView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          filteredFoods={filteredFoods}
          paginatedFoods={paginatedFoods}
          foodsPage={foodsPage}
          setFoodsPage={setFoodsPage}
          filteredMenus={filteredMenus}
          paginatedMenus={paginatedMenus}
          menus={menus}
          menusPage={menusPage}
          setMenusPage={setMenusPage}
          filteredMenuItems={filteredMenuItems}
          paginatedMenuItems={paginatedMenuItems}
          menuItemsPage={menuItemsPage}
          setMenuItemsPage={setMenuItemsPage}
          selectedMenuId={selectedMenuId}
          setSelectedMenuId={setSelectedMenuId}
          handleOpenFoodModal={handleOpenFoodModal}
          handleToggleFoodAvailability={handleToggleFoodAvailability}
          handleOpenMenuModal={handleOpenMenuModal}
          handleToggleMenuStatus={handleToggleMenuStatus}
          handleOpenAssignModal={handleOpenAssignModal}
          handleOpenEditItemModal={handleOpenEditItemModal}
          handleToggleMenuItemAvailability={handleToggleMenuItemAvailability}
          setDeleteConfirm={setDeleteConfirm}
        />
      </div>

      <KitchenMenuCrudModals
        foodModalOpen={foodModalOpen}
        setFoodModalOpen={setFoodModalOpen}
        editingFood={editingFood}
        foodForm={foodForm}
        setFoodForm={setFoodForm}
        handleSaveFoodItem={handleSaveFoodItem}
        menuModalOpen={menuModalOpen}
        setMenuModalOpen={setMenuModalOpen}
        editingMenu={editingMenu}
        menuForm={menuForm}
        setMenuForm={setMenuForm}
        handleSaveMenu={handleSaveMenu}
      />

      <KitchenMenuAssignAndConfirmModals
        assignModalOpen={assignModalOpen}
        setAssignModalOpen={setAssignModalOpen}
        currentMenu={currentMenu}
        assignForm={assignForm}
        setAssignForm={setAssignForm}
        foodItems={foodItems}
        handleAssignFoodToMenu={handleAssignFoodToMenu}
        editingMenuItem={editingMenuItem}
        setEditingMenuItem={setEditingMenuItem}
        editItemForm={editItemForm}
        setEditItemForm={setEditItemForm}
        handleSaveEditMenuItem={handleSaveEditMenuItem}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        handleDeleteFoodItem={handleDeleteFoodItem}
        handleDeleteMenu={handleDeleteMenu}
        handleRemoveItemFromMenu={handleRemoveItemFromMenu}
      />
    </div>
  );
};
