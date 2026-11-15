import React from 'react';
import {
  Navigation,
  Gauge,
  Ban,
  AlertTriangle,
  X,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BatteryLow,
} from 'lucide-react';
import { KioskChoicePrompt } from './KioskChoicePrompt';
import { WorkflowGuestRequestPanel } from './WorkflowGuestRequestPanel';
import { OUTCOME } from '../../../../utils/workflowFlow';

/**
 * Viewport HUD overlays: floor badge, navigation & active zone telemetry pills,
 * low-battery notice, zone alert toast, guest choice/request overlays, and zoom buttons.
 */
export const WorkflowViewportOverlays = ({
  rc,
  language,
  guestRequest,
  setGuestRequest,
  activeWorkflow,
  isPaused,
  simSpeed,
  stepProgress,
  stepRun,
  simBatteryPercent,
  simGuestPresent,
  setSimGuestPresent,
  robotPose,
  selectedZone,
  zoneAlert,
  setZoneAlert,
  zoomScale,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  isZoneEditMode,
  activeRobotZone,
  activeStep,
  showingIdlePromo,
  requestPhase,
  handleStepFinish,
  batteryStatusText,
  handleStopSim,
}) => {
  return (
    <>
      <div className="absolute top-3 left-4 z-10 select-none pointer-events-none flex items-center gap-2">
        <span
          className="font-mono font-bold text-xs px-2 py-0.5 rounded-md border shadow-2xs"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#1c1917' }}
        >
          Ground
        </span>
        <span className="font-mono text-[11px] font-medium" style={{ color: '#78716c' }}>
          Sảnh Khách Sạn • 19.60m × 12.60m
        </span>
      </div>

      {/* Thanh huong dan dieu huong truc quan & HUD Trang thai Vung cua Robot */}
      <div className="absolute top-3 right-4 z-10 flex flex-col items-end gap-1.5 select-none pointer-events-none">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-xs text-xs font-medium backdrop-blur-xs"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
        >
          {isZoneEditMode || selectedZone ? (
            <span title="Chế độ sửa Vùng (Kéo thả & Định vị)">
              <Move className="w-3.5 h-3.5 text-amber-700" />
            </span>
          ) : (
            <span title="Click sàn bản đồ để điều hướng Robot">
              <Navigation className="w-3.5 h-3.5 text-[#8C8C8C]" />
            </span>
          )}
          <span
            className="font-mono font-bold px-1.5 py-0.5 rounded border text-[11px]"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            title="Tọa độ Robot hiện tại (X, Y)"
          >
            {robotPose.x}m, {robotPose.y}m
          </span>
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded border text-[11px] ${
              batteryGuard.mode === BATTERY_MODE.CRITICAL
                ? 'bg-red-100 text-red-800 border-red-300'
                : batteryGuard.mode === BATTERY_MODE.LOW
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : ''
            }`}
            style={batteryGuard.mode === BATTERY_MODE.OK ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' } : {}}
            title="Pin giả lập, đổi trong Tùy chọn mô phỏng"
          >
            Pin {simBatteryPercent}%
          </span>

          {/* Chip HUD Trang thai Vung hien tai cua Robot */}
          {activeRobotZone ? (
            <span
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border shadow-2xs ${
                activeRobotZone.type === 'KEEP_OUT'
                  ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                  : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}
              title={
                activeRobotZone.type === 'KEEP_OUT'
                  ? 'Cảnh báo: Robot đang trong Vùng Cấm!'
                  : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                  ? `Robot trong Vùng Giới hạn tốc độ ${activeRobotZone.speed_limit || 0.20}m/s`
                  : 'Robot đang trong Vùng Cấm Dừng'
              }
            >
              {activeRobotZone.type === 'KEEP_OUT' && <Ban className="w-3 h-3 text-red-600" />}
              {(activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED') && (
                <Gauge className="w-3 h-3 text-amber-600" />
              )}
              {activeRobotZone.type === 'NO_STOP' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
              <span>
                {activeRobotZone.type === 'KEEP_OUT'
                  ? 'CẤM'
                  : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                  ? `${activeRobotZone.speed_limit || 0.20}m/s`
                  : 'CẤM DỪNG'}
              </span>
            </span>
          ) : (
            <span
              className="px-1.5 py-0.5 rounded font-mono text-[9.5px] border font-bold"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}
              title="Robot đang trong vùng tự do an toàn"
            >
              Sảnh Tự Do
            </span>
          )}
        </div>

        {/* Trạng thái pin yếu */}
        {batteryStatusText && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-xs text-[11px] font-semibold max-w-md"
            style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}
          >
            <BatteryLow className="w-3.5 h-3.5 shrink-0" />
            <span>{batteryStatusText}</span>
          </div>
        )}

        {/* Toast Cảnh Báo An Toàn Vùng (Nổi khi vi phạm hoặc click vùng cấm) */}
        {zoneAlert && (
          <div
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-md text-xs font-semibold animate-fadeIn max-w-md"
            style={{
              backgroundColor: zoneAlert.type === 'error' ? '#FEF2F2' : '#FFFBEB',
              borderColor: zoneAlert.type === 'error' ? '#FCA5A5' : '#FCD34D',
              color: zoneAlert.type === 'error' ? '#991B1B' : '#92400E',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-[11px] leading-tight flex-1">{zoneAlert.message}</span>
            <button
              type="button"
              onClick={() => setZoneAlert(null)}
              className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {showingIdlePromo && (
        <button type="button" aria-pressed={simGuestPresent} onClick={() => setSimGuestPresent(value => !value)}
          className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-lg border bg-white px-4 py-2 text-xs font-semibold shadow">
          {rc(simGuestPresent ? 'Guest left · resume promotion' : 'Guest arrived · pause promotion')}
        </button>
      )}
      {requestPhase && !isPaused && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(440px,94%)] max-h-[90%] overflow-y-auto rounded-xl border bg-white p-4 shadow-xl">
          <WorkflowGuestRequestPanel key={activeStep.step_id + ':' + stepRun} workflowId={activeWorkflow.id} phase={requestPhase}
            session={guestRequest} setSession={setGuestRequest} preview english={language === 'EN'}
            onNext={() => handleStepFinish()} onCancel={handleStopSim} />
        </div>
      )}
      {/* KHUNG LUA CHON CUA KHACH (BUOC CHOICE) - dung chung voi man hinh robot */}
      {activeStep?.type === 'CHOICE' && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[min(520px,92%)] rounded-2xl border shadow-2xl p-3 bg-white/95 backdrop-blur-xs"
          style={{ borderColor: '#BFBFBD' }}
        >
          <KioskChoicePrompt
            step={activeStep}
            disabled={isPaused}
            remainingSec={Math.ceil(((getChoiceTimeoutSec(activeStep) / (simSpeed || 1)) * (100 - stepProgress)) / 100)}
            onChoose={(optionId) => handleStepFinish({ type: OUTCOME.CHOSEN, optionId })}
            onCancel={() => handleStepFinish({ type: OUTCOME.CANCEL })}
          />
        </div>
      )}

      {/* FLOATING ZOOM CONTROLS (PHÓNG TO / THU NHỎ / RESET ZOOM TRÊN BẢN ĐỒ) */}
      <div
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1 rounded-xl border shadow-lg backdrop-blur-xs select-none"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#BFBFBD' }}
      >
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoomScale <= 0.75}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Thu nhỏ bản đồ (Zoom Out)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="h-7 px-2 rounded-lg font-mono font-bold text-[11px] text-[#262626] hover:bg-[#F2EFE9] cursor-pointer transition-colors"
          title="Khôi phục kích thước 100% (Reset Zoom)"
        >
          {Math.round(zoomScale * 100)}%
        </button>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoomScale >= 2.5}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Phóng to bản đồ (Zoom In)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-[#BFBFBD] mx-0.5" />

        <button
          type="button"
          onClick={handleResetZoom}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] cursor-pointer transition-colors"
          title="Căn giữa toàn màn hình"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};
