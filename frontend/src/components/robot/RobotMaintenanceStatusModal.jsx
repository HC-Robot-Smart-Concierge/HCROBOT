import React from 'react';
import { Wrench, Clock, CheckCircle2, RefreshCw, X, Edit3 } from 'lucide-react';

export const MaintenanceStatusModal = ({
  isStatusModalOpen,
  setIsStatusModalOpen,
  isLoadingStatus,
  loadRoomStatus,
  targetRoom,
  setIsRoomPickerOpen,
  isEn,
  statusData,
}) => (
  <>
      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal Tiến Độ */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-300" />
                <h3 className="text-xs sm:text-sm font-bold text-stone-100">
                  {isEn ? 'Maintenance & Repair Progress' : 'Tiến Độ Sửa Chữa Kỹ Thuật'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isLoadingStatus}
                  onClick={() => loadRoomStatus(targetRoom)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
                  title={isEn ? 'Refresh repair status' : 'Làm mới tiến độ'}
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

            {/* Thông tin phòng tra cứu & Đổi phòng (100% Cảm ứng on-screen) */}
            <div className="flex justify-between items-center text-xs p-2.5 bg-stone-800/80 rounded-2xl border border-stone-700/60">
              <span className="text-stone-400 font-medium">
                {isEn ? 'Checking room:' : 'Đang tra cứu cho:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setIsRoomPickerOpen(true);
                }}
                className="font-bold text-stone-100 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-700/70 hover:bg-stone-700 border border-stone-600/80 cursor-pointer transition-colors active:scale-95"
              >
                <span>{targetRoom ? `${isEn ? 'Room' : 'Phòng'} ${targetRoom}` : (isEn ? 'Select Room' : 'Chọn số phòng')}</span>
                <Edit3 className="w-3.5 h-3.5 text-stone-300" />
              </button>
            </div>

            {/* Status Summary Counters */}
            {statusData && (
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
                <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/50">
                  <p className="text-stone-400">{isEn ? 'Pending' : 'Chờ xử lý'}</p>
                  <p className="text-xs font-black text-stone-200 mt-0.5">{statusData.pending_count || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-blue-950/40 border border-blue-800/40">
                  <p className="text-blue-300">{isEn ? 'In Progress' : 'Đang sửa'}</p>
                  <p className="text-xs font-black text-blue-200 mt-0.5">{statusData.in_progress_count || 0}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                  <p className="text-emerald-300">{isEn ? 'Completed' : 'Đã xong'}</p>
                  <p className="text-xs font-black text-emerald-200 mt-0.5">{statusData.completed_count || 0}</p>
                </div>
              </div>
            )}

            {/* Danh sách yêu cầu bảo trì */}
            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {isLoadingStatus ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-300" />
                  <p>{isEn ? 'Checking technical requests...' : 'Đang kiểm tra tiến độ từ bộ phận Kỹ thuật...'}</p>
                </div>
              ) : !statusData || !statusData.requests || statusData.requests.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400 bg-stone-800/40 rounded-2xl border border-stone-800">
                  <Wrench className="w-6 h-6 text-stone-500 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-stone-300">
                    {isEn
                      ? `No maintenance tickets found for Room ${targetRoom}`
                      : `Không có yêu cầu bảo trì nào cho Phòng ${targetRoom}`}
                  </p>
                  <p className="text-[10px] text-stone-500 mt-1">
                    {isEn ? 'All facilities in this room are operational' : 'Mọi thiết bị trong phòng đang hoạt động bình thường'}
                  </p>
                </div>
              ) : (
                statusData.requests.map((req) => {
                  const s = (req.status || '').toLowerCase();
                  const isDone = s === 'completed' || s === 'resolved';
                  const isInProg = s === 'in progress' || s === 'assigned' || s === 'in preparation';

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                      {isEn ? 'Pending' : 'Chờ tiếp nhận'}
                    </span>
                  );
                  if (isInProg) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/60 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {isEn ? 'In Progress' : 'Đang xử lý'}
                      </span>
                    );
                  } else if (isDone) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {isEn ? 'Completed' : 'Đã hoàn tất'}
                      </span>
                    );
                  }

                  return (
                    <article
                      key={req.id || req.ticket_code}
                      className="p-3 rounded-2xl border border-stone-800 bg-stone-800/60 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-stone-400">
                              #{req.ticket_code}
                            </span>
                            <span className="text-[10px] text-stone-500">
                              {new Date(req.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-100 mt-0.5">
                            {req.title}
                          </h4>
                        </div>
                        <div className="shrink-0">{statusBadge}</div>
                      </div>

                      {req.description && (
                        <p className="text-[10px] sm:text-[11px] text-stone-300 bg-stone-900/70 p-2 rounded-xl border border-stone-800 whitespace-pre-line">
                          {req.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-stone-400 pt-1 border-t border-stone-800/60">
                        <span>
                          {isEn ? 'Technician:' : 'Kỹ thuật viên:'}{' '}
                          <strong className="text-stone-200">
                            {req.assigned_to || (isEn ? 'Duty Team' : 'Đội kỹ thuật')}
                          </strong>
                        </span>
                        <span>
                          {isEn ? 'ETA:' : 'Dự kiến:'}{' '}
                          <strong className="text-stone-200">{req.est_completion || (isEn ? '~15-20 min' : '~15-20 phút')}</strong>
                        </span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Footer Modal Tiến Độ */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="w-full py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
              >
                {isEn ? 'Back to Menu' : 'Quay lại danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}
  </>
);
