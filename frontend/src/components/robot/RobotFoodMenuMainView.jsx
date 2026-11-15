import React from 'react';
import {
  Search,
  ShoppingBag,
  X,
  ArrowLeft,
  ChefHat,
  Edit3,
} from 'lucide-react';
import { INITIAL_MENU_CATEGORIES, formatCurrency } from './robotFoodMenuCatalog';

export function RobotFoodMenuMainView({
  addToCart, cart, deliveryRoom, handleCategoryClick, handleMainScroll, handleOpenRoomModal, isReviewModalOpen, itemsByCategory, mainScrollRef, onClose, removeFromCart, searchQuery, selectedCategory, setIsReviewModalOpen, setSearchQuery, sidebarNavRef, totalItemsCount, totalPrice, totalVisibleItems,
}) {
  return (
    <>
      {/* CẢNH BÁO XOAY NGANG MÀN HÌNH KHI Ở CHẾ ĐỘ DỌC (PORTRAIT GUARD - GIỐNG ẢNH 1) */}
      <div className="robot-portrait-guard fixed inset-0 z-50 bg-stone-950 text-white items-center justify-center text-center p-8">
        <div>
          <p className="text-xs font-bold tracking-[0.24em] uppercase text-stone-400">HCROBOT</p>
          <h2 className="mt-3 text-2xl font-black">Vui lòng xoay ngang điện thoại</h2>
          <p className="mt-2 text-sm text-stone-400">Ứng dụng Robot được thiết kế để sử dụng ở chế độ ngang.</p>
        </div>
      </div>

      {/* CỘT BÊN TRÁI (LEFT SIDEBAR): Tối ưu safe-area tai thỏ & chiều rộng vừa vặn cho landscape */}
      <aside className="w-36 sm:w-40 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none overscroll-contain touch-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        {/* Tiêu đề Danh mục */}
        <div className="h-11 sm:h-12 shrink-0 px-2 sm:px-3 border-b border-[#E3DFD5] flex items-center bg-white/40 touch-none">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-stone-700 tracking-wider truncate">
            Danh Mục Món Ăn
          </span>
        </div>

        {/* Danh mục thực đơn */}
        <nav
          ref={sidebarNavRef}
          className={`flex-1 min-h-0 p-1.5 space-y-1 ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y no-scrollbar`}
        >
          {INITIAL_MENU_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                id={`sidebar-cat-${cat.id}`}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`w-full px-2.5 py-1.5 sm:py-2 rounded-xl text-left text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-sm'
                    : 'text-stone-700 hover:bg-white/70 hover:text-stone-900'
                }`}
              >
                <span className="block truncate">{cat.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* CỘT CHÍNH (MAIN AREA): HÀNG TRÊN (TIÊU ĐỀ) + LƯỚI MÓN ĂN + HÀNG DƯỚI (TỔNG CỘNG) */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F5F2EB] overscroll-none touch-none">
        {/* HÀNG TRÊN: TIÊU ĐỀ + NÚT QUAY LẠI ROBOT */}
        <header className="h-11 sm:h-12 shrink-0 border-b border-[#E3DFD5] px-3 sm:px-4 pr-[max(0.75rem,env(safe-area-inset-right,0px))] flex items-center justify-between bg-white/80 backdrop-blur-md touch-none">
          <div className="flex items-center">
            <h1 className="text-xs sm:text-sm font-black text-stone-900 tracking-tight">
              Xin mời quý khách chọn món ăn
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Box */}
            <div className="relative hidden lg:block w-48">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm món ngon..."
                className="w-full h-8 pl-8 pr-3 rounded-full bg-stone-100 border border-stone-300 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Room / Table badge - Bấm vào để sửa số phòng */}
            <button
              type="button"
              onClick={handleOpenRoomModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-sm transition-all cursor-pointer active:scale-95 group"
              title="Bấm để thay đổi số phòng nhận món"
            >
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              <span>{deliveryRoom ? `Phòng ${deliveryRoom}` : 'Chưa có phòng'}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5" />
            </button>

            {/* Nút Quay lại màn hình Robot */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Quay lại giao diện Robot"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Robot</span>
            </button>
          </div>
        </header>

        {/* LƯỚI DANH SÁCH MÓN ĂN (Hiển thị tất cả theo danh mục, cuộn và đồng bộ danh mục) */}
        <main
          ref={mainScrollRef}
          onScroll={handleMainScroll}
          className={`flex-1 min-h-0 p-4 ${
            isReviewModalOpen ? 'overflow-hidden pointer-events-none' : 'overflow-y-auto'
          } overscroll-contain touch-pan-y custom-scrollbar`}
        >
          {totalVisibleItems === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <ChefHat className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm font-bold text-stone-700">Không tìm thấy món ăn phù hợp</p>
              <p className="text-xs text-stone-400 mt-1">Vui lòng thử tìm với từ khóa khác</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-bold active:scale-95 transition-all"
                >
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {itemsByCategory.map((group) => {
                if (group.items.length === 0) return null;

                return (
                  <section
                    key={group.category.id}
                    id={`cat-section-${group.category.id}`}
                    className="scroll-mt-2"
                  >
                    {/* Note phân cách danh mục (cuộn tự nhiên, không thanh ngang cố định che món ăn) */}
                    <div className="flex items-center gap-2 mb-2.5 pt-1">
                      <span className="text-stone-900 text-sm font-black leading-none select-none">•</span>
                      <h2 className="text-xs sm:text-sm font-black text-stone-900 uppercase tracking-wider">
                        {group.category.name}
                      </h2>
                    </div>

                    {/* Danh sách món ăn 1 cột (1 món mỗi hàng, thẻ to rõ ràng, hình ảnh nổi bật chuẩn Kiosk) */}
                    <div className="flex flex-col gap-3 sm:gap-3.5">
                      {group.items.map((item) => {
                        const quantityInCart = cart[item.id]?.qty || 0;

                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl sm:rounded-3xl border border-[#E3DFD5] p-3 sm:p-3.5 shadow-xs hover:shadow-md transition-all flex items-center gap-3.5 sm:gap-4 group hover:border-stone-400 min-h-[116px] sm:min-h-[124px]"
                          >
                            {/* Ảnh món ăn bên trái: To, rõ nét, bắt mắt */}
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl overflow-hidden bg-stone-100 shadow-xs">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
                                }}
                              />
                              {item.badge && (
                                <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold rounded-md">
                                  {item.badge}
                                </span>
                              )}
                            </div>

                            {/* Thông tin món ăn ở giữa: Tên món to đậm, mô tả chi tiết thoáng đãng */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
                              <h3 className="text-sm sm:text-base font-black text-stone-900 truncate group-hover:text-black leading-snug">
                                {item.name}
                              </h3>
                              <p className="text-xs sm:text-[13px] text-stone-600 line-clamp-2 mt-1 sm:mt-1.5 leading-relaxed">
                                {item.description}
                              </p>
                            </div>

                            {/* Cột giá tiền & Thao tác chọn món bên phải: Nút to dễ bấm trên màn hình cảm ứng */}
                            <div className="flex flex-col items-end justify-between self-stretch py-1 shrink-0 pl-3 sm:pl-4 border-l border-stone-100 min-w-[105px] sm:min-w-[120px]">
                              <span className="text-sm sm:text-base font-black text-stone-900 whitespace-nowrap">
                                {formatCurrency(item.price)} đ
                              </span>

                              {quantityInCart === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="h-8 sm:h-8.5 px-3.5 sm:px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs active:scale-95 transition-all cursor-pointer"
                                  title="Thêm vào danh sách chọn"
                                >
                                  + Thêm
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 bg-stone-100 rounded-full p-1 border border-stone-200">
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.id)}
                                    className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                    title="Bớt 1 món"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs sm:text-sm font-black text-stone-900 min-w-5 text-center px-0.5">
                                    {quantityInCart}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                                    title="Thêm 1 món"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>

        {/* HÀNG CUỐI: TỔNG CỘNG: ... Đ & NÚT XEM LẠI MENU */}
        <footer className="h-11 sm:h-12 shrink-0 bg-white border-t border-[#E3DFD5] px-4 sm:px-6 pr-[max(1rem,env(safe-area-inset-right,0px))] flex items-center justify-between shadow-lg z-10 touch-none pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider">
              Tổng cộng:
            </span>
            <span className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
              {formatCurrency(totalPrice)} đ
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Nút Xem lại menu có hiển thị số lượng món đã chọn */}
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              disabled={totalItemsCount === 0}
              className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-full font-bold text-[11px] sm:text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 ${
                totalItemsCount > 0
                  ? 'bg-[#1A1917] hover:bg-stone-800 text-white shadow-stone-950/20'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Xem lại menu</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black min-w-4 text-center ${
                  totalItemsCount > 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-300 text-stone-500'
                }`}
              >
                {totalItemsCount}
              </span>
            </button>
          </div>
        </footer>
      </div>

    </>
  );
}
