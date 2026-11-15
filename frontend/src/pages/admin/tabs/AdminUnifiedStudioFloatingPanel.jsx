import React from 'react';
import { OTTO_STEP_TYPES } from './AdminWorkflowTab';
import { AdminUnifiedStudioWaypointsZonesTabs } from './AdminUnifiedStudioWaypointsZonesTabs';

export const AdminUnifiedStudioFloatingPanel = ({
  isPanelOpen,
  setIsPanelOpen,
  workflows,
  activeWf,
  setActiveWf,
  handleCreateNewWorkflow,
  handleOpenRenameModal,
  handleSaveCurrentWorkflow,
  sideTab,
  setSideTab,
  waypoints,
  keepOutZones,
  handleAddStep,
  handleMoveStep,
  handleRemoveStep,
  simStepIndex,
  setHighlightedWpId,
  simLogs,
  templateFilter,
  setTemplateFilter,
  selectedWaypoint,
  highlightedWpId,
  selectedZone,
  handleOpenAddEndpointModal,
  handleSelectWaypointFromMap,
  handleCanvasClickGoal,
  handleAddWaypointToWorkflow,
  handleOpenEditEndpointModal,
  handleOpenDeleteConfirm,
  handleOpenAddZoneModal,
  handleSelectZoneFromMap,
  handleOpenEditZoneModal,
  handleDeleteZone,
}) => (
  <>
            {/* FLOATING POP-UP WORKFLOW STUDIO PANEL OVER MAP */}
            {isPanelOpen && (
              <div
                className="absolute top-3 right-3 bottom-12 z-30 w-80 sm:w-96 rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
              >
          {/* Top Panel Selector */}
          <div className="p-3 border-b space-y-2 shrink-0" style={{ borderColor: '#CBD5E1', backgroundColor: '#FAF8F5' }}>
            <div className="flex items-center justify-between gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: '#8C8C8C' }}>
                KỊCH BẢN HOẠT ĐỘNG
              </label>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateNewWorkflow}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100 transition-colors"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  title="Tạo kịch bản mới"
                >
                  + Mới
                </button>
                <button
                  type="button"
                  onClick={handleOpenRenameModal}
                  disabled={!activeWf}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100 disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  title="Đổi tên kịch bản đang chọn"
                >
                  ✎ Đổi Tên
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentWorkflow}
                  className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100 transition-colors"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                >
                  Lưu Kịch Bản
                </button>
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="px-1.5 py-0.5 rounded text-[11px] font-bold text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer ml-0.5"
                  title="Thu gọn Bảng Kịch Bản"
                >
                  ✕
                </button>
              </div>
            </div>

            <select
              value={activeWf?.id || ''}
              onChange={(e) => {
                const found = workflows.find((w) => w.id === e.target.value);
                if (found) setActiveWf(found);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.steps?.length || 0} bước)
                </option>
              ))}
            </select>

            {/* SubTab Toggle: Workflow Steps vs Endpoints vs Functional Zones */}
            <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: '#CBD5E1' }}>
              <button
                type="button"
                onClick={() => setSideTab('workflow')}
                className="flex-1 py-1 text-center font-bold cursor-pointer transition-colors"
                style={{
                  backgroundColor: sideTab === 'workflow' ? '#262626' : '#FFFFFF',
                  color: sideTab === 'workflow' ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                Steps ({activeWf?.steps?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSideTab('waypoints')}
                className="flex-1 py-1 text-center font-bold cursor-pointer transition-colors text-ellipsis overflow-hidden whitespace-nowrap"
                style={{
                  backgroundColor: sideTab === 'waypoints' ? '#262626' : '#FFFFFF',
                  color: sideTab === 'waypoints' ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                Endpoints ({waypoints.length})
              </button>
              <button
                type="button"
                onClick={() => setSideTab('zones')}
                className="flex-1 py-1 text-center font-bold cursor-pointer transition-colors text-ellipsis overflow-hidden whitespace-nowrap"
                style={{
                  backgroundColor: sideTab === 'zones' ? '#262626' : '#FFFFFF',
                  color: sideTab === 'zones' ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                Vùng ({keepOutZones.length})
              </button>
            </div>
          </div>

          {/* TAB 1: WORKFLOW STEPS LIST */}
          {sideTab === 'workflow' && (
            <div className="flex-1 min-h-0 flex flex-col p-3 overflow-y-auto space-y-2">
              {/* Add Step Dropdown */}
              <div className="flex items-center gap-2 shrink-0 pb-1">
                <span className="text-[10px] font-semibold" style={{ color: '#8C8C8C' }}>Thêm Step:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddStep(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="flex-1 px-2 py-1 rounded text-xs font-bold border cursor-pointer focus:outline-none"
                  style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
                >
                  <option value="" disabled>+ Chọn bước chuẩn Otto</option>
                  {OTTO_STEP_TYPES.map((st) => (
                    <option key={st.type} value={st.type}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Steps Cards */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {(activeWf?.steps || []).map((step, idx) => {
                  const isCurrentSim = simStepIndex === idx;
                  const isMove = step.type === 'MOVE';

                  return (
                    <div
                      key={step.step_id || idx}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                        isCurrentSim ? 'ring-2 ring-emerald-500 shadow-md' : ''
                      }`}
                      style={{
                        backgroundColor: isCurrentSim ? '#F0FDF4' : '#FAF8F5',
                        borderColor: isCurrentSim ? '#10B981' : '#BFBFBD',
                      }}
                      onMouseEnter={() => {
                        if (isMove && step.params?.target_waypoint_id) {
                          setHighlightedWpId(step.params.target_waypoint_id);
                        }
                      }}
                      onMouseLeave={() => setHighlightedWpId(null)}
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between gap-1 border-b pb-1.5" style={{ borderColor: '#E9E5DC' }}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0"
                            style={{
                              backgroundColor: isMove ? '#262626' : '#52525B',
                              color: '#FFFFFF',
                              borderColor: isMove ? '#262626' : '#52525B',
                            }}
                          >
                            {step.type}
                          </span>
                          <span className="font-bold text-xs truncate" style={{ color: '#94A3B8' }}>
                            {step.title}
                          </span>
                        </div>

                        {/* Reorder and Delete */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, -1)}
                            disabled={idx === 0}
                            className="px-1 py-0.2 rounded text-[10px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, 1)}
                            disabled={idx === activeWf.steps.length - 1}
                            className="px-1 py-0.2 rounded text-[10px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="px-1.5 py-0.2 rounded text-[10px] border cursor-pointer hover:text-red-700"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Step Details & Waypoint link */}
                      {isMove && (
                        <div className="text-[11px] font-mono" style={{ color: '#6D28D9' }}>
                          Đích đến: <strong>{step.params?.waypoint_name || 'Tọa độ'}</strong> (X:{step.params?.target_x || 0}, Y:{step.params?.target_y || 0})
                        </div>
                      )}
                      {step.type === 'SPEAK' && (
                        <div className="text-[11px] truncate italic" style={{ color: '#8C8C8C' }}>
                          "{step.params?.speech_text || 'Đọc lời chào ra loa'}"
                        </div>
                      )}
                      {step.type === 'GREET' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Biểu cảm: <strong>{step.params?.face_expression || 'SMILE'}</strong> • Đèn: <strong>{step.params?.led_color || 'CYAN'}</strong>
                        </div>
                      )}
                      {step.type === 'SHOW' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Màn hình: <strong>{step.params?.screen_mode || 'MENU'}</strong>
                        </div>
                      )}
                      {step.type === 'COMMUNICATE' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Đối thoại AI (Ngắt sau: <strong>{step.params?.silence_timeout_sec || 30}s</strong> im lặng)
                        </div>
                      )}
                      {step.type === 'LISTEN' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Kênh: <strong>{step.params?.input_mode || 'VOICE/TOUCH'}</strong> (Chờ: {step.params?.timeout_sec || 15}s)
                        </div>
                      )}
                      {step.type === 'RECOMMEND' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Gợi ý: <strong>{step.params?.highlight_item || 'Ẩm thực & Spa'}</strong>
                        </div>
                      )}
                      {step.type === 'CREATE_REQUEST' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Phiếu gửi: <strong>{step.params?.target_department || 'Housekeeping'}</strong>
                        </div>
                      )}
                      {step.type === 'FEEDBACK' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Khảo sát: <strong>1 - 5 Sao</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Simulation Logs Output */}
              {simLogs.length > 0 && (
                <div
                  className="p-2.5 rounded-xl border text-[10px] font-mono space-y-1 max-h-32 overflow-y-auto shrink-0"
                  style={{ backgroundColor: '#1A1917', color: '#E9E5DC', borderColor: '#262626' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 border-b pb-0.5 mb-1" style={{ borderColor: '#333' }}>
                    LOG MÔ PHỎNG TIẾN TRÌNH:
                  </div>
                  {simLogs.map((log, lIdx) => (
                    <div key={lIdx} className="leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <AdminUnifiedStudioWaypointsZonesTabs
            sideTab={sideTab}
            waypoints={waypoints}
            keepOutZones={keepOutZones}
            templateFilter={templateFilter}
            setTemplateFilter={setTemplateFilter}
            selectedWaypoint={selectedWaypoint}
            highlightedWpId={highlightedWpId}
            selectedZone={selectedZone}
            handleOpenAddEndpointModal={handleOpenAddEndpointModal}
            handleSelectWaypointFromMap={handleSelectWaypointFromMap}
            handleCanvasClickGoal={handleCanvasClickGoal}
            handleAddWaypointToWorkflow={handleAddWaypointToWorkflow}
            handleOpenEditEndpointModal={handleOpenEditEndpointModal}
            handleOpenDeleteConfirm={handleOpenDeleteConfirm}
            handleOpenAddZoneModal={handleOpenAddZoneModal}
            handleSelectZoneFromMap={handleSelectZoneFromMap}
            handleOpenEditZoneModal={handleOpenEditZoneModal}
            handleDeleteZone={handleDeleteZone}
          />
        </div>
      )}
  </>
);
