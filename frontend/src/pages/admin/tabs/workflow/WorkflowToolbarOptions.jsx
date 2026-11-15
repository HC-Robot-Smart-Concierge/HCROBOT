import React from 'react';
import { Send, X, SlidersHorizontal } from 'lucide-react';
import { BATTERY_LOW_PERCENT } from '../../../../utils/batteryPolicy';

/**
 * Toolbar Group 3: direct 1x/2x/4x speed controls, simulation options popover
 * (speed, patrol loop, TTS audio, simulated battery, ROS 2 bridge), dispatch & close buttons.
 */
export const WorkflowToolbarOptions = ({
  rc,
  simSpeed,
  setSimSpeed,
  isMuted,
  setIsMuted,
  isLoopMode,
  setIsLoopMode,
  isLoopModeRef,
  simBatteryPercent,
  setSimBatteryPercent,
  isRosEnabled,
  setIsRosEnabled,
  isRosConnected,
  setIsWorkflowMenuOpen,
  setIsMapMenuOpen,
  isSettingsMenuOpen,
  setIsSettingsMenuOpen,
  settingsMenuRef,
  handleDispatchToRobot,
  onClose,
  onNotify,
}) => {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* 3 NÚT TỐC ĐỘ MÔ PHỎNG TRỰC TIẾP TRÊN THANH CÔNG CỤ (KHÔNG CẦN POPUP) */}
      <div
        className="flex items-center p-0.5 rounded-lg border shadow-xs"
        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
        title="Tốc độ mô phỏng trực tiếp"
      >
        {[1, 2, 4].map((spd) => (
          <button
            key={spd}
            type="button"
            onClick={() => setSimSpeed(spd)}
            className={`h-7 px-2 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${
              simSpeed === spd
                ? 'bg-[#262626] text-white shadow-xs'
                : 'text-[#262626] hover:bg-[#FAF8F5]'
            }`}
            title={`Đặt tốc độ ${spd}x`}
          >
            {spd}x
          </button>
        ))}
      </div>

      {/* TÙY CHỌN: CHỈ DÙNG ICON SLIDERS (LOOP, TTS, ROS 2) */}
      <div className="relative" ref={settingsMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsSettingsMenuOpen((prev) => !prev);
            setIsMapMenuOpen(false);
            setIsWorkflowMenuOpen(false);
          }}
          className={`h-8 w-8 rounded-lg border text-xs font-bold flex items-center justify-center shadow-xs cursor-pointer transition-all ${
            isSettingsMenuOpen
              ? 'bg-[#262626] text-white border-[#262626]'
              : 'hover:bg-[#FAF8F5]'
          }`}
          style={!isSettingsMenuOpen ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' } : {}}
          title={`Tùy chọn nâng cao: ${isLoopMode ? 'Lặp lại, ' : ''}Âm thanh, ROS 2`}
        >
          <div className="relative flex items-center justify-center">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${
                isRosEnabled && isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`}
            />
          </div>
        </button>

        {/* DROPDOWN POPOVER TÙY CHỌN */}
        {isSettingsMenuOpen && (
          <div
            className="absolute top-full right-0 mt-1.5 w-68 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-3 animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#262626]" />
                <span>Tùy chọn mô phỏng</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(false)}
                className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1. Tốc độ mô phỏng */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                Tốc độ mô phỏng:
              </div>
              <div className="flex p-0.5 rounded-lg border bg-[#F2EFE9]" style={{ borderColor: '#E9E5DC' }}>
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSimSpeed(spd)}
                    className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${
                      simSpeed === spd ? 'bg-[#262626] text-white shadow-xs' : 'text-[#262626] hover:bg-[#E9E5DC]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tuần tra lặp lại (Patrol Loop) */}
            <button
              type="button"
              onClick={() => {
                const nextVal = !isLoopMode;
                setIsLoopMode(nextVal);
                isLoopModeRef.current = nextVal;
                onNotify(
                  nextVal
                    ? 'Đã bật Chế độ Tuần tra lặp lại (Patrol Loop)'
                    : 'Đã tắt Chế độ Tuần tra lặp lại',
                  'info'
                );
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
              style={{ borderColor: '#E9E5DC' }}
            >
              <span className="text-[#262626]">Tuần tra lặp lại (Loop)</span>
              <span
                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  isLoopMode ? 'bg-indigo-100 text-indigo-800' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                }`}
              >
                {isLoopMode ? 'BẬT' : 'TẮT'}
              </span>
            </button>

            {/* 3. Giọng đọc TTS (Voice Audio) */}
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
              style={{ borderColor: '#E9E5DC' }}
            >
              <span className="text-[#262626]">Giọng nói Robot (TTS)</span>
              <span
                className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  !isMuted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {!isMuted ? 'BẬT' : 'TẮT'}
              </span>
            </button>

            {/* 3b. Pin giả lập (cùng ngưỡng với màn hình robot) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                <span>Pin giả lập</span>
                <span className="font-mono text-[#262626]">{simBatteryPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={simBatteryPercent}
                onChange={(e) => setSimBatteryPercent(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#262626]"
              />
              <p className="text-[10px] leading-snug text-[#8C8C8C]">
                Từ {BATTERY_LOW_PERCENT}%: xong khách hiện tại rồi về trạm sạc. Từ {BATTERY_CRITICAL_PERCENT}%: dừng ngay để về sạc. Nhận khách lại khi đạt {BATTERY_RESUME_PERCENT}%.
              </p>
            </div>

            {/* 4. Cổng kết nối ROS 2 */}
            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                  ROS 2 Bridge (Port 9090)
                </span>
                <span
                  className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                    isRosEnabled && isRosConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isRosEnabled && isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                  {isRosEnabled && isRosConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextState = !isRosEnabled;
                  setIsRosEnabled(nextState);
                  if (nextState) {
                    onNotify('Đang kích hoạt kết nối ROS 2 (port 9090)...', 'info');
                  } else {
                    onNotify('Đã ngắt kết nối ROS 2.', 'info');
                  }
                }}
                className="w-full py-1 px-2 rounded-lg border text-xs font-semibold text-center hover:bg-[#F2EFE9] cursor-pointer transition-colors"
                style={{ borderColor: '#E9E5DC', color: '#262626' }}
              >
                {isRosEnabled && isRosConnected ? 'Ngắt kết nối ROS 2' : 'Kết nối lại ROS 2'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NÚT PHÁT: ICON BUTTON CAO CẤP */}
      <button
        type="button"
        onClick={handleDispatchToRobot}
        className="h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0 hover:bg-[#363636]"
        style={{ backgroundColor: '#262626' }}
        title={rc('Send workflow to robot')}
      >
        <Send className="w-3.5 h-3.5" />
      </button>

      {/* NÚT ĐÓNG: ICON X GỌN GÀNG */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#FAF8F5]"
          style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          title={rc('Close simulator')}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
