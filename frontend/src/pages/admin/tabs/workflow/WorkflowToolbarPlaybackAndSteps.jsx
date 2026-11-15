import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Square,
  Edit3,
  Check,
  X,
  ListOrdered,
  Megaphone,
} from 'lucide-react';

/**
 * Toolbar Group 2: playback buttons, compact stepper, live step progress chip,
 * and step list / inline MOVE waypoint-and-broadcast editor popover.
 */
export const WorkflowToolbarPlaybackAndSteps = ({
  rc,
  steps,
  editingStepIdx,
  setEditingStepIdx,
  handleUpdateMoveStepWaypoints,
  handleUpdateMoveStepBroadcast,
  currentStepIndex,
  isPlaying,
  isPaused,
  stepProgress,
  visitedSteps,
  setIsWorkflowMenuOpen,
  setIsMapMenuOpen,
  setIsSettingsMenuOpen,
  isStepsMenuOpen,
  setIsStepsMenuOpen,
  stepsMenuRef,
  endpoints,
  activeStep,
  activeDetail,
  handleStartSim,
  handlePauseSim,
  handleStopSim,
  handleNextStep,
  handleReset,
}) => {
  return (
    <div className="order-last xl:order-none w-full xl:w-auto xl:flex-1 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 min-w-0">
      {/* Cụm Nút Playback Controls: ĐỒNG BỘ 4 NÚT CÙNG TỈ LỆ VÀ KÍCH THƯỚC (32x32px) */}
      <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-xl border shrink-0" style={{ borderColor: '#BFBFBD' }}>
        {/* 1. Nút Chạy / Tạm dừng */}
        <button
          type="button"
          onClick={isPlaying ? handlePauseSim : handleStartSim}
          className={`h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs transition-all cursor-pointer ${
            isPlaying && !isPaused
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-emerald-700 hover:bg-emerald-800'
          }`}
          title={
            isPlaying && !isPaused
              ? rc('Pause simulation')
              : isPlaying && isPaused
              ? rc('Resume simulation')
              : rc('Run simulation')
          }
        >
          {isPlaying && !isPaused ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        {/* 2. Nút Bước tiếp theo */}
        <button
          type="button"
          onClick={isPlaying ? handleNextStep : handleStartSim}
          className="h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-[#363636] transition-colors"
          style={{ backgroundColor: '#262626' }}
          title={rc(isPlaying ? 'Next step' : 'Run simulation')}
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* 3. Nút Dừng hẳn mô phỏng */}
        <button
          type="button"
          onClick={handleStopSim}
          className="h-8 w-8 rounded-lg bg-red-700 hover:bg-red-800 text-white flex items-center justify-center shadow-xs cursor-pointer transition-colors"
          title={rc('Stop simulation')}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* 4. Nút Đặt Robot về vị trí chờ ban đầu */}
        <button
          type="button"
          onClick={handleReset}
          className="h-8 w-8 rounded-lg border bg-white hover:bg-[#FAF8F5] text-[#262626] shadow-xs flex items-center justify-center cursor-pointer transition-colors"
          style={{ borderColor: '#BFBFBD' }}
          title={rc('Reset robot position')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* DÃY TIẾN TRÌNH STEPPER VÀ TRẠNG THÁI REALTIME */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-xl border bg-[#F2EFE9] shadow-xs min-w-0"
        style={{ borderColor: '#BFBFBD' }}
      >
        {/* Dãy Stepper các bước ngang (Horizontal Steps) */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-0.5">
          {steps.map((st, idx) => {
            const isActive = isPlaying && currentStepIndex === idx;
            const isPast = isPlaying && !isActive && visitedSteps.has(idx);
            const stDetail = getStepActionDetail(st);

            return (
              <button
                key={st.step_id || idx}
                type="button"
                onClick={() => {
                  setIsStepsMenuOpen(true);
                  setEditingStepIdx(idx);
                  setIsWorkflowMenuOpen(false);
                  setIsMapMenuOpen(false);
                  setIsSettingsMenuOpen(false);
                }}
                className={`h-7 min-w-7 shrink-0 px-1.5 rounded-lg flex items-center justify-center text-[10.5px] font-mono font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#262626] text-white shadow-xs ring-2 ring-emerald-500/60 animate-pulse'
                    : isPast
                    ? 'bg-[#BFBFBD] text-[#262626]'
                    : 'border hover:bg-[#E9E5DC] text-[#8C8C8C] hover:text-[#262626]'
                }`}
                style={!isActive && !isPast ? { backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' } : {}}
                title={`Bước ${idx + 1}: ${stDetail.label} - ${st.title || stDetail.shortChip}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Vách ngăn mỏng */}
        <div className="w-px h-5 bg-[#BFBFBD] shrink-0" />

        {/* Chip Trạng thái & Tiến độ bước thời gian thực */}
        <div className="flex flex-col justify-center min-w-0 shrink-0 max-w-[35vw]">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold tracking-wider shrink-0"
              style={{
                backgroundColor: isPlaying ? '#262626' : '#E9E5DC',
                color: isPlaying ? '#FFFFFF' : '#262626',
                border: '1px solid #BFBFBD',
              }}
            >
              {isPlaying ? `B${currentStepIndex + 1}/${steps.length} ${activeDetail.label}` : 'READY'}
            </span>
            <span
              className="font-bold text-[11px] truncate max-w-[120px] sm:max-w-[200px]"
              style={{ color: '#262626' }}
              title={activeStep ? (activeStep.title || activeDetail.shortChip) : rc('Robot ready')}
            >
              {activeStep ? (activeStep.title || activeDetail.shortChip) : rc('Robot ready')}
            </span>
            {isPlaying && (
              <span className="font-mono font-bold text-[11px] text-[#262626] shrink-0">
                {stepProgress}%
              </span>
            )}
          </div>

          {/* Progress Bar mảnh chạy theo tiến độ */}
          {isPlaying && (
            <div className="w-full h-1 rounded-full bg-[#E9E5DC] overflow-hidden mt-0.5 border border-[#BFBFBD]/50">
              <div
                className="h-full bg-[#262626] transition-all duration-150 rounded-full"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Nút Popover mở Danh sách tất cả các bước chi tiết (ListOrdered) */}
        <div className="relative shrink-0" ref={stepsMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsStepsMenuOpen((prev) => !prev);
              setIsWorkflowMenuOpen(false);
              setIsMapMenuOpen(false);
              setIsSettingsMenuOpen(false);
            }}
            className={`h-7 w-7 rounded-lg border flex items-center justify-center shadow-2xs transition-all cursor-pointer ${
              isStepsMenuOpen ? 'bg-[#262626] text-white border-[#262626]' : 'text-[#262626] hover:bg-[#FAF8F5]'
            }`}
            style={!isStepsMenuOpen ? { backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' } : {}}
            title={`Xem & chỉnh sửa chi tiết ${steps.length} bước kịch bản`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* DROPDOWN POPOVER DANH SÁCH BƯỚC VÀ ĐỔI ĐIỂM MỐC */}
          {isStepsMenuOpen && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-2 w-80 sm:w-96 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-2 animate-fadeIn"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {/* Header Popover */}
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#262626]">
                  <ListOrdered className="w-4 h-4 text-[#262626]" />
                  <span>Tiến trình kịch bản</span>
                  <span className="font-mono text-[10px] text-[#8C8C8C]">({steps.length} bước)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStepsMenuOpen(false)}
                  className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Danh sách các bước dạng cuộn */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {steps.map((st, idx) => {
                  const isActive = isPlaying && currentStepIndex === idx;
                  const isPast = isPlaying && !isActive && visitedSteps.has(idx);
                  const stDetail = getStepActionDetail(st);

                  return (
                    <div
                      key={st.step_id || idx}
                      className="p-2 rounded-lg border transition-all flex flex-col gap-1.5 select-none"
                      style={{
                        backgroundColor: isActive ? '#FFFFFF' : isPast ? '#E9E5DC' : '#F2EFE9',
                        borderColor: isActive ? '#262626' : '#BFBFBD',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                              isActive
                                ? 'bg-[#262626] text-white'
                                : isPast
                                ? 'bg-[#BFBFBD] text-[#262626]'
                                : 'bg-[#E9E5DC] text-[#262626]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          {/* Nhãn loại bước rộng cố định để tiêu đề các bước thẳng một cột */}
                          <span
                            className="w-[78px] px-1 py-0.5 rounded text-[9px] text-center truncate font-mono font-bold tracking-wider border shrink-0"
                            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                            title={stDetail.label}
                          >
                            {stDetail.label === 'CREATE_REQUEST' ? 'REQUEST' : stDetail.label}
                          </span>
                          {/* Tiêu đề dài tự xuống dòng, không cắt bằng dấu ba chấm */}
                          <span className="flex-1 min-w-0 font-bold text-xs leading-snug break-words">
                            {st.title || stDetail.shortChip}
                          </span>
                        </div>

                        {st.type === 'MOVE' && !isPlaying && (
                          <button
                            type="button"
                            onClick={() => setEditingStepIdx(editingStepIdx === idx ? null : idx)}
                            className="p-1 rounded border transition-colors cursor-pointer shrink-0 hover:bg-[#FAF8F5]"
                            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                            title={editingStepIdx === idx ? 'Đóng bảng đổi điểm mốc' : 'Đổi điểm mốc xuất phát / đích đến'}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Bảng chỉnh sửa điểm mốc nếu đang mở */}
                      {editingStepIdx === idx && st.type === 'MOVE' && (
                        <div
                          className="mt-1 pt-2 border-t space-y-2 p-2 rounded-lg"
                          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Đổi Điểm Mốc (A ➔ B)</span>
                            <button
                              type="button"
                              onClick={() => setEditingStepIdx(null)}
                              className="p-0.5 rounded hover:bg-[#FAF8F5] cursor-pointer text-[#262626] transition-colors"
                              title="Hoàn tất và đóng"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                            </button>
                          </div>

                          <div className="space-y-0.5">
                            <label className="block text-[9px] font-bold uppercase text-[#8C8C8C]">
                              Từ Điểm Mốc (Start):
                            </label>
                            <select
                              value={st.params?.from_waypoint || 'CURRENT'}
                              onChange={(e) =>
                                handleUpdateMoveStepWaypoints(
                                  idx,
                                  e.target.value,
                                  st.params?.target_value || st.params?.target_waypoint_id || 'FRONT_DESK'
                                )
                              }
                              className="w-full px-2 py-1 rounded text-[10px] font-semibold border focus:outline-none cursor-pointer"
                              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                            >
                              <option value="CURRENT">Vị trí hiện tại của Robot</option>
                              {endpoints.map((wp) => (
                                <option key={wp.id} value={wp.id}>
                                  {wp.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-0.5">
                            <label className="block text-[9px] font-bold uppercase text-[#8C8C8C]">
                              Đến Điểm Mốc (Goal):
                            </label>
                            <select
                              value={st.params?.target_value || st.params?.target_waypoint_id || 'FRONT_DESK'}
                              onChange={(e) =>
                                handleUpdateMoveStepWaypoints(
                                  idx,
                                  st.params?.from_waypoint || 'CURRENT',
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 rounded text-[10px] font-semibold border focus:outline-none cursor-pointer"
                              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                            >
                              {endpoints.map((wp) => (
                                <option key={wp.id} value={wp.id}>
                                  {wp.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Phát loa quảng cáo khi di chuyển */}
                          <div className="space-y-0.5 pt-1 border-t" style={{ borderColor: '#BFBFBD' }}>
                            <label className="block text-[9px] font-bold uppercase text-[#4F46E5] flex items-center gap-1">
                              <Megaphone className="w-2.5 h-2.5" />
                              <span>Phát loa quảng cáo khi di chuyển:</span>
                            </label>
                            <input
                              type="text"
                              value={st.params?.broadcast_speech || ''}
                              onChange={(e) => handleUpdateMoveStepBroadcast(idx, e.target.value)}
                              placeholder="vd: Nhà hàng tầng 2 ưu đãi tiệc trà chiều..."
                              className="w-full px-2 py-1 rounded text-[10px] font-medium border focus:outline-none"
                              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
