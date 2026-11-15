import React from 'react';
import { Star, Globe, Mic } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RobotFace } from '../../components/robot/RobotFace';
import { AudioWave } from '../../components/robot/AudioWave';
import { FloorMap, HOTEL_DESTINATIONS } from '../../components/robot/FloorMap';
import { KioskDisplayPreview } from '../admin/tabs/workflow/KioskDisplayPreview';
import { FloatingCinemaSubtitle } from './FloatingCinemaSubtitle';

/**
 * Desktop center viewport: active workflow step preview, RT-05 2D FloorMap navigation,
 * animated RobotFace with captions/listening/processing indicators, and bottom state switcher.
 */
export const RobotDesktopMainBody = ({
  requestPhase,
  isWorkflowRunning,
  activeWorkflow,
  activeStep,
  transcript,
  isListening,
  choiceRemaining,
  chooseOption,
  cancelChoice,
  currentState,
  setCurrentState,
  navigationDestinationKey,
  setNavigationDestinationKey,
  navigationStep,
  setNavigationStep,
  handleCloseDirections,
  isAutoQrModalOpen,
  setIsAutoQrModalOpen,
  qrCountdown,
  handleCloseQrModalOnly,
  aiResponseText,
  setAiResponseText,
  qrMapUrl,
  clearRouteGuidanceTimers,
  handleStartTalk,
  isSpeaking,
  handleStopSpeaking,
  robotFaceMode,
  activeEyeExpression,
  clearFollowUpTimer,
  setIsWaitingFollowUp,
  isWaitingFollowUp,
  handleOpenFeedback,
  language,
  volumeLevel,
  speechError,
  lastUserPrompt,
  isStandby,
  setIsStandby,
  batteryStatusText,
  currentStepIndex,
  totalSteps,
  nextStep,
  stopWorkflow,
}) => (
  <>
  {batteryStatusText && (
    <div className={`absolute ${isWorkflowRunning ? 'top-16' : 'top-5'} left-1/2 -translate-x-1/2 z-[60] px-5 py-2 rounded-full bg-amber-50/95 border border-amber-300 shadow-xl text-amber-900 text-xs font-bold animate-fadeIn`}>
      {batteryStatusText}
    </div>
  )}

  {isWorkflowRunning && (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-stone-900/90 border border-stone-700 shadow-xl backdrop-blur-md flex items-center gap-3 animate-fadeIn text-stone-200">
      <span className="w-2.5 h-2.5 rounded-full bg-stone-300 animate-pulse" />
      <span className="text-xs font-bold text-stone-200 tracking-wide uppercase">{activeWorkflow?.name}</span>
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-800 text-stone-300 border border-stone-700">
        BƯỚC {currentStepIndex + 1}/{totalSteps}: {activeStep?.type}
      </span>
      <button type="button" onClick={(e) => { e.stopPropagation(); nextStep(); }} className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] font-bold cursor-pointer transition-colors">Tiếp</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); stopWorkflow(); }} className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-[10px] font-bold cursor-pointer transition-colors">Dừng</button>
    </div>
  )}

  {/* 2. Main Body Container */}
  <main className="w-full flex-1 px-16 py-[54px] flex items-center justify-center gap-16 overflow-hidden">

    {/* Render Workflow Kiosk Interface trực tiếp tại trung tâm màn hình robot (loại trừ wf-06-idle-promo) */}
    {requestPhase ? null : isWorkflowRunning && activeWorkflow?.id !== 'wf-06-idle-promo' && (activeStep?.type === 'SHOW' || activeStep?.type === 'FEEDBACK' || activeStep?.type === 'MOVE' || activeStep?.type === 'LISTEN' || activeStep?.type === 'COMMUNICATE' || activeStep?.type === 'RECOMMEND' || activeStep?.type === 'CREATE_REQUEST' || activeStep?.type === 'CHOICE') ? (
      <div className="w-[700px] max-h-[610px] bg-white/98 backdrop-blur-2xl border-2 border-stone-200/90 rounded-3xl shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden animate-fadeIn">
        <KioskDisplayPreview
          activeStep={activeStep}
          transcript={transcript}
          isListening={isListening}
          silenceRemaining={30}
          onNextStep={() => { }}
          choiceRemaining={choiceRemaining}
          onChooseOption={chooseOption}
          onCancelChoice={cancelChoice}
        />
      </div>
    ) : currentState === 'RT-05' ? (
      <div className="w-full flex justify-between items-center gap-8 animate-fadeIn">
        {/* Left: 2D Floor Map with Google Maps style indoor wayfinding */}
        <FloorMap
          destinationKey={navigationDestinationKey}
          onSelectDestination={(k) => {
            setNavigationDestinationKey(k);
            setNavigationStep(1);
          }}
          onClose={handleCloseDirections}
          showQrModalExternal={isAutoQrModalOpen}
          qrCountdown={qrCountdown}
          onCloseQrModal={handleCloseQrModalOnly}
          currentStepExternal={navigationStep}
          onStepChange={setNavigationStep}
          defaultZoom={1.0}
        />

        {/* Right: AI Answer & Step Instructions */}
        <div className="w-[430px] h-[558px] flex flex-col justify-between items-start gap-4 shrink-0">
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 tracking-wider uppercase">
                Lộ trình di chuyển
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 border border-zinc-300 uppercase">
                {HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel || 'TẦNG 5'}
              </span>
            </div>

            {/* AI Text Response */}
            <div className="p-4 bg-white/95 rounded-2xl border border-zinc-200 shadow-sm text-sm font-medium text-zinc-800 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar">
              {aiResponseText || `Lộ trình dẫn tới ${HOTEL_DESTINATIONS[navigationDestinationKey]?.name || 'điểm đến'}. Quý khách vui lòng theo dõi sơ đồ bên trái.`}
            </div>
          </div>

          {/* Step checklist */}
          <div className="w-full flex flex-col gap-2.5">
            <div
              onClick={() => setNavigationStep(1)}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all duration-300 shadow-sm cursor-pointer ${
                navigationStep === 1
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 font-bold'
                  : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                navigationStep === 1 ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-white'
              }`}>1</div>
              <span className="text-xs font-semibold">
                {HOTEL_DESTINATIONS[navigationDestinationKey]?.step1Text || 'Đi thẳng tới Thang máy A ở sảnh'}
              </span>
            </div>

            {HOTEL_DESTINATIONS[navigationDestinationKey]?.isDifferentFloor ? (
              <>
                <div
                  onClick={() => setNavigationStep(2)}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all duration-300 shadow-sm cursor-pointer ${
                    navigationStep === 2
                      ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 font-bold'
                      : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    navigationStep === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-white'
                  }`}>2</div>
                  <span className="text-xs font-semibold">
                    {HOTEL_DESTINATIONS[navigationDestinationKey]?.step2Text || `Ra khỏi thang máy, rẽ theo biển báo tới ${HOTEL_DESTINATIONS[navigationDestinationKey]?.name}`}
                  </span>
                </div>
                <div className="p-3.5 bg-zinc-100 rounded-xl border border-zinc-300 flex items-center gap-3 shadow-sm">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <span className="text-xs font-bold text-zinc-900">
                    Đến nơi: {HOTEL_DESTINATIONS[navigationDestinationKey]?.name} ({HOTEL_DESTINATIONS[navigationDestinationKey]?.floorLevel})
                  </span>
                </div>
              </>
            ) : (
              <div className="p-3.5 bg-zinc-100 rounded-xl border border-zinc-300 flex items-center gap-3 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs shrink-0">2</div>
                <span className="text-xs font-bold text-zinc-900">
                  Đến nơi: {HOTEL_DESTINATIONS[navigationDestinationKey]?.name} (Tầng Trệt)
                </span>
              </div>
            )}
          </div>

          {/* Mobile QR Handoff Card (Quét QR mang theo bản đồ trên điện thoại) */}
          <div
            onClick={() => setIsAutoQrModalOpen(true)}
            className={`w-full p-3 bg-zinc-850 hover:bg-zinc-800 rounded-2xl border transition-all duration-300 flex items-center gap-3.5 shadow-md cursor-pointer ${isAutoQrModalOpen
              ? 'border-zinc-400 ring-2 ring-zinc-400/40 shadow-zinc-500/20'
              : 'border-zinc-700 hover:border-zinc-500'
              }`}
          >
            <div className="p-1.5 bg-white rounded-xl shrink-0 shadow-sm flex items-center justify-center border border-zinc-200">
              <QRCodeSVG
                value={qrMapUrl}
                size={82}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-zinc-100 font-bold text-xs uppercase tracking-wide">
                  Quét mã QR lưu chỉ dẫn
                </span>
                {qrCountdown !== null && qrCountdown >= 0 && (
                  <span className="text-[10px] font-mono font-semibold text-zinc-300 bg-zinc-700/80 px-2 py-0.5 rounded border border-zinc-600">
                    {qrCountdown}s
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-300 font-normal leading-tight mt-1">
                Quý khách có thể quét mã QR trên màn hình để ghi nhớ 2 chặng chỉ dẫn trên điện thoại nhé ạ.
              </p>
            </div>
          </div>

          {/* Reset Action */}
          <div className="w-full flex flex-col gap-2">
            <button
              onClick={() => {
                clearRouteGuidanceTimers();
                setIsAutoQrModalOpen(false);
                setNavigationDestinationKey(null);
                handleStartTalk();
              }}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 active:scale-[0.99] transition-all cursor-pointer shadow-lg"
            >
              <span>TÔI ĐÃ NHỚ ĐƯỜNG · ĐÓNG BẢN ĐỒ</span>
            </button>
            <p className="text-[11px] text-center text-stone-500 font-medium">
              Bạn có thể nói <strong>"Ok tôi đã nhớ"</strong> hoặc <strong>"Cảm ơn"</strong> để tự động đóng bản đồ.
            </p>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center relative scale-100 sm:scale-105 transition-transform duration-500">
        {/* Khuôn mặt Robot */}
        <div
          onClick={() => {
            if (isSpeaking) {
              handleStopSpeaking();
            } else if (currentState === 'RT-01' || currentState === 'RT-02') {
              handleStartTalk();
            }
          }}
          className={`cursor-pointer transition-transform duration-300 ${isSpeaking ? 'active:scale-95' : ''}`}
          title={isSpeaking ? 'Chạm để ngắt lời / Tap to interrupt' : 'Chạm để nói chuyện'}
        >
          <RobotFace
            mode={robotFaceMode}
            eyeExpression={activeEyeExpression}
            isSpeakingActive={isSpeaking}
          />
        </div>

        {/* 1. Khi đang nói (Speaking) hoặc có câu trả lời: Phụ đề động tinh giản (Floating Cinema Captions) */}
        {(aiResponseText || (isWorkflowRunning && (activeStep?.type === 'GREET' || activeStep?.type === 'SPEAK') && (activeStep.params?.speech_text || activeStep.params?.greeting_text || activeStep.params?.text))) && (
          <FloatingCinemaSubtitle
            fullText={aiResponseText || (activeStep?.params?.speech_text || activeStep?.params?.greeting_text || activeStep?.params?.text)}
            isSpeaking={isSpeaking}
            onClose={() => {
              clearFollowUpTimer();
              setIsWaitingFollowUp(false);
              setAiResponseText('');
            }}
          />
        )}

        {/* Nút hành động nhanh khi Robot hỏi "Quý khách có cần hỗ trợ thêm gì nữa không?" */}
        {isWaitingFollowUp && (
          <div className="mt-4 flex items-center gap-3 animate-fadeIn z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFollowUpTimer();
                setIsWaitingFollowUp(false);
                handleOpenFeedback({ speakPrompt: true });
              }}
              className="px-4 py-2.5 rounded-full bg-stone-900/90 hover:bg-stone-800 text-stone-100 border border-stone-700/80 hover:border-emerald-500/80 text-xs font-bold transition-all shadow-xl cursor-pointer flex items-center gap-2 active:scale-95 group"
              title="Hoàn tất và đánh giá dịch vụ"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform" />
              <span>{language === 'English' ? 'No, thank you · Rate service' : 'Không cần nữa · Đánh giá dịch vụ'}</span>
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearFollowUpTimer();
                setIsWaitingFollowUp(false);
                handleStartTalk();
              }}
              className="px-4 py-2.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/60 text-xs font-semibold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Nói thêm yêu cầu khác"
            >
              <Mic className="w-3.5 h-3.5 text-stone-300" />
              <span>{language === 'English' ? 'I need more help' : 'Tôi cần hỗ trợ thêm'}</span>
            </button>
          </div>
        )}

        {/* 2. Khi đang nghe (Listening): Hiển thị AudioWave và trạng thái thu âm thực tế */}
        {currentState === 'RT-03' && !aiResponseText && (
          <div className="mt-6 flex flex-col items-center gap-3 animate-fadeIn">
            <div className="px-6 py-3.5 bg-stone-900/90 backdrop-blur-xl border border-stone-700/80 rounded-2xl shadow-2xl flex items-center gap-4 text-stone-100 max-w-[620px]">
              <AudioWave isActive={isListening} volumeLevel={volumeLevel} />
              <div className="flex flex-col text-left min-w-[240px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Khách nói:</span>
                </div>
                <span className="text-sm font-bold text-stone-100">
                  {transcript ? `"${transcript}"` : (volumeLevel > 5 ? 'Đang nhận diện giọng nói...' : 'Listening... · Đang lắng nghe...')}
                </span>
                <span className="text-[10px] text-stone-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-3 h-3 text-stone-400" />
                  <span>Auto-detect VI · EN · Tự động nhận diện</span>
                </span>
              </div>
            </div>
            {speechError && (
              <div className="px-4 py-2 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs font-medium max-w-md text-center shadow-lg">
                {speechError}
              </div>
            )}
          </div>
        )}

        {/* 3. Khi ở trạng thái chờ (RT-01 hoặc RT-02): Dùng Icon làm chỉ thị tương tác quốc tế */}
        {(currentState === 'RT-01' || currentState === 'RT-02') && !aiResponseText && !isSpeaking && (
          <div className="mt-6 flex flex-col items-center gap-2 animate-fadeIn">
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleStartTalk();
              }}
              className="px-5 py-2.5 bg-stone-900/85 hover:bg-stone-800 backdrop-blur-xl border border-stone-700/80 hover:border-stone-500 rounded-full shadow-2xl flex items-center gap-3.5 cursor-pointer transition-all active:scale-95 group text-stone-300 hover:text-stone-100"
              title="Chạm hoặc nói chuyện để bắt đầu / Touch or speak to begin"
              aria-label="Bắt đầu giao tiếp"
            >
              {/* Chấm trạng thái xám sáng theo chuẩn theme hệ thống */}
              <span className="w-2 h-2 rounded-full bg-stone-300 animate-pulse group-hover:scale-125 transition-transform" />

              {/* Icon Micro & Chỉ thị tương tác */}
              <div className="flex items-center gap-2 text-stone-200 group-hover:text-white transition-colors">
                <Mic className="w-4 h-4 text-stone-300 group-hover:text-white" />
                <span className="text-xs font-semibold tracking-wide">Touch or Speak · Chạm hoặc Nói</span>
              </div>

              {/* Biểu tượng đa ngôn ngữ quốc tế */}
              <div className="flex items-center gap-1 text-[10px] text-stone-400 bg-stone-800/90 px-2 py-0.5 rounded-full border border-stone-700/60 font-mono">
                <Globe className="w-3 h-3 text-stone-400" />
                <span>VI · EN</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Khi đang xử lý (Processing): Hiển thị rõ câu người dùng đã nói & hiệu ứng đang suy nghĩ */}
        {currentState === 'RT-04' && !aiResponseText && (
          <div className="mt-5 px-6 py-3.5 bg-stone-900/85 backdrop-blur-md border border-stone-700/60 rounded-2xl flex flex-col items-center gap-2 shadow-xl animate-fadeIn max-w-[600px]">
            {lastUserPrompt ? (
              <div className="flex items-center gap-2 text-stone-200 text-sm font-semibold text-center">
                <span className="text-stone-400 text-xs uppercase tracking-wider font-bold shrink-0">Khách hỏi:</span>
                <span className="italic text-stone-100">"{lastUserPrompt}"</span>
              </div>
            ) : null}
            <div className="text-xs font-semibold text-stone-400 tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-stone-400 animate-ping" />
              <span>Rora đang suy nghĩ...</span>
            </div>
          </div>
        )}

      </div>
    )}
  </main>

  {/* 3. Bottom Dev State Switcher (Chỉ là các hình tròn nhỏ màu xám/trung tính đại diện cho State, không chữ) */}
  <footer className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-stone-900/80 px-3.5 py-2 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md border border-stone-800/80 z-10 transition-all duration-300 ${aiResponseText || isSpeaking ? 'opacity-0 pointer-events-none' : 'opacity-20 hover:opacity-100'
    }`}>
    {[
      { id: 'RT-01', name: 'Sleeping', activeColor: 'bg-stone-300 ring-2 ring-stone-200 scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
      { id: 'RT-02', name: 'Welcome', activeColor: 'bg-stone-100 ring-2 ring-white scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
      { id: 'RT-03', name: 'Listening', activeColor: 'bg-stone-400 ring-2 ring-stone-300 scale-125 animate-pulse', idleColor: 'bg-stone-700 hover:bg-stone-600' },
      { id: 'RT-04', name: 'Processing', activeColor: 'bg-stone-300 ring-2 ring-stone-200 scale-125 animate-pulse', idleColor: 'bg-stone-700 hover:bg-stone-600' },
      { id: 'RT-05', name: 'Route Guidance', activeColor: 'bg-stone-200 ring-2 ring-stone-100 scale-125', idleColor: 'bg-stone-700 hover:bg-stone-600' },
    ].map((st) => {
      const isActive = currentState === st.id;
      return (
        <button
          key={st.id}
          onClick={(e) => {
            e.stopPropagation();
            setCurrentState(st.id);
          }}
          className={`w-3 h-3 rounded-full transition-all cursor-pointer ${isActive ? st.activeColor : st.idleColor}`}
          title={`${st.id}: ${st.name}`}
        />
      );
    })}

    <div className="w-[1px] h-3.5 bg-stone-700 mx-0.5" />

    {/* Nút Standby Poster Dev Quick Toggle */}
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsStandby((prev) => !prev);
      }}
      className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider transition-all cursor-pointer ${isStandby
        ? 'bg-stone-200 text-stone-900 shadow-sm'
        : 'bg-stone-800 text-stone-400 hover:text-stone-200'
        }`}
      title="Bật/Tắt Chế độ Standby Poster Quảng Cáo"
    >
      POSTER
    </button>
  </footer>
  </>
);
