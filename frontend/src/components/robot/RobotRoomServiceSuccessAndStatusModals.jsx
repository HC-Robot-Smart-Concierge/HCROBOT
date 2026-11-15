import React from 'react';
import {
  X,
  Clock,
  Check,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from './robotRoomServiceCatalog';

export const RobotRoomServiceSuccessAndStatusModals = ({
  successData,
  setSuccessData,
  onClose,
  isStatusModalOpen,
  setIsStatusModalOpen,
  targetRoom,
  setIsPinModalSelectingRoom,
  setIsPinModalOpen,
  isLoadingStatus,
  loadStatusForRoom,
  statusOrders,
}) => (
  <>
      {/* POPUP THÔNG BÁO YÊU CẦU DỊCH VỤ THÀNH CÔNG */}
      {successData && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-3.5">
            <div className="w-12 h-12 rounded-xl bg-stone-800 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              {successData.isMerged ? (
                <>
                  <span className="inline-block px-3 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 text-[11px] font-bold mb-1.5">
                    Đã Tự Động Gộp Vào Yêu Cầu Hiện Tại
                  </span>
                  <h3 className="text-base font-bold text-stone-100">Gộp Yêu Cầu Thành Công!</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Mã yêu cầu: <span className="font-mono font-bold text-stone-200">{successData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    Phòng <strong>{successData.room}</strong> đang có yêu cầu chờ xử lý. Hệ thống đã tự động gộp các dịch vụ này vào chung đơn để phục vụ cùng một chuyến duy nhất.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-stone-100">Yêu Cầu Dịch Vụ Thành Công!</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Mã yêu cầu: <span className="font-mono font-bold text-stone-200">{successData.orderCode}</span>
                  </p>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    Yêu cầu đã được chuyển tới bộ phận <strong>Room Service</strong> để phục vụ đến{' '}
                    <strong>phòng {successData.room}</strong> trong ít phút tới.
                  </p>
                </>
              )}
            </div>
            <div className="p-3 bg-stone-800/80 rounded-xl border border-stone-700/50 text-xs flex flex-col gap-1 text-left">
              <div className="flex justify-between font-bold">
                <span className="text-stone-400">Ghi vào hóa đơn phòng:</span>
                <span className="text-stone-100">{formatCurrency(successData.totalAmount)}</span>
              </div>
              <p className="text-[11px] text-stone-400 font-normal">
                Hóa đơn đã được gửi về quầy Lễ tân để thanh toán khi trả phòng (không thanh toán tại chỗ).
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
              >
                Tiếp tục xem dịch vụ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold transition-all cursor-pointer"
              >
                Về Robot
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL TRA CỨU TIẾN ĐỘ DỊCH VỤ & DỌN PHÒNG */}
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-300" />
                <h3 className="text-sm font-bold text-stone-100">Tiến Độ Dịch Vụ & Dọn Phòng</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadStatusForRoom(targetRoom)}
                  disabled={isLoadingStatus}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                  title="Làm mới tiến độ"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin text-stone-200' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Thông tin phòng hiện tại & nút đổi phòng */}
            <div className="flex justify-between items-center text-xs p-2.5 bg-stone-800/80 rounded-xl border border-stone-700/60">
              <span className="text-stone-400 font-medium">Đang tra cứu cho:</span>
              <button
                type="button"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setIsPinModalSelectingRoom(true);
                  setIsPinModalOpen(true);
                }}
                className="font-bold text-stone-100 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-700/70 hover:bg-stone-700 border border-stone-600/80 cursor-pointer transition-colors active:scale-95"
              >
                <span>{targetRoom ? `Phòng ${targetRoom}` : 'Chưa chọn phòng'}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-300" />
              </button>
            </div>
            {/* Danh sách tiến độ các yêu cầu */}
            <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {isLoadingStatus ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-300" />
                  <p>Đang kiểm tra tiến độ từ bộ phận buồng phòng & Room Service...</p>
                </div>
              ) : statusOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-stone-800/40 rounded-xl border border-stone-800">
                  <p>Hiện chưa có yêu cầu dịch vụ hoặc dọn phòng nào đang thực hiện cho phòng {targetRoom || 'này'}.</p>
                  <p className="text-[11px] text-stone-500 mt-1">Quý khách có thể chọn dịch vụ để gửi yêu cầu ngay ạ.</p>
                </div>
              ) : (
                statusOrders.map((ord) => {
                  const s = (ord.status || 'Pending').toLowerCase();
                  let statusLabel = 'Chờ tiếp nhận';
                  let statusBg = 'bg-stone-800 text-stone-300 border-stone-700';
                  let progressPercent = 20;
                  if (s === 'cooking' || s === 'in progress' || s === 'assigned') {
                    statusLabel = ord.is_service_request ? 'Đang dọn phòng / xử lý' : 'Bếp đang nấu món';
                    statusBg = 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60';
                    progressPercent = 50;
                  } else if (s === 'ready') {
                    statusLabel = ord.is_service_request ? 'Đã chuẩn bị xong' : 'Món đã nấu xong';
                    statusBg = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60';
                    progressPercent = 75;
                  } else if (s === 'delivering') {
                    statusLabel = 'Đang giao lên phòng';
                    statusBg = 'bg-blue-900/40 text-blue-300 border-blue-700/60';
                    progressPercent = 85;
                  } else if (s === 'completed' || s === 'delivered') {
                    statusLabel = 'Đã hoàn tất';
                    statusBg = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60';
                    progressPercent = 100;
                  } else if (s === 'cancelled' || s === 'rejected') {
                    statusLabel = 'Đã hủy';
                    statusBg = 'bg-rose-900/40 text-rose-300 border-rose-700/60';
                    progressPercent = 0;
                  }
                  const itemsDesc = Array.isArray(ord.items) && ord.items.length > 0
                    ? ord.items.map((it) => `${it.qty || it.quantity || 1}x ${it.name || it.item_name || 'Dịch vụ'}`).join(', ')
                    : (ord.note || 'Yêu cầu phục vụ phòng');
                  return (
                    <div
                      key={ord.id || ord.order_number}
                      className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-stone-400">
                          #{ord.order_number || ord.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="font-bold text-stone-100 text-xs line-clamp-2">
                        {itemsDesc}
                      </p>
                      {/* Thanh Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-stone-700/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              progressPercent === 100
                                ? 'bg-emerald-400'
                                : progressPercent >= 50
                                ? 'bg-indigo-400'
                                : 'bg-stone-400'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400">
                          <span>Tiến độ: {progressPercent}%</span>
                          <span>{ord.est_completion || (progressPercent === 100 ? 'Đã xong' : 'Đang xử lý')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
  </>
);
