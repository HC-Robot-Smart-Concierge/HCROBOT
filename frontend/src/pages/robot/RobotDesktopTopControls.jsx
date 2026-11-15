import React from 'react';
import {
  PhoneCall, Clock, Utensils, ConciergeBell, Star, Building,
  Film, Menu, Globe, Check, Car, LogOut, Wrench, Luggage,
} from 'lucide-react';
import { createConciergeRequest } from '../../services/conciergeApi';

/**
 * Desktop top bar controls: hotel branding secret tap area, room exit pill,
 * language selector, and service quick menu.
 */
export const RobotDesktopTopControls = ({
  handleSecretAreaClick,
  activeRoomNumber,
  language,
  setLanguage,
  handleManualResetSession,
  showLangMenu,
  setShowLangMenu,
  showQuickMenu,
  setShowQuickMenu,
  setIsFacilitiesModalOpen,
  speak,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsMaintenanceMenuOpen,
  setIsBellmanMenuOpen,
  setIsTaxiModalOpen,
  updateStatusQueryType,
  isRoomPickerOpenRef,
  setIsRoomPickerOpen,
  handleTriggerTaxiBooking,
  setIsStandby,
  setVideoCallSessionId,
  setVideoCallTicketCode,
  setIsVideoCallOpen,
  handleOpenFeedback,
}) => (
  <>
  {/* Top-Left Branding & Secret Multi-Tap Zone (Nhân viên: Gõ 5 lần liên tiếp để mở Đăng xuất) */}
  <div
    onClick={handleSecretAreaClick}
    className="absolute top-5 left-6 z-40 flex items-center gap-2.5 cursor-default select-none"
    title=""
  >
    <strong className="text-xs font-black tracking-widest text-stone-400/90 uppercase">HCROBOT</strong>
    <span className="w-1.5 h-1.5 rounded-full bg-stone-600" />
    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Aurora Grand Hotel</span>
  </div>

  {/* Top-Right Controls: Phòng hiện tại, Thoát phiên, Ngôn ngữ & Menu Dịch Vụ */}
  <div className="absolute top-5 right-5 z-40 flex items-center gap-2.5">
    {/* Active Room Session & Nút Thoát phiên cho Desktop */}
    {activeRoomNumber && (
      <div className="flex items-center gap-2 bg-stone-900/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-700/80 shadow-lg animate-fadeIn">
        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-stone-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {language === 'English' ? `Room ${activeRoomNumber}` : `Phòng ${activeRoomNumber}`}
        </span>
        <button
          type="button"
          onClick={handleManualResetSession}
          title={language === 'English' ? `Exit session for room ${activeRoomNumber}` : `Thoát phiên phòng ${activeRoomNumber}`}
          className="h-6 px-2.5 rounded-full bg-rose-950/70 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-800/60 text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 touch-manipulation"
          aria-label={language === 'English' ? 'Exit session' : 'Thoát phiên'}
        >
          <LogOut className="w-3 h-3 text-rose-400" />
          <span>{language === 'English' ? 'Exit' : 'Thoát phiên'}</span>
        </button>
      </div>
    )}

    {/* 1. Nút Icon Địa Cầu Chuyển Ngôn Ngữ (Tiếng Việt & English) */}
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowLangMenu((prev) => !prev);
          setShowQuickMenu(false);
        }}
        className="w-9 h-9 rounded-full bg-stone-900/85 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 flex items-center justify-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
        title="Ngôn ngữ / Language"
        aria-label="Chọn ngôn ngữ"
      >
        <Globe className="w-4 h-4 text-stone-300" />
      </button>

      {showLangMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-11 right-0 w-44 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl p-1.5 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95 space-y-1"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1 border-b border-stone-800 flex items-center justify-between">
            <span>Ngôn ngữ</span>
            <span className="text-[9px] text-stone-500 font-mono">LANG</span>
          </div>

          {/* Tiếng Việt */}
          <button
            type="button"
            onClick={() => {
              setLanguage('Tiếng Việt');
              setShowLangMenu(false);
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${language === 'Tiếng Việt'
              ? 'bg-stone-800 text-stone-100 border border-stone-600'
              : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
              }`}
          >
            <span className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-stone-700 text-[10px] font-bold text-stone-300">VI</span>
              <span>Tiếng Việt</span>
            </span>
            {language === 'Tiếng Việt' && <Check className="w-3.5 h-3.5 text-stone-200" />}
          </button>

          {/* English */}
          <button
            type="button"
            onClick={() => {
              setLanguage('English');
              setShowLangMenu(false);
            }}
            className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${language === 'English'
              ? 'bg-stone-800 text-stone-100 border border-stone-600'
              : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100'
              }`}
          >
            <span className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-stone-700 text-[10px] font-bold text-stone-300">EN</span>
              <span>English</span>
            </span>
            {language === 'English' && <Check className="w-3.5 h-3.5 text-stone-200" />}
          </button>
        </div>
      )}
    </div>

    {/* 2. Nút Icon Menu Dịch Vụ */}
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowQuickMenu((prev) => !prev);
          setShowLangMenu(false);
        }}
        className="w-9 h-9 rounded-full bg-stone-900/85 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/80 flex items-center justify-center shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
        title="Menu Dịch vụ và Tiện ích"
        aria-label="Menu dịch vụ"
      >
        <Menu className="w-4 h-4 text-stone-300" />
      </button>

      {showQuickMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-11 right-0 w-80 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl p-2.5 space-y-1.5 backdrop-blur-xl z-50 text-left animate-in fade-in zoom-in-95"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 py-1 border-b border-stone-800 flex items-center justify-between">
            <span>Menu Dịch vụ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
          </div>


          {/* 2. Cơ Sở Vật Chất & Tiện Ích 5 Sao */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsFacilitiesModalOpen(true);
              speak('Dạ đây là toàn bộ cơ sở vật chất và tiện ích 5 sao của khách sạn ạ.');
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Building className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Cơ sở vật chất & Tiện ích</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Hồ bơi vô cực, Spa, Gym, Sky Bar, Bãi xe</p>
            </div>
          </button>

          {/* 3. Thực Đơn Món Ăn & Đặt Nhà Hàng */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsFoodMenuOpen(true);
              setIsRoomServiceMenuOpen(false);
              setIsMaintenanceMenuOpen(false);
              setIsBellmanMenuOpen(false);
              setIsTaxiModalOpen(false);
              setIsFacilitiesModalOpen(false);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Utensils className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Thực đơn món ăn</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Danh mục món ăn & đặt ẩm thực tại phòng</p>
            </div>
          </button>

          {/* 3b. Dịch Vụ Phòng (Room Service) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsRoomServiceMenuOpen(true);
              setIsFoodMenuOpen(false);
              setIsMaintenanceMenuOpen(false);
              setIsBellmanMenuOpen(false);
              setIsTaxiModalOpen(false);
              setIsFacilitiesModalOpen(false);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <ConciergeBell className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Dịch vụ phòng</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Khăn tắm, gối chăn, massage tại phòng & giặt ủi</p>
            </div>
          </button>

          {/* 3b1. Hành lý & Bellman */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsBellmanMenuOpen(true);
              setIsMaintenanceMenuOpen(false);
              setIsFoodMenuOpen(false);
              setIsRoomServiceMenuOpen(false);
              setIsTaxiModalOpen(false);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Luggage className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Hành lý & Bellman</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Mang, gửi giữ hành lý & chuyển đồ sang phòng mới</p>
            </div>
          </button>

          {/* 3b2. Báo hỏng & Sửa chữa kỹ thuật */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsMaintenanceMenuOpen(true);
              setIsFoodMenuOpen(false);
              setIsRoomServiceMenuOpen(false);
              setIsTaxiModalOpen(false);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Wrench className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Báo hỏng & Sửa chữa</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Điều hòa, điện nước, khóa phòng & tra cứu tiến độ</p>
            </div>
          </button>

          {/* 3c. Kiểm tra tiến độ dịch vụ phòng & dọn phòng */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              updateStatusQueryType('service');
              isRoomPickerOpenRef.current = true;
              setIsRoomPickerOpen(true);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Clock className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Tiến độ dọn phòng & dịch vụ</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Tra cứu tiến độ dọn phòng, thêm khăn & massage</p>
            </div>
          </button>

          {/* 3c2. Kiểm tra tiến độ sửa chữa kỹ thuật */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              updateStatusQueryType('maintenance');
              isRoomPickerOpenRef.current = true;
              setIsRoomPickerOpen(true);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Wrench className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Tiến độ sửa chữa kỹ thuật</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Tra cứu trạng thái xử lý sự cố thiết bị phòng</p>
            </div>
          </button>

          {/* 3d. Đặt Xe & Gọi Taxi */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              handleTriggerTaxiBooking();
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Car className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Đặt xe & Gọi taxi</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Gọi xe 4 - 7 chỗ hoặc đưa đón sân bay trong 3-5 phút</p>
            </div>
          </button>

          {/* 4. Video & Poster Quảng Cáo Ưu Đãi */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              setIsStandby(true);
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Film className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Video & Poster ưu đãi</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Chiếu poster & clip quảng bá dịch vụ</p>
            </div>
          </button>

          {/* 5. Gọi Lễ Tân / Nhân Viên Trực Tiếp */}
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              try {
                const req = await createConciergeRequest({
                  title: 'Yêu cầu gọi video trực tiếp từ Khách tại Kiosk',
                  room_number: activeRoomNumber || 'Main Lobby Kiosk',
                  guest_name: 'Khách tại Sảnh',
                  description: 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge',
                });
                const canonicalCode = req.ticket_code || req.id || `SUP-${Date.now()}`;
                setVideoCallSessionId(canonicalCode);
                setVideoCallTicketCode(req.ticket_code || canonicalCode);
                setIsVideoCallOpen(true);
              } catch (err) {
                const fallbackCode = `CCG-${Date.now()}`;
                setVideoCallSessionId(fallbackCode);
                setVideoCallTicketCode(fallbackCode);
                setIsVideoCallOpen(true);
              }
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <PhoneCall className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Gọi lễ tân trực tiếp</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Kết nối cuộc gọi video hỗ trợ tức thì</p>
            </div>
          </button>

          {/* 6. Hoàn tất / Đánh Giá Dịch Vụ */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowQuickMenu(false);
              handleOpenFeedback();
            }}
            className="w-full p-2.5 rounded-xl text-left hover:bg-stone-800/90 transition-all cursor-pointer flex items-center gap-3 group active:scale-[0.99]"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700/80 text-stone-300 flex items-center justify-center shrink-0 group-hover:bg-stone-700 group-hover:text-stone-100 group-hover:scale-105 transition-all">
              <Star className="w-4 h-4 text-stone-300 group-hover:text-stone-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-200 group-hover:text-white transition-colors">Hoàn tất / Đánh giá</p>
              <p className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Kết thúc phiên & khảo sát hài lòng 5 sao</p>
            </div>
          </button>
        </div>
      )}
    </div>
  </div>
  </>
);
