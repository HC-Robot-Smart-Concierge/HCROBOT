import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LidarCanvas } from '../../components/admin/LidarCanvas';
import {
  fetchWaypoints,
  saveWaypoint,
  deleteWaypoint,
} from '../../services/workflowApi';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  parseOccupancyGrid,
  parseLaserScan,
  quaternionToYaw,
} from '../../services/rosbridgeService';
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
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Server,
  Compass,
} from 'lucide-react';

// Pi5 connection endpoints (mirrors AdminCameraTab pattern)
const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;
const PI5_WS = `ws://${PI5_IP}:8000/api/v1`;
const ROSBRIDGE_DEFAULT_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';

export const AdminLidarPage = ({ onSwitchToCamera }) => {
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState('ros2'); // 'ros2' | 'pi5'
  const [rosbridgeUrl, setRosbridgeUrl] = useState(ROSBRIDGE_DEFAULT_URL);

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

  const [encoders, setEncoders] = useState({
    m1: { ticks: 0, rpm: 0.0, dir: 0 },
    m2: { ticks: 0, rpm: 0.0, dir: 0 },
    m3: { ticks: 0, rpm: 0.0, dir: 0 },
    m4: { ticks: 0, rpm: 0.0, dir: 0 },
  });

  const [activeNavGoal, setActiveNavGoal] = useState(null);
  const [navNotification, setNavNotification] = useState('');

  // Waypoints mapping state
  const [waypoints, setWaypoints] = useState([]);
  const [isPinMode, setIsPinMode] = useState(false);
  const [isAddWpModalOpen, setIsAddWpModalOpen] = useState(false);
  const [newWpData, setNewWpData] = useState({ name: '', floor: 'Tầng 1', x: 0, y: 0, type: 'service' });

  const wsRef = useRef(null);
  const rosClientRef = useRef(null);

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
    if (connectionMode !== 'pi5') return;
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
  }, [connectionMode]);

  // Dual Connection Effect: ROS 2 Rosbridge (port 9090) hoặc Pi 5 (port 8000)
  useEffect(() => {
    setIsWsConnected(false);

    if (connectionMode === 'ros2') {
      const client = new RosbridgeClient(rosbridgeUrl, {
        autoReconnect: true,
        onOpen: () => {
          setIsWsConnected(true);
          setHardwareInfo({
            is_connected: true,
            device_info: {
              model: 'ROS 2 SLAM Toolbox & Nav2',
              port: rosbridgeUrl,
              health: 'Active',
            },
          });
          setTelemetry((prev) => ({
            ...prev,
            status: 'ROS2_CONNECTED',
            source: 'ROS2_SLAM_NAV2',
          }));
          setNavNotification(`[ROS 2] Đã kết nối Rosbridge (${rosbridgeUrl})`);
        },
        onClose: () => {
          setIsWsConnected(false);
        },
        onError: () => {
          setIsWsConnected(false);
        },
      });

      rosClientRef.current = client;
      client.connect();

      // 1. Subscribe Occupancy Grid Map (/map)
      const unsubMap = client.subscribe(ROS_TOPICS.MAP, ROS_MSG_TYPES.OCCUPANCY_GRID, (msg) => {
        const parsed = parseOccupancyGrid(msg);
        if (parsed) {
          setGridData(parsed.gridData);
          setGridMetadata(parsed.metadata);
        }
      });

      // 2. Subscribe 2D Laser Scan (/scan)
      const unsubScan = client.subscribe(ROS_TOPICS.SCAN, ROS_MSG_TYPES.LASER_SCAN, (msg) => {
        const points = parseLaserScan(msg);
        setScanPoints(points);
      });

      // 3. Subscribe Odometry (/odom)
      const unsubOdom = client.subscribe(ROS_TOPICS.ODOM, ROS_MSG_TYPES.ODOMETRY, (msg) => {
        const pos = msg.pose?.pose?.position;
        const ori = msg.pose?.pose?.orientation;
        if (pos) {
          const yaw = ori ? quaternionToYaw(ori.z, ori.w) : 0;
          setTelemetry((prev) => ({
            ...prev,
            x: Number(pos.x.toFixed(2)),
            y: Number(pos.y.toFixed(2)),
            yaw: Number((yaw * (180 / Math.PI)).toFixed(1)),
            linearVelocity: Number(msg.twist?.twist?.linear?.x?.toFixed(2) || 0),
            angularVelocity: Number(msg.twist?.twist?.angular?.z?.toFixed(2) || 0),
            source: 'ROS2_SLAM_NAV2',
          }));
        }
      });

      // 4. Subscribe AMCL Robot Pose (/amcl_pose)
      const unsubAmcl = client.subscribe(ROS_TOPICS.AMCL_POSE, ROS_MSG_TYPES.POSE_WITH_COVARIANCE, (msg) => {
        const pos = msg.pose?.pose?.position;
        const ori = msg.pose?.pose?.orientation;
        if (pos) {
          const yaw = ori ? quaternionToYaw(ori.z, ori.w) : 0;
          setTelemetry((prev) => ({
            ...prev,
            x: Number(pos.x.toFixed(2)),
            y: Number(pos.y.toFixed(2)),
            yaw: Number((yaw * (180 / Math.PI)).toFixed(1)),
            status: 'AMCL_LOCALIZED',
            source: 'ROS2_SLAM_NAV2',
          }));
        }
      });

      // 5. Subscribe Encoder Telemetry (/robot/encoder_telemetry)
      const unsubTelemetry = client.subscribe('/robot/encoder_telemetry', 'std_msgs/String', (msg) => {
        try {
          const encData = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
          if (encData && encData.m1) {
            setEncoders({
              m1: encData.m1,
              m2: encData.m2,
              m3: encData.m3,
              m4: encData.m4,
            });
          }
        } catch {
          // ignore parsing error
        }
      });

      return () => {
        unsubMap();
        unsubScan();
        unsubOdom();
        unsubAmcl();
        unsubTelemetry();
        client.disconnect();
      };
    } else {
      // Chế độ kết nối trực tiếp Pi 5 WebSocket (port 8000)
      const ws = new WebSocket(`${PI5_WS}/map/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        setNavNotification(`[Pi 5] Đã kết nối trực tiếp Pi 5 (${PI5_WS})`);
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
            if (data.encoders) {
              setEncoders(data.encoders);
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
    }
  }, [connectionMode, rosbridgeUrl]);

  // Reconnect logic
  const handleReconnect = async () => {
    if (connectionMode === 'ros2') {
      setNavNotification(`Đang kết nối lại ROS 2 Rosbridge (${rosbridgeUrl})...`);
      if (rosClientRef.current) {
        rosClientRef.current.disconnect();
        rosClientRef.current.autoReconnect = true;
        rosClientRef.current.connect();
      }
    } else {
      setNavNotification('Đang kết nối lại Pi 5 backend...');
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
        setNavNotification('[ERROR] Không thể kết nối Pi 5 — kiểm tra Tailscale hoặc IP');
      }
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  // Reset SLAM grid map
  const handleResetGridMap = async () => {
    try {
      setNavNotification('Đang xóa sạch bản đồ SLAM...');
      const res = await fetch(`${PI5_API}/map/reset_map`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification('Bản đồ đã xóa sạch. Vị trí robot đã đặt về (0,0).');
        setGridData(new Array(200 * 200).fill(-1));
        setTelemetry((prev) => ({ ...prev, x: 0, y: 0, yaw: 0 }));
      }
    } catch (err) {
      console.error('Reset map error:', err);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleScan360 = async () => {
    setNavNotification('Bắt đầu xoay 360 độ quét toàn cảnh các bức tường phòng...');
    try {
      await fetch(`${PI5_API}/map/scan_360`, { method: 'POST' });
    } catch (err) {
      console.error('Lỗi quét 360:', err);
    }
  };

  const handleTeleop = async (command) => {
    if (connectionMode === 'ros2' && rosClientRef.current?.isConnected) {
      let lin = 0.0;
      let ang = 0.0;
      if (command === 'forward') lin = 0.25;
      else if (command === 'backward') lin = -0.25;
      else if (command === 'left') ang = 0.6;
      else if (command === 'right') ang = -0.6;
      rosClientRef.current.publishCmdVel(lin, ang);
      return;
    }

    try {
      await fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, speed: 40 }),
      });
    } catch (err) {
      console.error('Teleop error:', err);
    }
  };

  // Keyboard Teleop: W-A-S-D hoặc Phím Mũi Tên
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') handleTeleop('forward');
      else if (key === 's' || key === 'arrowdown') handleTeleop('backward');
      else if (key === 'a' || key === 'arrowleft') handleTeleop('left');
      else if (key === 'd' || key === 'arrowright') handleTeleop('right');
      else if (key === ' ' || key === 'x') handleTeleop('stop');
    };
    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        handleTeleop('stop');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [connectionMode]);

  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });

    if (connectionMode === 'ros2' && rosClientRef.current?.isConnected) {
      rosClientRef.current.publishGoal(targetX, targetY, 0);
      setNavNotification(`[NAV2] Đã gửi mục tiêu /goal_pose -> X: ${targetX.toFixed(2)}m, Y: ${targetY.toFixed(2)}m`);
    } else {
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

    if (connectionMode === 'ros2' && rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(0, 0);
    }

    try {
      await fetch('/api/v1/operations/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'stop',
          target_ip: PI5_IP,
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
      {/* Status Banner — Dual Connection */}
      <div className="w-full border-b px-6 py-2 flex items-center justify-between text-xs font-mono"
        style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}>
        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center border rounded-md p-0.5 bg-[#FAF8F5]" style={{ borderColor: '#BFBFBD' }}>
            <button
              onClick={() => setConnectionMode('ros2')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                connectionMode === 'ros2'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ROS 2 (WSL2 :9090)
            </button>
            <button
              onClick={() => setConnectionMode('pi5')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                connectionMode === 'pi5'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Pi 5 Direct (:8000)
            </button>
          </div>

          <span className="font-bold px-2 py-0.5 rounded border text-[10px]"
            style={isWsConnected
              ? { background: '#262626', color: '#FFFFFF', borderColor: '#262626' }
              : { background: '#F2EFE9', color: '#8C8C8C', borderColor: '#BFBFBD' }}>
            {connectionMode === 'ros2'
              ? (isWsConnected ? `ROS 2 CONNECTED — ${rosbridgeUrl}` : `ROS 2 OFFLINE — ${rosbridgeUrl}`)
              : (isWsConnected ? `PI5 CONNECTED — ${PI5_IP}` : `PI5 OFFLINE — ${PI5_IP}`)}
          </span>

          {connectionMode === 'ros2' && isWsConnected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold hidden sm:inline-block">
              TOPICS: /map & /goal_pose
            </span>
          )}

          <span style={{ color: '#8C8C8C' }}>RAW: <strong style={{ color: '#262626' }}>{scanPoints.length} PTS</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScan360}
            className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
            title="Cho robot xoay tại chỗ 360 độ để quét toàn cảnh các bức tường xung quanh phòng"
          >
            <RotateCw className="w-3 h-3 text-emerald-600 animate-spin-slow" />
            <span>QUÉT 360° PHÒNG</span>
          </button>
          <button
            onClick={handleResetGridMap}
            className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-red-50 hover:text-red-700 hover:border-red-300"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#8C8C8C' }}
            title="Xóa sạch toàn bộ lưới bản đồ SLAM và đặt lại vị trí Robot về (0,0)"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
            <span>XÓA BẢN ĐỒ</span>
          </button>
          <button
            onClick={handleReconnect}
            className="px-2 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer hover:bg-stone-200"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
            title="Thử kết nối lại"
          >
            <RefreshCw className="w-3 h-3 text-stone-600" />
            <span>KẾT NỐI LẠI</span>
          </button>
        </div>
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
              onResetMap={handleResetGridMap}
              isPinMode={isPinMode}
              showGridMap={showGridMap}
              showGridLines={showGridLines}
              showScanRays={showScanRays}
              showWaypoints={true}
            />

            {/* Waiting for data overlay */}
            {scanPoints.length === 0 && (
              <div className="absolute inset-0 z-10 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6 rounded-2xl"
                style={{ background: 'rgba(242,239,233,0.97)', border: '1px solid #BFBFBD' }}>
                <Cpu className="w-8 h-8 animate-pulse" style={{ color: '#8C8C8C' }} />
                <div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: '#262626' }}>
                    {connectionMode === 'ros2'
                      ? `CHƯA CÓ DỮ LIỆU TỪ ROS 2 — ${rosbridgeUrl}`
                      : `NO DATA FROM PI5 — ${PI5_IP}`}
                  </h3>
                  <p className="text-xs max-w-md leading-relaxed" style={{ color: '#8C8C8C' }}>
                    {connectionMode === 'ros2'
                      ? 'Đang chờ topic /map hoặc /scan từ Rosbridge Server. Hãy chắc chắn script start_wsl_slam.sh hoặc Gazebo đang chạy.'
                      : 'WebSocket waiting for SLAM data from Pi5. Make sure the Pi5 backend is running and reachable via Tailscale.'}
                  </p>
                </div>
                <button
                  onClick={handleReconnect}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer uppercase"
                  style={{ background: '#262626', color: '#FFFFFF' }}
                >
                  {connectionMode === 'ros2' ? 'KẾT NỐI LẠI ROSBRIDGE (:9090)' : 'RECONNECT TO PI5 (:8000)'}
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
          {/* Card 1: Waypoints Mapping (Hotel Concierge Concepts) */}
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
                        X: {Number(wp.x).toFixed(1)}m, Y: {Number(wp.y).toFixed(1)}m
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

          {/* Card 2: Telemetry & Odometry */}
          <div className="border rounded-xl p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#8C8C8C' }}>TELEMETRY & ODOMETRY</span>
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

            {/* Speeds from Odometry */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg border" style={{ background: '#FAF8F5', borderColor: '#E3DFD5' }}>
                <div className="text-[9px] font-bold tracking-wider mb-0.5" style={{ color: '#8C8C8C' }}>VẬN TỐC DÀI (Vx)</div>
                <div className="text-xs font-mono font-bold" style={{ color: '#262626' }}>{telemetry.linearVelocity} m/s</div>
              </div>
              <div className="p-2 rounded-lg border" style={{ background: '#FAF8F5', borderColor: '#E3DFD5' }}>
                <div className="text-[9px] font-bold tracking-wider mb-0.5" style={{ color: '#8C8C8C' }}>VẬN TỐC GÓC (Wz)</div>
                <div className="text-xs font-mono font-bold" style={{ color: '#262626' }}>{telemetry.angularVelocity} rad/s</div>
              </div>
            </div>

            {/* 4-Wheel Encoder Telemetry (ESP32 JGA25-370) */}
            <div className="p-2.5 rounded-lg border flex flex-col gap-2" style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#262626' }}>
                  4 BÁNH ENCODER (ESP32)
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border" style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}>
                  CPR 330
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="p-1.5 rounded border" style={{ background: '#FFFFFF', borderColor: '#E3DFD5' }}>
                  <div className="font-bold text-[9px]" style={{ color: '#8C8C8C' }}>M1 (TRÁI TRƯỚC)</div>
                  <div className="font-bold text-stone-900">{encoders.m1?.rpm || 0} RPM | {encoders.m1?.ticks || 0} T</div>
                </div>
                <div className="p-1.5 rounded border" style={{ background: '#FFFFFF', borderColor: '#E3DFD5' }}>
                  <div className="font-bold text-[9px]" style={{ color: '#8C8C8C' }}>M3 (PHẢI TRƯỚC)</div>
                  <div className="font-bold text-stone-900">{encoders.m3?.rpm || 0} RPM | {encoders.m3?.ticks || 0} T</div>
                </div>
                <div className="p-1.5 rounded border" style={{ background: '#FFFFFF', borderColor: '#E3DFD5' }}>
                  <div className="font-bold text-[9px]" style={{ color: '#8C8C8C' }}>M2 (TRÁI SAU)</div>
                  <div className="font-bold text-stone-900">{encoders.m2?.rpm || 0} RPM | {encoders.m2?.ticks || 0} T</div>
                </div>
                <div className="p-1.5 rounded border" style={{ background: '#FFFFFF', borderColor: '#E3DFD5' }}>
                  <div className="font-bold text-[9px]" style={{ color: '#8C8C8C' }}>M4 (PHẢI SAU)</div>
                  <div className="font-bold text-stone-900">{encoders.m4?.rpm || 0} RPM | {encoders.m4?.ticks || 0} T</div>
                </div>
              </div>
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

            {/* Manual WASD D-Pad Teleop */}
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-[#FAF8F5]" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[10px] font-bold text-stone-600">LÁI THỦ CÔNG ĐỂ QUÉT PHÒNG (W-A-S-D)</span>
              <div className="flex flex-col items-center gap-1">
                <button
                  onMouseDown={() => handleTeleop('forward')}
                  onMouseUp={() => handleTeleop('stop')}
                  className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                  title="Tiến (W)"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onMouseDown={() => handleTeleop('left')}
                    onMouseUp={() => handleTeleop('stop')}
                    className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                    title="Rẽ Trái (A)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTeleop('stop')}
                    className="px-2 py-1.5 rounded-lg border bg-stone-200 text-[10px] font-bold shadow-sm hover:bg-stone-300 active:scale-95 cursor-pointer text-stone-800"
                    title="Dừng (Space/X)"
                  >
                    STOP
                  </button>
                  <button
                    onMouseDown={() => handleTeleop('right')}
                    onMouseUp={() => handleTeleop('stop')}
                    className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                    title="Rẽ Phải (D)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onMouseDown={() => handleTeleop('backward')}
                  onMouseUp={() => handleTeleop('stop')}
                  className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                  title="Lùi (S)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

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
