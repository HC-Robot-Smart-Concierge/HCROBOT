import React, { useState, useEffect, useRef } from 'react';
import { LidarCanvas } from '../../components/admin/LidarCanvas';
import {
  fetchWaypoints,
  saveWaypoint,
  deleteWaypoint,
} from '../../services/workflowApi';
import {
  Activity,
  BatteryCharging,
  Radio,
  ShieldAlert,
  Square,
  Sparkles,
  Layers,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Video,
  MapPin,
  Plus,
} from 'lucide-react';

// Pi5 connection endpoints (mirrors AdminCameraTab pattern)
const PI5_IP = import.meta.env.VITE_PI5_IP || '100.73.245.66';
const PI5_API  = `http://${PI5_IP}:8000/api/v1`;
const PI5_WS   = `ws://${PI5_IP}:8000/api/v1`;

export const AdminLidarPage = ({ onSwitchToCamera }) => {
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Layer Toggles
  const [showGridMap, setShowGridMap] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showScanRays, setShowScanRays] = useState(true);

  // Telemetry & Scan Data
  const [mapData, setMapData] = useState(null);
  const [scanPoints, setScanPoints] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [gridMetadata, setGridMetadata] = useState({ width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 });

  const [telemetry, setTelemetry] = useState({
    x: 0.0,
    y: 0.0,
    yaw: 0.0,
    battery: 98,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
    status: 'WAITING_FOR_PI5_CONNECTION',
    source: 'NO_HARDWARE_CONNECTED',
  });

  const [activeNavGoal, setActiveNavGoal] = useState(null);
  const [navNotification, setNavNotification] = useState('');

  // Waypoints mapping state
  const [waypoints, setWaypoints] = useState([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [isAddWpModalOpen, setIsAddWpModalOpen] = useState(false);
  const [newWpData, setNewWpData] = useState({ name: '', floor: 'Tầng 1', x: 0, y: 0, type: 'service' });

  const wsRef = useRef(null);

  const loadWaypoints = async () => {
    try {
      const data = await fetchWaypoints();
      setWaypoints(data || []);
    } catch (err) {
      console.warn('Lỗi khi tải waypoints:', err);
    }
  };

  useEffect(() => {
    loadWaypoints();
  }, []);

  const handleCanvasClickPin = (x, y) => {
    setNewWpData({
      name: '',
      floor: 'Tầng 1',
      x,
      y,
      type: 'service',
    });
    setIsPinMode(false);
    setIsAddWpModalOpen(true);
  };

  const handleSaveNewWaypoint = async (e) => {
    e.preventDefault();
    if (!newWpData.name.trim()) return;
    try {
      const id = `wp-${Date.now().toString(36)}`;
      await saveWaypoint({
        id,
        name: newWpData.name.trim(),
        floor: newWpData.floor,
        x: newWpData.x,
        y: newWpData.y,
        yaw: 0,
        type: newWpData.type,
      });
      setIsAddWpModalOpen(false);
      setNavNotification(`Đã ghim điểm mốc "${newWpData.name}" thành công!`);
      await loadWaypoints();
    } catch (err) {
      setNavNotification(`Lỗi khi lưu điểm mốc: ${err.message}`);
    }
  };

  const handleDeleteWp = async (id, name) => {
    if (!window.confirm(`Xác nhận xóa điểm mốc "${name}"?`)) return;
    try {
      await deleteWaypoint(id);
      setNavNotification(`Đã xóa điểm mốc "${name}"`);
      await loadWaypoints();
    } catch (err) {
      setNavNotification(`Lỗi khi xóa: ${err.message}`);
    }
  };

  // Fetch initial status from Pi5 backend
  const fetchHardwareStatus = async () => {
    try {
      const [mapRes, lidarStatusRes] = await Promise.all([
        fetch(`${PI5_API}/map/current`),
        fetch(`${PI5_API}/map/lidar_status`),
      ]);

      if (mapRes.ok) {
        const mData = await mapRes.json();
        setMapData(mData);
        if (mData.grid_data) setGridData(mData.grid_data);
      }
      if (lidarStatusRes.ok) {
        const lStatus = await lidarStatusRes.json();
        setHardwareInfo(lStatus);
      }
    } catch (err) {
      console.warn('Pi5 backend offline:', err);
    }
  };

  useEffect(() => {
    fetchHardwareStatus();
  }, []);

  // WebSocket to Pi5 backend — mirrors camera connection pattern
  useEffect(() => {
    const ws = new WebSocket(`${PI5_WS}/map/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry_update') {
          if (data.device_info) {
            setHardwareInfo((prev) => ({
              ...prev,
              is_connected: true,
              device_info: data.device_info,
            }));
          }
          if (data.robot_pose) {
            setTelemetry((prev) => ({
              ...prev,
              x: data.robot_pose.x,
              y: data.robot_pose.y,
              yaw: data.robot_pose.yaw,
              battery: data.battery ?? prev.battery,
              linearVelocity: data.linear_velocity ?? prev.linearVelocity,
              angularVelocity: data.angular_velocity ?? prev.angularVelocity,
              status: data.status ?? prev.status,
              source: data.source ?? prev.source,
            }));
          }
          if (data.scan_points) setScanPoints(data.scan_points);
          if (data.grid_data) setGridData(data.grid_data);
          if (data.grid_metadata) setGridMetadata(data.grid_metadata);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onerror = () => setIsWsConnected(false);
    ws.onclose = () => setIsWsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Reconnect to Pi5 backend (useful if Pi5 reboots)
  const handleReconnectPi5 = async () => {
    setNavNotification('Reconnecting to Pi5 backend...');
    try {
      const res = await fetch(`${PI5_API}/map/connect_lidar`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(data.message);
        fetchHardwareStatus();
      } else {
        setNavNotification(`[FAILED] ${data.message}`);
      }
    } catch {
      setNavNotification('[ERROR] Cannot reach Pi5 — check SSH tunnel or IP');
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  // Reset SLAM grid map
  const handleResetGridMap = async () => {
    try {
      setNavNotification('Clearing SLAM map...');
      const res = await fetch(`${PI5_API}/map/reset_map`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification('SLAM map cleared. Ready for new scan.');
        setGridData(new Array(200 * 200).fill(-1));
      }
    } catch (err) {
      console.error('Reset map error:', err);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });
    setNavNotification(`NAV GOAL SET — X: ${targetX.toFixed(2)}m, Y: ${targetY.toFixed(2)}m`);

    try {
      await fetch(`${PI5_API}/map/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_x: targetX, target_y: targetY }),
      });
    } catch (err) {
      console.error('Navigate command failed:', err);
    }

    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleEmergencyStop = async () => {
    setActiveNavGoal(null);
    setNavNotification('[E-STOP] Đã gửi tín hiệu ngắt toàn bộ chuyển động robot.');
    setTelemetry((prev) => ({
      ...prev,
      status: 'EMERGENCY_STOPPED',
      linearVelocity: 0,
      angularVelocity: 0,
    }));

    try {
      await fetch('/api/v1/operations/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'stop',
          target_ip: '100.73.245.66',
          port: 9999,
        }),
      });
    } catch (err) {
      console.warn('Lỗi gửi lệnh dừng khẩn cấp tới động cơ:', err);
    }

    setTimeout(() => setNavNotification(''), 5000);
  };

  const isRealHardwareActive = telemetry.source === 'REAL_RPLIDAR_HARDWARE';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden font-sans select-none" style={{ background: '#F2EFE9', color: '#262626' }}>
      {/* Status Banner — Pi5 connection */}
      <div className="w-full border-b px-6 py-2 flex items-center justify-between text-xs font-mono"
        style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}>
        <div className="flex items-center gap-4">
          <span className="font-bold px-2 py-0.5 rounded border text-[10px]"
            style={isWsConnected
              ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
              : { background: '#F2EFE9', color: '#8C8C8C', borderColor: '#BFBFBD' }}>
            {isWsConnected ? `PI5 CONNECTED — ${PI5_IP}` : `PI5 OFFLINE — ${PI5_IP}`}
          </span>
          <span style={{ color: '#8C8C8C' }}>RAW: <strong style={{ color: '#262626' }}>{scanPoints.length} PTS</strong></span>
        </div>
        <span className="text-[11px]" style={{ color: '#8C8C8C' }}>WS: {PI5_IP}:8000</span>
      </div>

      {/* Nav Notification Alert */}
      {navNotification && (
        <div className="w-full border-b px-6 py-2 flex items-center gap-2 text-xs font-bold font-mono"
          style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}>
          <Radio className="w-3 h-3 shrink-0" style={{ color: '#8C8C8C' }} />
          <span>{navNotification}</span>
        </div>
      )}

      {/* 2. Main Workspace */}
      <main className="w-full flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column: 2D SLAM Canvas (8 Cols) */}
        <div className="col-span-8 flex flex-col gap-3 h-full overflow-hidden">
          <div className="w-full flex-1 relative overflow-hidden">
            <LidarCanvas
              scanPoints={scanPoints}
              gridData={gridData}
              gridMetadata={gridMetadata}
              robotPose={{ x: telemetry.x, y: telemetry.y, yaw: telemetry.yaw }}
              waypoints={waypoints}
              onCanvasClickGoal={handleSetGoal}
              onCanvasClickWaypointPin={handleCanvasClickPin}
              isPinMode={isPinMode}
              showGridMap={showGridMap}
              showGridLines={showGridLines}
              showScanRays={showScanRays}
              showWaypoints={true}
            />

            {/* Waiting for Pi5 data overlay */}
            {scanPoints.length === 0 && (
              <div className="absolute inset-0 z-10 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6 rounded-2xl"
                style={{ background: 'rgba(242,239,233,0.97)', border: '1px solid #BFBFBD' }}>
                <Cpu className="w-8 h-8 animate-pulse" style={{ color: '#8C8C8C' }} />
                <div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: '#262626' }}>
                    NO DATA FROM PI5 — {PI5_IP}
                  </h3>
                  <p className="text-xs max-w-md leading-relaxed" style={{ color: '#8C8C8C' }}>
                    WebSocket waiting for SLAM data from Pi5. Make sure the Pi5 backend is running and reachable via Tailscale.
                  </p>
                </div>
                <button
                  onClick={handleReconnectPi5}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  style={{ background: '#262626', color: '#FFFFFF' }}
                >
                  RECONNECT TO PI5
                </button>
              </div>
            )}
          </div>

          {/* Layers Control Bar */}
          <div className="w-full h-10 border rounded-lg px-4 flex items-center justify-between text-xs shrink-0"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}>
            <div className="flex items-center gap-4 font-medium" style={{ color: '#8C8C8C' }}>
              <span className="font-bold text-[10px] tracking-wider" style={{ color: '#262626' }}>LAYERS:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showGridMap} onChange={(e) => setShowGridMap(e.target.checked)} className="focus:ring-0" />
                <span>SLAM Map</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showGridLines} onChange={(e) => setShowGridLines(e.target.checked)} className="focus:ring-0" />
                <span>Radar Rings</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showScanRays} onChange={(e) => setShowScanRays(e.target.checked)} className="focus:ring-0" />
                <span>Point Cloud ({scanPoints.length})</span>
              </label>
            </div>
            <span className="text-[10px] font-mono font-bold" style={{ color: '#8C8C8C' }}>REAL-TIME SLAM</span>
          </div>
        </div>

        {/* Right Column: Telemetry, Waypoints & Controls (4 Cols) */}
        <div className="col-span-4 flex flex-col gap-3 h-full overflow-y-auto pr-1">
          {/* Card 1: Waypoints Mapping (Otto Motors Concepts) */}
          <div className="border rounded-xl p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" style={{ color: '#262626' }} />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#262626' }}>
                  ĐIỂM MỐC LI-DAR ({waypoints.length})
                </span>
              </div>
              <button
                onClick={() => setIsPinMode(!isPinMode)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1"
                style={{
                  background: isPinMode ? '#262626' : '#F2EFE9',
                  color: isPinMode ? '#F2EFE9' : '#262626',
                  borderColor: isPinMode ? '#262626' : '#BFBFBD',
                }}
              >
                <Plus className="w-3 h-3" />
                <span>{isPinMode ? 'Đang chờ click...' : '+ Ghim điểm'}</span>
              </button>
            </div>

            {/* Waypoints List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {waypoints.length === 0 ? (
                <div className="text-center py-4 text-[11px]" style={{ color: '#8C8C8C' }}>
                  Chưa có điểm mốc nào. Nhấn "+ Ghim điểm" và click lên bản đồ.
                </div>
              ) : (
                waypoints.map((wp) => (
                  <div
                    key={wp.id}
                    className="p-2 rounded-lg border flex items-center justify-between text-xs transition-colors hover:bg-[#F2EFE9]/40"
                    style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
                  >
                    <div>
                      <div className="font-bold text-xs" style={{ color: '#262626' }}>{wp.name}</div>
                      <div className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                        {wp.floor} • X: {Number(wp.x).toFixed(1)}m, Y: {Number(wp.y).toFixed(1)}m
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSetGoal(wp.x, wp.y)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                        style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                        title="Điều hướng Robot tới điểm này"
                      >
                        Đến
                      </button>
                      <button
                        onClick={() => handleDeleteWp(wp.id, wp.name)}
                        className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer hover:text-red-600 hover:border-red-300"
                        style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                        title="Xóa điểm mốc"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: Telemetry */}
          <div className="border rounded-xl p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#8C8C8C' }}>TELEMETRY</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                style={{ background: '#F2EFE9', color: '#8C8C8C', borderColor: '#BFBFBD' }}>
                {telemetry.source}
              </span>
            </div>

            {/* Position Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[['X', telemetry.x, 'm'], ['Y', telemetry.y, 'm'], ['YAW', telemetry.yaw, '°']].map(([label, val, unit]) => (
                <div key={label} className="p-2.5 rounded-lg border text-center" style={{ background: '#F2EFE9', borderColor: '#BFBFBD' }}>
                  <div className="text-[9px] font-bold tracking-wider mb-1" style={{ color: '#8C8C8C' }}>{label}</div>
                  <div className="text-base font-mono font-black" style={{ color: '#262626' }}>{val}{unit}</div>
                </div>
              ))}
            </div>

            {/* Battery */}
            <div>
              <div className="flex justify-between text-[10px] font-semibold mb-1">
                <span style={{ color: '#8C8C8C' }}>BATTERY</span>
                <span className="font-mono font-bold" style={{ color: '#262626' }}>{telemetry.battery}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E9E5DC' }}>
                <div className="h-full transition-all duration-300" style={{ width: `${telemetry.battery}%`, background: '#262626' }} />
              </div>
            </div>
          </div>

          {/* Card 3: Emergency & Teleop */}
          <div className="border rounded-xl p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#8C8C8C' }}>EMERGENCY & TELEOP</span>
              {activeNavGoal && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border animate-pulse"
                  style={{ background: '#262626', color: '#FFFFFF', borderColor: '#262626' }}>NAVIGATING</span>
              )}
            </div>

            {activeNavGoal ? (
              <div className="p-3 rounded-lg border text-xs" style={{ background: '#F2EFE9', borderColor: '#BFBFBD' }}>
                <div className="text-[9px] font-bold tracking-wider mb-1" style={{ color: '#8C8C8C' }}>NAV GOAL ACTIVE</div>
                <div className="font-mono font-bold" style={{ color: '#262626' }}>
                  X: {activeNavGoal.x.toFixed(2)}m — Y: {activeNavGoal.y.toFixed(2)}m
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border text-xs font-mono" style={{ background: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}>
                Click on the SLAM map to set a navigation goal.
              </div>
            )}

            <button
              onClick={handleEmergencyStop}
              className="w-full py-2.5 text-xs font-bold rounded-lg transition-all active:scale-[0.98] cursor-pointer uppercase tracking-widest"
              style={{ background: '#262626', color: '#FFFFFF' }}
            >
              E-STOP
            </button>

            <div className="pt-2 border-t flex flex-col gap-2" style={{ borderColor: '#BFBFBD' }}>
              <button
                onClick={() => onSwitchToCamera && onSwitchToCamera()}
                className="w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer"
                style={{ background: '#F2EFE9', color: '#262626', borderColor: '#BFBFBD' }}
              >
                SWITCH TO LIVE CAMERA FPV
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Thêm Waypoint Mới Khi Click Trên Bản Đồ */}
      {isAddWpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                Ghim Điểm Mốc LiDAR (Waypoint)
              </h3>
              <button
                type="button"
                onClick={() => setIsAddWpModalOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveNewWaypoint} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN ĐIỂM MỐC *
                </label>
                <input
                  type="text"
                  required
                  value={newWpData.name}
                  onChange={(e) => setNewWpData({ ...newWpData, name: e.target.value })}
                  placeholder="VD: Quầy Lễ Tân, Thang Máy A, Trạm Sạc..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    TẦNG
                  </label>
                  <select
                    value={newWpData.floor}
                    onChange={(e) => setNewWpData({ ...newWpData, floor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    <option value="Tầng 1">Tầng 1</option>
                    <option value="Tầng 2">Tầng 2</option>
                    <option value="Tầng 3">Tầng 3</option>
                    <option value="Tầng 4">Tầng 4</option>
                    <option value="Sảnh Chính">Sảnh Chính</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    LOẠI ĐIỂM
                  </label>
                  <select
                    value={newWpData.type}
                    onChange={(e) => setNewWpData({ ...newWpData, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    <option value="service">Dịch vụ / Tiện ích</option>
                    <option value="dock">Trạm sạc / Dock</option>
                    <option value="room">Phòng nghỉ</option>
                    <option value="elevator">Thang máy</option>
                    <option value="standby">Điểm chờ</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg border text-xs font-mono" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}>
                <span className="text-[10px] font-bold block mb-1" style={{ color: '#8C8C8C' }}>TỌA ĐỘ ĐÃ CHỌN:</span>
                <span className="font-bold" style={{ color: '#262626' }}>X = {Number(newWpData.x).toFixed(2)} m</span>, {' '}
                <span className="font-bold" style={{ color: '#262626' }}>Y = {Number(newWpData.y).toFixed(2)} m</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  onClick={() => setIsAddWpModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  Lưu Điểm Mốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
