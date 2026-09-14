import React from 'react';

export const StudioHeader = ({
  isWsConnected,
  notification,
  isPinMode,
  setIsPinMode,
  onAddKeepOutZone,
  isSimulating,
  onStartSimulation,
}) => {
  return (
    <div
      className="h-12 border-b px-4 shrink-0 flex items-center justify-between gap-3 text-xs"
      style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
    >
      {/* Left Title & Status */}
      <div className="flex items-center gap-2.5">
        <span className="font-black text-sm tracking-tight" style={{ color: '#262626' }}>
          LiDAR SLAM Map &amp; Step Workflow Studio
        </span>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
          style={{
            backgroundColor: isWsConnected ? '#262626' : '#FAF8F5',
            color: isWsConnected ? '#FFFFFF' : '#8C8C8C',
            borderColor: '#BFBFBD',
          }}
        >
          {isWsConnected ? 'RPLIDAR COM9 ONLINE' : 'SIMULATION MODE'}
        </span>
        {notification && (
          <span
            className="text-[11px] font-semibold text-emerald-700 animate-pulse pl-2 border-l"
            style={{ borderColor: '#BFBFBD' }}
          >
            {notification}
          </span>
        )}
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Pin Waypoint Tool */}
        <button
          type="button"
          onClick={() => setIsPinMode(!isPinMode)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
          style={{
            backgroundColor: isPinMode ? '#262626' : '#FFFFFF',
            color: isPinMode ? '#F2EFE9' : '#262626',
            borderColor: isPinMode ? '#262626' : '#BFBFBD',
          }}
        >
          {isPinMode ? '● Click bản đồ để ghim...' : '+ Ghim Waypoint'}
        </button>

        {/* Add Keep-out zone */}
        <button
          type="button"
          onClick={onAddKeepOutZone}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#DC2626' }}
          title="Thêm vùng cấm di chuyển"
        >
          + Vùng Cấm
        </button>

        {/* Test Run Workflow on Map */}
        <button
          type="button"
          disabled={isSimulating}
          onClick={onStartSimulation}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-opacity cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
        >
          {isSimulating ? 'Đang chạy mô phỏng...' : '▶ Chạy kịch bản trên Map'}
        </button>
      </div>
    </div>
  );
};
