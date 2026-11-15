import React from 'react';
import {
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Film,
  ExternalLink,
  Star,
  AlertTriangle,
  User,
  X,
} from 'lucide-react';
import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { ConciergeTaxiBookingModal } from '../../components/dashboard/concierge/ConciergeTaxiBookingModal';
import { ConciergeTestCallModal } from '../../components/dashboard/concierge/ConciergeTestCallModal';

export const ConciergeModals = ({
  currentUser,
  isTestModalOpen,
  setIsTestModalOpen,
  handleCreateLiveCall,
  testForm,
  setTestForm,
  isTaxiModalOpen,
  setIsTaxiModalOpen,
  handleCreateTaxi,
  taxiForm,
  setTaxiForm,
  playingVideo,
  setPlayingVideo,
  isEmotionModalOpen,
  setIsEmotionModalOpen,
  isSavingEmotion,
  emotionForm,
  setEmotionForm,
  handleCreateEmotionAlert,
  selectedTranscriptFb,
  setSelectedTranscriptFb,
  isTranscriptLoading,
  transcriptMessages,
  activeSession,
  isVideoModalOpen,
  activeCallSessionId,
  activeCallSession,
  handleAcceptCall,
  handleUpdateStatus,
  handleFinishCall,
}) => (
  <>
      {/* MODAL: MÔ PHỎNG LIVE CALL */}
      <ConciergeTestCallModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onSubmit={handleCreateLiveCall}
        testForm={testForm}
        setTestForm={setTestForm}
      />

      {/* MODAL: ĐẶT XE MỚI */}
      <ConciergeTaxiBookingModal
        isOpen={isTaxiModalOpen}
        onClose={() => setIsTaxiModalOpen(false)}
        onSubmit={handleCreateTaxi}
        taxiForm={taxiForm}
        setTaxiForm={setTaxiForm}
      />

      {/* MODAL XEM LẠI VIDEO GHI HÌNH TỪ CLOUDINARY */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-neutral-900 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <Film className="w-4 h-4 text-emerald-400" />
                <span>Bản Ghi Cuộc Gọi: {playingVideo.session_code || playingVideo.id}</span>
                <span className="text-neutral-400 font-normal">({playingVideo.guest_name} - {playingVideo.room_number})</span>
              </div>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-neutral-800 transition-all"
              >
                Đóng
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center">
              <video
                src={playingVideo.recording_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3 bg-neutral-900/90 text-[11px] text-neutral-400 flex items-center justify-between border-t border-neutral-800">
              <span className="truncate">URL: {playingVideo.recording_url}</span>
              <a
                href={playingVideo.recording_url}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline shrink-0 ml-3 flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Mở gốc
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GHI NHẬN KHÁCH HÀNG CÓ BIỂU CẢM KHÓ CHỊU (CONCIERGE) */}
      {isEmotionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#BFBFBD] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E9E5DC] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-[14px] font-bold text-[#262626]">
                  Ghi Nhận &amp; Xử Lý Khách Có Biểu Cảm Khó Chịu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmotionModalOpen(false)}
                className="p-1 rounded-lg text-[#777] hover:text-[#262626] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmotionAlert} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#262626] mb-1">
                    Vị trí / Kiosk / Phòng
                  </label>
                  <input
                    type="text"
                    required
                    value={emotionForm.location}
                    onChange={(e) => setEmotionForm((s) => ({ ...s, location: e.target.value }))}
                    placeholder="VD: Main Lobby Kiosk, Phòng 305..."
                    className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#262626] mb-1">
                    Tên khách / Định danh
                  </label>
                  <input
                    type="text"
                    value={emotionForm.guestName}
                    onChange={(e) => setEmotionForm((s) => ({ ...s, guestName: e.target.value }))}
                    placeholder="Khách tại Sảnh Kiosk..."
                    className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#262626] mb-1">
                  Biểu cảm / Mức độ ghi nhận từ AI Kiosk
                </label>
                <select
                  value={emotionForm.emotionType}
                  onChange={(e) => setEmotionForm((s) => ({ ...s, emotionType: e.target.value }))}
                  className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                >
                  <option value="Khó chịu (Unhappy)">Khó chịu (Unhappy) - Phát hiện từ Camera AI</option>
                  <option value="Bực bội / Thất vọng (Frustrated)">Bực bội / Thất vọng (Frustrated) - Cần hỗ trợ gấp</option>
                  <option value="Đang lúng túng tại Kiosk">Khách đang lúng túng / Không hài lòng tại Kiosk</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#262626] mb-1">
                  Ghi chú tình huống
                </label>
                <textarea
                  rows={3}
                  value={emotionForm.description}
                  onChange={(e) => setEmotionForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Mô tả tình huống khách đang gặp phải tại Kiosk/Sảnh để nhân viên Concierge tiếp cận xử lý..."
                  className="w-full rounded-xl border border-[#BFBFBD] px-3 py-2 text-[#262626] outline-none focus:border-[#262626]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmotionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#BFBFBD] text-[#403D39] font-semibold hover:bg-[#F0EFEC] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmotion}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  {isSavingEmotion ? 'Đang lưu...' : 'Ghi nhận & Cảnh báo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XEM TRANSCRIPT CHI TIẾT HỘI THOẠI (SERVICE RECOVERY) */}
      {selectedTranscriptFb && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#BFBFBD] overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#FAF9F6] border-b border-[#E9E5DC] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#262626] text-white">
                    {selectedTranscriptFb.chat_session_id}
                  </span>
                  <span className="text-[14px] font-bold text-[#262626]">
                    {selectedTranscriptFb.guest_name || 'Khách tại Kiosk'}
                  </span>
                  <span className="text-xs text-[#77736E]">
                    ({selectedTranscriptFb.room_number ? `Phòng ${selectedTranscriptFb.room_number}` : 'Kiosk Sảnh'})
                  </span>
                </div>
                <div className="text-xs text-[#77736E] mt-1 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Đánh giá dịch vụ: <strong className="text-[#262626]">{selectedTranscriptFb.rating}/5 Sao</strong></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="p-1.5 text-[#777] hover:text-[#262626] hover:bg-[#EFECE6] rounded-lg font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Modal Content / Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6]">
              {isTranscriptLoading ? (
                <div className="py-12 text-center text-xs text-[#777] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải toàn bộ lượt hội thoại...</span>
                </div>
              ) : transcriptMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777]">
                  Không tìm thấy bản ghi chi tiết từng tin nhắn cho phiên này.
                </div>
              ) : (
                transcriptMessages.map((msg, idx) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] font-mono font-bold text-[#77736E] mb-1 px-1">
                        {isUser ? 'Khách hàng (User)' : 'Trợ lý Robot Rora (Assistant)'}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-[#262626] text-white rounded-br-xs'
                            : 'bg-white text-[#262626] border border-[#BFBFBD] rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                        {msg.intent_action && (
                          <div className={`mt-1 pt-1 border-t text-[9px] font-mono opacity-75 ${isUser ? 'border-white/20' : 'border-[#E9E5DC]'}`}>
                            Intent: {msg.intent_action}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-white border-t border-[#E9E5DC] flex items-center justify-between">
              <span className="text-[11px] text-[#77736E] font-medium">
                Dữ liệu lưu tự động trong CSDL bảng <code>chat_messages</code>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTranscriptFb(null)}
                className="px-4 py-1.5 rounded-lg bg-[#262626] hover:bg-[#404040] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL RINGING MODAL FOR STAFF (GOOGLE USER / MEET STYLE) */}
      {activeSession && activeSession.status === 'Pending' && !isVideoModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E3DFD5] rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center space-y-5 shadow-2xl text-[#1A1917] animate-in zoom-in-95 duration-200">
            {/* Animated Call Ring Icon */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-md">
                <PhoneCall className="w-9 h-9 animate-pulse" />
              </div>
            </div>

            {/* Caller Information */}
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cuộc gọi đến từ Robot Kiosk
              </span>
              <h3 className="text-xl font-bold text-[#1A1917] pt-1">
                {activeSession.guest_name || 'Khách tại Sảnh'}
              </h3>
              <p className="text-xs text-[#8C857B] font-medium">
                Vị trí: <span className="font-semibold text-[#1A1917]">{activeSession.room_number || 'Main Lobby Kiosk'}</span> • Mã: <span className="font-mono font-semibold">{activeSession.ticket_code}</span>
              </p>
            </div>

            {/* Call Reason / Description */}
            <div className="text-xs text-[#8C857B] bg-[#F9F8F5] p-3.5 rounded-2xl border border-[#E3DFD5] italic leading-relaxed text-left">
              "{activeSession.description || 'Khách bấm gọi hỗ trợ trực tiếp từ màn hình Robot Concierge'}"
            </div>

            {/* Action Buttons (Google Phone Style) */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleUpdateStatus('Closed')}
                className="flex-1 py-3 px-4 rounded-full bg-[#F5F2EB] hover:bg-red-50 text-[#1A1917] hover:text-red-700 font-semibold text-xs sm:text-sm border border-[#E3DFD5] hover:border-red-200 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <PhoneOff className="w-4 h-4 text-[#8C857B]" />
                <span>Từ chối</span>
              </button>
              <button
                type="button"
                onClick={() => handleAcceptCall(activeSession)}
                className="flex-1 py-3 px-4 rounded-full bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Trả Lời Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MESSENGER VIDEO CALL MODAL (STAFF CALLEE ROLE) */}
      <MessengerVideoCallModal
        isOpen={isVideoModalOpen}
        sessionId={activeCallSessionId || activeSession?.ticket_code || activeSession?.id || 'SUP-STAFF'}
        role="staff"
        callerName={activeCallSession?.guest_name || activeSession?.guest_name || 'Khách hàng'}
        calleeName={currentUser?.full_name || 'Nhân viên hỗ trợ'}
        roomNumber={activeCallSession?.room_number || activeSession?.room_number || ''}
        ticketCode={activeCallSession?.ticket_code || activeSession?.ticket_code}
        guestLanguage={activeCallSession?.language || activeSession?.language || 'Tiếng Việt'}
        onClose={handleFinishCall}
        onCallEnded={handleFinishCall}
      />
  </>
);
