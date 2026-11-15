import React from 'react';
import {
  PhoneCall,
  Video,
  Clock,
  PhoneOff,
  Plus,
  RefreshCw,
  MessageSquare,
  Disc,
  Play,
  ExternalLink,
  Cloud,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { CONCIERGE_PAGE_SIZE } from './conciergeDashboardUtils';

export const ConciergeLiveCallAndRecordingsView = ({
  activeSubTab,
  activeCount,
  activeSession,
  isLoading,
  loadData,
  setIsTestModalOpen,
  handleAcceptCall,
  handleFinishCall,
  recordedSessions,
  paginatedRecordings,
  recordingsPage,
  setRecordingsPage,
  setPlayingVideo,
}) => (
  <>
        {/* SUBTAB 1: LIVE CALL */}
        {activeSubTab === 'live_call' && (
          <div className="space-y-4">
            {/* Live Call Metric Banner */}
            <div className="flex items-center gap-3 bg-white border border-[#BFBFBD] rounded-xl px-4 py-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                <span className="text-[12px] font-semibold text-[#262626]">
                  Trạng thái Trực Tổng Đài: Sẵn Sàng (Live Concierge Online)
                </span>
                <span className="text-[11px] text-[#777]">
                  Đang có <strong className="text-[#262626]">{activeCount}</strong> phiên hỗ trợ cần xử lý
                </span>
              </div>
            </div>

            {activeSession ? (
              <div className="max-w-3xl mx-auto bg-white rounded-xl border border-[#BFBFBD] p-5">
                <div className="flex items-start justify-between border-b border-[#E9E5DC] pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold bg-[#F4F3F0] text-[#1A1917] border border-[#E2DFD9] px-2 py-0.5 rounded">
                        {activeSession.ticket_code || activeSession.id}
                      </span>
                      <span className="text-[13px] font-bold text-[#262626]">
                        {activeSession.guest_name || 'Khách tại Kiosk'}
                      </span>
                      <span className="text-[12px] text-[#777]">
                        ({activeSession.room_number || 'Sảnh S1'})
                      </span>
                    </div>
                    <div className="text-[11px] text-[#777] mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Khởi tạo: {activeSession.created_at || 'Vừa xong'}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      activeSession.status === 'Connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeSession.status === 'Closed'
                        ? 'bg-[#F0EFEC] text-[#777]'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeSession.status || 'Pending'}
                  </span>
                </div>

                {/* Conversation Transcript */}
                <div className="my-4">
                  <label className="text-[11px] font-bold text-[#403D39] uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Nội Dung Hội Thoại Chuyển Tiếp Từ Robot</span>
                  </label>
                  <div className="bg-[#FAF9F6] border border-[#EFECE6] rounded-lg p-3 text-[12px] text-[#262626] leading-relaxed max-h-40 sm:max-h-none overflow-y-auto">
                    {activeSession.description || 'Không có mô tả hội thoại.'}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-[#E9E5DC]">
                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#777]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sẵn sàng kết nối video call trực tiếp</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {activeSession.status !== 'Connected' && activeSession.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => handleAcceptCall(activeSession)}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Tiếp nhận cuộc gọi Video</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={() => handleAcceptCall(activeSession)}
                        className="flex-1 sm:flex-initial w-full sm:w-auto px-5 py-3 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Mở Màn Hình Cuộc Gọi</span>
                      </button>
                    )}

                    {activeSession.status === 'Connected' && (
                      <button
                        type="button"
                        onClick={handleFinishCall}
                        className="px-4 py-3 sm:py-2 rounded-xl bg-neutral-700 hover:bg-neutral-800 active:bg-neutral-900 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>Kết thúc</span>
                      </button>
                    )}

                    {activeSession.status === 'Closed' && (
                      <span className="text-[12px] text-[#777] font-semibold">
                        Phiên hỗ trợ này đã hoàn tất.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto my-8 bg-white rounded-xl border border-[#BFBFBD] p-8 text-center">
                <PhoneCall className="w-10 h-10 text-[#A8A29E] mx-auto mb-3" />
                <h2 className="text-[14px] font-bold text-[#262626]">Không có cuộc gọi Live Call nào</h2>
                <p className="text-[12px] text-[#777] mt-1">
                  Robot Kiosk hiện chưa phát tín hiệu can thiệp trực tiếp từ khách hàng.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="mt-4 px-3.5 py-2 rounded-lg bg-[#262626] hover:bg-[#404040] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tạo cuộc gọi mô phỏng
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB: CLOUDINARY CALL RECORDINGS */}
        {activeSubTab === 'recordings' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-[#BFBFBD] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E9E5DC] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#403D39]">
                    Lịch Sử Cuộc Gọi & Bản Ghi Video (Human Support Sessions)
                  </h3>
                  <p className="text-[11px] text-[#77736E] mt-0.5">
                    Các cuộc gọi video hỗ trợ trực tiếp giữa Robot Kiosk và Nhân viên được ghi hình tự động.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded border border-[#BFBFBD] bg-white hover:bg-[#F0EFEC] flex items-center gap-1 text-[#403D39] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {recordedSessions.length === 0 ? (
                <div className="p-10 text-center text-[12px] text-[#777]">
                  Chưa có bản ghi cuộc gọi nào. Khi khách gọi qua Robot Kiosk, video sẽ tự động xuất hiện ở đây.
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6]">
                  {paginatedRecordings.map((session) => (
                    <div
                      key={session.id}
                      className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-[#FAF9F6] transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold bg-[#F4F3F0] text-[#1A1917] px-2 py-0.5 rounded border border-[#E2DFD9]">
                            {session.session_code || session.id}
                          </span>
                          <span className="text-[13px] font-bold text-[#262626]">{session.guest_name}</span>
                          <span className="text-[11px] text-[#777]">({session.room_number})</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              session.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {session.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#666] flex flex-wrap items-center gap-4 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.created_at ? new Date(session.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Disc className="w-3.5 h-3.5 text-red-500" />
                            Thời lượng: <strong className="font-semibold text-[#262626]">{session.recording_duration || 0}s</strong>
                          </span>
                          {session.recording_url && (
                            <span className="flex items-center gap-1 text-sky-700 font-semibold">
                              <Cloud className="w-3.5 h-3.5" />
                              Cloudinary Cloud Storage
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {session.recording_status === 'saving' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Đang lưu bản ghi...
                          </span>
                        ) : session.recording_status === 'failed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            Lưu thất bại
                          </span>
                        ) : session.recording_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPlayingVideo(session)}
                              className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Xem Bản Ghi
                            </button>
                            <a
                              href={session.recording_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-[#BFBFBD] hover:bg-[#F0EFEC] text-[#555] hover:text-[#262626] transition-all"
                              title="Mở tab Cloudinary mới"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-[#777] italic">Đang diễn ra hoặc chưa lưu video</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Footer */}
              {recordedSessions.length > 0 && (
                <Pagination
                  currentPage={recordingsPage}
                  totalItems={recordedSessions.length}
                  pageSize={CONCIERGE_PAGE_SIZE}
                  onPageChange={setRecordingsPage}
                  itemName="bản ghi"
                />
              )}
            </div>
          </div>
        )}
  </>
);
