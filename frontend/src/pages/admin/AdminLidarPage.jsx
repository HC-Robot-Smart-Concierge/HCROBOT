import React, { useState, useEffect, useRef } from 'react';
import { LidarCanvas } from '../../components/admin/LidarCanvas';
import {
  Activity,
  BatteryCharging,
  Compass,
  Radio,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Sparkles,
  Layers,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export const AdminLidarPage = () => {
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
    status: 'WAITING_FOR_COM9_HARDWARE',
    source: 'NO_HARDWARE_CONNECTED',
  });

  const [activeNavGoal, setActiveNavGoal] = useState(null);
  const [navNotification, setNavNotification] = useState('');

  const wsRef = useRef(null);

  // Fetch dữ liệu ban đầu từ Backend API
  const fetchHardwareStatus = async () => {
    try {
      const [mapRes, lidarStatusRes] = await Promise.all([
        fetch('http://localhost:8000/api/v1/map/current'),
        fetch('http://localhost:8000/api/v1/map/lidar_status'),
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
      console.warn('Backend Server offline:', err);
    }
  };

  useEffect(() => {
    fetchHardwareStatus();
  }, []);

  // Kết nối WebSocket duy nhất nhận điểm quét thực từ cổng COM9
  useEffect(() => {
    const wsUrl = 'ws://localhost:8000/api/v1/map/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);
      console.log('✅ Đã mở kết nối WebSocket nhận dữ liệu RPLiDAR COM9');
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
          if (data.scan_points) {
            setScanPoints(data.scan_points);
          }
          if (data.grid_data) {
            setGridData(data.grid_data);
          }
          if (data.grid_metadata) {
            setGridMetadata(data.grid_metadata);
          }
        }
      } catch (err) {
        console.error('Lỗi parse WebSocket payload:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('Lỗi kết nối WebSocket LiDAR:', err);
      setIsWsConnected(false);
    };

    ws.onclose = () => {
      setIsWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Gửi lệnh mở kết nối cổng COM9
  const handleConnectHardwareLidar = async () => {
    try {
      setNavNotification('🔌 Đang kết nối tới cổng Serial COM9...');
      const res = await fetch('http://localhost:8000/api/v1/map/connect_lidar', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(`✅ ${data.message}`);
        fetchHardwareStatus();
      } else {
        setNavNotification(`⚠️ ${data.message}`);
      }
    } catch (err) {
      setNavNotification('⚠️ Không thể kết nối tới Backend Server');
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  // Reset xóa trắng bản đồ SLAM Grid
  const handleResetGridMap = async () => {
    try {
      setNavNotification('🧹 Đang xóa trắng bản đồ 2D SLAM...');
      const res = await fetch('http://localhost:8000/api/v1/map/reset_map', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification('✅ Đã xóa trắng bản đồ 2D Occupancy Grid. Tiến hành quét lại...');
        setGridData(new Array(200 * 200).fill(-1));
      }
    } catch (err) {
      console.error('Lỗi reset bản đồ:', err);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });
    setNavNotification(`Đã gửi tọa độ mục tiêu (X: ${targetX}m, Y: ${targetY}m)`);

    try {
      await fetch('http://localhost:8000/api/v1/map/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_x: targetX, target_y: targetY }),
      });
    } catch (err) {
      console.error('Gửi lệnh di chuyển thất bại:', err);
    }

    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleManualNudge = (direction) => {
    let dx = 0,
      dy = 0;
    if (direction === 'UP') dy = 0.5;
    if (direction === 'DOWN') dy = -0.5;
    if (direction === 'LEFT') dx = -0.5;
    if (direction === 'RIGHT') dx = 0.5;

    const newX = Number((telemetry.x + dx).toFixed(2));
    const newY = Number((telemetry.y + dy).toFixed(2));

    handleSetGoal(newX, newY);
  };

  const handleEmergencyStop = () => {
    setNavNotification('⚠️ DỪNG KHẨN CẤP! Đã ngắt chuyển động.');
    setTelemetry((prev) => ({ ...prev, status: 'EMERGENCY_STOPPED', linearVelocity: 0, angularVelocity: 0 }));
    setTimeout(() => setNavNotification(''), 5000);
  };

  const isRealHardwareActive = telemetry.source === 'REAL_RPLIDAR_HARDWARE';

  return (
    <div className="w-full h-screen bg-[#FCFAF7] text-[#1A1917] flex flex-col overflow-hidden font-sans select-none">
      {/* Hardware Status Banner */}
      <div className="w-full bg-[#FAF8F5] border-b border-[#E5E1D8] px-6 py-2 flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-3">
          {isRealHardwareActive ? (
            <div className="flex items-center gap-2 text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>RPLIDAR HARDWARE ONLINE • COM9 (MODEL {hardwareInfo?.device_info?.model || '24'})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-stone-700 font-bold bg-white border border-[#DDD8CE] px-3 py-0.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-stone-500" />
              <span>CHƯA KẾT NỐI CẢM BIẾN THỰC THẾ TRÊN COM9</span>
            </div>
          )}

          <span className="text-stone-500 font-mono">
            RAW POINTS: <strong className="text-stone-900">{scanPoints.length} PTS</strong>
          </span>
        </div>

        <span className="text-stone-500 text-[11px] font-mono">
          BAUDRATE: 115200 | PORT: COM9
        </span>
      </div>

      {/* Nav Notification Alert */}
      {navNotification && (
        <div className="w-full bg-white border-b border-[#E5E1D8] text-stone-900 text-xs px-6 py-2 flex items-center gap-2 font-bold animate-fadeIn">
          <Sparkles className="w-4 h-4 text-stone-700" />
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
              waypoints={[]}
              onCanvasClickGoal={handleSetGoal}
              showGridMap={showGridMap}
              showGridLines={showGridLines}
              showScanRays={showScanRays}
              showWaypoints={false}
            />

            {/* Waiting for Hardware Overlay when empty */}
            {scanPoints.length === 0 && (
              <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center p-6 border border-[#E5E1D8] rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#DDD8CE] flex items-center justify-center">
                  <Cpu className="w-7 h-7 text-stone-700 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1A1917] mb-1">
                    ĐANG CHỜ DỮ LIỆU ĐIỂM QUÉT THỰC TỪ RPLIDAR (COM9)
                  </h3>
                  <p className="text-xs text-stone-600 max-w-md leading-relaxed font-medium">
                    Đang kết nối phần cứng cảm biến RPLiDAR trên cổng Serial COM9. Vui lòng bấm nút KÍCH HOẠT KẾT NỐI CỔNG COM9 để thử lại.
                  </p>
                </div>
                <button
                  onClick={handleConnectHardwareLidar}
                  className="px-5 py-2.5 bg-[#18181B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>KÍCH HOẠT KẾT NỐI CỔNG COM9</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Layers Control Bar */}
          <div className="w-full h-11 bg-white border border-[#E5E1D8] rounded-xl px-4 flex items-center justify-between text-xs shrink-0 shadow-sm">
            <div className="flex items-center gap-4 text-stone-700 font-medium">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-stone-600" />
                <span>RADAR LAYERS:</span>
              </span>
              <label className="flex items-center gap-2 cursor-pointer hover:text-stone-900">
                <input
                  type="checkbox"
                  checked={showGridMap}
                  onChange={(e) => setShowGridMap(e.target.checked)}
                  className="rounded border-[#DDD8CE] text-stone-900 focus:ring-0"
                />
                <span>SLAM 2D Floor Map</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-stone-900">
                <input
                  type="checkbox"
                  checked={showGridLines}
                  onChange={(e) => setShowGridLines(e.target.checked)}
                  className="rounded border-[#DDD8CE] text-stone-900 focus:ring-0"
                />
                <span>Radar Rings (1m-5m)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-stone-900">
                <input
                  type="checkbox"
                  checked={showScanRays}
                  onChange={(e) => setShowScanRays(e.target.checked)}
                  className="rounded border-[#DDD8CE] text-stone-900 focus:ring-0"
                />
                <span>Point Cloud Rays ({scanPoints.length})</span>
              </label>
            </div>

            <div className="text-[11px] font-mono text-stone-500 font-bold">
              REAL-TIME SLAM MAPPING
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & Controls (4 Cols) */}
        <div className="col-span-4 flex flex-col gap-4 h-full overflow-y-auto pr-1">
          {/* Card 1: Telemetry Metrics */}
          <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#F0ECE6] pb-3">
              <span className="text-xs font-bold tracking-wider text-stone-500 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-stone-900" />
                <span>TELEMETRY METRICS</span>
              </span>
              <span className="px-2.5 py-0.5 bg-[#EFECE6] text-stone-800 font-bold text-[10px] rounded-full border border-[#DDD8CE]">
                {telemetry.source}
              </span>
            </div>

            {/* Position Display Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E5E1D8] text-center">
                <span className="text-[10px] text-stone-500 font-bold block mb-1">X POSITION</span>
                <span className="text-lg font-mono font-bold text-stone-900">{telemetry.x}m</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E5E1D8] text-center">
                <span className="text-[10px] text-stone-500 font-bold block mb-1">Y POSITION</span>
                <span className="text-lg font-mono font-bold text-stone-900">{telemetry.y}m</span>
              </div>
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E5E1D8] text-center">
                <span className="text-[10px] text-stone-500 font-bold block mb-1">YAW ANGLE</span>
                <span className="text-lg font-mono font-bold text-stone-800">{telemetry.yaw}°</span>
              </div>
            </div>

            {/* Battery & Scan Info */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-stone-600 flex items-center gap-1">
                    <BatteryCharging className="w-3.5 h-3.5 text-stone-800" /> MỨC PIN
                  </span>
                  <span className="font-mono text-stone-900 font-bold">{telemetry.battery}%</span>
                </div>
                <div className="w-full h-2 bg-[#FAF8F5] rounded-full overflow-hidden border border-[#DDD8CE]">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${telemetry.battery}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#E5E1D8] text-xs flex justify-between items-center">
                <span className="text-stone-500 font-bold">SERIAL NUMBER:</span>
                <span className="font-mono text-stone-900 text-[11px] font-bold">
                  {hardwareInfo?.device_info?.serialnumber || 'CP210x_COM9'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Manual Teleop Directions */}
          <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <span className="text-xs font-bold tracking-wider text-stone-500 uppercase border-b border-[#F0ECE6] pb-2 flex items-center gap-2">
              <Compass className="w-4 h-4 text-stone-900" />
              <span>MANUAL NUDGE TELEOP</span>
            </span>

            <div className="flex flex-col items-center gap-2 py-2">
              <button
                onClick={() => handleManualNudge('UP')}
                className="w-12 h-12 bg-[#FAF8F5] hover:bg-[#18181B] hover:text-white border border-[#DDD8CE] rounded-xl flex items-center justify-center text-stone-900 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <ArrowUp className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleManualNudge('LEFT')}
                  className="w-12 h-12 bg-[#FAF8F5] hover:bg-[#18181B] hover:text-white border border-[#DDD8CE] rounded-xl flex items-center justify-center text-stone-900 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleEmergencyStop}
                  className="w-12 h-12 bg-[#18181B] hover:bg-black border border-black rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <Square className="w-5 h-5 fill-current text-white" />
                </button>
                <button
                  onClick={() => handleManualNudge('RIGHT')}
                  className="w-12 h-12 bg-[#FAF8F5] hover:bg-[#18181B] hover:text-white border border-[#DDD8CE] rounded-xl flex items-center justify-center text-stone-900 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => handleManualNudge('DOWN')}
                className="w-12 h-12 bg-[#FAF8F5] hover:bg-[#18181B] hover:text-white border border-[#DDD8CE] rounded-xl flex items-center justify-center text-stone-900 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
