import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LidarCanvas } from '../../components/admin/LidarCanvas';
import {
  fetchWaypoints,
  saveWaypoint,
  deleteWaypoint,
  fetchCurrentMap,
  loadSavedLidarMap,
  listSavedMaps,
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
  Save,
  FolderOpen,
  FileText,
  Check,
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
  const [selectedMapId, setSelectedMapId] = useState('phong_lam_viec');

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

  // Map saving & loading state
  const [isSaveMapModalOpen, setIsSaveMapModalOpen] = useState(false);
  const [saveMapName, setSaveMapName] = useState('floor1_map');
  const [isSavedMapsModalOpen, setIsSavedMapsModalOpen] = useState(false);
  const [savedMapsList, setSavedMapsList] = useState([]);
  const [isSavingMap, setIsSavingMap] = useState(false);

  // Frontier Exploration
  const [isExploring, setIsExploring] = useState(false);
  const [exploreAutoSave, setExploreAutoSave] = useState(true);
  const [exploreSaveName, setExploreSaveName] = useState('auto_explored_map');
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);

  // Workflow Manager
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [workflowList, setWorkflowList] = useState([]);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState({});
  const [newWorkflow, setNewWorkflow] = useState({
    name: 'Tuần tra tầng 1',
    description: '',
    steps: [
      { name: 'Điểm A', action: 'navigate', x: 1.0, y: 0.0, timeout: 45 },
      { name: 'Dừng chờ', action: 'wait', wait_sec: 3 },
      { name: 'Về gốc', action: 'return_home' },
    ],
  });

  // Overlay Map
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayWaypoints, setOverlayWaypoints] = useState([]);
  const [isOverlayModalOpen, setIsOverlayModalOpen] = useState(false);
  const [overlayMapName, setOverlayMapName] = useState('floor_plan_overlay');

  // Real-time LiDAR Safety & Obstacle Clearances
  const [safetyInfo, setSafetyInfo] = useState({ front_cm: null, rear_cm: null, left_cm: null, right_cm: null, alert: '' });

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

  // Tự động tải danh sách bản đồ và nạp bản đồ tĩnh hiện tại từ Backend
  useEffect(() => {
    const initMaps = async () => {
      try {
        const listData = await listSavedMaps();
        if (listData?.maps && listData.maps.length > 0) {
          setSavedMapsList(listData.maps);
          if (listData.active_map_id) setSelectedMapId(listData.active_map_id);
        }
        const currMap = await fetchCurrentMap();
        if (currMap?.grid_data && currMap.grid_data.length > 0) {
          setGridData(currMap.grid_data);
          if (currMap.metadata) setGridMetadata(currMap.metadata);
        }
      } catch (err) {
        console.warn('Lỗi load bản đồ tĩnh ban đầu:', err);
      }
    };
    initMaps();
  }, []);

  const handleSelectMap = async (mapId) => {
    try {
      setSelectedMapId(mapId);
      setNavNotification(`Đang nạp bản đồ: ${mapId}...`);
      await loadSavedLidarMap(mapId);
      const curr = await fetchCurrentMap();
      if (curr?.grid_data) {
        setGridData(curr.grid_data);
        if (curr.metadata) setGridMetadata(curr.metadata);
        setNavNotification(`✅ Đã nạp thành công bản đồ: ${mapId}`);
      }
    } catch (err) {
      setNavNotification(`❌ Lỗi nạp bản đồ: ${err.message}`);
    }
  };

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
            // New fields from updated backend
            if (data.is_exploring !== undefined) setIsExploring(data.is_exploring);
            if (data.is_workflow_running !== undefined) setIsWorkflowRunning(data.is_workflow_running);
            if (data.workflow_progress) setWorkflowProgress(data.workflow_progress);
            if (data.overlay_active !== undefined) setOverlayActive(data.overlay_active);
            if (data.overlay_waypoints) setOverlayWaypoints(data.overlay_waypoints);
            if (data.safety) {
              setSafetyInfo(data.safety);
            }
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

  const handleOpenSaveMapModal = () => {
    setSaveMapName(`map_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now().toString().slice(-4)}`);
    setIsSaveMapModalOpen(true);
  };

  const handleSaveMap = async (e) => {
    if (e) e.preventDefault();
    if (!saveMapName.trim()) return;
    setIsSavingMap(true);
    setNavNotification(`Đang lưu bản đồ "${saveMapName}"...`);
    try {
      const res = await fetch(`${PI5_API}/map/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveMapName.trim() }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(`✅ Đã lưu bản đồ "${saveMapName}" thành công (JSON + ROS 2 YAML/PGM)!`);
        setIsSaveMapModalOpen(false);
      } else {
        setNavNotification(`❌ Lỗi khi lưu bản đồ: ${data.message}`);
      }
    } catch (err) {
      setNavNotification(`❌ Không thể kết nối Pi 5: ${err.message}`);
    } finally {
      setIsSavingMap(false);
      setTimeout(() => setNavNotification(''), 4500);
    }
  };

  const handleOpenSavedMapsModal = async () => {
    setIsSavedMapsModalOpen(true);
    try {
      const res = await fetch(`${PI5_API}/map/saved_list`);
      if (res.ok) {
        const data = await res.json();
        setSavedMapsList(data.maps || []);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách bản đồ:', err);
    }
  };

  const handleLoadSavedMap = async (mapName) => {
    setNavNotification(`Đang nạp bản đồ "${mapName}"...`);
    try {
      const res = await fetch(`${PI5_API}/map/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(`✅ Đã nạp bản đồ "${mapName}" vào hệ thống.`);
        setIsSavedMapsModalOpen(false);
        await fetchHardwareStatus();
      } else {
        setNavNotification(`❌ Lỗi nạp bản đồ: ${data.message}`);
      }
    } catch (err) {
      setNavNotification(`❌ Lỗi kết nối: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDeleteSavedMap = async (mapName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bản đồ "${mapName}"?`)) return;
    try {
      const res = await fetch(`${PI5_API}/map/saved/${mapName}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedMapsList((prev) => prev.filter((m) => m.name !== mapName));
        setNavNotification(`Đã xóa bản đồ "${mapName}"`);
      }
    } catch (err) {
      setNavNotification(`Lỗi khi xóa: ${err.message}`);
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

  // ─── Frontier Exploration ────────────────────────────────────────────
  const handleStartExplore = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/explore/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_save: exploreAutoSave, save_name: exploreSaveName }),
      });
      const data = await res.json();
      setIsExploring(true);
      setIsExploreModalOpen(false);
      setNavNotification(`🗺️ ${data.message}`);
    } catch (err) {
      setNavNotification(`❌ Lỗi khởi động khám phá: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 5000);
  };

  const handleStopExplore = async () => {
    try {
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST' });
      setIsExploring(false);
      setNavNotification('🛑 Đã dừng khám phá tự động.');
    } catch (err) {
      setNavNotification(`❌ ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  // ─── Workflow Manager ────────────────────────────────────────────────
  const loadWorkflows = async () => {
    try {
      const res = await fetch(`${PI5_API.replace('map', 'workflow')}/list`.replace('/map/list', '').replace(/\/map$/, '') + '/../workflow/list');
      // Simplified direct URL:
      const res2 = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/list`);
      if (res2.ok) {
        const data = await res2.json();
        setWorkflowList(data.workflows || []);
      }
    } catch (err) {
      console.warn('Lỗi tải workflow:', err);
    }
  };

  const handleOpenWorkflowModal = async () => {
    setIsWorkflowModalOpen(true);
    await loadWorkflows();
  };

  const handleSaveWorkflow = async () => {
    try {
      const res = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkflow),
      });
      const data = await res.json();
      setNavNotification(`✅ Đã lưu workflow "${newWorkflow.name}" (ID: ${data.id})`);
      await loadWorkflows();
    } catch (err) {
      setNavNotification(`❌ Lỗi lưu workflow: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleExecuteWorkflow = async (wid) => {
    try {
      const res = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/execute/${wid}`, { method: 'POST' });
      const data = await res.json();
      setIsWorkflowRunning(true);
      setNavNotification(`▶️ ${data.message}`);
      setIsWorkflowModalOpen(false);
    } catch (err) {
      setNavNotification(`❌ Lỗi thực thi: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleStopWorkflow = async () => {
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/stop`, { method: 'POST' });
      setIsWorkflowRunning(false);
      setNavNotification('🛑 Đã dừng workflow.');
    } catch (err) {
      setNavNotification(`❌ ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleDeleteWorkflow = async (wid) => {
    if (!window.confirm(`Xóa workflow "${wid}"?`)) return;
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/${wid}`, { method: 'DELETE' });
      await loadWorkflows();
    } catch (err) {
      console.warn('Lỗi xóa workflow:', err);
    }
  };

  // ─── Overlay Map ─────────────────────────────────────────────────────
  const handleLoadOverlay = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/overlay/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_name: overlayMapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setOverlayActive(true);
        setOverlayWaypoints(data.waypoints || []);
        setNavNotification(`🏢 Đã nạp overlay map "${overlayMapName}"`);
        setIsOverlayModalOpen(false);
      } else {
        setNavNotification(`❌ ${data.message}`);
      }
    } catch (err) {
      setNavNotification(`❌ Lỗi: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDisableOverlay = async () => {
    try {
      await fetch(`${PI5_API}/map/overlay/disable`, { method: 'POST' });
      setOverlayActive(false);
      setOverlayWaypoints([]);
      setNavNotification('Đã tắt overlay map');
    } catch (err) {
      setNavNotification(`❌ ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleGenerateOverlayTemplate = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/overlay/template?name=${overlayMapName}`);
      const data = await res.json();
      setNavNotification(`📄 ${data.message}`);
    } catch (err) {
      setNavNotification(`❌ ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
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
          {/* Map Selector */}
          {savedMapsList.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-bold"
              style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}>
              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
              <select
                value={selectedMapId}
                onChange={(e) => handleSelectMap(e.target.value)}
                className="bg-transparent border-none text-[11px] font-bold outline-none cursor-pointer"
                style={{ color: '#262626' }}
                title="Chọn bản đồ đã lưu để hiển thị"
              >
                {savedMapsList.map((m) => (
                  <option key={m.map_id} value={m.map_id}>
                    {m.name || m.map_id} ({m.width}x{m.height})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleOpenSaveMapModal}
            className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
            title="Lưu bản đồ hiện tại ra file JSON và chuẩn ROS 2 YAML/PGM"
          >
            <Save className="w-3 h-3 text-blue-600" />
            <span>LƯU BẢN ĐỒ</span>
          </button>

          {/* Frontier Exploration */}
          {connectionMode === 'pi5' && (
            isExploring ? (
              <button
                onClick={handleStopExplore}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                style={{ background: '#f97316', borderColor: '#ea580c', color: '#fff' }}
                title="Dừng khám phá tự động"
              >
                <Square className="w-3 h-3" />
                <span>DỪNG KHÁM PHÁ</span>
              </button>
            ) : (
              <button
                onClick={() => setIsExploreModalOpen(true)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
                style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
                title="Robot tự di chuyển để quét toàn bộ khu vực"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>KHÁM PHÁ TỰ ĐỘNG</span>
              </button>
            )
          )}

          {/* Workflow Manager */}
          {connectionMode === 'pi5' && (
            isWorkflowRunning ? (
              <button
                onClick={handleStopWorkflow}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                style={{ background: '#8b5cf6', borderColor: '#7c3aed', color: '#fff' }}
                title="Dừng workflow đang chạy"
              >
                <Square className="w-3 h-3" />
                <span>DỪNG WORKFLOW {workflowProgress.current_step && `(${workflowProgress.current_step}/${workflowProgress.total_steps})`}</span>
              </button>
            ) : (
              <button
                onClick={handleOpenWorkflowModal}
                className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
                style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
                title="Quản lý và chạy workflow tự động"
              >
                <Layers className="w-3 h-3 text-purple-600" />
                <span>WORKFLOW</span>
              </button>
            )
          )}

          {/* Overlay Map */}
          {connectionMode === 'pi5' && (
            <button
              onClick={() => setIsOverlayModalOpen(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
              style={overlayActive
                ? { background: '#0f766e', borderColor: '#0d9488', color: '#fff' }
                : { background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
              title="Nạp bản đồ tĩnh (floor plan) đè lên LiDAR map"
            >
              <FileText className="w-3 h-3" style={{ color: overlayActive ? '#fff' : '#0f766e' }} />
              <span>{overlayActive ? 'OVERLAY ĐÃ BẬT' : 'OVERLAY MAP'}</span>
            </button>
          )}
          <button
            onClick={handleOpenSavedMapsModal}
            className="px-2.5 py-1 text-[11px] font-bold rounded-md border flex items-center gap-1.5 transition-all cursor-pointer hover:bg-stone-200"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD', color: '#262626' }}
            title="Xem và nạp các bản đồ đã lưu trên robot"
          >
            <FolderOpen className="w-3 h-3 text-amber-600" />
            <span>BẢN ĐỒ ĐÃ LƯU</span>
          </button>
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

      {/* Floating Toast Notification (Absolute - Never shifts workspace layout height) */}
      {navNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-md border flex items-center gap-2 text-xs font-bold font-mono pointer-events-auto backdrop-blur-xs"
          style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD', color: '#262626' }}>
          <Radio className="w-3.5 h-3.5 shrink-0 text-amber-600 animate-pulse" />
          <span>{navNotification}</span>
          <button onClick={() => setNavNotification('')} className="ml-2 text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer">✕</button>
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

            {/* Waiting for data overlay: chỉ hiện khi chưa có cả live scan VÀ chưa có bản đồ tĩnh */}
            {scanPoints.length === 0 && gridData.length === 0 && (
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

            {/* Real-time LiDAR Obstacle Clearances */}
            <div className="p-2.5 rounded-lg border flex flex-col gap-1.5" style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-stone-700 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  KHOẢNG CÁCH VẬT CẢN (LiDAR)
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-emerald-100 text-emerald-800'}`}>
                  {safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'NGUY HIỂM (<35cm)' : 'AN TOÀN'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono">
                <div className={`p-1.5 rounded border ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-50 border-red-300 text-red-700 font-bold' : 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[8px] text-stone-500 font-sans">TRƯỚC</div>
                  <div>{safetyInfo.front_cm !== null && safetyInfo.front_cm !== undefined ? `${safetyInfo.front_cm}cm` : '---'}</div>
                </div>
                <div className={`p-1.5 rounded border ${safetyInfo.rear_cm && safetyInfo.rear_cm < 30 ? 'bg-red-50 border-red-300 text-red-700 font-bold' : 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[8px] text-stone-500 font-sans">SAU</div>
                  <div>{safetyInfo.rear_cm !== null && safetyInfo.rear_cm !== undefined ? `${safetyInfo.rear_cm}cm` : '---'}</div>
                </div>
                <div className="p-1.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[8px] text-stone-500 font-sans">TRÁI</div>
                  <div>{safetyInfo.left_cm !== null && safetyInfo.left_cm !== undefined ? `${safetyInfo.left_cm}cm` : '---'}</div>
                </div>
                <div className="p-1.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[8px] text-stone-500 font-sans">PHẢI</div>
                  <div>{safetyInfo.right_cm !== null && safetyInfo.right_cm !== undefined ? `${safetyInfo.right_cm}cm` : '---'}</div>
                </div>
              </div>
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

      {/* MODAL: Lưu Bản Đồ SLAM LiDAR */}
      {isSaveMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                  Lưu Bản Đồ SLAM LiDAR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveMapModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveMap} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN BẢN ĐỒ (ĐỊNH DANH DUY NHẤT)
                </label>
                <input
                  type="text"
                  required
                  value={saveMapName}
                  onChange={(e) => setSaveMapName(e.target.value)}
                  placeholder="VD: tang_1_sanh, phong_hop_a, phong_lab..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none font-mono"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              <div className="p-3 rounded-lg border text-xs leading-relaxed" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#555' }}>
                <span className="font-bold block text-stone-800 mb-1">ĐỊNH DẠNG XUẤT RA:</span>
                • <strong>JSON</strong>: Dành cho Web Admin hiển thị tức thì.<br />
                • <strong>ROS 2 Nav2 (.yaml & .pgm)</strong>: Phục vụ Autonomous Navigation, Map Server & AMCL.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  onClick={() => setIsSaveMapModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingMap}
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingMap ? 'Đang lưu...' : 'Lưu Bản Đồ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Danh Sách Bản Đồ Đã Lưu */}
      {isSavedMapsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-lg w-full rounded-2xl border p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-3 shrink-0" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                  Kho Bản Đồ Đã Lưu Trên Robot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {savedMapsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500 font-mono">
                  Chưa có bản đồ nào được lưu.<br />
                  Hãy quét phòng và nhấn "LƯU BẢN ĐỒ" để lưu bản đồ đầu tiên.
                </div>
              ) : (
                savedMapsList.map((mapItem) => (
                  <div
                    key={mapItem.name}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 hover:bg-stone-50 transition-all"
                    style={{ borderColor: '#E3DFD5', backgroundColor: '#FAF8F5' }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-600" />
                        <span className="font-bold text-xs text-stone-900 font-mono">{mapItem.name}</span>
                        {mapItem.has_ros2_yaml && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            ROS 2 YAML/PGM
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        {mapItem.created_at || 'Thời gian: N/A'} • {mapItem.width}x{mapItem.height} ({mapItem.resolution}m/px)
                      </div>
                      {mapItem.statistics && (
                        <div className="text-[10px] text-stone-600">
                          Vật cản: <strong>{mapItem.statistics.occupied_cells}</strong> ô | Trống: <strong>{mapItem.statistics.free_cells}</strong> ô
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoadSavedMap(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white hover:bg-stone-100 text-stone-800 cursor-pointer shadow-xs"
                        style={{ borderColor: '#BFBFBD' }}
                        title="Nạp bản đồ này vào hệ thống SLAM"
                      >
                        Nạp Bản Đồ
                      </button>
                      <button
                        onClick={() => handleDeleteSavedMap(mapItem.name)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Xóa bản đồ này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0" style={{ borderColor: '#BFBFBD' }}>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frontier Exploration Modal */}
      {isExploreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-stone-900">Khám Phá & Lập Bản Đồ Tự Động</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2">
              <p>
                Robot sẽ kích hoạt thuật toán <strong>Frontier Exploration</strong>: tự động tìm kiếm các biên chưa biết (unknown boundary), lập kế hoạch đường đi tránh vật cản bằng LiDAR và tự di chuyển để quét trọn vẹn phòng.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                ⚠️ Hãy đảm bảo sàn nhà không có bậc cầu thang hoặc hố sâu. Robot sẽ tự dừng khẩn cấp nếu gặp vật cản sát &lt; 25cm.
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Tên bản đồ sẽ lưu</label>
                <input
                  type="text"
                  value={exploreSaveName}
                  onChange={(e) => setExploreSaveName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs bg-white text-stone-800 outline-none focus:border-amber-500"
                  style={{ borderColor: '#BFBFBD' }}
                  placeholder="auto_explored_map"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={exploreAutoSave}
                  onChange={(e) => setExploreAutoSave(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>Tự động lưu file bản đồ khi hoàn thành khám phá</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleStartExplore}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bắt Đầu Khám Phá</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Manager Modal */}
      {isWorkflowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b shrink-0" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-stone-900">Quản Lý Workflow Tự Động</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto">
              {/* Column 1: Saved Workflows */}
              <div className="flex flex-col gap-2 border-r pr-3" style={{ borderColor: '#E5E4E2' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Quy trình đã lưu ({workflowList.length})</span>
                  <button
                    onClick={loadWorkflows}
                    className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Làm mới
                  </button>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
                  {workflowList.length === 0 ? (
                    <div className="text-xs text-stone-400 italic text-center py-8">Chưa có workflow nào</div>
                  ) : (
                    workflowList.map((wf) => (
                      <div
                        key={wf.id}
                        className="p-3 bg-white rounded-lg border flex flex-col gap-2 shadow-xs"
                        style={{ borderColor: '#BFBFBD' }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-stone-800">{wf.name}</div>
                            {wf.description && <div className="text-[10px] text-stone-500">{wf.description}</div>}
                            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
                              {wf.steps?.length || 0} bước thực hiện
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleExecuteWorkflow(wf.id)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              title="Chạy workflow"
                            >
                              ▶ Chạy
                            </button>
                            <button
                              onClick={() => handleDeleteWorkflow(wf.id)}
                              className="p-1 text-red-500 hover:text-red-700 rounded text-[10px] cursor-pointer"
                              title="Xóa workflow"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Steps preview */}
                        <div className="text-[10px] text-stone-500 bg-stone-50 rounded p-1.5 space-y-0.5">
                          {wf.steps?.map((st, i) => (
                            <div key={i} className="truncate">
                              {i + 1}. <span className="font-semibold text-stone-700">{st.action}</span> - {st.name} {st.x !== undefined && `(${st.x}, ${st.y})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: New Workflow Editor */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tạo Workflow mới</span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600">Tên Workflow</label>
                    <input
                      type="text"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border text-xs bg-white text-stone-800"
                      style={{ borderColor: '#BFBFBD' }}
                      placeholder="VD: Tuần tra sảnh chính"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-stone-600">Các bước thực hiện</label>
                      <button
                        type="button"
                        onClick={() =>
                          setNewWorkflow({
                            ...newWorkflow,
                            steps: [
                              ...newWorkflow.steps,
                              { name: `Bước ${newWorkflow.steps.length + 1}`, action: 'navigate', x: 0, y: 0, timeout: 30 },
                            ],
                          })
                        }
                        className="text-[10px] text-purple-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Thêm bước
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {newWorkflow.steps.map((st, idx) => (
                        <div key={idx} className="p-2 bg-white rounded border text-xs space-y-1" style={{ borderColor: '#E5E4E2' }}>
                          <div className="flex items-center gap-1 justify-between">
                            <span className="font-bold text-[10px] text-purple-700">#{idx + 1}</span>
                            <input
                              type="text"
                              value={st.name}
                              onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].name = e.target.value;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="px-1.5 py-0.5 border rounded text-[11px] flex-1"
                              placeholder="Tên bước"
                            />
                            <select
                              value={st.action}
                              onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].action = e.target.value;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="px-1.5 py-0.5 border rounded text-[11px] bg-stone-50"
                            >
                              <option value="navigate">navigate</option>
                              <option value="wait">wait</option>
                              <option value="scan_360">scan_360</option>
                              <option value="return_home">return_home</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = newWorkflow.steps.filter((_, i) => i !== idx);
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="text-red-500 hover:text-red-700 px-1"
                            >
                              ✕
                            </button>
                          </div>

                          {st.action === 'navigate' && (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>X (m): <input type="number" step="0.1" value={st.x ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].x = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded" /></div>
                              <div>Y (m): <input type="number" step="0.1" value={st.y ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].y = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded" /></div>
                            </div>
                          )}

                          {st.action === 'wait' && (
                            <div className="text-[10px]">
                              Chờ (giây): <input type="number" value={st.wait_sec ?? 3} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].wait_sec = parseInt(e.target.value) || 3;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWorkflow}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu Workflow Mới</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0" style={{ borderColor: '#BFBFBD' }}>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Map Modal */}
      {isOverlayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-stone-900">Bản Đồ Tĩnh (Static Overlay)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOverlayModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2">
              <p>
                Đè bản đồ mặt bằng thiết kế (floor plan với các bức tường kiên cố, vùng cấm, phòng ban) lên trên lưới SLAM quét từ LiDAR.
              </p>
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px]">
                🛡️ <strong>Nguyên tắc:</strong> Tường từ bản đồ Overlay sẽ luôn là vật cản cứng (100% obstacle), đảm bảo thuật toán điều hướng A* không bao giờ dẫn đường xuyên tường.
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Tên file Overlay Map</label>
                <input
                  type="text"
                  value={overlayMapName}
                  onChange={(e) => setOverlayMapName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs bg-white text-stone-800 outline-none focus:border-teal-500"
                  style={{ borderColor: '#BFBFBD' }}
                  placeholder="floor_plan_overlay"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded border text-xs" style={{ borderColor: '#BFBFBD' }}>
                <span className="font-semibold text-stone-700">Trạng thái:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${overlayActive ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-600'}`}>
                  {overlayActive ? 'ĐANG KÍCH HOẠT' : 'CHƯA BẬT'}
                </span>
              </div>

              {overlayWaypoints.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-semibold">Điểm mốc (Waypoints) từ Overlay:</span>
                  <div className="mt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {overlayWaypoints.map((wp, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-[10px] font-medium">
                        📍 {wp.name} ({wp.x}, {wp.y})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={handleGenerateOverlayTemplate}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100 flex items-center gap-1"
                  style={{ borderColor: '#BFBFBD' }}
                  title="Tạo file mẫu JSON trên Pi 5"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Tạo Template JSON</span>
                </button>

                {overlayActive ? (
                  <button
                    type="button"
                    onClick={handleDisableOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-red-600 hover:bg-red-700 text-white"
                  >
                    Tắt Overlay
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoadOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Nạp Overlay Lên Bản Đồ</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
