import React from 'react';
import {
  BatteryCharging,
  ShieldAlert,
  Layers,
  RefreshCw,
  Video,
  Compass,
  Save,
  AlertOctagon,
} from 'lucide-react';
import { AdminCameraTab } from './tabs/AdminCameraTab';
import { FoxgloveWebViewer } from '../../components/admin/FoxgloveWebViewer';
import { RobotManualControls } from '../../components/admin/RobotManualControls';
import { formatPowerValue, formatDuration } from './adminLidarUtils';

export function AdminLidarWorkspaceView({
  rc,
  currentUser,
  activeView,
  switchView,
  telemetry,
  emergencyStopVersion,
  isRos2RuntimeBusy,
  handleStartMappingFromWeb,
  handleOpenSaveMapModal,
  selectedMapId,
  setSelectedMapId,
  savedMapsList,
  handleStartNavigationFromWeb,
  mapMode,
  lidarLive,
  odometryMotionSeen,
  isExploring,
  exploredCount,
  handleEmergencyStop,
  safetyInfo,
  piPowerBadge,
  piPower,
  piBattery,
  piBatteryPercent,
  piBatteryBarColor,
  piVoltageLow,
  piPowerNotes,
  isBatteryEditOpen,
  setIsBatteryEditOpen,
  batteryInputPercent,
  setBatteryInputPercent,
  batteryInputRate,
  setBatteryInputRate,
  handleSyncBattery,
  isSyncingBattery,
  activeNavGoal,
  slamSpeed,
  slamSpeedDraft,
  setSlamSpeedDraft,
  handleSlamSpeedChange,
  slamActiveMotion,
  startTeleop,
  stopTeleop,
  encoders,
}) {
  return (
    <>
      <div className="robot-view-tabs" role="tablist" aria-label="Robot Control">
        <button type="button" role="tab" id="robot-slam-tab" aria-selected={activeView === 'slam'} aria-controls="robot-slam-panel" onClick={() => switchView('slam')}>
          <Layers size={15} /> {rc('Control & SLAM')}
        </button>
        <button type="button" role="tab" id="robot-camera-tab" aria-selected={activeView === 'camera'} aria-controls="robot-camera-panel" onClick={() => switchView('camera')}>
          <Video size={15} /> {rc('Live Camera')}
        </button>
        <span> {rc("Shared control workspace")} </span>
      </div>

      <AdminCameraTab currentUser={currentUser} active={activeView === 'camera'} telemetry={telemetry} emergencyStopVersion={emergencyStopVersion}
        renderWorkspace={({ cameraView, cameraControls, cameraExtras, activeMotion }) => (
          <main className="robot-workspace">
            <div className="robot-workspace-main">
              <section id="robot-slam-panel" role="tabpanel" aria-labelledby="robot-slam-tab" hidden={activeView !== 'slam'} className="robot-slam-view">
          <div className="shrink-0 rounded-xl border border-stone-300 bg-white px-3 py-2 flex items-center gap-2 text-[11px] shadow-sm">
            <button
              type="button"
              disabled={isRos2RuntimeBusy}
              onClick={handleStartMappingFromWeb}
              className="px-3 py-1.5 rounded-lg border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5"/>
              <span> {rc("1. SCAN MAP")} </span>
            </button>
            <button
              type="button"
              disabled={isRos2RuntimeBusy}
              onClick={handleOpenSaveMapModal}
              className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              title={rc("Save the current map and switch to Navigation")}
            >
              <Save className="w-3.5 h-3.5"/>
              <span> {rc("2. SAVE & LOCK")} </span>
            </button>
            <select
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
              className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-700 font-semibold outline-none"
              title={rc("Map for Navigation")}
            >
              {savedMapsList.length === 0 && <option value="phong_lam_viec">phong_lam_viec</option>}
              {savedMapsList.map((mapItem) => (
                <option key={mapItem.map_id || mapItem.name} value={mapItem.map_id || mapItem.name}>
                  {mapItem.name || mapItem.map_id}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isRos2RuntimeBusy}
              onClick={() => handleStartNavigationFromWeb()}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5"/>
              <span>3. NAVIGATION</span>
            </button>
            {isRos2RuntimeBusy && <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0"/>}
          </div>
          {mapMode === 'MAPPING' && lidarLive && !odometryMotionSeen && (
            <div className="shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-[11px] text-orange-900 font-semibold"> {rc("LiDAR is scanning while stationary. Encoders must report motion to extend the map. If the robot has moved and this message remains, stop scanning and check encoders/odometry before saving.")} </div>
          )}
          <div className="w-full flex-1 relative overflow-hidden">
            <FoxgloveWebViewer
              activeMapName={selectedMapId}
              isRuntimeBusy={isRos2RuntimeBusy}
              onStartMapping={handleStartMappingFromWeb}
              onStartNavigation={() => handleStartNavigationFromWeb()}
            />
            {/* Floating Status HUD khi dang tu hanh quet full phong */}
            {isExploring && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-stone-900/90 border border-emerald-500/60 rounded-full shadow-2xl backdrop-blur-md text-white text-xs font-semibold pointer-events-auto">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"/>
                <span className="text-emerald-400 font-mono font-bold"> {rc("AUTONOMOUS SLAM:")} </span>
                <span> {rc("The robot is scanning the entire room...")} </span>
                {exploredCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/40 text-[10px] text-emerald-200 font-mono">
                    {exploredCount} {rc("locations")} </span>
                )}
                <button
                  onClick={handleEmergencyStop}
                  className="ml-1.5 px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] cursor-pointer transition-colors shadow-md flex items-center gap-1 animate-pulse"
                  title={rc("Stop all autonomous navigation and motors immediately")}
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-white"/>
                  <span> {rc("Emergency Stop")} </span>
                </button>
              </div>
            )}
          </div>
              </section>
              <section id="robot-camera-panel" role="tabpanel" aria-labelledby="robot-camera-tab" hidden={activeView !== 'camera'} className="robot-camera-panel">
                {cameraView}
                {cameraExtras}
              </section>
            </div>
            <aside className="robot-workspace-sidebar">
          {/* Card 2: Telemetry & Odometry (Thiết kế tinh gọn, dễ theo dõi) */}
          <div className="robot-telemetry border rounded-xl p-3 flex flex-col gap-2"style={{ background: '#FFFFFF', borderColor: '#BFBFBD'}}>
            <div className="flex items-center justify-between border-b pb-1.5"style={{ borderColor: '#BFBFBD'}}>
              <span className="text-[9px] font-bold tracking-widest uppercase text-stone-500">{rc('Telemetry & Odometry')}</span>
              <span className="text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border bg-stone-100 text-stone-600 border-stone-300">
                {telemetry.source}
              </span>
            </div>

            {/* Position (X, Y, Yaw) & Speeds (Vx, Wz) gom trên 1 hàng 5 cột */}
            <div className="grid grid-cols-5 gap-1 text-center font-mono">
              <div className="p-1 rounded border bg-[#FAF8F5] border-stone-200">
                <div className="text-[7.5px] font-bold text-stone-500 font-sans">X</div>
                <div className="text-[11px] font-black text-stone-900">{telemetry.x}m</div>
              </div>
              <div className="p-1 rounded border bg-[#FAF8F5] border-stone-200">
                <div className="text-[7.5px] font-bold text-stone-500 font-sans">Y</div>
                <div className="text-[11px] font-black text-stone-900">{telemetry.y}m</div>
              </div>
              <div className="p-1 rounded border bg-[#FAF8F5] border-stone-200">
                <div className="text-[7.5px] font-bold text-stone-500 font-sans">YAW</div>
                <div className="text-[11px] font-black text-stone-900">{telemetry.yaw}°</div>
              </div>
              <div className="p-1 rounded border bg-[#FAF8F5] border-stone-200">
                <div className="text-[7.5px] font-bold text-stone-500 font-sans">Vx</div>
                <div className="text-[10px] font-bold text-stone-800">{telemetry.linearVelocity} <span className="text-[7px]">m/s</span></div>
              </div>
              <div className="p-1 rounded border bg-[#FAF8F5] border-stone-200">
                <div className="text-[7.5px] font-bold text-stone-500 font-sans">Wz</div>
                <div className="text-[10px] font-bold text-stone-800">{telemetry.angularVelocity} <span className="text-[7px]">r/s</span></div>
              </div>
            </div>

            {/* Real-time LiDAR Obstacle Clearances - Gọn gàng */}
            <div className="p-1.5 rounded-lg border flex flex-col gap-1 bg-[#FAF8F5] border-stone-200">
              <div className="flex items-center justify-between text-[8.5px]">
                <span className="font-bold uppercase text-stone-700 flex items-center gap-1 font-sans">
                  <ShieldAlert className="w-3 h-3 text-amber-600"/> {rc("Obstacle distance (LiDAR)")} </span>
                <span className={`font-bold px-1 rounded text-[7.5px] ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-100 text-red-700 animate-pulse': 'bg-emerald-100 text-emerald-800'}`}>
                  {safetyInfo.front_cm && safetyInfo.front_cm < 35 ? rc("DANGER (<35cm)"): rc("Safe")}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-mono">
                <div className={`py-0.5 rounded border ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-50 border-red-300 text-red-700 font-bold': 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Front")} </div>
                  <div className="font-bold">{safetyInfo.front_cm !== null && safetyInfo.front_cm !== undefined ? `${safetyInfo.front_cm}cm`: '---'}</div>
                </div>
                <div className={`py-0.5 rounded border ${safetyInfo.rear_cm && safetyInfo.rear_cm < 30 ? 'bg-red-50 border-red-300 text-red-700 font-bold': 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[7px] text-stone-500 font-sans">{rc('Rear')}</div>
                  <div className="font-bold">{safetyInfo.rear_cm !== null && safetyInfo.rear_cm !== undefined ? `${safetyInfo.rear_cm}cm`: '---'}</div>
                </div>
                <div className="py-0.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Left")} </div>
                  <div className="font-bold">{safetyInfo.left_cm !== null && safetyInfo.left_cm !== undefined ? `${safetyInfo.left_cm}cm`: '---'}</div>
                </div>
                <div className="py-0.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Right")} </div>
                  <div className="font-bold">{safetyInfo.right_cm !== null && safetyInfo.right_cm !== undefined ? `${safetyInfo.right_cm}cm`: '---'}</div>
                </div>
              </div>
            </div>

            {/* Nguồn cấp Pi 5 - đọc PMIC thật qua /api/v1/system/power */}
            <div className="p-1.5 rounded-lg border flex flex-col gap-1 bg-[#FAF8F5] border-stone-200">
              <div className="flex items-center justify-between text-[8.5px]">
                <span
                  className="font-bold tracking-wider uppercase text-stone-700 flex items-center gap-1 font-sans"
                  title={rc("Measured after Pi's USB-C input. A power bank maintains 5V until cutoff, so this reading cannot determine battery percentage.")}
                >
                  <BatteryCharging className="w-3 h-3 text-stone-600"/> {rc("Pi 5 Power (PMIC)")} </span>
                <span className={`font-bold px-1 rounded text-[7.5px] ${piPowerBadge.className}`}>
                  {rc(piPowerBadge.label)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-mono">
                <div className={`py-0.5 rounded border ${piVoltageLow ? 'bg-red-50 border-red-300 text-red-700 font-bold' : 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Input voltage")} </div>
                  <div className="font-bold">{formatPowerValue(piPower?.ext5v_v, 2, 'V')}</div>
                </div>
                <div
                  className="py-0.5 rounded border bg-white border-stone-200 text-stone-800"
                  title={rc("Total PMIC rails, excluding USB devices (LiDAR, ESP32, camera).")}
                >
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Power")} </div>
                  <div className="font-bold">{formatPowerValue(piPower?.pmic_power_w, 2, 'W')}</div>
                </div>
                <div
                  className="py-0.5 rounded border bg-white border-stone-200 text-stone-800"
                  title={rc("PMIC power divided by input voltage. Actual current is higher due to USB devices.")}
                >
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("Current ≈")} </div>
                  <div className="font-bold">{formatPowerValue(piPower?.est_current_a, 2, 'A')}</div>
                </div>
                <div className="py-0.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[7px] text-stone-500 font-sans"> {rc("CPU temp")} </div>
                  <div className="font-bold">{formatPowerValue(piPower?.cpu_temp_c, 0, '°C')}</div>
                </div>
              </div>
              {/* Pin dự phòng: ước tính theo thời gian Pi đã được cấp nguồn (uptime) */}
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="text-[8.5px] font-bold text-stone-500 tracking-wider font-sans"
                  title={rc("Estimate: starting charge minus elapsed runtime divided by minutes per 1%. Use EDIT to enter the charge shown on the power bank.")}
                >
                  {rc('Battery ≈')}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-stone-200">
                  <div className={`h-full transition-all duration-300 ${piBatteryBarColor}`} style={{ width: `${piBatteryPercent ?? 0}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold text-stone-800">
                  {piBatteryPercent !== null ? `${Math.round(piBatteryPercent)}%` : '---'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsBatteryEditOpen((open) => !open)}
                  disabled={!piBattery?.available}
                  className="text-[7.5px] font-bold px-1 rounded border bg-white border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-40 font-sans"
                > {rc("EDIT")} </button>
              </div>
              {piBattery?.available && (
                <div className="text-[7.5px] leading-snug text-stone-500 font-sans"> {rc("Powered for")} {formatDuration(piBattery.session_min, rc)} {rc("· remaining ~")} {formatDuration(piBattery.remaining_min, rc)}
                  {' · '}{piBattery.minutes_per_percent} {rc("min/1%")} {piBattery.anchor_source === 'assumed' && rc(" · assumes a full battery at startup")}
                </div>
              )}
              {isBatteryEditOpen && (
                <div className="flex flex-wrap items-center gap-1 text-[8px] font-sans">
                  <span className="text-stone-500"> {rc("Power bank %")} </span>
                  <input
                    type="number" min="0" max="100" step="1"
                    value={batteryInputPercent}
                    placeholder={piBatteryPercent !== null ? String(Math.round(piBatteryPercent)) : ''}
                    onChange={(e) => setBatteryInputPercent(e.target.value)}
                    className="w-12 px-1 py-0.5 rounded border border-stone-300 bg-white font-mono text-[9px]"
                  />
                  <span className="text-stone-500"> {rc("min/1%")} </span>
                  <input
                    type="number" min="0.5" max="120" step="0.5"
                    value={batteryInputRate}
                    placeholder={String(piBattery?.minutes_per_percent ?? '')}
                    onChange={(e) => setBatteryInputRate(e.target.value)}
                    className="w-12 px-1 py-0.5 rounded border border-stone-300 bg-white font-mono text-[9px]"
                  />
                  <button
                    type="button"
                    onClick={handleSyncBattery}
                    disabled={isSyncingBattery}
                    className="px-1.5 py-0.5 rounded bg-stone-800 text-white font-bold disabled:opacity-50"
                  >
                    {isSyncingBattery ? '...' : rc("SAVE")}
                  </button>
                </div>
              )}
              {piPowerNotes.length > 0 && (
                <div className="text-[7.5px] leading-snug text-stone-500 font-sans">{piPowerNotes.join(' · ')}</div>
              )}
            </div>
          </div>

              <section className="robot-manual-card robot-card">
                <div className="robot-card-heading">
                  <h2> {rc("Manual control")} </h2>
                  <span><i className={`robot-status-dot ${activeView === 'camera' ? (activeMotion !== 'stop' ? 'is-online' : '') : (Number(telemetry.linearVelocity) !== 0 || Number(telemetry.angularVelocity) !== 0 ? 'is-online' : '')}`} />
                    {activeView === 'camera' ? (activeMotion === 'stop' ? rc("Stopped") : rc("Moving")) : (Number(telemetry.linearVelocity) !== 0 || Number(telemetry.angularVelocity) !== 0 ? rc("Moving") : rc("Stopped"))}
                  </span>
                </div>
                {activeNavGoal && <div className="robot-nav-goal">NAV GOAL · X: {activeNavGoal.x.toFixed(2)}m · Y: {activeNavGoal.y.toFixed(2)}m</div>}
                {activeView === 'camera' ? cameraControls : (
                  <RobotManualControls
                    speed={slamSpeed}
                    speedDraft={slamSpeedDraft}
                    onSpeedDraftChange={setSlamSpeedDraft}
                    onSpeedChange={handleSlamSpeedChange}
                    activeMotion={slamActiveMotion}
                    onMove={(key) => startTeleop({ w: 'forward', s: 'backward', a: 'left', d: 'right' }[key])}
                    onStop={stopTeleop}
                    stopOnLeave
                  />
                )}
            <button
              onClick={handleEmergencyStop}
              className={`w-full py-2.5 text-xs font-black rounded-lg transition-all active:scale-[0.98] cursor-pointer uppercase tracking-widest shadow-md flex items-center justify-center gap-2 border ${
                isExploring || telemetry.linearVelocity !== 0 || telemetry.angularVelocity !== 0
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse ring-2 ring-red-400'
                  : 'bg-red-600 hover:bg-red-700 text-white border-red-700'
              }`}
              title={rc("EMERGENCY STOP: stop all wheel motion, mapping and autonomous navigation immediately")}
            >
              <AlertOctagon className="w-4 h-4 text-white"/>
              <span> {rc("EMERGENCY STOP")} </span>
            </button>

              </section>
            {/* 4-Wheel Encoder Telemetry (ESP32 JGA25-370) - Thu nhỏ */}
            <details className="robot-encoders robot-card">
              <summary className="flex items-center justify-between text-[11px]">
                <span className="font-bold tracking-wider uppercase text-stone-700 font-sans"> {rc("4-wheel encoders (ESP32)")} </span>
                <span className="font-mono font-bold px-1 rounded border bg-stone-100 border-stone-300 text-stone-600 text-[7.5px]">
                  CPR 330
                </span>
              </summary>
              <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans"> {rc("M1 (Front left):")} </span>
                  <span className="font-bold text-stone-900">{encoders.m1?.rpm || 0} RPM · {encoders.m1?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans"> {rc("M3 (Front right):")} </span>
                  <span className="font-bold text-stone-900">{encoders.m3?.rpm || 0} RPM · {encoders.m3?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">{rc('M2 (Rear left):')}</span>
                  <span className="font-bold text-stone-900">{encoders.m2?.rpm || 0} RPM · {encoders.m2?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">{rc('M4 (Rear right):')}</span>
                  <span className="font-bold text-stone-900">{encoders.m4?.rpm || 0} RPM · {encoders.m4?.ticks || 0} tick</span>
                </div>
              </div>
            </details>

            </aside>
          </main>
        )}
      />
    </>
  );
}
