import React from 'react';
import {
  X,
  CheckCircle2,
  ConciergeBell,
  Edit3,
} from 'lucide-react';
import { RoomPinModal } from './RoomPinModal';
import { formatCurrency } from './robotRoomServiceCatalog';

export const RobotRoomServiceReviewAndPinModals = ({
  isReviewModalOpen,
  setIsReviewModalOpen,
  targetRoom,
  setTargetRoom,
  activeRoomNumber,
  authenticatedRoom,
  isLocalPinVerified,
  setIsLocalPinVerified,
  isPinModalOpen,
  setIsPinModalOpen,
  isPinModalSelectingRoom,
  setIsPinModalSelectingRoom,
  isStatusModalOpen,
  loadStatusForRoom,
  cart,
  requestNote,
  setRequestNote,
  totalItemsCount,
  totalPrice,
  isSubmitting,
  executeSubmitRequest,
  onPinVerifiedSuccess,
  sessionId,
  onRoomChange,
  onClose,
}) => (
  <>
      {/* MODAL XEM LẠI YÊU CẦU TRƯỚC KHI NHẬP PIN */}
      {isReviewModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsReviewModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white border border-[#E3DFD5] text-[#1A1917] rounded-3xl p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E3DFD5] pb-3">
              <div className="flex items-center gap-2">
                <ConciergeBell className="w-4 h-4 text-stone-700" />
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">Xác Nhận Dịch Vụ Phòng</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Vị trí phục vụ - Chọn số phòng nhận dịch vụ */}
            <div className="flex justify-between items-center text-xs p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${targetRoom ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                <span className="text-stone-600 font-medium">Phục vụ tới phòng:</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setIsPinModalSelectingRoom(true);
                  setIsPinModalOpen(true);
                }}
                className="font-bold text-stone-900 hover:text-stone-700 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 shadow-2xs cursor-pointer transition-colors active:scale-95"
                title="Bấm để chọn hoặc đổi số phòng"
              >
                <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chưa chọn phòng'}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
            {/* Danh sách items */}
            <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {Object.values(cart).map(({ item, qty }) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-stone-500">{item.unit}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className={`font-bold ${item.price > 0 ? 'text-stone-900' : 'text-emerald-700'}`}>
                      {item.price > 0 ? formatCurrency(item.price * qty) : 'Miễn phí'}
                    </p>
                    <p className="text-[10px] text-stone-500">SL: {qty}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Thông báo thanh toán */}
            <div className="p-3.5 rounded-2xl bg-[#EFECE4]/50 border border-[#E3DFD5] text-[11px] text-stone-700 space-y-1">
              <div className="flex justify-between font-extrabold text-xs text-stone-900">
                <span>Tổng chi phí phát sinh:</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <p className="text-[10px] text-stone-500 leading-snug">
                Chi phí (nếu có) được ghi nhận vào hóa đơn phòng khi trả phòng tại Lễ tân.
              </p>
            </div>
            {/* Nút bấm xác nhận gửi yêu cầu */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer"
              >
                Chọn thêm
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  const roomToUse = targetRoom || activeRoomNumber;
                  const isCurrentlyAuth = Boolean(
                    roomToUse &&
                    ((authenticatedRoom && String(authenticatedRoom).trim() === String(roomToUse).trim()) ||
                     isLocalPinVerified)
                  );
                  if (isCurrentlyAuth && roomToUse && String(roomToUse).trim()) {
                    setIsReviewModalOpen(false);
                    executeSubmitRequest(roomToUse);
                  } else {
                    setIsReviewModalOpen(false);
                    setPinModalAction('room_service');
                    if (roomToUse && String(roomToUse).trim()) {
                      setIsPinModalSelectingRoom(false);
                    } else {
                      setIsPinModalSelectingRoom(true);
                    }
                    setIsPinModalOpen(true);
                  }
                }}
                className="flex-1 py-2.5 rounded-2xl bg-[#1A1917] hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Đang gửi...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-stone-300" />
                    <span>
                      {targetRoom || activeRoomNumber
                        ? `Gửi Yêu Cầu (Phòng ${targetRoom || activeRoomNumber})`
                        : 'Tiếp Tục'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL MÃ PIN XÁC THỰC 4 SỐ CUỐI CCCD */}
      <RoomPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (totalItemsCount > 0) {
            setIsReviewModalOpen(true);
          }
        }}
        roomNumber={targetRoom || activeRoomNumber}
        isSelectingRoomInitial={isPinModalSelectingRoom}
        sessionId={sessionId}
        onRoomSelect={(room) => {
          setTargetRoom(room);
          if (onRoomChange) onRoomChange(room);
        }}
        pendingAction="verify_only"
        skipTicketCreation={true}
        pendingItems={Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ')}
        initialTab="pin"
        onVerifiedSuccess={(res, verifiedRoom) => {
          const finalRoom = verifiedRoom || res?.room_number || targetRoom || activeRoomNumber;
          setTargetRoom(finalRoom);
          setIsLocalPinVerified(true);
          if (typeof onPinVerifiedSuccess === 'function') {
            onPinVerifiedSuccess(finalRoom);
          }
          if (onRoomChange) onRoomChange(finalRoom);
          setIsPinModalOpen(false);
          setIsPinModalSelectingRoom(false);
          if (isStatusModalOpen) {
            loadStatusForRoom(finalRoom);
          } else {
            // Xác thực PIN thành công -> Tiến hành tạo đơn Room Service
            executeSubmitRequest(finalRoom, res?.guest_name);
          }
        }}
        onNotCheckedIn={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) onNotCheckedIn(info);
        }}
        onForgotPin={(info) => {
          setIsPinModalOpen(false);
          setIsReviewModalOpen(false);
          onClose();
          if (onNotCheckedIn) {
            onNotCheckedIn({
              destination_key: 'front_desk',
              message: 'Dạ vì lý do an toàn và bảo mật thông tin phòng, Robot không thể cấp lại mã PIN phòng. Quý khách vui lòng đến quầy Lễ tân tại sảnh chính để được nhân viên hỗ trợ nhé ạ.',
              roomNumber: info?.roomNumber || targetRoom,
            });
          }
        }}
      />
  </>
);
