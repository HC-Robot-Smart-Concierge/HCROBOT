import React from 'react';
import {
  Activity,
  Cpu,
  Wifi,
  WifiOff,
  RefreshCw,
  Navigation,
  Layers,
  RotateCcw,
  ShieldCheck,
  Battery,
  X,
  Crosshair,
  Home,
  ShieldBan,
} from 'lucide-react';
import { LAYOUT2_CONFIG, ZONE_TEMPLATES } from './physicalMapConstants';

export function PhysicalMapPopupOverviewSections({
  closePopup, connectionMode, dockEndpoint, handleRelocalize, handleSelectMap, handleSetPoseAtDock, handleStartNav2, hardwareInfo, isLegacyMap, isLocalized, isNavigating, isPoseSetMode, isSettingPose, isStartingNav2, isWsConnected, localizationReady, managerLoc, mapConfig, mapLayouts, nav2Runtime, navStatus, navigationMapReady, panel, pi5Ip, robotPose, setConnectionMode, setIsAddEndpointMode, setIsPoseSetMode, setPoseDraft, setSelectedEndpoint, setSelectedZone, setTrail, setZoneDraft, setZoneDrawType, startPointPlacement, t, toggleZoneDraw, trail,
}) {
  return (
    <>
          {panel.section === 'ADD' && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-400">Chọn loại cần thêm, sau đó đặt trực tiếp trên bản đồ.</p>
              <div className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Điểm mốc / Point</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'CHARGER', label: 'Trạm sạc', Icon: Battery },
                    { type: 'PARK', label: 'Điểm đỗ', Icon: Home },
                  ].map(({ type, label, Icon }) => (
                    <button key={type} type="button" onClick={() => startPointPlacement(type)} className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-3 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-500 hover:bg-blue-950/60">
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">Click trên map để đặt điểm. Nhấn Esc để hủy.</p>
              </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vùng / Zone</h3>
                {ZONE_TEMPLATES.map((template) => (
                  <button key={template.type} type="button" onClick={() => toggleZoneDraw(template.type)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-left transition-colors hover:border-slate-500 hover:bg-slate-800">
                    <ShieldBan className="h-5 w-5 shrink-0" style={{ color: template.color }} />
                    <span>
                      <span className="block text-xs font-bold" style={{ color: template.color }}>{template.badge}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">{template.description}</span>
                    </span>
                  </button>
                ))}
                <p className="text-[11px] text-slate-500">Nhấn giữ và kéo trên map để vẽ vùng. Nhấn Esc để hủy.</p>
              </div>
            </div>
          )}
          {popupAction && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-400">{popupAction.description}</p>
              <button
                type="button"
                role="switch"
                aria-checked={popupAction.active}
                aria-label={popupAction.title}
                onClick={popupAction.onClick}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs font-semibold hover:border-cyan-700"
              >
                <span>{popupAction.key === 'heading' ? popupAction.label : 'Hiển thị trên bản đồ'}</span>
                <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${popupAction.active ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${popupAction.active ? 'translate-x-[18px] left-0' : 'left-0.5'}`} />
                </span>
              </button>
            </div>
          )}
          {panel.section === 'trail' && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-400">Xóa đường vệt đã di chuyển đang hiển thị trên bản đồ.</p>
              <button type="button" onClick={() => { setTrail([]); closePopup(); }} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-600">
                <RotateCcw className="h-4 w-4" />
                Xóa vệt di chuyển
              </button>
            </div>
          )}
          {/* Card 1: Telemetry Realtime & Hardware */}
          {panel.section === 'telemetry' && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 scroll-mt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Dữ Liệu Telemetry Thực Tế
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  isNavigating ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isNavigating ? 'Đang Di Chuyển' : navigationMapReady && isLocalized ? 'Đã Định Vị' : 'Chưa Sẵn Sàng Đi'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">TỌA ĐỘ X</span>
                <span className="text-cyan-400 font-bold text-sm">{robotPose.x.toFixed(2)}m</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">TỌA ĐỘ Y</span>
                <span className="text-cyan-400 font-bold text-sm">{robotPose.y.toFixed(2)}m</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">GÓC YAW</span>
                <span className="text-amber-400 font-bold text-sm">
                  {((robotPose.yaw * 180) / Math.PI).toFixed(0)}°
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <Cpu className="w-3 h-3 text-cyan-400" />
                {hardwareInfo.model}
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <Battery className="w-3 h-3" />
                {hardwareInfo.battery}%
              </span>
            </div>
          </div>

          )}

          {/* Card Nav2 (che do ROS 2): bat map_server + AMCL + Nav2 voi map dang chon */}
          {panel.section === 'nav2' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 scroll-mt-3">
              <label
          className="flex items-center w-full bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs"
          title={`${mapConfig.widthMeters}m × ${mapConfig.heightMeters}m • ${mapConfig.resolution}m/ô • gốc (${mapConfig.originX}, ${mapConfig.originY})`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-400 mr-1.5">Bản đồ:</span>
          <select
            value={mapConfig.mapId}
            onChange={(e) => handleSelectMap(e.target.value)}
            disabled={mapLayouts.length === 0}
            className="bg-slate-900 text-[11px] font-semibold text-slate-200 outline-none cursor-pointer disabled:cursor-not-allowed flex-1 min-w-0"
          >
            {mapLayouts.length === 0 && (
              <option value={mapConfig.mapId}>{mapConfig.mapId}{isLegacyMap ? ' (gốc Lab)' : ''}</option>
            )}
            {mapLayouts.map((m) => (
              <option key={m.map_id} value={m.map_id}>
                {m.name}
                {m.map_id === LAYOUT2_CONFIG.mapId ? ' (gốc Lab)' : ''} • {m.width_m}×{m.height_m}m
              </option>
            ))}
          </select>
        </label>
              <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Target */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setConnectionMode('pi5')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                connectionMode === 'pi5'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>Xe Thật Pi 5</span>
            </button>
            <button
              onClick={() => setConnectionMode('ros2')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                connectionMode === 'ros2'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>ROS 2</span>
            </button>
          </div>

          {/* Connection status badge */}
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
              isWsConnected
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                : 'bg-rose-950/80 text-rose-400 border-rose-800/80'
            }`}
          >
            {isWsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>
              {isWsConnected
                ? connectionMode === 'pi5'
                  ? `Pi 5 (${pi5Ip})`
                  : 'ROS 2 Live'
                : 'Mất kết nối'}
            </span>
          </div>
        </div>
              <div className="h-px bg-slate-800 my-3" />
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-orange-400" />
                  {connectionMode === 'pi5' ? 'Xe thật • Nav2 + tránh vật cản' : 'Nav2'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    nav2Runtime.mode === 'NAVIGATION'
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {nav2Runtime.mode}
                  {nav2Runtime.activeMap ? ` • ${nav2Runtime.activeMap}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartNav2}
                disabled={isStartingNav2}
                className="w-full px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border bg-orange-600/90 text-white border-orange-500 hover:bg-orange-500 disabled:opacity-60"
                title="Nạp map đang chọn vào map_server, bật AMCL + Nav2 và vùng cấm (KEEP_OUT)"
              >
                {isStartingNav2 ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                {nav2Runtime.mode === 'NAVIGATION' && nav2Runtime.activeMap === mapConfig.mapId
                  ? 'Khởi động lại Nav2'
                  : `Bật Nav2 với map "${mapConfig.mapId}"`}
              </button>
              <p className="text-[10px] leading-snug text-slate-500">
                1. Bật Navigation → 2. Chọn đúng chỗ xe đang đứng và kéo theo hướng mũi xe → 3. Đợi AMCL xác nhận rồi bấm Tới.
              </p>
              <p role="status" aria-live="polite" className="text-[11px] leading-relaxed text-cyan-200 bg-slate-900 rounded px-2 py-1.5 break-words">
                {navStatus}
              </p>
            </div>
          )}

          {/* Card 2: Dat vi tri ban dau (Initial Pose / 2D Pose Estimate) */}
          {panel.section === 'pose' && (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 scroll-mt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                2. Vị Trí Ban Đầu Robot
              </span>
              {isSettingPose && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPoseSetMode((prev) => !prev);
                  setPoseDraft(null);
                  setSelectedEndpoint(null);
                  setSelectedZone(null);
                  setIsAddEndpointMode(false);
                  setZoneDrawType(null);
                  setZoneDraft(null);
                  closePopup();
                }}
                disabled={isSettingPose || !navigationMapReady}
                className={`px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border ${
                  isPoseSetMode
                    ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
                title="Click vào vị trí robot trên bản đồ, giữ chuột kéo theo hướng mũi xe rồi thả"
              >
                <Crosshair className="w-3 h-3" />
                {isPoseSetMode ? 'Hủy chọn' : 'Chọn trên map'}
              </button>
              <button
                type="button"
                onClick={handleSetPoseAtDock}
                disabled={isSettingPose || !navigationMapReady || !dockEndpoint}
                className="px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                title="Robot đang đứng tại Trạm Sạc (Home), mũi xe theo hướng yaw của điểm dock"
              >
                <Home className="w-3 h-3" />
                Đặt tại Dock
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-1.5 text-[11px] ${
                  isLocalized
                    ? 'text-emerald-400'
                    : managerLoc.tone === 'busy'
                    ? 'text-amber-400'
                    : managerLoc.tone === 'bad'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
                title={managerLoc.fresh ? managerLoc.reason : undefined}
              >
                <ShieldCheck className="w-3 h-3" />
                {managerLoc.fresh
                  ? managerLoc.label
                  : localizationReady
                  ? 'AMCL đã định vị bằng LiDAR'
                  : 'Chưa xác nhận vị trí trên map'}
              </span>
              <button
                type="button"
                onClick={handleRelocalize}
                disabled={isSettingPose || !navigationMapReady}
                className="px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border bg-slate-900 text-cyan-300 border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Khớp lại tia LiDAR với bản đồ quanh vị trí hiện tại để sửa trôi odometry"
              >
                <RefreshCw className="w-3 h-3" />
                Định vị lại
              </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              {!navigationMapReady
                ? 'Hiện chưa có Navigation đúng map. Bật Nav2 ở bước 1 trước; chế độ MAPPING chỉ dùng để quét.'
                : !dockEndpoint
                  ? 'Map chưa có Dock. Gốc (0,0) không phải vị trí mặc định của xe; hãy dùng Chọn trên map.'
                  : 'Chỉ dùng Đặt tại Dock khi xe thật đang đứng đúng điểm Dock đã lưu.'}
            </p>
            {isPoseSetMode && (
              <p className="text-[10px] text-emerald-300/90 leading-snug">
                Click vào chỗ robot đang đứng, giữ chuột và kéo theo hướng mũi xe, rồi thả chuột.
              </p>
            )}
          </div>

          )}
    </>
  );
}
