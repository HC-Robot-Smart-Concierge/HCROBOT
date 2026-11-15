import React from 'react';
import { Layers, X, ChevronDown } from 'lucide-react';

/**
 * Toolbar Group 1: scenario workflow selector dropdown and Map Layer (Zones / Endpoints) popover.
 */
export const WorkflowToolbarScenarioAndMap = ({
  rc,
  localWorkflows,
  selectedWorkflowId,
  setSelectedWorkflowId,
  activeWorkflow,
  steps,
  zones,
  showZones,
  setShowZones,
  selectedZone,
  isZoneEditMode,
  setIsZoneEditMode,
  hasUnsavedZones,
  isSavingZones,
  isWorkflowMenuOpen,
  setIsWorkflowMenuOpen,
  isMapMenuOpen,
  setIsMapMenuOpen,
  mapMenuTab,
  setMapMenuTab,
  setIsSettingsMenuOpen,
  workflowMenuRef,
  mapMenuRef,
  handleAddZone,
  handleSaveZones,
  handleResetDefaultZones,
  endpoints,
  selectedEndpoint,
  hasUnsavedEndpoints,
  isSavingEndpoints,
  handleAddEndpoint,
  handleSaveEndpointToDb,
  handleResetDefaultEndpoints,
  handleStopSim,
}) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* Dropdown Kịch bản: BÊN NGOÀI CHỈ HIỆN WORKFLOW X + CHEVRON */}
      <div className="relative" ref={workflowMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsWorkflowMenuOpen((prev) => !prev);
            setIsMapMenuOpen(false);
            setIsSettingsMenuOpen(false);
          }}
          className={`h-8 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
            isWorkflowMenuOpen
              ? 'bg-[#262626] text-white border-[#262626]'
              : 'text-[#262626] hover:bg-[#FAF8F5]'
          }`}
          style={!isWorkflowMenuOpen ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
          title={activeWorkflow?.name || rc('Select workflow')}
        >
          <span>
            Workflow {localWorkflows.findIndex((w) => w.id === selectedWorkflowId) >= 0 ? localWorkflows.findIndex((w) => w.id === selectedWorkflowId) + 1 : 1}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform opacity-70 ${isWorkflowMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* DANH SÁCH CHI TIẾT KHI MỞ RA */}
        {isWorkflowMenuOpen && (
          <div
            className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 rounded-xl border shadow-2xl p-2.5 z-50 text-xs space-y-1.5 animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            <div className="flex items-center justify-between pb-2 border-b px-1" style={{ borderColor: '#E9E5DC' }}>
              <span className="font-bold text-xs uppercase tracking-wider text-[#8C8C8C]">
                Danh sách kịch bản ({localWorkflows.length})
              </span>
              <button
                type="button"
                onClick={() => setIsWorkflowMenuOpen(false)}
                className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {localWorkflows.map((wf, idx) => {
                const isSelected = wf.id === selectedWorkflowId;
                return (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => {
                      handleStopSim();
                      setSelectedWorkflowId(wf.id);
                      setIsWorkflowMenuOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#262626] text-white border-[#262626] shadow-xs'
                        : 'hover:bg-[#F2EFE9] border-transparent hover:border-[#E9E5DC] text-[#262626]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#262626]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">
                          {wf.name}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 truncate ${
                            isSelected ? 'text-white/70' : 'text-[#8C8C8C]'
                          }`}
                        >
                          {wf.description || `${wf.steps?.length || 0} bước thực thi`}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#262626]'
                      }`}
                    >
                      {wf.steps?.length || 0} bước
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ICON BUTTON BẢN ĐỒ (CHỈ DÙNG ICON LAYERS + CHEVRON, TOOLTIP CHI TIẾT) */}
      <div className="relative" ref={mapMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsMapMenuOpen((prev) => !prev);
            setIsWorkflowMenuOpen(false);
            setIsSettingsMenuOpen(false);
          }}
          className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
            isMapMenuOpen || selectedZone || selectedEndpoint
              ? 'bg-[#262626] text-white border-[#262626]'
              : 'text-[#262626] hover:bg-[#FAF8F5]'
          }`}
          style={!(isMapMenuOpen || selectedZone || selectedEndpoint) ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
          title={`Lớp bản đồ: ${zones.length} Vùng · ${endpoints.length} Điểm`}
        >
          <Layers className="w-4 h-4" />
          {(hasUnsavedZones || hasUnsavedEndpoints) && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}
          <ChevronDown className={`w-3 h-3 transition-transform opacity-70 ${isMapMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* DROPDOWN POPOVER BẢN ĐỒ */}
        {isMapMenuOpen && (
          <div
            className="absolute top-full left-0 mt-1.5 w-80 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-3 animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Layers className="w-4 h-4 text-[#262626]" />
                <span>Cấu hình Lớp bản đồ</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMapMenuOpen(false)}
                className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tabs chuyển đổi giữa Vùng và Điểm đích (Text thuần túy) */}
            <div className="flex p-0.5 rounded-lg border bg-[#F2EFE9]" style={{ borderColor: '#E9E5DC' }}>
              <button
                type="button"
                onClick={() => setMapMenuTab('ZONES')}
                className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition-all flex items-center justify-center cursor-pointer ${
                  mapMenuTab === 'ZONES' ? 'bg-[#262626] text-white shadow-xs' : 'text-[#8C8C8C] hover:text-[#262626]'
                }`}
              >
                <span>Vùng ({zones.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMapMenuTab('ENDPOINTS')}
                className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition-all flex items-center justify-center cursor-pointer ${
                  mapMenuTab === 'ENDPOINTS' ? 'bg-[#262626] text-white shadow-xs' : 'text-[#8C8C8C] hover:text-[#262626]'
                }`}
              >
                <span>Điểm đích ({endpoints.length})</span>
              </button>
            </div>

            {/* TAB 1: VÙNG QUY ĐỊNH */}
            {mapMenuTab === 'ZONES' && (
              <div className="space-y-2.5">
                {/* Bật/Tắt hiển thị & Kéo thả (Gọn gàng không chèn icon) */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowZones((prev) => !prev)}
                    className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
                    style={{ borderColor: '#E9E5DC' }}
                  >
                    <span className="text-[#262626]">Hiển thị Lớp Vùng</span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        showZones ? 'bg-emerald-100 text-emerald-800' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                      }`}
                    >
                      {showZones ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsZoneEditMode((prev) => !prev)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold cursor-pointer transition-colors text-left text-xs ${
                      isZoneEditMode
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'hover:bg-[#F2EFE9] text-[#262626] border-[#E9E5DC]'
                    }`}
                  >
                    <span>Kéo thả & Co giãn Vùng</span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isZoneEditMode ? 'bg-amber-200 text-amber-900' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                      }`}
                    >
                      {isZoneEditMode ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>
                </div>

                {/* Thêm Vùng mới */}
                <div className="pt-1.5 border-t space-y-1" style={{ borderColor: '#E9E5DC' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    + Thêm vùng chức năng:
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleAddZone('KEEP_OUT')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-red-50 text-red-700 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                      <span>Cấm vào (Keep-Out Zone)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddZone('SPEED_ZONE')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Giới hạn tốc độ (Speed Zone)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddZone('NO_STOP')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Cấm dừng (No-Stop Zone)</span>
                    </button>
                  </div>
                </div>

                {/* Lưu & Đặt lại Vùng (Pure Text CTA) */}
                <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveZones();
                      setIsMapMenuOpen(false);
                    }}
                    disabled={isSavingZones || !hasUnsavedZones}
                    className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs transition-all ${
                      hasUnsavedZones
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer animate-pulse'
                        : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                    }`}
                  >
                    <span>{isSavingZones ? 'Đang lưu...' : 'Lưu Vùng'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetDefaultZones();
                      setIsMapMenuOpen(false);
                    }}
                    className="h-7.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                    style={{ borderColor: '#BFBFBD' }}
                    title="Khôi phục lại 3 Vùng Chức Năng về chuẩn ban đầu"
                  >
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: ĐIỂM ĐÍCH (ENDPOINTS) */}
            {mapMenuTab === 'ENDPOINTS' && (
              <div className="space-y-2.5">
                {/* Thêm Endpoint Mới */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    + Thêm điểm đích mới:
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('WAYPOINT')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#F2EFE9] text-[#262626] font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#262626] shrink-0" />
                      <span>Waypoint (Điểm đường / Điểm trung gian)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('CHARGER')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-emerald-50 text-emerald-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0" />
                      <span>Charger (Trạm sạc pin)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('PARK')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#E9E5DC] text-stone-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#71717A] shrink-0" />
                      <span>Park (Điểm đỗ / chờ)</span>
                    </button>
                  </div>
                </div>

                {/* Lưu & Đặt lại Endpoints (Pure Text CTA) */}
                <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                  <button
                    type="button"
                    onClick={() => {
                      endpoints.forEach((ep) => handleSaveEndpointToDb(ep));
                      setIsMapMenuOpen(false);
                    }}
                    disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                    className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs transition-all ${
                      hasUnsavedEndpoints
                        ? 'bg-[#262626] hover:bg-[#383838] text-[#F2EFE9] cursor-pointer'
                        : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                    }`}
                  >
                    <span>{isSavingEndpoints ? 'Đang lưu...' : 'Lưu Điểm'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetDefaultEndpoints();
                      setIsMapMenuOpen(false);
                    }}
                    className="h-7.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                    style={{ borderColor: '#BFBFBD' }}
                    title="Khôi phục lại danh sách Điểm Mốc về chuẩn ban đầu"
                  >
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
