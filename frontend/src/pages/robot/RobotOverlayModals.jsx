import React from 'react';
import { Check } from 'lucide-react';
import { HOTEL_DESTINATIONS } from '../../components/robot/FloorMap';
import { sendChatPrompt } from '../../services/aiApi';
import { WorkflowGuestRequestPanel } from '../admin/tabs/workflow/WorkflowGuestRequestPanel';
import { MessengerVideoCallModal } from '../../components/video/MessengerVideoCallModal';
import { RobotQuickFeedbackModal } from '../../components/robot/RobotQuickFeedbackModal';
import { RobotFacilitiesModal } from '../../components/robot/RobotFacilitiesModal';
import { RoomPickerModal } from '../../components/robot/RoomPickerModal';
import { RoomPinModal } from '../../components/robot/RoomPinModal';
import { RobotTaxiModal } from '../../components/robot/RobotTaxiModal';
import { EmotionAssistanceModal } from '../../components/robot/EmotionAssistanceModal';

/**
 * Renders kiosk overlay modals: protected staff logout, workflow guest panel, video call,
 * quick feedback, hotel facilities, room picker, room PIN check, taxi booking, and emotion aid.
 */
export const RobotOverlayModals = ({
  showLogoutModal,
  setShowLogoutModal,
  logoutPassword,
  setLogoutPassword,
  logoutError,
  handleProtectedLogoutSubmit,
  requestPhase,
  activeWorkflow,
  stopWorkflow,
  speak,
  language,
  activeRoomNumber,
  setActiveRoomNumber,
  isVideoCallOpen,
  setIsVideoCallOpen,
  videoCallSessionId,
  videoCallTicketCode,
  isFeedbackModalOpen,
  handleCloseFeedback,
  handleFeedbackCompleted,
  sessionId,
  isFacilitiesModalOpen,
  setIsFacilitiesModalOpen,
  setNavigationDestinationKey,
  setIsAutoQrModalOpen,
  setQrCountdown,
  setCurrentState,
  handleOpenFeedback,
  handleStartTalk,
  isRoomPickerOpen,
  setIsRoomPickerOpen,
  isRoomPickerOpenRef,
  handleRoomPickerSelect,
  isPinModalOpen,
  isPinModalOpenRef,
  setIsPinModalOpen,
  pinModalRoomNumber,
  setPinModalRoomNumber,
  pinModalAction,
  pinModalItems,
  setAuthenticatedRoom,
  authenticatedRoom,
  handlePinVerifiedSuccess,
  handlePinNotCheckedIn,
  handleForgotPinFallback,
  statusQueryType,
  setAiResponseText,
  setIsFoodMenuOpen,
  setIsRoomServiceMenuOpen,
  setIsMaintenanceMenuOpen,
  setIsBellmanMenuOpen,
  isTaxiModalOpen,
  taxiModalInitialMode,
  taxiVoiceInput,
  handleCloseTaxiModal,
  isUnhappyAssistanceOpen,
  handleConfirmCallConcierge,
  handleDismissUnhappyAssistance,
}) => (
  <>
  {showLogoutModal && (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white border border-[#E3DFD5] text-[#1A1917] rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5 relative">
        <button
          onClick={() => setShowLogoutModal(false)}
          className="absolute top-4 right-4 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors cursor-pointer px-2 py-1"
        >
          Đóng
        </button>

        <div className="space-y-1 border-b border-[#E3DFD5] pb-4">
          <h3 className="text-base font-black text-[#1A1917] tracking-tight">Mật Khẩu Đăng Xuất Robot</h3>
          <p className="text-xs text-stone-500 font-medium">Ngăn người dùng tự ý thoát khỏi màn hình</p>
        </div>

        {logoutError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
            {logoutError}
          </div>
        )}

        <form onSubmit={handleProtectedLogoutSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
              Mật khẩu Bảo vệ (Password)
            </label>
            <input
              type="password"
              placeholder="Nhập mật khẩu (Mặc định: 123456)"
              value={logoutPassword}
              onChange={(e) => setLogoutPassword(e.target.value)}
              autoFocus
              required
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
            />
            <p className="text-[11px] text-stone-500 font-medium mt-2">
              Mật khẩu mẫu: <code className="text-stone-800 font-bold">123456</code> hoặc <code className="text-stone-800 font-bold">robot123</code>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 py-3 rounded-2xl bg-[#FAF8F5] hover:bg-[#E5E1D8] text-stone-700 border border-[#E0DCD3] font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-[#E5E1D8] hover:bg-[#DCD7CB] text-stone-900 border border-[#CFCABF] font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              Xác Nhận Đăng Xuất
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {requestPhase && (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-3" role="dialog" aria-modal="true" aria-label={language === 'English' ? 'Guest service' : 'Dịch vụ khách'}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 text-stone-900 shadow-xl">
        <WorkflowGuestRequestPanel key={activeWorkflow.id + ':' + stepRun} workflowId={activeWorkflow.id}
          phase={requestPhase} session={guestRequest} setSession={setGuestRequest}
          english={language === 'English'} verifiedRoom={authenticatedRoom} sessionId={sessionId}
          onRoomVerified={room => { setAuthenticatedRoom(room); setActiveRoomNumber(room); }}
          onNext={() => {
            nextStep();
            if (requestPhase === 'wait' && currentStepIndex === totalSteps - 1) handleOpenFeedback();
          }} onCancel={stopWorkflow} />
      </div>
    </div>
  )}

  {/* Đã gỡ bỏ KioskPromoSlide wf-06-idle-promo theo yêu cầu để giữ khuôn mặt tương tác RT-02/RT-01 và Standby Poster */}

  {/* MESSENGER VIDEO CALL MODAL & CLOUDINARY RECORDING */}
  <MessengerVideoCallModal
    isOpen={isVideoCallOpen}
    sessionId={videoCallTicketCode || videoCallSessionId || sessionId}
    role="guest"
    callerName="Khách hàng"
    calleeName="Nhân viên hỗ trợ"
    roomNumber=""
    ticketCode={videoCallTicketCode}
    guestLanguage="Tiếng Việt"
    onClose={() => {
      setIsVideoCallOpen(false);
      setVideoCallSessionId(null);
      setVideoCallTicketCode(null);
      setCurrentState('RT-02');
    }}
    onCallEnded={(recordRes) => {
      console.log('[RobotScreen] Call ended:', recordRes);
      setIsVideoCallOpen(false);
      setVideoCallSessionId(null);
      setVideoCallTicketCode(null);
      setCurrentState('RT-02');
    }}
  />

  {/* QUICK FEEDBACK SURVEY MODAL */}
  <RobotQuickFeedbackModal
    isOpen={isFeedbackModalOpen}
    onClose={handleCloseFeedback}
    sessionId={sessionId}
    roomNumber={activeRoomNumber || 'Main Lobby Kiosk'}
    guestName="Khách tại Kiosk"
    onCompleted={handleFeedbackCompleted}
  />

  {/* 5-STAR HOTEL FACILITIES MODAL */}
  <RobotFacilitiesModal
    isOpen={isFacilitiesModalOpen}
    language={language}
    onClose={() => setIsFacilitiesModalOpen(false)}
    onNavigateToDestination={(destKey) => {
      setIsFacilitiesModalOpen(false);
      setNavigationDestinationKey(destKey);
      setCurrentState('RT-05');
      setIsAutoQrModalOpen(false);
      setQrCountdown(null);
      const destName = HOTEL_DESTINATIONS[destKey]?.name || 'tiện ích';
      speak(`Dạ đây là lộ trình tới ${destName}. Quý khách có thể xem bản đồ hoặc quét mã QR trên màn hình nhé ạ.`);
    }}
    onOpenFoodMenu={() => {
      setIsFacilitiesModalOpen(false);
      setIsFoodMenuOpen(true);
      setIsMaintenanceMenuOpen(false);
      setIsBellmanMenuOpen(false);
      setIsRoomServiceMenuOpen(false);
    }}
    onSpeak={(text) => speak(text)}
    onAskFacilityWithAI={async (facility) => {
      const isEnLang = language === 'English';
      const prompt = isEnLang
        ? `Please briefly and accurately introduce "${facility.name}" based strictly on the hotel Knowledge Base.`
        : `Hãy giới thiệu ngắn gọn, chính xác về "${facility.name}" dựa trên Knowledge Base của khách sạn.`;
      const kbCtx = facility.kbContext || facility.knowledge?.summary || null;
      const chatRes = await sendChatPrompt(
        prompt,
        kbCtx,
        language,
        'neutral',
        sessionId,
        authenticatedRoom || activeRoomNumber || null
      );
      const reply = chatRes?.response || facility.knowledge?.summary || '';
      if (reply) {
        const langCode = chatRes?.lang_code || (isEnLang ? 'en-US' : 'vi-VN');
        setAiResponseText(reply);
        speak(reply, langCode, undefined, undefined, chatRes?.audio_base64 || null);
      }
      return reply;
    }}
  />

  {/* ROOM PICKER MODAL (KIỂM TRA TIẾN ĐỘ ĐƠN MÓN & DỊCH VỤ DỌN PHÒNG - 100% CẢM ỨNG ON-SCREEN) */}
  <RoomPickerModal
    isOpen={isRoomPickerOpen}
    onClose={() => {
      isRoomPickerOpenRef.current = false;
      setIsRoomPickerOpen(false);
    }}
    onSelectRoom={handleRoomPickerSelect}
    title={
      statusQueryType === 'service'
        ? (language === 'English' ? 'Check Housekeeping & Room Service Status' : 'Kiểm Tra Tiến Độ Dịch Vụ & Dọn Phòng')
        : (statusQueryType === 'maintenance'
            ? (language === 'English' ? 'Check Technical Repair Status' : 'Kiểm Tra Tiến Độ Sửa Chữa Kỹ Thuật')
            : (statusQueryType === 'food'
                ? (language === 'English' ? 'Check Food Order Status' : 'Kiểm Tra Trạng Thái Món Ăn')
                : (language === 'English' ? 'Check Order & Service Status' : 'Kiểm Tra Tiến Độ Đơn Hàng & Dịch Vụ')))
    }
    subtitle={
      statusQueryType === 'service'
        ? (language === 'English' ? 'Please choose your room number so Rora can check housekeeping progress' : 'Quý khách vui lòng chọn số phòng để Rora báo tiến độ dọn phòng và dịch vụ phòng ạ')
        : (statusQueryType === 'maintenance'
            ? (language === 'English' ? 'Please choose your room number so Rora can check technical repair progress' : 'Quý khách vui lòng chọn số phòng để Rora báo tiến độ sửa chữa thiết bị ạ')
            : (statusQueryType === 'food'
                ? (language === 'English' ? 'Please choose your room number so Rora can check cooking progress' : 'Quý khách vui lòng chọn số phòng để Rora báo tiến độ đơn món ngay ạ')
                : (language === 'English' ? 'Please choose your room number so Rora can check your order and request progress' : 'Quý khách vui lòng chọn số phòng để Rora kiểm tra tiến độ ngay ạ')))
    }
    iconType={statusQueryType === 'service' ? 'concierge' : (statusQueryType === 'maintenance' ? 'wrench' : (statusQueryType === 'food' ? 'utensils' : 'concierge'))}
  />

  {/* ROOM PIN VERIFICATION MODAL (KIOSK TOUCH NUMPAD) */}
  <RoomPinModal
    isOpen={isPinModalOpen}
    onClose={() => {
      isPinModalOpenRef.current = false;
      setIsPinModalOpen(false);
    }}
    roomNumber={pinModalRoomNumber}
    onRoomSelect={(room) => setPinModalRoomNumber(room)}
    pendingAction={pinModalAction}
    sessionId={sessionId}
    pendingItems={pinModalItems}
    // A spoken Bellman request has no menu to submit it after verification, so the
    // PIN/NFC endpoint creates the ticket (it de-duplicates open requests per room).
    skipTicketCreation={pinModalAction !== 'bellman'}
    onVerifiedSuccess={handlePinVerifiedSuccess}
    onNotCheckedIn={handlePinNotCheckedIn}
    onForgotPin={handleForgotPinFallback}
    initialTab="pin"
  />

  {/* MODAL ĐẶT XE & GỌI TAXI NHANH (FAST-PATH & TOUCH KIOSK) */}
  <RobotTaxiModal
    isOpen={isTaxiModalOpen}
    onClose={handleCloseTaxiModal}
    initialMode={taxiModalInitialMode}
    activeRoomNumber={authenticatedRoom || activeRoomNumber}
    lastVoiceTranscript={taxiVoiceInput || transcript}
    speak={speak}
    onStartTalk={handleStartTalk}
    onSuccess={() => {}}
  />

  {/* POP-UP HỎI VÀ GỌI CONCIERGE KHI PHÁT HIỆN KHÁCH KHÓ CHỊU */}
  <EmotionAssistanceModal
    isOpen={isUnhappyAssistanceOpen}
    onConfirm={handleConfirmCallConcierge}
    onDismiss={handleDismissUnhappyAssistance}
    language={language}
  />
  </>
);
