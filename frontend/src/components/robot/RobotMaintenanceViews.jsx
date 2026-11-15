import React from 'react';
import { Wrench, Clock, CheckCircle2, AlertCircle, RefreshCw, X, Building, Send, Edit3 } from 'lucide-react';
import { MAINTENANCE_CATEGORIES } from './robotMaintenanceData';

export const MaintenanceIssueGrid = ({
  isLoadingCatalog,
  filteredIssues,
  isEn,
  handleSelectIssue,
}) => (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
          {isLoadingCatalog ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <p className="text-xs">{isEn ? 'Loading catalog...' : 'Đang tải danh mục...'}</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 py-12">
              <p className="text-xs sm:text-sm">
                {isEn ? 'No repair issues match your search' : 'Không tìm thấy sự cố phù hợp'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 pb-8">
              {filteredIssues.map((issue) => {
                const catCfg =
                  MAINTENANCE_CATEGORIES.find((c) => c.id === issue.category) ||
                  MAINTENANCE_CATEGORIES[MAINTENANCE_CATEGORIES.length - 1];
                const CatIcon = catCfg.icon;

                return (
                  <div
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue)}
                    className="bg-white rounded-2xl border border-[#E3DFD5] hover:border-stone-400 shadow-2xs hover:shadow-md p-3 sm:p-3.5 flex flex-col justify-between transition-all group cursor-pointer active:scale-[0.99] min-h-[140px]"
                  >
                    <div>
                      {/* Category icon */}
                      <div className="w-8 h-8 rounded-xl bg-[#EFECE4] border border-[#E3DFD5] text-stone-700 flex items-center justify-center shrink-0 group-hover:bg-[#1A1917] group-hover:text-white transition-colors">
                        <CatIcon className="w-4 h-4" />
                      </div>

                      {/* Title */}
                      <h3 className="text-xs sm:text-[13px] font-bold text-stone-900 group-hover:text-black mt-2 line-clamp-1">
                        {isEn ? issue.name_en : issue.name_vi}
                      </h3>

                      {/* Description */}
                      <p className="text-[10px] sm:text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {isEn ? issue.description_en : issue.description_vi}
                      </p>
                    </div>

                    {/* Footer card: Thời gian dự kiến & Nút chọn */}
                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>~{issue.estimated_fix_time || 15}{isEn ? ' min' : 'p'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectIssue(issue);
                        }}
                        className="h-7 px-3 rounded-lg bg-[#1A1917] hover:bg-stone-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <span>{isEn ? 'Select' : 'Báo sửa'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
);

export const MaintenanceConfirmAndSuccessModals = ({
  selectedIssue,
  setSelectedIssue,
  isEn,
  targetRoom,
  setIsRoomPickerOpen,
  timePreference,
  setTimePreference,
  errorMsg,
  isSubmitting,
  handleConfirmSubmit,
  successTicket,
  setSuccessTicket,
  handleOpenStatusModal,
}) => (
  <>
      {selectedIssue && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl border border-[#E3DFD5] shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E3DFD5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EFECE4] text-stone-800 flex items-center justify-center">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                  {isEn ? 'Confirm Repair Request' : 'Xác nhận yêu cầu sửa chữa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Modal: Thông tin sự cố */}
            <div className="p-3 rounded-2xl bg-[#F5F2EB] border border-[#E3DFD5]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-stone-900">
                  {isEn ? selectedIssue.name_en : selectedIssue.name_vi}
                </p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-stone-800 border border-[#E3DFD5]">
                  ~{selectedIssue.estimated_fix_time || 15}{isEn ? ' min' : 'p'}
                </span>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                {isEn ? selectedIssue.description_en : selectedIssue.description_vi}
              </p>
            </div>

            {/* Phòng tiếp nhận: Bấm để chọn trực tiếp từ bảng số phòng (Không dùng bàn phím máy) */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-[#E3DFD5]">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">
                  {isEn ? 'Target Room:' : 'Số phòng tiếp nhận:'}
                </span>
                <span className="text-xs font-mono font-black text-stone-900">
                  {targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : (isEn ? 'Not selected' : 'Chưa chọn phòng')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsRoomPickerOpen(true)}
                className="text-xs font-bold text-stone-800 hover:text-black px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <span>{targetRoom ? (isEn ? 'Change' : 'Đổi phòng') : (isEn ? 'Select' : 'Chọn phòng')}</span>
                <Edit3 className="w-3 h-3 text-stone-500" />
              </button>
            </div>

            {/* Thời gian tiếp đón kỹ thuật */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                {isEn ? 'Time Preference:' : 'Thời gian hỗ trợ:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimePreference('ASAP')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    timePreference === 'ASAP'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                  }`}
                >
                  <p className="font-bold">{isEn ? 'Immediate' : 'Cần thợ lên ngay'}</p>
                  <p className="text-[9px] opacity-80">{isEn ? 'Visit ASAP' : 'Khách đang có mặt'}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTimePreference('WHEN_AWAY')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                    timePreference === 'WHEN_AWAY'
                      ? 'bg-[#1A1917] text-white border-[#1A1917] shadow-xs'
                      : 'bg-[#F5F2EB] text-stone-700 border-[#E3DFD5] hover:bg-stone-200'
                  }`}
                >
                  <p className="font-bold">{isEn ? 'When Away' : 'Khi vắng mặt'}</p>
                  <p className="text-[9px] opacity-80">{isEn ? 'Repair while out' : 'Khi khách ra ngoài'}</p>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="flex-1 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-all cursor-pointer"
              >
                {isEn ? 'Cancel' : 'Hủy'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="flex-2 py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:bg-stone-300"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isEn ? 'Send Request' : 'Gửi yêu cầu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {successTicket && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 text-center border border-[#E3DFD5] shadow-2xl space-y-3">
            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-stone-900">
                {successTicket.merged
                  ? (isEn ? 'Existing request updated' : 'Đã bổ sung vào phiếu hiện có')
                  : successTicket.duplicate
                  ? (isEn ? 'Request already exists' : 'Yêu cầu đã tồn tại')
                  : (isEn ? 'Request Dispatched' : 'Đã tiếp nhận yêu cầu')}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {successTicket.merged
                  ? (isEn
                    ? `The additional issue was added to repair request #${successTicket.ticket_code} for the same equipment. No new ticket was created.`
                    : `Đã bổ sung sự cố vào phiếu sửa chữa #${successTicket.ticket_code} cho cùng thiết bị. Không tạo thêm phiếu mới.`)
                  : successTicket.duplicate
                  ? (isEn
                    ? `Room ${targetRoom} already has an open request #${successTicket.ticket_code} for this issue. No new ticket was created.`
                    : `Phòng ${targetRoom} đã có phiếu #${successTicket.ticket_code} cho sự cố này đang chờ hoặc đang xử lý. Không tạo thêm phiếu mới.`)
                  : isEn
                  ? `Ticket #${successTicket.ticket_code} for Room ${targetRoom} dispatched to technicians`
                  : `Mã phiếu #${successTicket.ticket_code} của Phòng ${targetRoom} đã được gửi tới kỹ thuật`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessTicket(null);
                handleOpenStatusModal();
              }}
              className="w-full py-2 rounded-xl bg-[#1A1917] hover:bg-stone-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {isEn ? 'View Tracking Status' : 'Xem tiến độ xử lý'}
            </button>
          </div>
        </div>
      )}
  </>
);
