import React from 'react';
import {
  X,
  Plus,
  Minus,
  Clock,
  ChevronRight,
  ConciergeBell,
  Edit3,
} from 'lucide-react';
import { SERVICE_CATEGORIES, formatCurrency } from './robotRoomServiceCatalog';

export const RobotRoomServiceMainView = ({
  activeCategory,
  setActiveCategory,
  onClose,
  targetRoom,
  setIsPinModalSelectingRoom,
  setIsPinModalOpen,
  loadStatusForRoom,
  totalItemsCount,
  setIsReviewModalOpen,
  filteredServices,
  cart,
  handleAddToCart,
  handleRemoveFromCart,
  totalPrice,
}) => (
  <>
      {/* SIDEBAR DANH MỤC DỊCH VỤ */}
      <aside className="w-36 sm:w-44 shrink-0 bg-[#EFECE4] border-r border-[#E3DFD5] flex flex-col h-full select-none pl-[max(0.75rem,env(safe-area-inset-left,0px))]">
        <div className="p-3 border-b border-[#E3DFD5]">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] uppercase font-bold tracking-wider">
            <ConciergeBell className="w-3.5 h-3.5" />
            <span>Room Service</span>
          </div>
          <h2 className="text-xs sm:text-sm font-black text-stone-900 mt-0.5">Dịch Vụ Phòng</h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {SERVICE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1A1917] text-white shadow-sm font-bold'
                    : 'hover:bg-[#E5E1D8] text-stone-700 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span className="text-xs truncate">{cat.name}</span>
              </button>
            );
          })}
        </nav>
        {/* Nút đóng thoát về Robot */}
        <div className="p-2 border-t border-[#E3DFD5]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Về Robot</span>
          </button>
        </div>
      </aside>
      {/* KHU VỰC CHÍNH: LƯỚI DANH SÁCH DỊCH VỤ */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F5F2EB]">
        {/* Header trên */}
        <header className="h-14 px-4 sm:px-6 bg-[#F5F2EB] border-b border-[#E3DFD5] flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm sm:text-base font-black text-stone-900">
              Tiện Ích & Dịch Vụ Phục Vụ Tại Phòng
            </h1>
            <p className="text-[11px] text-stone-500">
              Khăn tắm, chăn gối, massage thư giãn · Gửi về Room Service & Lễ tân
            </p>
          </div>
          {/* Thanh điều khiển Header: Chọn phòng, Tiến độ, Giỏ hàng, Đóng */}
          <div className="flex items-center gap-2">
            {/* 1. Nút Chọn / Sửa Số Phòng */}
            <button
              type="button"
              onClick={() => {
                setIsPinModalSelectingRoom(true);
                setIsPinModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-800 shadow-xs transition-all cursor-pointer active:scale-95 group"
              title="Bấm để chọn hoặc đổi số phòng"
            >
              <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chọn số phòng'}</span>
              <Edit3 className="w-3 h-3 text-stone-400 group-hover:text-stone-700 transition-colors ml-0.5" />
            </button>
            {/* 2. Nút Tra Cứu Tiến Độ Yêu Cầu & Dọn Phòng */}
            <button
              type="button"
              onClick={() => loadStatusForRoom(targetRoom)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-[#E3DFD5] hover:border-stone-400 text-[11px] font-bold text-stone-700 hover:text-stone-900 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Tra cứu tiến độ dịch vụ phòng và dọn phòng"
            >
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden sm:inline">Tiến độ yêu cầu</span>
              <span className="sm:hidden">Tiến độ</span>
            </button>
            {/* 3. Giỏ yêu cầu mini */}
            {totalItemsCount > 0 && (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <ConciergeBell className="w-3.5 h-3.5" />
                <span>Yêu Cầu ({totalItemsCount})</span>
                {totalPrice > 0 && <span>· {formatCurrency(totalPrice)}</span>}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        {/* Danh sách lưới dịch vụ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-20">
            {filteredServices.map((item) => {
              const inCartQty = cart[item.id]?.qty || 0;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#E3DFD5] shadow-xs hover:shadow-md overflow-hidden flex flex-col transition-all group"
                >
                  {/* Hình ảnh dịch vụ */}
                  <div className="relative h-32 sm:h-36 overflow-hidden bg-stone-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white">
                      {item.badge}
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-[10px] font-medium text-stone-200 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>~{item.prep_time}p</span>
                    </div>
                  </div>
                  {/* Thông tin dịch vụ */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-1 text-[10px] text-stone-400 font-medium">
                        Quy cách: {item.unit}
                      </div>
                    </div>
                    {/* Giá tiền & Nút Thêm */}
                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                        {formatCurrency(item.price)}
                      </span>
                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-2 bg-stone-100 px-2 py-1 rounded-xl border border-stone-200">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200 flex items-center justify-center text-stone-800 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black min-w-[16px] text-center">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item)}
                            className="w-6 h-6 rounded-lg bg-[#1A1917] hover:bg-stone-800 text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-[#1A1917] hover:text-white text-stone-900 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Yêu cầu</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Thanh Bottom Bar khi có đồ trong giỏ */}
        {totalItemsCount > 0 && (
          <div className="p-3 sm:p-4 bg-white border-t border-[#E3DFD5] flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center font-black text-stone-900 border border-stone-200">
                {totalItemsCount}
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">
                  {totalPrice > 0 ? `Chi phí dự kiến: ${formatCurrency(totalPrice)}` : 'Dịch vụ miễn phí'}
                </p>
                <p className="text-[10px] text-stone-500">
                  Ghi vào hóa đơn phòng · Lễ tân thanh toán khi trả phòng
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(true)}
              className="py-2.5 px-5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <span>Xem Lại & Xác Nhận</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
  </>
);
