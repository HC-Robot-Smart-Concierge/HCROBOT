import { RobotManualControls } from '../../components/admin/RobotManualControls';
import { DEFAULT_SLAM_SPEED, clampTeleopSpeed, getSlamTeleopMotion } from '../../utils/slamTeleop';
import { useRobotControlText } from '../../context/RobotControlLanguage';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdminCameraTab } from './tabs/AdminCameraTab';
import './robot-control.css';
import { FoxgloveWebViewer } from '../../components/admin/FoxgloveWebViewer';
import {
  fetchCurrentMap,
  loadSavedLidarMap,
  listSavedMaps,
  fetchRos2RuntimeStatus,
  startRos2Mapping,
  saveRos2Map,
  startRos2Navigation,
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
  Sparkles,
  Layers,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Video,
  Plus,
  ChevronDown,
  RotateCw,
  Server,
  Compass,
  Save,
  FolderOpen,
  FileText,
  Check,
  AlertOctagon,
  Download,
  Menu,
  X,
  Lock,
  Unlock,
} from 'lucide-react';

const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;
const ROSBRIDGE_DEFAULT_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';

// Trạng thái nguồn Pi 5 do robot/scripts/pi_power_monitor.py phân loại.
const PI_POWER_BADGES = {
  OK: { label: 'Stable', className: 'bg-emerald-100 text-emerald-800' },
  LOW_VOLTAGE: { label: 'Low voltage', className: 'bg-amber-100 text-amber-800' },
  UNDERVOLTAGE: { label: 'Undervoltage', className: 'bg-red-100 text-red-700 animate-pulse' },
  UNDERVOLTAGE_OCCURRED: { label: 'Past undervoltage', className: 'bg-amber-100 text-amber-800' },
  THROTTLED: { label: 'Throttled', className: 'bg-amber-100 text-amber-800' },
  UNAVAILABLE: { label: 'Unavailable', className: 'bg-stone-100 text-stone-600' },
  OFFLINE: { label: 'Pi offline', className: 'bg-stone-100 text-stone-600' },
};

const formatPowerValue = (value, digits, unit) => (
  typeof value === 'number' ? `${value.toFixed(digits)}${unit}` : '---'
);

const formatDuration = (minutes, rc) => {
  if (typeof minutes !== 'number') return '---';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins} ${rc('min')}`;
};

export const AdminLidarPage = ({ currentUser, initialView = 'slam' }) => {
  const rc = useRobotControlText();
  const [activeView, setActiveView] = useState(initialView);
  const [emergencyStopVersion, setEmergencyStopVersion] = useState(0);
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [rosbridgeUrl, setRosbridgeUrl] = useState(ROSBRIDGE_DEFAULT_URL);

  // Telemetry & Scan Data
  const [scanPoints, setScanPoints] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [gridMetadata, setGridMetadata] = useState({ width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 });
  const [selectedMapId, setSelectedMapId] = useState('phong_lam_viec');

  const [telemetry, setTelemetry] = useState({
    x: 0.0,
    y: 0.0,
    yaw: 0.0,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
    status: 'WAITING_FOR_ROS2_CONNECTION',
    source: 'ROS2_SLAM_NAV2',
  });

  // Nguồn cấp Pi 5 (PMIC); null khi chưa gọi được Pi.
  const [piPower, setPiPower] = useState(null);
  // % pin dự phòng ước tính theo thời gian cấp nguồn (robot/scripts/pi_battery_estimator.py).
  const [piBattery, setPiBattery] = useState(null);
  const [isBatteryEditOpen, setIsBatteryEditOpen] = useState(false);
  const [batteryInputPercent, setBatteryInputPercent] = useState('');
  const [batteryInputRate, setBatteryInputRate] = useState('');
  const [isSyncingBattery, setIsSyncingBattery] = useState(false);

  const [encoders, setEncoders] = useState({
    m1: { ticks: 0, rpm: 0.0, dir: 0 },
    m2: { ticks: 0, rpm: 0.0, dir: 0 },
    m3: { ticks: 0, rpm: 0.0, dir: 0 },
    m4: { ticks: 0, rpm: 0.0, dir: 0 },
  });

  const [activeNavGoal, setActiveNavGoal] = useState(null);
  const [navNotification, setNavNotification] = useState('');

  // Map saving & loading state
  const [isSaveMapModalOpen, setIsSaveMapModalOpen] = useState(false);
  const [saveMapName, setSaveMapName] = useState('floor1_map');
  const [isSavedMapsModalOpen, setIsSavedMapsModalOpen] = useState(false);
  const [savedMapsList, setSavedMapsList] = useState([]);
  const [isSavingMap, setIsSavingMap] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false);
  const [mapMode, setMapMode] = useState('MAPPING');
  const [isRos2RuntimeBusy, setIsRos2RuntimeBusy] = useState(false);
  const [sensorHealth, setSensorHealth] = useState(null);
  const [hasLiveRosMap, setHasLiveRosMap] = useState(false);

  // Frontier Exploration (Quet full phong tu dong bang SLAM)
  const [isExploring, setIsExploring] = useState(false);
  const [exploredCount, setExploredCount] = useState(0);
  const [exploreAutoSave, setExploreAutoSave] = useState(true);
  const [exploreSaveName, setExploreSaveName] = useState('auto_explored_map');
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);

  // Workflow Manager
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [workflowList, setWorkflowList] = useState([]);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState({});
  const [newWorkflow, setNewWorkflow] = useState({
    name: rc("Floor 1 patrol"),
    description: '',
    steps: [
      { name: rc("Point A"), action: 'navigate', x: 1.0, y: 0.0, timeout: 45 },
      { name: rc("Wait"), action: 'wait', wait_sec: 3 },
      { name: rc("Return home"), action: 'return_home'},
    ],
  });

  // Overlay Map
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayWaypoints, setOverlayWaypoints] = useState([]);
  const [isOverlayModalOpen, setIsOverlayModalOpen] = useState(false);
  const [overlayMapName, setOverlayMapName] = useState('floor_plan_overlay');

  // Real-time LiDAR Safety & Obstacle Clearances
  const [safetyInfo, setSafetyInfo] = useState({ front_cm: null, rear_cm: null, left_cm: null, right_cm: null, alert: ''});

  const rosClientRef = useRef(null);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const menuDropdownRef = useRef(null);

  const mapStats = useMemo(() => {
    let occupied = 0;
    let free = 0;
    for (const cell of gridData) {
      if (cell >= 65) occupied += 1;
      else if (cell === 0) free += 1;
    }
    return { occupied, free, known: occupied + free };
  }, [gridData]);

  const lidarLive = Boolean(sensorHealth?.lidar_live && scanPoints.length > 0);
  const odometryMotionSeen = Boolean(sensorHealth?.encoder_motion_detected);
  const mapHasContent = mapStats.occupied > 0 || mapStats.free > 0;
  const mappingReadyToSave = true; // Luôn cho phép lưu map tự do bất kỳ lúc nào

  const piPowerBadge = PI_POWER_BADGES[piPower ? piPower.status : 'OFFLINE'] || PI_POWER_BADGES.UNAVAILABLE;
  const piVoltageLow = piPower?.status === 'UNDERVOLTAGE' || piPower?.status === 'LOW_VOLTAGE';
  const piBatteryPercent = typeof piBattery?.percent === 'number' ? piBattery.percent : null;
  let piBatteryBarColor = 'bg-stone-800';
  if (piBatteryPercent !== null && piBatteryPercent < 20) piBatteryBarColor = 'bg-red-500';
  else if (piBatteryPercent !== null && piBatteryPercent < 50) piBatteryBarColor = 'bg-amber-500';
  const piPowerNotes = [];
  if (!piPower) {
    piPowerNotes.push(rc("Pi 5 is unreachable (port 8000)."));
  } else {
    if (piPower.message) piPowerNotes.push(piPower.message);
    if (typeof piPower.psu_max_current_ma === 'number' && piPower.psu_max_current_ma < 3000) {
      piPowerNotes.push(
        rc("Power supply advertises only {0} A to Pi", [(piPower.psu_max_current_ma / 1000).toFixed(1)])
        + `${piPower.psu_usb_pd === false ? rc(" (no USB-PD)") : ''}.`
      );
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target)) {
        setIsMenuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động tải danh sách bản đồ và nạp bản đồ tĩnh hiện tại từ Backend
  useEffect(() => {
    const initMaps = async () => {
      try {
        const listData = await listSavedMaps();
        if (listData?.maps && listData.maps.length > 0) {
          setSavedMapsList(listData.maps);
          if (listData.active_map_id) setSelectedMapId(listData.active_map_id);
        }
        if (typeof listData?.is_map_locked === 'boolean') {
          setIsMapLocked(listData.is_map_locked);
          setMapMode(listData.map_mode || (listData.is_map_locked ? 'NAVIGATION' : 'MAPPING'));
        }
        const currMap = await fetchCurrentMap();
        if (currMap?.grid_data && currMap.grid_data.some((v) => v !== -1)) {
          setGridData(currMap.grid_data);
          if (currMap.metadata) setGridMetadata(currMap.metadata);
        }
      } catch (err) {
        console.warn('Lỗi load bản đồ tĩnh ban đầu:', err);
      }
    };
    initMaps();
  }, []);

  // Polling dong bo trang thai SLAM Frontier Exploration tu Pi 5
  useEffect(() => {
    let isMounted = true;
    const pollExploreStatus = async () => {
      try {
        const res = await fetch(`${PI5_API}/map/explore/status`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.status === 'SUCCESS') {
            setIsExploring(Boolean(data.is_exploring));
            if (typeof data.explored_count === 'number') {
              setExploredCount(data.explored_count);
            }
          }
        } else {
          // Fallback sang endpoint workflow status de dong bo robot_status
          const fallbackRes = await fetch(`${PI5_API}/workflow/status`);
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            if (isMounted) {
              setIsExploring(fbData.robot_status === 'EXPLORING');
            }
          }
        }
      } catch {
        // Bo qua loi khi Pi 5 dang ban
      }
    };

    const timer = setInterval(pollExploreStatus, 1500);
    pollExploreStatus();
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Nguồn Pi 5 đọc thẳng từ Pi (port 8000), không phụ thuộc ROS 2 có chạy hay không.
  useEffect(() => {
    let isMounted = true;
    const pollPiPower = async () => {
      try {
        const res = await fetch(`${PI5_API}/system/power`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setPiPower(data.power || null);
          setPiBattery(data.battery || null);
        }
      } catch {
        if (isMounted) {
          setPiPower(null);
          setPiBattery(null);
        }
      }
    };

    const timer = setInterval(pollPiPower, 2000);
    pollPiPower();
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Ô để trống thì không gửi: chỉ nhập % thì Pi tự học tốc độ tụt giữa các lần nhập.
  const handleSyncBattery = async () => {
    const body = {};
    if (batteryInputPercent !== '') body.percent = Number(batteryInputPercent);
    if (batteryInputRate !== '') body.minutes_per_percent = Number(batteryInputRate);
    if (Object.keys(body).length === 0) {
      setIsBatteryEditOpen(false);
      return;
    }

    setIsSyncingBattery(true);
    try {
      const res = await fetch(`${PI5_API}/system/battery/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'SUCCESS') throw new Error(data.message || `HTTP ${res.status}`);
      setPiBattery(data.battery);
      setBatteryInputPercent('');
      setBatteryInputRate('');
      setIsBatteryEditOpen(false);
      setNavNotification(
        rc("Pi 5 battery updated: {0}%", [Math.round(data.battery.percent)])
        + (data.battery.calibrated ? rc(" · auto-calibrated to {0} min/1%", [data.battery.minutes_per_percent]) : '')
      );
    } catch (err) {
      setNavNotification(rc("Could not update Pi 5 battery: {0}", [err.message]));
    } finally {
      setIsSyncingBattery(false);
    }
  };

  const handleSelectMap = async (mapId) => {
    try {
      setSelectedMapId(mapId);
      setNavNotification(rc("Loading map: {0}...", [mapId]));
      await loadSavedLidarMap(mapId);
      const curr = await fetchCurrentMap();
      if (curr?.grid_data) {
        setGridData(curr.grid_data);
        if (curr.metadata) setGridMetadata(curr.metadata);
        setNavNotification(rc("Map loaded: {0}", [mapId]));
      }
    } catch (err) {
      setNavNotification(rc("Could not load map: {0}", [err.message]));
    }
  };

  // ROS 2 Rosbridge Connection (port 9090)
  useEffect(() => {
    setIsWsConnected(false);

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
        setNavNotification(rc("[ROS 2] Rosbridge connected ({0}); waiting for live LiDAR data...", [rosbridgeUrl]));
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
        setHasLiveRosMap(true);
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
        const encData = typeof msg.data === 'string'? JSON.parse(msg.data) : msg.data;
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

    // 6. Subscribe 2D Goal Pose (/goal_pose) từ Foxglove hoặc Web Admin.
    const unsubGoal = client.subscribe(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED, (msg) => {
      const pos = msg.pose?.position;
      if (pos) {
        const gx = Number(pos.x.toFixed(2));
        const gy = Number(pos.y.toFixed(2));
        setActiveNavGoal({ x: gx, y: gy });
        setNavNotification(rc("[NAV2] Goal received from Foxglove: X={0}m, Y={1}m -> Navigating to destination!", [gx, gy]));
        setTimeout(() => setNavNotification(''), 4500);
      }
    });

    // 7. Subscribe Mapping Status (/robot/mapping_status)
    const unsubStatus = client.subscribe('/robot/mapping_status', 'std_msgs/String', (msg) => {
      if (msg?.data === 'PAUSED') {
        setIsMapLocked(true);
        setMapMode('PAUSED');
      } else if (msg?.data === 'MAPPING') {
        setIsMapLocked(false);
        setMapMode('MAPPING');
      } else if (msg?.data === 'NAVIGATION') {
        setIsMapLocked(true);
        setMapMode('NAVIGATION');
      }
    });

    // 8. Trạng thái dữ liệu thật xuyên suốt Pi -> ROS 2. Một socket mở chưa
    // đồng nghĩa LiDAR/encoder đang phát dữ liệu.
    const unsubSensorHealth = client.subscribe('/robot/sensor_health', 'std_msgs/String', (msg) => {
      try {
        const health = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        setSensorHealth(health || null);
      } catch {
        setSensorHealth(null);
      }
    });

    return () => {
      unsubMap();
      unsubScan();
      unsubOdom();
      unsubAmcl();
      unsubTelemetry();
      unsubGoal();
      unsubStatus();
      unsubSensorHealth();
      client.disconnect();
    };
  }, [rosbridgeUrl]);

  // Reconnect logic
  const handleReconnect = () => {
    setNavNotification(rc("Reconnecting to ROS 2 Rosbridge ({0})...", [rosbridgeUrl]));
    if (rosClientRef.current) {
      rosClientRef.current.disconnect();
      rosClientRef.current.autoReconnect = true;
      rosClientRef.current.connect();
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const waitForRos2Runtime = useCallback(async (expectedMode) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const statusData = await fetchRos2RuntimeStatus();
        if (statusData?.rosbridge_online && statusData?.foxglove_online && statusData?.mode === expectedMode) {
          return statusData;
        }
      } catch {
        // WSL2/ROS 2 đang khởi động; tiếp tục chờ.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(rc("ROS 2/Foxglove startup timed out. Check the backend logs."));
  }, []);

  const handleStartMappingFromWeb = useCallback(async () => {
    if (isRos2RuntimeBusy) return;
    setIsRos2RuntimeBusy(true);
    setNavNotification(rc("Starting WSL2 + SLAM Toolbox + Foxglove for live mapping..."));
    try {
      setGridData(new Array(200 * 200).fill(-1));
      setScanPoints([]);
      setSensorHealth(null);
      setHasLiveRosMap(false);
      // Yêu cầu Pi mở lại motor/luồng đọc RPLiDAR. ROS bridge sau đó vẫn tự
      // kiểm tra dữ liệu thực; phản hồi SUCCESS ở đây không được xem là đủ.
      const lidarResponse = await fetch(`${PI5_API}/map/connect_lidar`, { method: 'POST' });
      const lidarResult = await lidarResponse.json().catch(() => null);
      if (!lidarResponse.ok || lidarResult?.status !== 'SUCCESS') {
        throw new Error(lidarResult?.message || rc("Pi opened the port but RPLiDAR is not producing scan data."));
      }
      await startRos2Mapping();
      await waitForRos2Runtime('MAPPING');
      setMapMode('MAPPING');
      setIsMapLocked(false);
      rosClientRef.current?.connect();
      setNavNotification(rc("MAPPING is active. Save only when both LiDAR LIVE and ODOM MOVING are green."));
    } catch (err) {
      setNavNotification(rc("Could not start mapping: {0}", [err.message]));
    } finally {
      setIsRos2RuntimeBusy(false);
      setTimeout(() => setNavNotification(''), 7000);
    }
  }, [isRos2RuntimeBusy, waitForRos2Runtime]);

  const handleStartNavigationFromWeb = useCallback(async (requestedMapName = null) => {
    if (isRos2RuntimeBusy) return;
    const mapName = typeof requestedMapName === 'string' && requestedMapName
      ? requestedMapName
      : (selectedMapId || 'phong_lam_viec');
    setIsRos2RuntimeBusy(true);
    setNavNotification(rc("Loading static map \"{0}\" and starting AMCL + Nav2...", [mapName]));
    try {
      await startRos2Navigation(mapName);
      await waitForRos2Runtime('NAVIGATION');
      setSelectedMapId(mapName);
      setMapMode('NAVIGATION');
      setIsMapLocked(true);
      rosClientRef.current?.connect();
      setNavNotification(rc("NAVIGATION is ready with static map \"{0}\".", [mapName]));
    } catch (err) {
      setNavNotification(rc("Could not start Navigation: {0}", [err.message]));
    } finally {
      setIsRos2RuntimeBusy(false);
      setTimeout(() => setNavNotification(''), 7000);
    }
  }, [isRos2RuntimeBusy, selectedMapId, waitForRos2Runtime]);

  // Reset SLAM grid map (xóa sạch bản đồ trên Foxglove & SLAM Toolbox).
  const handleResetGridMap = async () => {
    if (!window.confirm(rc("Clear the current SLAM map and return the robot to (0, 0) to start a new scan?"))) {
      return;
    }

    try {
      setNavNotification(rc("Clearing the SLAM Toolbox map and returning the robot to the origin..."));

      // 1. Gửi tín hiệu Reset tới ROS 2 SLAM Toolbox qua Rosbridge
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.resetMap();
      }

      // 2. Gửi tín hiệu Reset tới Pi 5 Backend
      try {
        await fetch(`${PI5_API}/map/reset_map`, { method: 'POST'});
      } catch {
        // Fallback ignore if Pi5 endpoint is busy
      }

      // 3. Reset state giao diện Web Admin
      setIsExploring(false);
      setExploredCount(0);
      setGridData(new Array(200 * 200).fill(-1));
      setScanPoints([]);
      setTelemetry((prev) => ({
        ...prev,
        x: 0.0,
        y: 0.0,
        yaw: 0.0,
        linearVelocity: 0.0,
        angularVelocity: 0.0,
        status: 'SLAM_MAP_CLEARED',
      }));

      setNavNotification(rc("SLAM map cleared. Robot is at (0,0), ready for a new scan."));
    } catch (err) {
      console.error('Reset map error:', err);
      setNavNotification(rc("Could not clear map: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4500);
  };

  // Khóa bản đồ gốc / Tiếp tục quét
  const handleToggleLockMap = () => {
    try {
      if (mapMode === 'NAVIGATION') {
        setNavNotification(rc("NAVIGATION is active: the saved map is read-only. Run quet_map_mot_lan.bat to scan again."));
        setTimeout(() => setNavNotification(''), 5000);
        return;
      }
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.togglePauseMap();
        const nextLocked = !isMapLocked;
        setIsMapLocked(nextLocked);
        setMapMode(nextLocked ? 'PAUSED' : 'MAPPING');
        setNavNotification(
          nextLocked
            ? rc("Base map locked. The map is fixed and new walls will not be added.")
            : rc("Map unlocked. Scanning and map updates resumed.")
        );
      } else {
        setNavNotification(rc("Not connected to Rosbridge 9090!"));
      }
    } catch (err) {
      setNavNotification(rc("Could not lock/unlock map: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleScan360 = async () => {
    setNavNotification(rc("Starting a 360-degree scan of the room walls..."));
    try {
      await fetch(`${PI5_API}/map/scan_360`, { method: 'POST'});
    } catch (err) {
      console.error('Lỗi quét 360:', err);
    }
  };

  const handleOpenSaveMapModal = () => {
    if (mapMode !== 'MAPPING') {
      setNavNotification(
        mapMode === 'NAVIGATION'
          ? rc("Cannot save during NAVIGATION: this is a saved static map. Select \"1. START MAPPING\" first.")
          : rc("The map is locked. Resume MAPPING before saving.")
      );
      setTimeout(() => setNavNotification(''), 6500);
      return;
    }
    setSaveMapName(`map_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now().toString().slice(-4)}`);
    setIsSaveMapModalOpen(true);
  };

  const triggerMapDownload = async (mapName) => {
    try {
      const res = await fetch(`/api/v1/map/download/${encodeURIComponent(mapName)}?format=zip`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${mapName}_slam_map.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 3000);
      return true;
    } catch (err) {
      console.warn('Lỗi fetch download, chuyển sang direct download link:', err);
      const a = document.createElement('a');
      a.href = `/api/v1/map/download/${encodeURIComponent(mapName)}?format=zip`;
      a.download = `${mapName}_slam_map.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 1000);
      return false;
    }
  };

  const handleSaveMap = async (e) => {
    if (e) e.preventDefault();
    if (mapMode !== 'MAPPING') {
      setNavNotification(rc("Save new maps only while SLAM Toolbox is in MAPPING mode. Navigation reads saved static maps."));
      setTimeout(() => setNavNotification(''), 6500);
      return;
    }
    const trimmedName = saveMapName.trim();
    if (!trimmedName) return;
    setIsSavingMap(true);
    setNavNotification(rc("Saving ROS 2 map \"{0}\" as YAML/PGM...", [trimmedName]));

    try {
      // 1. Backend laptop gọi map_saver_cli và chỉ trả SUCCESS khi YAML/PGM đã tồn tại.
      await saveRos2Map(trimmedName);

      setSelectedMapId(trimmedName);
      setIsMapLocked(true);
      setMapMode('PAUSED');
      setNavNotification(rc("Saved \"{0}\". Switching to static-map Navigation...", [trimmedName]));

      // 2. Kết thúc mapping và tự nạp đúng map vừa lưu bằng Map Server + AMCL + Nav2.
      await startRos2Navigation(trimmedName);
      await waitForRos2Runtime('NAVIGATION');
      setMapMode('NAVIGATION');
      rosClientRef.current?.connect();

      // 3. Tải gói map sau khi file thật đã được tạo xong.
      await triggerMapDownload(trimmedName);
      const listData = await listSavedMaps().catch(() => null);
      if (listData?.maps) setSavedMapsList(listData.maps);
      setNavNotification(rc("Saved and locked \"{0}\". Navigation is running and the ZIP has been downloaded.", [trimmedName]));
      setIsSaveMapModalOpen(false);
    } catch (err) {
      setNavNotification(rc("Could not save map: {0}", [err.message]));
    } finally {
      setIsSavingMap(false);
      setTimeout(() => setNavNotification(''), 8000);
    }
  };

  const handleOpenSavedMapsModal = async () => {
    setIsSavedMapsModalOpen(true);
    try {
      // 1. Tải danh sách bản đồ từ Pi 5
      const pi5Res = await fetch(`${PI5_API}/map/saved_list`).catch(() => null);
      let pi5Maps = [];
      if (pi5Res && pi5Res.ok) {
        const data = await pi5Res.json();
        pi5Maps = data.maps || [];
      }

      // 2. Tải danh sách bản đồ lưu trên máy tính (backend robot/maps & static/maps)
      const localRes = await fetch('/api/v1/map/list_saved_maps').catch(() => null);
      let localMaps = [];
      if (localRes && localRes.ok) {
        const data = await localRes.json();
        localMaps = data.maps || [];
      }

      // Hợp nhất danh sách bản đồ
      const mergedMap = new Map();
      pi5Maps.forEach((m) => {
        mergedMap.set(m.name, { ...m, source: 'PI5'});
      });
      localMaps.forEach((m) => {
        const existing = mergedMap.get(m.name);
        if (existing) {
          mergedMap.set(m.name, { ...existing, has_local_file: true });
        } else {
          mergedMap.set(m.name, {
            name: m.name,
            floor: m.floor || rc("Floor 1 lobby"),
            width: m.width,
            height: m.height,
            resolution: m.resolution,
            has_ros2_yaml: true,
            has_local_file: true,
            created_at: m.created_at,
            source: 'LOCAL_DISK',
          });
        }
      });

      setSavedMapsList(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn('Lỗi tải danh sách bản đồ:', err);
    }
  };

  const handleLoadSavedMap = async (mapName) => {
    setNavNotification(rc("Loading map \"{0}\"...", [mapName]));
    try {
      const res = await fetch(`${PI5_API}/map/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name: mapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(rc("Map \"{0}\" loaded into the system.", [mapName]));
        setIsSavedMapsModalOpen(false);
      } else {
        setNavNotification(rc("Could not load map: {0}", [data.message]));
      }
    } catch (err) {
      setNavNotification(rc("Connection error: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDeleteSavedMap = async (mapName) => {
    if (!window.confirm(rc("Delete map file \"{0}\"?", [mapName]))) return;
    try {
      await fetch(`/api/v1/map/saved/${encodeURIComponent(mapName)}`, { method: 'DELETE'}).catch(() => null);
      await fetch(`${PI5_API}/map/saved/${mapName}`, { method: 'DELETE'}).catch(() => null);
      setSavedMapsList((prev) => prev.filter((m) => m.name !== mapName));
      setNavNotification(rc("Deleted map file \"{0}\"", [mapName]));
    } catch (err) {
      setNavNotification(rc("Could not delete: {0}", [err.message]));
    }
  };

  const [slamSpeed, setSlamSpeed] = useState(DEFAULT_SLAM_SPEED);
  const [slamSpeedDraft, setSlamSpeedDraft] = useState(null);
  const [slamActiveMotion, setSlamActiveMotion] = useState('stop');
  const slamSpeedRef = useRef(DEFAULT_SLAM_SPEED);
  const handleSlamSpeedChange = (value) => {
    const speed = clampTeleopSpeed(value);
    slamSpeedRef.current = speed;
    setSlamSpeed(speed);
  };

  const teleopIntervalRef = useRef(null);
  const activeTeleopCmdRef = useRef(null);

  const sendMotion = (command) => {
    const motion = getSlamTeleopMotion(command, slamSpeedRef.current);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(motion.linear, motion.angular);
    } else {
      fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          command,
          speed: motion.speed,
        }),
      }).catch(() => {});
    }
  };

  const startTeleop = (command) => {
    if (activeTeleopCmdRef.current === command && teleopIntervalRef.current) {
      return;
    }
    if (teleopIntervalRef.current) {
      clearInterval(teleopIntervalRef.current);
    }
    activeTeleopCmdRef.current = command;
    setSlamActiveMotion({ forward: 'w', backward: 's', left: 'a', right: 'd' }[command] || 'stop');
    sendMotion(command);
    teleopIntervalRef.current = setInterval(() => {
      sendMotion(command);
    }, 100);
  };

  const stopTeleop = () => {
    if (teleopIntervalRef.current) {
      clearInterval(teleopIntervalRef.current);
      teleopIntervalRef.current = null;
    }
    activeTeleopCmdRef.current = null;
    setSlamActiveMotion('stop');
    sendMotion('stop');
  };

  const handleTeleop = (command) => {
    if (command === 'stop') {
      stopTeleop();
    } else {
      sendMotion(command);
    }
  };

  // Keyboard Teleop: W-A-S-D hoặc Phím Mũi Tên (giữ phím để xe chạy liên tục)
  useEffect(() => {
    if (activeView !== 'slam') return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['1', '2', '3', '+', '=', '-', '_'].includes(key)) {
        const presets = { '1': 50, '2': 75, '3': 100 };
        handleSlamSpeedChange(presets[key] ?? (slamSpeedRef.current + (key === '-' || key === '_' ? -10 : 10)));
        return;
      }
      let targetCmd = null;
      if (key === 'w'|| key === 'arrowup') targetCmd = 'forward';
      else if (key === 's'|| key === 'arrowdown') targetCmd = 'backward';
      else if (key === 'a'|| key === 'arrowleft') targetCmd = 'left';
      else if (key === 'd'|| key === 'arrowright') targetCmd = 'right';
      else if (key === ' '|| key === 'x') {
        stopTeleop();
        return;
      }

      if (targetCmd && activeTeleopCmdRef.current !== targetCmd) {
        startTeleop(targetCmd);
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        stopTeleop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (teleopIntervalRef.current) clearInterval(teleopIntervalRef.current);
    };
  }, [activeView]);

  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishGoal(targetX, targetY, 0);
      setNavNotification(rc("[NAV2] Published /goal_pose -> X: {0}m, Y: {1}m -> Navigating to destination!", [targetX.toFixed(2), targetY.toFixed(2)]));
    } else {
      setNavNotification(`[NAV GOAL SET] X: ${targetX.toFixed(2)}m, Y: ${targetY.toFixed(2)}m`);
      try {
        await fetch(`${PI5_API}/map/navigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ target_x: targetX, target_y: targetY }),
        });
      } catch (err) {
        console.error('Navigate command failed:', err);
      }
    }

    setTimeout(() => setNavNotification(''), 4500);
  };

  const handleEmergencyStop = async () => {
    if (teleopIntervalRef.current) clearInterval(teleopIntervalRef.current);
    teleopIntervalRef.current = null;
    activeTeleopCmdRef.current = null;
    setSlamActiveMotion('stop');
    setEmergencyStopVersion((version) => version + 1);
    // 1. Cập nhật state UI ngay lập tức
    setIsExploring(false);
    setActiveNavGoal(null);
    setTelemetry((prev) => ({
      ...prev,
      status: 'EMERGENCY_STOPPED',
      linearVelocity: 0,
      angularVelocity: 0,
    }));
    setNavNotification(rc("[EMERGENCY STOP] ALL MOTION AND MAPPING STOPPED. THE ROBOT IS STATIONARY."));

    // 2. Ngắt vận tốc ROS 2 (/cmd_vel = 0)
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(0, 0);
    }

    // 3. Dừng quét tự hành Frontier Exploration trên Pi 5
    try {
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST'});
    } catch (err) {
      console.warn('Lỗi dừng explore:', err);
    }

    // 4. Gửi tín hiệu dừng khẩn cấp / teleop stop tới Pi 5
    try {
      await fetch(`${PI5_API}/map/emergency_stop`, { method: 'POST'});
    } catch {
      fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ command: 'stop'}),
      }).catch(() => null);
    }

    // 5. Gửi UDP stop động cơ trực tiếp qua Backend operations port 9999
    try {
      await fetch('/api/v1/operations/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          command: 'stop',
          target_ip: PI5_IP,
          port: 9999,
        }),
      });
    } catch (err) {
      console.warn('Lỗi gửi lệnh dừng khẩn cấp tới động cơ:', err);
    }

    setTimeout(() => setNavNotification(''), 6000);
  };

  // ─── Frontier Exploration (SLAM Tu Hanh Quet Full Phong) ────────────────
  const handleStartExplore = async () => {
    try {
      setNavNotification(rc("Starting SLAM Frontier Exploration: the robot will navigate and scan the room..."));
      const res = await fetch(`${PI5_API}/map/explore/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ auto_save: exploreAutoSave, save_name: exploreSaveName }),
      });
      const data = await res.json();
      setIsExploring(true);
      setIsExploreModalOpen(false);
      setNavNotification(`${data.message || rc("The robot is moving autonomously to scan the entire room...")}`);
    } catch (err) {
      setNavNotification(rc("Could not start exploration: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 5000);
  };

  const handleStopExplore = async () => {
    try {
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST'});
      setIsExploring(false);
      publishCmdVel(0, 0);
      setNavNotification(rc("Automatic scanning stopped. The robot is stationary."));
    } catch (err) {
      setNavNotification(rc("Could not stop exploration: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 3500);
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
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(newWorkflow),
      });
      const data = await res.json();
      setNavNotification(rc("Workflow \"{0}\" saved (ID: {1})", [newWorkflow.name, data.id]));
      await loadWorkflows();
    } catch (err) {
      setNavNotification(rc("Could not save workflow: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleExecuteWorkflow = async (wid) => {
    try {
      const res = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/execute/${wid}`, { method: 'POST'});
      const data = await res.json();
      setIsWorkflowRunning(true);
      setNavNotification(`▶️ ${data.message}`);
      setIsWorkflowModalOpen(false);
    } catch (err) {
      setNavNotification(rc("Execution error: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleStopWorkflow = async () => {
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/stop`, { method: 'POST'});
      setIsWorkflowRunning(false);
      setNavNotification(rc("Workflow stopped."));
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleDeleteWorkflow = async (wid) => {
    if (!window.confirm(rc("Delete workflow \"{0}\"?", [wid]))) return;
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/${wid}`, { method: 'DELETE'});
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
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ map_name: overlayMapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setOverlayActive(true);
        setOverlayWaypoints(data.waypoints || []);
        setNavNotification(rc("Overlay map \"{0}\" loaded", [overlayMapName]));
        setIsOverlayModalOpen(false);
      } else {
        setNavNotification(`${data.message}`);
      }
    } catch (err) {
      setNavNotification(rc("Error: {0}", [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDisableOverlay = async () => {
    try {
      await fetch(`${PI5_API}/map/overlay/disable`, { method: 'POST'});
      setOverlayActive(false);
      setOverlayWaypoints([]);
      setNavNotification(rc("Overlay map disabled"));
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleGenerateOverlayTemplate = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/overlay/template?name=${overlayMapName}`);
      const data = await res.json();
      setNavNotification(`${data.message}`);
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const switchView = (view) => {
    if (view === activeView) return;
    if (activeTeleopCmdRef.current) stopTeleop();
    setActiveView(view);
  };

  const isRealHardwareActive = telemetry.source === 'REAL_RPLIDAR_HARDWARE';

  return (
    <div className="robot-control-page w-full h-full flex flex-col overflow-hidden font-sans select-none"style={{ background: '#F2EFE9', color: '#262626'}}>
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
                    <span className="text-[10px] text-red-500 font-normal"> {rc("Explored")} {exploredCount || 0} {rc("points")} </span>
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

      {/* Floating Toast Notification (Absolute - Never shifts workspace layout height) */}
      {navNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-md border flex items-center gap-2 text-xs font-bold font-mono pointer-events-auto backdrop-blur-xs"
          style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD', color: '#262626'}}>
          <Radio className="w-3.5 h-3.5 shrink-0 text-amber-600 animate-pulse"/>
          <span>{navNotification}</span>
          <button onClick={() => setNavNotification('')} className="ml-2 text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

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

      {/* MODAL: Lưu Bản Đồ SLAM LiDAR */}
      {isSaveMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between border-b pb-3"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-600"/>
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}> {rc("Save, Lock Map & Start Navigation")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveMapModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              > {rc("×")} </button>
            </div>

            <form onSubmit={handleSaveMap} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1"style={{ color: '#8C8C8C'}}> {rc("MAP NAME (UNIQUE IDENTIFIER)")} </label>
                <input
                  type="text"
                  required
                  value={saveMapName}
                  onChange={(e) => setSaveMapName(e.target.value)}
                  placeholder="VD: tang_1_sanh, phong_hop_a, phong_lab..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none font-mono"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
                />
              </div>

              <div className="p-3 rounded-lg border text-xs leading-relaxed"style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#555'}}>
                <span className="font-bold block text-stone-800 mb-1"> {rc("EXPORT FORMATS:")} </span>
                • <strong>JSON</strong> {rc(": Instant display in Web Admin.")} <br />
                • <strong>ROS 2 Nav2 (.yaml & .pgm)</strong> {rc(": Autonomous Navigation, Map Server & AMCL.")} <br />
                • <strong>PostgreSQL Database</strong> {rc(": Business metadata and waypoint structure.")} <br />
                • <strong> {rc("Computer Downloads")} </strong> {rc(": Automatically package the")} <code>.zip</code> {rc("file and download it to your computer.")} </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] text-blue-800 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600 shrink-0"/>
                <span> {rc("Save the live ROS 2 map, lock it, switch to")} <strong> {rc("static-map Navigation")} </strong> {rc("and download the ZIP.")} </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
                <button
                  type="button"
                  onClick={() => setIsSaveMapModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
                > {rc("Cancel")} </button>
                <button
                  type="submit"
                  disabled={isSavingMap}
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF'}}
                >
                  <Save className="w-3.5 h-3.5"/>
                  <span>{isSavingMap ? rc("Saving & switching mode..."): rc("Save & Start Navigation")}</span>
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
            className="max-w-2xl w-full rounded-2xl border p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between border-b pb-3 shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-600"/>
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}> {rc("Saved Maps on Robot")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              > {rc("×")} </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {savedMapsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500 font-mono"> {rc("No saved maps yet.")} <br /> {rc("Scan the room and select \"SAVE MAP\" to save your first map.")} </div>
              ) : (
                savedMapsList.map((mapItem) => (
                  <div
                    key={mapItem.name}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 hover:bg-stone-50 transition-all"
                    style={{ borderColor: '#E3DFD5', backgroundColor: '#FAF8F5'}}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-stone-600"/>
                        <span className="font-bold text-xs text-stone-900 font-mono">{mapItem.name}</span>
                        {mapItem.has_ros2_yaml && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                            ROS 2 YAML/PGM
                          </span>
                        )}
                        {mapItem.in_database && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold border border-blue-300">
                            PostgreSQL DB
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        {mapItem.created_at || rc("Time: N/A")} • {mapItem.width}x{mapItem.height} ({mapItem.resolution}m/px)
                      </div>
                      {mapItem.statistics && (
                        <div className="text-[10px] text-stone-600"> {rc("Obstacles:")} <strong>{mapItem.statistics.occupied_cells}</strong> {rc("cells | Free:")} <strong>{mapItem.statistics.free_cells}</strong> {rc("cells")} </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerMapDownload(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 cursor-pointer shadow-xs flex items-center gap-1 transition-all"
                        title={rc("Download map package (.zip containing .yaml + .pgm) to Downloads")}
                      >
                        <Download className="w-3 h-3 text-blue-600"/>
                        <span> {rc("Download")} </span>
                      </button>
                      <button
                        onClick={() => handleLoadSavedMap(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white hover:bg-stone-100 text-stone-800 cursor-pointer shadow-xs"
                        style={{ borderColor: '#BFBFBD'}}
                        title={rc("Load this map into SLAM")}
                      > {rc("Load Map")} </button>
                      <button
                        onClick={() => handleDeleteSavedMap(mapItem.name)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title={rc("Delete this map")}
                      >
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsSavedMapsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
              > {rc("Close")} </button>
            </div>
          </div>
        </div>
      )}

      {/* Frontier Exploration Modal */}
      {isExploreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Scan Entire Room (Autonomous SLAM)")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2.5">
              <p> {rc("The robot combines")} <strong>ROS 2 SLAM Toolbox</strong> {rc("with the algorithm")} <strong>Frontier Exploration</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-700">
                <li> {rc("Automatically identify reachable frontiers of unexplored space.")} </li>
                <li> {rc("Navigate to room corners and corridors to extend the map.")} </li>
                <li> {rc("Avoid obstacles in real time using 360° LiDAR A1 and ultrasonic sensors.")} </li>
                <li> {rc("Extend the live SLAM map in Foxglove until the room is covered.")} </li>
              </ul>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]"> {rc("Ensure the floor has no steep steps or holes. You can select \"STOP EXPLORATION\" at any time.")} </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1"> {rc("Map name to save")} </label>
                <input
                  type="text"
                  value={exploreSaveName}
                  onChange={(e) => setExploreSaveName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs bg-white text-stone-800 outline-none focus:border-emerald-500"
                  style={{ borderColor: '#BFBFBD'}}
                  placeholder="auto_explored_map"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={exploreAutoSave}
                  onChange={(e) => setExploreAutoSave(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span> {rc("Automatically save the map when the full scan completes")} </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD'}}
              > {rc("Cancel")} </button>
              <button
                type="button"
                onClick={handleStartExplore}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5"/>
                <span> {rc("Start Full Room Scan")} </span>
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
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Automatic Workflow Manager")} </h3>
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
              <div className="flex flex-col gap-2 border-r pr-3"style={{ borderColor: '#E5E4E2'}}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide"> {rc("Saved workflows (")} {workflowList.length})</span>
                  <button
                    onClick={loadWorkflows}
                    className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3"/> {rc("Refresh")} </button>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
                  {workflowList.length === 0 ? (
                    <div className="text-xs text-stone-400 italic text-center py-8"> {rc("No workflows yet")} </div>
                  ) : (
                    workflowList.map((wf) => (
                      <div
                        key={wf.id}
                        className="p-3 bg-white rounded-lg border flex flex-col gap-2 shadow-xs"
                        style={{ borderColor: '#BFBFBD'}}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-stone-800">{wf.name}</div>
                            {wf.description && <div className="text-[10px] text-stone-500">{wf.description}</div>}
                            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
                              {wf.steps?.length || 0} {rc("steps")} </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleExecuteWorkflow(wf.id)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              title={rc("Run workflow")}
                            > {rc("▶ Run")} </button>
                            <button
                              onClick={() => handleDeleteWorkflow(wf.id)}
                              className="p-1 text-red-500 hover:text-red-700 rounded text-[10px] cursor-pointer"
                              title={rc("Delete workflow")}
                            >
                              <Trash2 className="w-3.5 h-3.5"/>
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
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wide"> {rc("Create Workflow")} </span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600"> {rc("Workflow name")} </label>
                    <input
                      type="text"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border text-xs bg-white text-stone-800"
                      style={{ borderColor: '#BFBFBD'}}
                      placeholder={rc("E.g. Main lobby patrol")}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-stone-600"> {rc("Workflow steps")} </label>
                      <button
                        type="button"
                        onClick={() =>
                          setNewWorkflow({
                            ...newWorkflow,
                            steps: [
                              ...newWorkflow.steps,
                              { name: rc("Step {0}", [newWorkflow.steps.length + 1]), action: 'navigate', x: 0, y: 0, timeout: 30 },
                            ],
                          })
                        }
                        className="text-[10px] text-purple-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3"/> {rc("Add step")} </button>
                    </div>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {newWorkflow.steps.map((st, idx) => (
                        <div key={idx} className="p-2 bg-white rounded border text-xs space-y-1"style={{ borderColor: '#E5E4E2'}}>
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
                              placeholder={rc("Step name")}
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

                          {st.action === 'navigate'&& (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>X (m): <input type="number"step="0.1"value={st.x ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].x = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/></div>
                              <div>Y (m): <input type="number"step="0.1"value={st.y ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].y = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/></div>
                            </div>
                          )}

                          {st.action === 'wait'&& (
                            <div className="text-[10px]"> {rc("Wait (seconds):")} <input type="number"value={st.wait_sec ?? 3} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].wait_sec = parseInt(e.target.value) || 3;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/>
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
                    <Save className="w-3.5 h-3.5"/>
                    <span> {rc("Save New Workflow")} </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD'}}
              > {rc("Close")} </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Map Modal */}
      {isOverlayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Static Map Overlay")} </h3>
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
              <p> {rc("Overlay the designed floor plan (permanent walls, restricted zones and departments) on the LiDAR SLAM grid.")} </p>
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px]">
                ️ <strong> {rc("How it works:")} </strong> {rc("Overlay walls are treated as solid obstacles (100%), ensuring A* navigation never routes through them.")} </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1"> {rc("Overlay map filename")} </label>
                <input
                  type="text"
                  value={overlayMapName}
                  onChange={(e) => setOverlayMapName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs bg-white text-stone-800 outline-none focus:border-teal-500"
                  style={{ borderColor: '#BFBFBD'}}
                  placeholder="floor_plan_overlay"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded border text-xs"style={{ borderColor: '#BFBFBD'}}>
                <span className="font-semibold text-stone-700"> {rc("Status:")} </span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${overlayActive ? 'bg-teal-100 text-teal-800': 'bg-stone-100 text-stone-600'}`}>
                  {overlayActive ? rc("ACTIVE"): rc("INACTIVE")}
                </span>
              </div>

              {overlayWaypoints.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-semibold"> {rc("Overlay waypoints:")} </span>
                  <div className="mt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {overlayWaypoints.map((wp, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-[10px] font-medium">
                         {wp.name} ({wp.x}, {wp.y})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={handleGenerateOverlayTemplate}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100 flex items-center gap-1"
                  style={{ borderColor: '#BFBFBD'}}
                  title={rc("Create a sample JSON file on Pi 5")}
                >
                  <FileText className="w-3.5 h-3.5 text-stone-500"/>
                  <span> {rc("Create JSON Template")} </span>
                </button>

                {overlayActive ? (
                  <button
                    type="button"
                    onClick={handleDisableOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-red-600 hover:bg-red-700 text-white"
                  > {rc("Disable Overlay")} </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoadOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5"/>
                    <span> {rc("Load Map Overlay")} </span>
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
