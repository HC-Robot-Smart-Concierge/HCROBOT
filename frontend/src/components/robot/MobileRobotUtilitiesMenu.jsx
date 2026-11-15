import React from 'react';
import { Clock, X, PhoneCall, Map as MapIcon, Utensils, Building, ChevronRight, ConciergeBell, Sparkles, Car, Wrench, Luggage } from 'lucide-react';

export const MobileRobotUtilitiesMenu = ({
  isUtilitiesMenuOpen, setIsUtilitiesMenuOpen, isEn, isSpeaking, isProcessing, isListening, isBusy, setIsMapManualOpen, onOpenFacilities, onOpenFoodMenu, onOpenRoomService, onOpenBellman, onOpenMaintenance, onOpenTaxiBooking, onOpenOrderStatus, onOpenServiceStatus, onOpenMaintenanceStatus, onCallStaff,
}) => (
  <>
        {isUtilitiesMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#F5F2EB] backdrop-blur-2xl flex flex-col justify-between p-3.5 sm:p-5 robot-safe-x animate-fadeIn text-[#1A1917] select-none overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={isEn ? 'Utilities Menu' : 'Danh mục tiện ích'}
          >
            {/* Header: Tiêu đề Danh mục + Voice Status + Nút Đóng lớn */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DFD5] shrink-0">
              {/* Bên trái: Tiêu đề Danh mục & Trạng thái Voice */}
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900 truncate">
                    {isEn ? 'Utilities Menu' : 'Danh mục tiện ích'}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 border border-stone-300 shrink-0">
                    HCROBOT
                  </span>
                </div>
                {/* Trạng thái Voice / Lắng nghe mini (Theme xám nhạt) */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Listening... Please speak' : 'Listening... · Đang lắng nghe...'}
                      </span>
                    </>
                  ) : isSpeaking ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Robot speaking · Tap to interrupt' : 'Robot đang nói · Chạm để ngắt lời'}
                      </span>
                    </>
                  ) : isBusy ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-stone-400 animate-ping shrink-0" />
                      <span className="text-[11px] font-medium text-stone-500 truncate">
                        {isEn ? 'Processing...' : 'Đang xử lý...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                      <span className="text-[11px] text-stone-500 font-medium truncate">
                        {isEn ? 'Tap card or speak directly with robot' : 'Chạm chọn dịch vụ hoặc nói trực tiếp với robot'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Bên phải: Nút Đóng kích thước lớn chuẩn Touch Kiosk */}
              <button
                type="button"
                onClick={() => {
                  setIsUtilitiesMenuOpen(false);
                }}
                className="h-9 px-4 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white border border-[#1A1917] text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
                title={isEn ? 'Close menu' : 'Đóng menu'}
                aria-label={isEn ? 'Close' : 'Đóng'}
              >
                <X className="w-4 h-4" />
                <span>{isEn ? 'Close' : 'Đóng'}</span>
              </button>
            </div>

            {/* Thân Menu: Grid 2 Cột x Thẻ To dễ bấm cho Kiosk (Theme Xám Trắng Sáng Rõ) */}
            <div className="flex-1 min-h-0 py-2.5 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 h-full content-start">
                {/* 1. Cơ sở vật chất & Tiện ích 5 sao */}
                {onOpenFacilities && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFacilities();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Hotel Facilities & Amenities' : 'Cơ sở vật chất & Tiện ích'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Infinity Pool, Spa, Gym, Sky Bar' : 'Hồ bơi vô cực, Spa, Gym, Sky Bar'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 2. Sơ đồ bản đồ (8 Tầng) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMapManualOpen(true);
                    setIsUtilitiesMenuOpen(false);
                  }}
                  className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                      {isEn ? 'Floor Map (8 Floors)' : 'Sơ đồ bản đồ (8 Tầng)'}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                      {isEn ? '2D Wayfinding & Floor selector' : 'Chỉ đường 2D & đổi tầng'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* 3. Thực đơn chọn món */}
                {onOpenFoodMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFoodMenu();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'In-Room Dining Menu' : 'Thực đơn chọn món'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Order culinary & drinks to room' : 'Gọi món ăn & đồ uống lên phòng'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4. Dịch vụ phòng (Room Service: Khăn tắm, gối chăn, massage tại phòng) */}
                {onOpenRoomService && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenRoomService();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <ConciergeBell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'In-Room Services & Amenities' : 'Dịch vụ phòng (Room Service)'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Towels, extra bedding, in-room spa massage' : 'Thêm khăn tắm, gối chăn, massage tại phòng'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 3z. Hành lý & Bellman (Bellman Menu) */}
                {onOpenBellman && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenBellman();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Luggage className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Luggage & Bellman' : 'Hành lý & Bellman'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Bring, store & retrieve bags, room moves' : 'Mang, gửi giữ hành lý & chuyển đồ sang phòng mới'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4a. Báo hỏng & Sửa chữa kỹ thuật (Maintenance Menu) */}
                {onOpenMaintenance && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMaintenance();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Repairs & Maintenance' : 'Báo hỏng & Sửa chữa'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'AC, plumbing, electrical, door locks & facilities' : 'Điều hòa, điện nước, khóa phòng & sự cố'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4b. Đặt Xe & Taxi Sảnh */}
                {onOpenTaxiBooking && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenTaxiBooking();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Car className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Book Taxi & Lobby Ride' : 'Đặt xe & Gọi taxi'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? '4 - 7 seater cars, hotlines & airport shuttle' : 'Xe 4 - 7 chỗ, hotline & đưa đón sân bay'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5. Kiểm tra trạng thái món ăn */}
                {onOpenOrderStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenOrderStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Food Order Status' : 'Tiến độ món ăn'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check kitchen cooking progress' : 'Tra cứu tình trạng chế biến'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5b. Kiểm tra tiến độ dịch vụ phòng & dọn phòng */}
                {onOpenServiceStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenServiceStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Housekeeping & Service Status' : 'Tiến độ dọn phòng & dịch vụ'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check room cleaning & amenities progress' : 'Tra cứu dọn phòng, khăn tắm, massage'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 5c. Kiểm tra tiến độ sửa chữa kỹ thuật */}
                {onOpenMaintenanceStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMaintenanceStatus();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Technical Repair Status' : 'Tiến độ sửa chữa'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Check room repair progress' : 'Tra cứu tiến độ xử lý sự cố thiết bị'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}

                {/* 4. Gọi Nhân Viên Trực (Video Call) */}
                {onCallStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      onCallStaff();
                      setIsUtilitiesMenuOpen(false);
                    }}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white hover:bg-stone-50 active:scale-[0.98] border border-[#E3DFD5] hover:border-stone-400 transition-all cursor-pointer flex items-center gap-3.5 group text-left shadow-xs hover:shadow-md min-h-[64px]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white group-hover:scale-105 transition-all">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-stone-900 group-hover:text-black transition-colors truncate">
                        {isEn ? 'Call Staff Support' : 'Gọi nhân viên hỗ trợ'}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-stone-600 font-medium group-hover:text-stone-800 transition-colors truncate mt-0.5">
                        {isEn ? 'Direct video call assistance' : 'Kết nối hỗ trợ trực tiếp'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* Footer: Thông tin khách sạn & gợi ý chạm */}
            <div className="pt-2 border-t border-[#E3DFD5] flex items-center justify-between text-[10px] text-stone-600 shrink-0">
              <span className="font-bold text-stone-700">Aurora Grand Hotel · 5-Star Concierge</span>
              <span className="text-stone-600 font-medium">
                {isEn ? 'Tap any card or speak directly to command' : 'Chạm vào thẻ hoặc nói để điều khiển'}
              </span>
            </div>
          </div>
        )}
  </>
);
