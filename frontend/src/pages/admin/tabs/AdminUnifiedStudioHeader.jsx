import React from 'react';
import { Trash2, RotateCw, Compass } from 'lucide-react';

export const AdminUnifiedStudioHeader = ({
  isWsConnected,
  activeWf,
  notification,
  handleResetGridMap,
  handleScan360,
  isScanning360,
  showTeleopPad,
  setShowTeleopPad,
  isPinMode,
  setIsPinMode,
  handleOpenAddZoneModal,
  handleStartSimulation,
  isSimulating,
  isPanelOpen,
  setIsPanelOpen,
}) => (
  <>
      {/* 1. COMPACT STUDIO HEADER - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 border-b px-5 shrink-0 flex items-center justify-between gap-3 text-xs"
        style={{ backgroundColor: '#F2EFE9', borderColor: '#CBD5E1' }}
      >
        {/* Left Status */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs tracking-tight" style={{ color: '#94A3B8' }}>
            Bản Đồ SLAM
          </span>
          <span
            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase"
            style={{
              backgroundColor: isWsConnected ? '#262626' : '#FAF8F5',
              color: isWsConnected ? '#FFFFFF' : '#8C8C8C',
              borderColor: '#CBD5E1',
            }}
          >
            {isWsConnected ? 'RPLIDAR ONLINE' : 'SIMULATION MODE'}
          </span>
          {notification && (
            <span className="text-[11px] font-semibold text-[#262626] animate-pulse pl-2 border-l" style={{ borderColor: '#CBD5E1' }}>
              {notification}
            </span>
          )}
        </div>

        {/* Right Quick Tools */}
        <div className="flex items-center gap-1.5">
          {/* Reset Map Button */}
          <button
            type="button"
            onClick={handleResetGridMap}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 hover:bg-[#E9E5DC]"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#94A3B8',
              borderColor: '#CBD5E1',
            }}
            title="Xóa sạch bản đồ SLAM hiện tại và đặt lại robot về gốc (0,0)"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#262626]" />
            <span>Xóa Map</span>
          </button>

          {/* Quét 360° Button */}
          <button
            type="button"
            disabled={isScanning360}
            onClick={handleScan360}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 hover:bg-[#E9E5DC] disabled:opacity-50"
            style={{
              backgroundColor: isScanning360 ? '#262626' : '#FFFFFF',
              color: isScanning360 ? '#F2EFE9' : '#262626',
              borderColor: isScanning360 ? '#262626' : '#BFBFBD',
            }}
            title="Cho robot xoay 360 độ từ tốn để quét toàn cảnh các bức tường xung quanh phòng"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isScanning360 ? 'animate-spin text-[#F2EFE9]' : 'text-[#262626]'}`} />
            <span>{isScanning360 ? 'Đang Quét 360°...' : 'Quét 360°'}</span>
          </button>

          {/* Lái Quét WASD Button */}
          <button
            type="button"
            onClick={() => setShowTeleopPad(!showTeleopPad)}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 hover:bg-[#E9E5DC]"
            style={{
              backgroundColor: showTeleopPad ? '#262626' : '#FFFFFF',
              color: showTeleopPad ? '#F2EFE9' : '#262626',
              borderColor: showTeleopPad ? '#262626' : '#BFBFBD',
            }}
            title="Bật/Tắt bảng điều khiển W-A-S-D để lái xe đi dạo quét phòng"
          >
            <Compass className={`w-3.5 h-3.5 ${showTeleopPad ? 'text-[#F2EFE9]' : 'text-[#262626]'}`} />
            <span>{showTeleopPad ? '✕ Đóng Lái' : 'Lái Quét'}</span>
          </button>

          {/* Pin Waypoint Tool */}
          <button
            type="button"
            onClick={() => setIsPinMode(!isPinMode)}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer hover:bg-[#E9E5DC]"
            style={{
              backgroundColor: isPinMode ? '#262626' : '#FFFFFF',
              color: isPinMode ? '#F2EFE9' : '#262626',
              borderColor: isPinMode ? '#262626' : '#BFBFBD',
            }}
          >
            {isPinMode ? '● Ghim...' : '+ Ghim Waypoint'}
          </button>

          {/* Add Functional Zone */}
          <button
            type="button"
            onClick={() => handleOpenAddZoneModal()}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer hover:bg-[#E9E5DC]"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
            title="Thêm mới Vùng Chức Năng (Vùng cấm, giảm tốc, yên lặng VIP, đón khách AI)"
          >
            + Vùng Chức Năng
          </button>

          {/* Test Run Workflow on Map */}
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleStartSimulation}
            className="px-3 py-1 rounded text-xs font-bold transition-opacity cursor-pointer disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
          >
            {isSimulating ? 'Đang chạy...' : '▶ Mô Phỏng'}
          </button>

          {/* Toggle Workflow Studio Pop-up Button */}
          <button
            type="button"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs hover:bg-[#E9E5DC]"
            style={{
              backgroundColor: isPanelOpen ? '#262626' : '#FFFFFF',
              color: isPanelOpen ? '#F2EFE9' : '#262626',
              borderColor: isPanelOpen ? '#262626' : '#BFBFBD',
            }}
            title={isPanelOpen ? "Đóng bảng kịch bản" : "Mở bảng thiết kế Kịch Bản Workflow"}
          >
            <span>{isPanelOpen ? '✕ Đóng Studio' : 'Studio Kịch Bản'}</span>
            {activeWf?.steps?.length > 0 && (
              <span
                className="px-1.5 py-0.2 rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: isPanelOpen ? '#8C8C8C' : '#262626',
                  color: '#FFFFFF',
                }}
              >
                {activeWf.steps.length}
              </span>
            )}
          </button>
        </div>
      </div>
  </>
);
