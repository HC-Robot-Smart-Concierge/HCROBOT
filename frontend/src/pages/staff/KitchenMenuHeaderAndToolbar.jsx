import React from 'react';
import {
  ChefHat,
  Plus,
  Search,
  RefreshCw,
  BookOpen,
  Layers,
  Filter,
} from 'lucide-react';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { FOOD_CATEGORIES } from './kitchenMenuUtils';

export const KitchenMenuHeaderAndToolbar = ({
  activeTab,
  setActiveTab,
  isLoading,
  loadData,
  handleOpenFoodModal,
  handleOpenMenuModal,
  handleOpenAssignModal,
  totalFoods,
  availableFoods,
  totalMenus,
  activeMenus,
  menus,
  menuItems,
  selectedMenuId,
  setSelectedMenuId,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
}) => (
  <>
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
  </>
);
