import React from 'react';
import {
  ShoppingBag,
  X,
  Trash2,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { formatCurrency } from './robotFoodMenuCatalog';

export function RobotFoodMenuModals({
  activeRoomNumber, addToCart, cart, deleteFromCart, deliveryRoom, executePlaceOrder, handleConfirmOrder, handleOpenRoomModal, isPinModalOpen, isPinModalSelectingRoom, isReviewModalOpen, isSubmitting, onClose, onNotCheckedIn, onPinVerifiedSuccess, onRoomChange, orderSuccessData, removeFromCart, sessionId, setDeliveryRoom, setIsLocalPinVerified, setIsPinModalOpen, setIsPinModalSelectingRoom, setIsReviewModalOpen, setOrderSuccessData, totalItemsCount, totalPrice,
}) {
  return (
    <>
      {/* MODAL / DRAWER XEM LẠI MENU (CHI TIẾT MÓN ĐÃ CHỌN & XÁC NHẬN GỌI MÓN) */}
      {isReviewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end animate-fadeIn overscroll-none touch-none"
          onClick={() => setIsReviewModalOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-[#FAF8F5] border-l border-[#E3DFD5] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overscroll-contain touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="h-14 shrink-0 px-5 border-b border-[#E3DFD5] bg-white flex items-center justify-between touch-none">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-stone-800" />
                <h3 className="text-sm font-black text-stone-900 uppercase tracking-tight">
                  Món Đã Chọn ({totalItemsCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Danh sách các món trong giỏ (Chỉ lướt bên trong giỏ, không cuộn nền bên dưới) */}
            <div className="cart-drawer-scrollable flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar overscroll-contain touch-pan-y">
              {Object.values(cart).length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-stone-400">
                  Chưa có món nào được chọn.
                </div>
              ) : (
                Object.values(cart).map(({ item, qty }) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-2xl border border-[#E3DFD5] flex items-center gap-3 shadow-xs"
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-stone-100"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{item.name}</h4>
                      <p className="text-[10px] text-stone-500">{formatCurrency(item.price)} đ</p>
                      <p className="text-[11px] font-black text-stone-900 mt-0.5">
                        {formatCurrency(item.price * qty)} đ
                      </p>
                    </div>

                    {/* Bộ điều khiển số lượng */}
                    <div className="flex items-center gap-1.5 bg-stone-100 rounded-full p-1 border border-stone-200">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-6 h-6 rounded-full bg-white hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-black text-stone-900 min-w-4 text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-6 h-6 rounded-full bg-stone-900 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteFromCart(item.id)}
                      className="text-stone-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal: Tổng cộng & Nút Đặt Món */}
            <div className="p-4 border-t border-[#E3DFD5] bg-white space-y-3 touch-none">
              {/* Phòng nhận món - Bấm vào để sửa */}
              <div className="flex items-center justify-between text-xs py-2 px-3 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-stone-400" />
                  <span>Giao đến phòng:</span>
                </span>
                <button
                  type="button"
                  onClick={handleOpenRoomModal}
                  className="font-black text-stone-900 hover:text-stone-700 flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-lg hover:bg-stone-200/60"
                  title="Bấm để thay đổi số phòng nhận món"
                >
                  <span>{deliveryRoom ? `Phòng ${deliveryRoom}` : 'Chưa có phòng'}</span>
                  <Edit3 className="w-3 h-3 text-stone-400" />
                </button>
              </div>

              <div className="flex justify-between items-baseline text-xs">
                <span className="font-black text-stone-900 text-sm">Tổng cộng:</span>
                <span className="font-black text-xl text-stone-900">
                  {formatCurrency(totalPrice)} đ
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={totalItemsCount === 0 || isSubmitting}
                className="w-full py-3.5 rounded-full bg-[#1A1917] hover:bg-stone-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Đang gửi yêu cầu...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-300" />
                    <span>
                      {deliveryRoom || activeRoomNumber
                        ? `Đặt Món (Phòng ${deliveryRoom || activeRoomNumber})`
                        : `Xác Nhận Đặt Món (${totalItemsCount})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÃ PIN PHÒNG 6 SỐ CẢM ỨNG & CHỌN PHÒNG (100% TOUCH UI NUMPAD) */}
      <RoomPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (totalItemsCount > 0) {
            setIsReviewModalOpen(true);
          }
        }}
        roomNumber={deliveryRoom || activeRoomNumber}
        isSelectingRoomInitial={isPinModalSelectingRoom}
        sessionId={sessionId}
        onRoomSelect={(room) => {
          setDeliveryRoom(room);
          onRoomChange(room);
        }}
        pendingAction="verify_only"
        skipTicketCreation={true}
        pendingItems={Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ')}
        initialTab="pin"
        onVerifiedSuccess={(res, verifiedRoom) => {
          const finalRoom = verifiedRoom || res?.room_number || deliveryRoom || activeRoomNumber;
          setDeliveryRoom(finalRoom);
          setIsLocalPinVerified(true);
          if (typeof onPinVerifiedSuccess === 'function') {
            onPinVerifiedSuccess(finalRoom);
          }
          onRoomChange(finalRoom);
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          // ĐÃ XÁC THỰC MÃ PIN HỢP LỆ -> TIẾN HÀNH ĐẶT MÓN
          executePlaceOrder(finalRoom, res?.guest_name);
        }}
        onNotCheckedIn={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          onNotCheckedIn(info);
        }}
        onForgotPin={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) {
            onNotCheckedIn({
              destination_key: 'front_desk',
              message: 'Dạ vì lý do an toàn và bảo mật thông tin phòng, Robot không thể cấp lại mã PIN phòng. Quý khách vui lòng đến quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ nhé ạ.',
              roomNumber: info?.roomNumber || deliveryRoom,
            });
          }
        }}
      />

      {/* POPUP THÔNG BÁO ĐẶT MÓN THÀNH CÔNG */}
      {orderSuccessData && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overscroll-none touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center mx-auto text-2xl border border-stone-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              {orderSuccessData.isMerged ? (
                <>
                  <span className="inline-block px-3 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold mb-1.5">
                    Đã Tự Động Gộp Vào Đơn Hiện Tại
                  </span>
                  <h3 className="text-base font-black text-stone-900">Gộp Món Thành Công!</h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Mã đơn: <span className="font-mono font-bold text-stone-800">{orderSuccessData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                    Phòng <strong className="text-stone-900">{orderSuccessData.room}</strong> đang có đơn món chờ Bếp nấu. Hệ thống đã tự động gộp các món mới đặt vào chung đơn này để Bếp chế biến và Robot giao cùng một chuyến duy nhất.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-black text-stone-900">Đặt Món Thành Công!</h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Mã đơn: <span className="font-mono font-bold text-stone-800">{orderSuccessData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                    Đơn hàng đã được chuyển trực tiếp đến Bếp chế biến. Nhân viên bếp sẽ liên hệ với quý khách qua SĐT hoặc máy nhánh nếu cần trao đổi thêm. Món ăn sẽ được giao đến{' '}
                    <strong className="text-stone-900">{orderSuccessData.room ? `phòng ${orderSuccessData.room}` : 'phòng của quý khách'}</strong> ngay sau khi hoàn tất.
                  </p>
                </>
              )}
            </div>

            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs flex flex-col gap-1.5 text-left">
              <div className="flex justify-between font-bold items-center">
                <span className="text-stone-500">Ghi vào hóa đơn phòng:</span>
                <span className="text-stone-900 text-sm">{formatCurrency(orderSuccessData.totalAmount)} đ</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-normal font-normal">
                Hóa đơn đã được chuyển về quầy Lễ tân. Quý khách thanh toán khi làm thủ tục trả phòng (không thanh toán tại chỗ).
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderSuccessData(null)}
                className="flex-1 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer"
              >
                Tiếp tục xem menu
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSuccessData(null);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-full bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Về Robot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
