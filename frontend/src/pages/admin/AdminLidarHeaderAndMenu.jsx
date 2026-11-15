import React from 'react';
import {
  Radio,
  Sparkles,
  Layers,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronDown,
  Compass,
  Save,
  FolderOpen,
  AlertOctagon,
  Menu,
  Lock,
  Unlock,
} from 'lucide-react';

export function AdminLidarHeaderAndMenu({
  rc,
  isWsConnected,
  rosbridgeUrl,
  lidarLive,
  scanPoints,
  odometryMotionSeen,
  hasLiveRosMap,
  mapStats,
  menuDropdownRef,
  handleToggleLockMap,
  mapMode,
  isMapLocked,
  handleEmergencyStop,
  isExploring,
  telemetry,
  isMenuDropdownOpen,
  setIsMenuDropdownOpen,
  isRos2RuntimeBusy,
  handleStartMappingFromWeb,
  handleOpenSaveMapModal,
  handleStartNavigationFromWeb,
  setIsExploreModalOpen,
  handleStopExplore,
  handleOpenSavedMapsModal,
  savedMapsList,
  selectedMapId,
  handleSelectMap,
  handleResetGridMap,
  handleReconnect,
  exploreError,
  setExploreError,
  navNotification,
  setNavNotification,
}) {
  return (
    <>
      <header className="robot-page-heading">
        <div><p> {rc("ROBOT OPERATIONS")} </p><h1>{rc('Robot Control')}</h1></div>
        <span className="robot-page-badge"> {rc("LIVE CONTROL")} </span>
      </header>
      {/* Status Banner — Dedicated ROS 2 & VNC Connection */}
      <div className="robot-status-bar w-full border-b px-6 py-2 flex items-center justify-between text-xs font-mono"
        style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C'}}>
        <div className="flex items-center gap-3">
          <span className="font-bold px-2.5 py-1 rounded-md border text-[10px] flex items-center gap-1.5"
            style={isWsConnected
              ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626'}
              : { background: '#F2EFE9', color: '#8C8C8C', borderColor: '#BFBFBD'}}>
            <Compass className="w-3.5 h-3.5 text-emerald-400"/>
            <span>{isWsConnected ? `ROSBRIDGE ONLINE — ${rosbridgeUrl}`: `ROSBRIDGE OFFLINE — ${rosbridgeUrl}`}</span>
          </span>

          {isWsConnected && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold hidden sm:inline-block ${
              lidarLive
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-red-100 text-red-800 border-red-300'
            }`}>
              {lidarLive ? `LIDAR LIVE: ${scanPoints.length} PTS` : rc("LIDAR: NO SCAN")}
            </span>
          )}

          {isWsConnected && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold hidden sm:inline-block ${
              odometryMotionSeen
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {odometryMotionSeen ? rc("ODOM: MOTION DETECTED") : rc("ODOM: STATIONARY")}
            </span>
          )}

          <span style={{ color: '#8C8C8C'}}>MAP {hasLiveRosMap ? 'LIVE' : rc("NOT LIVE")}: <strong style={{ color: '#262626'}}>{mapStats.known} {rc("cells")} </strong></span>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuDropdownRef}>
          {/* Nút Khóa Bản Đồ Gốc (Freeze / Lock Base Map) */}
          <button
            type="button"
            onClick={handleToggleLockMap}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isMapLocked
                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700 ring-2 ring-amber-300'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
            }`}
            title={
              mapMode === 'NAVIGATION'
                ? rc("Navigation uses the saved static map. LaserScan is used for localization and obstacle avoidance.")
                : isMapLocked
                ? rc("The base map is locked and new scans are paused. Click to resume scanning.")
                : rc("Lock the base map to prevent SLAM from adding duplicate walls while moving.")
            }
          >
            {isMapLocked ? (
              <Lock className="w-3.5 h-3.5 text-white" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-stone-600" />
            )}
            <span>
              {mapMode === 'NAVIGATION'
                ? rc("NAVIGATION · STATIC MAP")
                : isMapLocked
                  ? rc("MAPPING PAUSED")
                  : rc("MAPPING · SCANNING")}
            </span>
          </button>

          {/* Nút Dừng Khẩn Cấp (E-STOP) nhanh trên thanh công cụ */}
          <button
            onClick={handleEmergencyStop}
            className={`px-3 py-1 text-[11px] font-black rounded-md border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isExploring || telemetry.linearVelocity !== 0 || telemetry.angularVelocity !== 0
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse ring-2 ring-red-400'
                : 'bg-red-600 hover:bg-red-700 text-white border-red-700'
            }`}
            title={rc("EMERGENCY STOP: stop all wheel motion and autonomous navigation immediately")}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-white"/>
            <span>E-STOP</span>
          </button>

          {/* Icon Menu Dropdown gom toàn bộ các lệnh thao tác bản đồ & robot */}
          <button
            type="button"
            onClick={() => setIsMenuDropdownOpen((prev) => !prev)}
            className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200 shadow-xs"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626'}}
            title={rc("Robot commands and map actions")}
          >
            <Menu className="w-3.5 h-3.5 text-stone-700"/>
            <span> {rc("COMMANDS")} </span>
            <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${isMenuDropdownOpen ? 'rotate-180': ''}`} />
          </button>

          {/* Floating Dropdown Menu Panel */}
          {isMenuDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border shadow-xl py-1.5 z-50 flex flex-col font-sans backdrop-blur-md"
              style={{ background: '#FAF8F5', borderColor: '#BFBFBD'}}
            >
              <button
                type="button"
                disabled={isRos2RuntimeBusy}
                onClick={() => {
                  handleStartMappingFromWeb();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-2.5 text-cyan-800 hover:bg-cyan-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-cyan-600 shrink-0"/>
                <div className="flex flex-col">
                  <span> {rc("1. Start Mapping")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Start WSL2, SLAM Toolbox and Foxglove")} </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isRos2RuntimeBusy}
                onClick={() => {
                  handleStartNavigationFromWeb();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-2.5 text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-amber-600 shrink-0"/>
                <div className="flex flex-col">
                  <span> {rc("3. Start Navigation")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Load static map:")} {selectedMapId || rc("not selected")}</span>
                </div>
              </button>

              <div className="h-px bg-stone-200 my-1"/>

              {/* Quét Full Phòng SLAM / Dừng Quét */}
              {isExploring ? (
                <button
                  type="button"
                  onClick={() => {
                    handleStopExplore();
                    setIsMenuDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-2.5 text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0"/>
                  <div className="flex flex-col">
                    <span> {rc("Stop Exploration")} </span>
                    <span className="text-[10px] text-red-500 font-normal"> {rc("The robot is exploring (SLAM + Nav2) · click to stop")} </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsExploreModalOpen(true);
                    setIsMenuDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold flex items-center gap-2.5 text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0"/>
                  <div className="flex flex-col">
                    <span> {rc("Scan Entire Room (SLAM)")} </span>
                    <span className="text-[10px] text-stone-500 font-normal"> {rc("Autonomously navigate and scan the room")} </span>
                  </div>
                </button>
              )}

              <div className="h-px bg-stone-200 my-1"/>

              {/* Khóa Bản Đồ Gốc / Tiếp Tục Quét */}
              <button
                type="button"
                onClick={() => {
                  handleToggleLockMap();
                  setIsMenuDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isMapLocked ? 'text-amber-800 hover:bg-amber-50' : 'text-stone-800 hover:bg-stone-100'
                }`}
              >
                {isMapLocked ? (
                  <Lock className="w-4 h-4 text-amber-600 shrink-0"/>
                ) : (
                  <Unlock className="w-4 h-4 text-stone-600 shrink-0"/>
                )}
                <div className="flex flex-col">
                  <span className="font-bold">{isMapLocked ? rc("Resume Mapping") : rc("Lock Base Map")}</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    {isMapLocked ? rc("Resume scanning to extend the map") : rc("Keep one fixed base map without duplicate walls")}
                  </span>
                </div>
              </button>

              <div className="h-px bg-stone-200 my-1"/>

              {/* Lưu Bản Đồ */}
              <button
                type="button"
                onClick={() => {
                  handleOpenSaveMapModal();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-blue-600 shrink-0"/>
                <div className="flex flex-col">
                  <span className="font-bold"> {rc("2. Save, Lock & Navigate")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Save YAML/PGM, lock the map and start Navigation")} </span>
                </div>
              </button>

              {/* Bản Đồ Đã Lưu */}
              <button
                type="button"
                onClick={() => {
                  handleOpenSavedMapsModal();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-amber-600 shrink-0"/>
                <div className="flex flex-col">
                  <span className="font-bold"> {rc("Saved Maps")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Browse and load saved maps")} </span>
                </div>
              </button>

              {/* Nạp nhanh bản đồ nếu có trong danh sách */}
              {savedMapsList.length > 0 && (
                <div className="px-3 py-1.5 bg-stone-100/70 border-y border-stone-200 flex flex-col gap-1 text-[11px] my-1">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider"> {rc("Quick-load map:")} </span>
                  <select
                    value={selectedMapId}
                    onChange={(e) => {
                      handleSelectMap(e.target.value);
                      setIsMenuDropdownOpen(false);
                    }}
                    className="w-full py-1 px-1.5 rounded border text-[11px] font-semibold bg-white border-stone-300 text-stone-800 outline-none cursor-pointer"
                  >
                    {savedMapsList.map((m) => (
                      <option key={m.map_id} value={m.map_id}>
                        {m.name || m.map_id} ({m.width}x{m.height})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="h-px bg-stone-200 my-1"/>

              {/* Xóa Bản Đồ (Reset) */}
              <button
                type="button"
                onClick={() => {
                  handleResetGridMap();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500 shrink-0"/>
                <div className="flex flex-col">
                  <span className="font-bold"> {rc("Reset Map")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Clear the SLAM grid and return the robot to (0,0)")} </span>
                </div>
              </button>

              {/* Kết Nối Lại */}
              <button
                type="button"
                onClick={() => {
                  handleReconnect();
                  setIsMenuDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2.5 text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-stone-600 shrink-0"/>
                <div className="flex flex-col">
                  <span className="font-bold"> {rc("Reconnect")} </span>
                  <span className="text-[10px] text-stone-500 font-normal"> {rc("Reconnect to Rosbridge 9090")} </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loi bat tu quet: do, giu nguyen toi khi bam X */}
      {exploreError && (
        <div
          role="alert"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 max-w-xl px-4 py-2.5 rounded-lg shadow-lg border flex items-start gap-2 text-xs font-bold pointer-events-auto"
          style={{ background: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B'}}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5"/>
          <span className="leading-relaxed">{exploreError}</span>
          <button onClick={() => setExploreError('')} className="ml-2 text-red-400 hover:text-red-700 font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Floating Toast Notification (Absolute - Never shifts workspace layout height) */}
      {navNotification && !exploreError && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-md border flex items-center gap-2 text-xs font-bold font-mono pointer-events-auto backdrop-blur-xs"
          style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD', color: '#262626'}}>
          <Radio className="w-3.5 h-3.5 shrink-0 text-amber-600 animate-pulse"/>
          <span>{navNotification}</span>
          <button onClick={() => setNavNotification('')} className="ml-2 text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}
    </>
  );
}
