import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Rviz2WebViewer } from '../../components/admin/Rviz2WebViewer';
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

export const AdminLidarPage = ({ onSwitchToCamera }) => {
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
    battery: 98,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
    status: 'WAITING_FOR_ROS2_CONNECTION',
    source: 'ROS2_SLAM_NAV2',
  });

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
    name: 'Tuần tra tầng 1',
    description: '',
    steps: [
      { name: 'Điểm A', action: 'navigate', x: 1.0, y: 0.0, timeout: 45 },
      { name: 'Dừng chờ', action: 'wait', wait_sec: 3 },
      { name: 'Về gốc', action: 'return_home'},
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
  const mapHasContent = mapStats.occupied >= 10 && mapStats.free >= 100;
  const mappingReadyToSave = mapMode === 'MAPPING'
    && isWsConnected
    && lidarLive
    && hasLiveRosMap
    && mapHasContent;

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

  const handleSelectMap = async (mapId) => {
    try {
      setSelectedMapId(mapId);
      setNavNotification(`Đang nạp bản đồ: ${mapId}...`);
      await loadSavedLidarMap(mapId);
      const curr = await fetchCurrentMap();
      if (curr?.grid_data) {
        setGridData(curr.grid_data);
        if (curr.metadata) setGridMetadata(curr.metadata);
        setNavNotification(`Đã nạp thành công bản đồ: ${mapId}`);
      }
    } catch (err) {
      setNavNotification(`Lỗi nạp bản đồ: ${err.message}`);
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
        setNavNotification(`[ROS 2] Rosbridge đã kết nối (${rosbridgeUrl}); đang chờ dữ liệu LiDAR thật...`);
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

    // 6. Subscribe 2D Goal Pose (/goal_pose) tu RViz2 hoac Nav2
    const unsubGoal = client.subscribe(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED, (msg) => {
      const pos = msg.pose?.position;
      if (pos) {
        const gx = Number(pos.x.toFixed(2));
        const gy = Number(pos.y.toFixed(2));
        setActiveNavGoal({ x: gx, y: gy });
        setNavNotification(`[NAV2] Đã nhận mục tiêu từ RViz2: X=${gx}m, Y=${gy}m -> Robot đang tự hành tới đích!`);
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
    setNavNotification(`Đang kết nối lại ROS 2 Rosbridge (${rosbridgeUrl})...`);
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
        if (statusData?.rosbridge_online && statusData?.rviz_online && statusData?.mode === expectedMode) {
          return statusData;
        }
      } catch {
        // WSL2/ROS 2 đang khởi động; tiếp tục chờ.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error('ROS 2/RViz khởi động quá thời gian chờ. Hãy kiểm tra log backend.');
  }, []);

  const handleStartMappingFromWeb = useCallback(async () => {
    if (isRos2RuntimeBusy) return;
    setIsRos2RuntimeBusy(true);
    setNavNotification('Đang bật WSL2 + Slam Toolbox + RViz Web để quét map...');
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
        throw new Error(lidarResult?.message || 'Pi đã mở cổng nhưng RPLiDAR không phát dữ liệu scan.');
      }
      await startRos2Mapping();
      await waitForRos2Runtime('MAPPING');
      setMapMode('MAPPING');
      setIsMapLocked(false);
      rosClientRef.current?.connect();
      setNavNotification('MAPPING đã bật. Chỉ lưu khi LiDAR LIVE và ODOM ĐÃ DI CHUYỂN đều chuyển xanh.');
    } catch (err) {
      setNavNotification(`Không bật được chế độ quét map: ${err.message}`);
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
    setNavNotification(`Đang nạp static map "${mapName}" và khởi động AMCL + Nav2...`);
    try {
      await startRos2Navigation(mapName);
      await waitForRos2Runtime('NAVIGATION');
      setSelectedMapId(mapName);
      setMapMode('NAVIGATION');
      setIsMapLocked(true);
      rosClientRef.current?.connect();
      setNavNotification(`NAVIGATION đã sẵn sàng với map tĩnh "${mapName}".`);
    } catch (err) {
      setNavNotification(`Không bật được Navigation: ${err.message}`);
    } finally {
      setIsRos2RuntimeBusy(false);
      setTimeout(() => setNavNotification(''), 7000);
    }
  }, [isRos2RuntimeBusy, selectedMapId, waitForRos2Runtime]);

  // Reset SLAM grid map (Xóa sạch bản đồ trên RViz & SLAM Toolbox)
  const handleResetGridMap = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sạch bản đồ SLAM hiện tại và đưa robot về tọa độ gốc (0, 0) để bắt đầu quét lại từ đầu?')) {
      return;
    }

    try {
      setNavNotification('Đang xóa sạch bản đồ SLAM Toolbox & đưa Robot về gốc...');

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

      setNavNotification('Bản đồ SLAM đã được xóa sạch. Robot đã về (0,0) sẵn sàng quét mới.');
    } catch (err) {
      console.error('Reset map error:', err);
      setNavNotification(`Lỗi khi xóa bản đồ: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4500);
  };

  // Khóa bản đồ gốc / Tiếp tục quét
  const handleToggleLockMap = () => {
    try {
      if (mapMode === 'NAVIGATION') {
        setNavNotification('Đang ở NAVIGATION: bản đồ đã lưu là read-only. Muốn quét lại, hãy chạy quet_map_mot_lan.bat.');
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
            ? 'Đã khóa bản đồ gốc: Chỉ giữ 1 map cố định, không đè thêm tường!'
            : 'Đã mở khóa: Tiếp tục quét cập nhật bản đồ.'
        );
      } else {
        setNavNotification('Chưa kết nối tới Rosbridge 9090!');
      }
    } catch (err) {
      setNavNotification(`Lỗi khi khóa/mở bản đồ: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleScan360 = async () => {
    setNavNotification('Bắt đầu xoay 360 độ quét toàn cảnh các bức tường phòng...');
    try {
      await fetch(`${PI5_API}/map/scan_360`, { method: 'POST'});
    } catch (err) {
      console.error('Lỗi quét 360:', err);
    }
  };

  const handleOpenSaveMapModal = () => {
    if (!mappingReadyToSave) {
      const reasons = [];
      if (!isWsConnected) reasons.push('Rosbridge chưa kết nối');
      if (!lidarLive) reasons.push('LiDAR chưa có scan thật');
      if (!hasLiveRosMap) reasons.push('SLAM chưa phát map mới trong phiên quét này');
      if (!mapHasContent) reasons.push('map chưa đủ ô tường và vùng trống');
      setNavNotification(`Chưa thể lưu map: ${reasons.join('; ')}.`);
      setTimeout(() => setNavNotification(''), 6000);
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
    const trimmedName = saveMapName.trim();
    if (!trimmedName) return;
    setIsSavingMap(true);
    setNavNotification(`Đang lưu map ROS 2 "${trimmedName}" ra YAML/PGM...`);

    try {
      // 1. Backend laptop gọi map_saver_cli và chỉ trả SUCCESS khi YAML/PGM đã tồn tại.
      await saveRos2Map(trimmedName);

      // 2. Lưu thêm snapshot JSON phía Pi 5 để Web Admin/Pi dùng lại; lỗi Pi không làm mất map ROS 2.
      await fetch(`${PI5_API}/map/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name: trimmedName }),
      }).catch(() => null);

      setSelectedMapId(trimmedName);
      setIsMapLocked(true);
      setMapMode('PAUSED');
      setNavNotification(`Đã lưu "${trimmedName}". Đang chuyển sang Navigation map tĩnh...`);

      // 3. Kết thúc mapping và tự nạp đúng map vừa lưu bằng Map Server + AMCL + Nav2.
      await startRos2Navigation(trimmedName);
      await waitForRos2Runtime('NAVIGATION');
      setMapMode('NAVIGATION');
      rosClientRef.current?.connect();

      // 4. Tải gói map sau khi file thật đã được tạo xong.
      await triggerMapDownload(trimmedName);
      const listData = await listSavedMaps().catch(() => null);
      if (listData?.maps) setSavedMapsList(listData.maps);
      setNavNotification(`Đã lưu & khóa "${trimmedName}", Navigation đã chạy và gói ZIP đã được tải.`);
      setIsSaveMapModalOpen(false);
    } catch (err) {
      setNavNotification(`Lưu map thất bại: ${err.message}`);
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
            floor: m.floor || 'Sảnh Tầng 1',
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
    setNavNotification(`Đang nạp bản đồ "${mapName}"...`);
    try {
      const res = await fetch(`${PI5_API}/map/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name: mapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(`Đã nạp bản đồ "${mapName}"vào hệ thống.`);
        setIsSavedMapsModalOpen(false);
      } else {
        setNavNotification(`Lỗi nạp bản đồ: ${data.message}`);
      }
    } catch (err) {
      setNavNotification(`Lỗi kết nối: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDeleteSavedMap = async (mapName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa file bản đồ "${mapName}"?`)) return;
    try {
      await fetch(`/api/v1/map/saved/${encodeURIComponent(mapName)}`, { method: 'DELETE'}).catch(() => null);
      await fetch(`${PI5_API}/map/saved/${mapName}`, { method: 'DELETE'}).catch(() => null);
      setSavedMapsList((prev) => prev.filter((m) => m.name !== mapName));
      setNavNotification(`Đã xóa file bản đồ "${mapName}"`);
    } catch (err) {
      setNavNotification(`Lỗi khi xóa: ${err.message}`);
    }
  };

  const teleopIntervalRef = useRef(null);
  const activeTeleopCmdRef = useRef(null);

  const sendMotion = (command) => {
    let lin = 0.0;
    let ang = 0.0;
    if (command === 'forward') lin = 0.12;
    else if (command === 'backward') lin = -0.12;
    else if (command === 'left') ang = 0.4;
    else if (command === 'right') ang = -0.4;

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(lin, ang);
    }
    fetch(`${PI5_API}/map/teleop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ command, speed: 25 }),
    }).catch(() => {});
  };

  const startTeleop = (command) => {
    if (teleopIntervalRef.current) {
      clearInterval(teleopIntervalRef.current);
    }
    activeTeleopCmdRef.current = command;
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
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      let targetCmd = null;
      if (key === 'w'|| key === 'arrowup') targetCmd = 'forward';
      else if (key === 's'|| key === 'arrowdown') targetCmd = 'backward';
      else if (key === 'a'|| key === 'arrowleft') targetCmd = 'left';
      else if (key === 'd'|| key === 'arrowright') targetCmd = 'right';
      else if (key === ''|| key === 'x') {
        stopTeleop();
        return;
      }

      if (targetCmd && activeTeleopCmdRef.current !== targetCmd) {
        startTeleop(targetCmd);
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
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
  }, []);

  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishGoal(targetX, targetY, 0);
      setNavNotification(`[NAV2] Đã phát mục tiêu /goal_pose -> X: ${targetX.toFixed(2)}m, Y: ${targetY.toFixed(2)}m -> Robot đang tự hành tới đích!`);
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
    // 1. Cập nhật state UI ngay lập tức
    setIsExploring(false);
    setActiveNavGoal(null);
    setTelemetry((prev) => ({
      ...prev,
      status: 'EMERGENCY_STOPPED',
      linearVelocity: 0,
      angularVelocity: 0,
    }));
    setNavNotification('[DỪNG KHẨN CẤP] ĐÃ NGẮT TOÀN BỘ CHUYỂN ĐỘNG & QUÉT MAP! ROBOT ĐỨNG YÊN AN TOÀN.');

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
      setNavNotification('Bắt đầu SLAM Frontier Exploration: Robot tự hành tìm đường và quét full phòng...');
      const res = await fetch(`${PI5_API}/map/explore/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ auto_save: exploreAutoSave, save_name: exploreSaveName }),
      });
      const data = await res.json();
      setIsExploring(true);
      setIsExploreModalOpen(false);
      setNavNotification(`${data.message || 'Robot đang tự động di chuyển quét full toàn bộ phòng...'}`);
    } catch (err) {
      setNavNotification(`Lỗi khởi động tự hành: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 5000);
  };

  const handleStopExplore = async () => {
    try {
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST'});
      setIsExploring(false);
      publishCmdVel(0, 0);
      setNavNotification('Đã dừng quét tự động. Robot đang đứng yên an toàn.');
    } catch (err) {
      setNavNotification(`Lỗi dừng khám phá: ${err.message}`);
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
      setNavNotification(`Đã lưu workflow "${newWorkflow.name}"(ID: ${data.id})`);
      await loadWorkflows();
    } catch (err) {
      setNavNotification(`Lỗi lưu workflow: ${err.message}`);
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
      setNavNotification(`Lỗi thực thi: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleStopWorkflow = async () => {
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/stop`, { method: 'POST'});
      setIsWorkflowRunning(false);
      setNavNotification('Đã dừng workflow.');
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleDeleteWorkflow = async (wid) => {
    if (!window.confirm(`Xóa workflow "${wid}"?`)) return;
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
        setNavNotification(`Đã nạp overlay map "${overlayMapName}"`);
        setIsOverlayModalOpen(false);
      } else {
        setNavNotification(`${data.message}`);
      }
    } catch (err) {
      setNavNotification(`Lỗi: ${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDisableOverlay = async () => {
    try {
      await fetch(`${PI5_API}/map/overlay/disable`, { method: 'POST'});
      setOverlayActive(false);
      setOverlayWaypoints([]);
      setNavNotification('Đã tắt overlay map');
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

  const isRealHardwareActive = telemetry.source === 'REAL_RPLIDAR_HARDWARE';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden font-sans select-none"style={{ background: '#F2EFE9', color: '#262626'}}>
      {/* Status Banner — Dedicated ROS 2 & VNC Connection */}
      <div className="w-full border-b px-6 py-2 flex items-center justify-between text-xs font-mono"
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
              {lidarLive ? `LIDAR LIVE: ${scanPoints.length} PTS` : 'LIDAR: KHÔNG CÓ SCAN'}
            </span>
          )}

          {isWsConnected && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold hidden sm:inline-block ${
              odometryMotionSeen
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {odometryMotionSeen ? 'ODOM: ĐÃ DI CHUYỂN' : 'ODOM: ROBOT ĐỨNG YÊN'}
            </span>
          )}

          <span style={{ color: '#8C8C8C'}}>MAP {hasLiveRosMap ? 'LIVE' : 'CHƯA LIVE'}: <strong style={{ color: '#262626'}}>{mapStats.known} ô</strong></span>
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
                ? 'Navigation đang dùng bản đồ tĩnh đã lưu. LaserScan chỉ phục vụ định vị và tránh vật cản.'
                : isMapLocked
                ? 'Bản đồ đang ĐƯỢC KHÓA (chỉ giữ 1 map gốc, dừng nhận quét mới). Bấm để tiếp tục quét.'
                : 'Bấm để KHÓA BẢN ĐỒ GỐC (ngăn SLAM vẽ đè thêm tường khi di chuyển)'
            }
          >
            {isMapLocked ? (
              <Lock className="w-3.5 h-3.5 text-white" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-stone-600" />
            )}
            <span>
              {mapMode === 'NAVIGATION'
                ? 'NAVIGATION • MAP TĨNH'
                : isMapLocked
                  ? 'MAPPING ĐANG TẠM DỪNG'
                  : 'MAPPING • ĐANG QUÉT'}
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
            title="DỪNG KHẨN CẤP: Ngắt toàn bộ chuyển động bánh xe và dừng tự hành ngay lập tức"
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
            title="Menu lệnh điều khiển và thao tác bản đồ"
          >
            <Menu className="w-3.5 h-3.5 text-stone-700"/>
            <span>LỆNH ĐIỀU KHIỂN</span>
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
                  <span>1. Bắt Đầu Quét Map</span>
                  <span className="text-[10px] text-stone-500 font-normal">Tự bật WSL2, Slam Toolbox và RViz Web</span>
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
                  <span>3. Chạy Navigation</span>
                  <span className="text-[10px] text-stone-500 font-normal">Nạp map tĩnh: {selectedMapId || 'chưa chọn'}</span>
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
                    <span>Dừng Quét Tự Hành</span>
                    <span className="text-[10px] text-red-500 font-normal">Đã khám phá {exploredCount || 0} điểm</span>
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
                    <span>Quét Full Phòng (SLAM)</span>
                    <span className="text-[10px] text-stone-500 font-normal">Robot tự hành tìm đường quét phòng</span>
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
                  <span className="font-bold">{isMapLocked ? 'Mở Khóa Quét Map' : 'Khóa Bản Đồ Gốc'}</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    {isMapLocked ? 'Tiếp tục nhận quét mở rộng bản đồ' : 'Chỉ giữ 1 bản đồ gốc, không đè thêm tường'}
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
                  <span className="font-bold">2. Lưu, Khóa & Chạy Nav</span>
                  <span className="text-[10px] text-stone-500 font-normal">Lưu YAML/PGM, khóa map và tự chuyển Navigation</span>
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
                  <span className="font-bold">Kho Bản Đồ Đã Lưu</span>
                  <span className="text-[10px] text-stone-500 font-normal">Xem và nạp các bản đồ đã lưu</span>
                </div>
              </button>

              {/* Nạp nhanh bản đồ nếu có trong danh sách */}
              {savedMapsList.length > 0 && (
                <div className="px-3 py-1.5 bg-stone-100/70 border-y border-stone-200 flex flex-col gap-1 text-[11px] my-1">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Chọn bản đồ nạp nhanh:</span>
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
                  <span className="font-bold">Xóa Bản Đồ (Reset)</span>
                  <span className="text-[10px] text-stone-500 font-normal">Xóa lưới SLAM và đưa robot về (0,0)</span>
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
                  <span className="font-bold">Kết Nối Lại</span>
                  <span className="text-[10px] text-stone-500 font-normal">Thử kết nối lại Rosbridge 9090</span>
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

      {/* 2. Main Workspace */}
      <main className="w-full flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column: Dedicated Native RViz2 3D SLAM Stream (8 Cols) */}
        <div className="col-span-8 flex flex-col gap-3 h-full overflow-hidden">
          <div className="shrink-0 rounded-xl border border-stone-300 bg-white px-3 py-2 flex items-center gap-2 text-[11px] shadow-sm">
            <button
              type="button"
              disabled={isRos2RuntimeBusy}
              onClick={handleStartMappingFromWeb}
              className="px-3 py-1.5 rounded-lg border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5"/>
              <span>1. QUÉT MAP</span>
            </button>
            <button
              type="button"
              disabled={isRos2RuntimeBusy || !mappingReadyToSave}
              onClick={handleOpenSaveMapModal}
              className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
              title={mappingReadyToSave
                ? 'Lưu bản đồ đã quét và chuyển sang Navigation'
                : 'Cần LiDAR live và map ROS 2 có dữ liệu hợp lệ; quét tĩnh không bắt buộc encoder thay đổi'}
            >
              <Save className="w-3.5 h-3.5"/>
              <span>2. LƯU & KHÓA</span>
            </button>
            <select
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
              className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-700 font-semibold outline-none"
              title="Bản đồ dùng cho Navigation"
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
          {mapMode === 'MAPPING' && !mappingReadyToSave && (
            <div className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 font-semibold">
              Chưa thể lưu: {!lidarLive
                ? 'Pi/RPLiDAR chưa phát scan thật.'
                : !hasLiveRosMap
                    ? ' SLAM chưa phát map mới trong phiên quét này.'
                    : !mapHasContent
                    ? ' Bản đồ chưa có đủ tường và vùng trống.'
                    : ' Đang chờ dữ liệu.'}
            </div>
          )}
          {mapMode === 'MAPPING' && lidarLive && !odometryMotionSeen && (
            <div className="shrink-0 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-[11px] text-orange-900 font-semibold">
              LiDAR đang quét tĩnh. Muốn mở rộng bản đồ khi robot chạy, encoder phải phát tick chuyển động;
              nếu robot đã chạy mà cảnh báo này vẫn còn thì dừng quét và kiểm tra encoder/odometry trước khi lưu.
            </div>
          )}
          <div className="w-full flex-1 relative overflow-hidden">
            <Rviz2WebViewer
              activeMapName={selectedMapId}
              isRuntimeBusy={isRos2RuntimeBusy}
              onStartMapping={handleStartMappingFromWeb}
              onStartNavigation={() => handleStartNavigationFromWeb()}
            />
            {/* Floating Status HUD khi dang tu hanh quet full phong */}
            {isExploring && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-stone-900/90 border border-emerald-500/60 rounded-full shadow-2xl backdrop-blur-md text-white text-xs font-semibold pointer-events-auto">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"/>
                <span className="text-emerald-400 font-mono font-bold">SLAM TỰ HÀNH:</span>
                <span>Robot đang tự di chuyển quét full phòng...</span>
                {exploredCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/40 text-[10px] text-emerald-200 font-mono">
                    {exploredCount} vị trí
                  </span>
                )}
                <button
                  onClick={handleEmergencyStop}
                  className="ml-1.5 px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] cursor-pointer transition-colors shadow-md flex items-center gap-1 animate-pulse"
                  title="Dừng khẩn cấp toàn bộ tự hành và động cơ"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-white"/>
                  <span>Dừng Khẩn Cấp</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Telemetry, Encoders & Controls (4 Cols) */}
        <div className="col-span-4 flex flex-col gap-3 h-full overflow-y-auto pr-1">

          {/* Card 2: Telemetry & Odometry (Thiết kế tinh gọn, dễ theo dõi) */}
          <div className="border rounded-xl p-3 flex flex-col gap-2"style={{ background: '#FFFFFF', borderColor: '#BFBFBD'}}>
            <div className="flex items-center justify-between border-b pb-1.5"style={{ borderColor: '#BFBFBD'}}>
              <span className="text-[9px] font-bold tracking-widest uppercase text-stone-500">TELEMETRY & ODOMETRY</span>
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
                  <ShieldAlert className="w-3 h-3 text-amber-600"/>
                  KHOẢNG CÁCH VẬT CẢN (LiDAR)
                </span>
                <span className={`font-bold px-1 rounded text-[7.5px] ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-100 text-red-700 animate-pulse': 'bg-emerald-100 text-emerald-800'}`}>
                  {safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'NGUY HIỂM (<35cm)': 'AN TOÀN'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center font-mono">
                <div className={`py-0.5 rounded border ${safetyInfo.front_cm && safetyInfo.front_cm < 35 ? 'bg-red-50 border-red-300 text-red-700 font-bold': 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[7px] text-stone-500 font-sans">TRƯỚC</div>
                  <div className="font-bold">{safetyInfo.front_cm !== null && safetyInfo.front_cm !== undefined ? `${safetyInfo.front_cm}cm`: '---'}</div>
                </div>
                <div className={`py-0.5 rounded border ${safetyInfo.rear_cm && safetyInfo.rear_cm < 30 ? 'bg-red-50 border-red-300 text-red-700 font-bold': 'bg-white border-stone-200 text-stone-800'}`}>
                  <div className="text-[7px] text-stone-500 font-sans">SAU</div>
                  <div className="font-bold">{safetyInfo.rear_cm !== null && safetyInfo.rear_cm !== undefined ? `${safetyInfo.rear_cm}cm`: '---'}</div>
                </div>
                <div className="py-0.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[7px] text-stone-500 font-sans">TRÁI</div>
                  <div className="font-bold">{safetyInfo.left_cm !== null && safetyInfo.left_cm !== undefined ? `${safetyInfo.left_cm}cm`: '---'}</div>
                </div>
                <div className="py-0.5 rounded border bg-white border-stone-200 text-stone-800">
                  <div className="text-[7px] text-stone-500 font-sans">PHẢI</div>
                  <div className="font-bold">{safetyInfo.right_cm !== null && safetyInfo.right_cm !== undefined ? `${safetyInfo.right_cm}cm`: '---'}</div>
                </div>
              </div>
            </div>

            {/* 4-Wheel Encoder Telemetry (ESP32 JGA25-370) - Thu nhỏ */}
            <div className="p-1.5 rounded-lg border flex flex-col gap-1 bg-[#FAF8F5] border-stone-200">
              <div className="flex items-center justify-between text-[8.5px]">
                <span className="font-bold tracking-wider uppercase text-stone-700 font-sans">
                  4 BÁNH ENCODER (ESP32)
                </span>
                <span className="font-mono font-bold px-1 rounded border bg-stone-100 border-stone-300 text-stone-600 text-[7.5px]">
                  CPR 330
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">M1 (T-TRƯỚC):</span>
                  <span className="font-bold text-stone-900">{encoders.m1?.rpm || 0} RPM · {encoders.m1?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">M3 (P-TRƯỚC):</span>
                  <span className="font-bold text-stone-900">{encoders.m3?.rpm || 0} RPM · {encoders.m3?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">M2 (T-SAU):</span>
                  <span className="font-bold text-stone-900">{encoders.m2?.rpm || 0} RPM · {encoders.m2?.ticks || 0} tick</span>
                </div>
                <div className="px-1.5 py-0.5 rounded border bg-white border-stone-200 flex justify-between items-center">
                  <span className="text-stone-500 font-sans">M4 (P-SAU):</span>
                  <span className="font-bold text-stone-900">{encoders.m4?.rpm || 0} RPM · {encoders.m4?.ticks || 0} tick</span>
                </div>
              </div>
            </div>

            {/* Battery - Gọn thanh ngang */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[8.5px] font-bold text-stone-500 tracking-wider font-sans">PIN:</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-stone-200">
                <div className="h-full transition-all duration-300 bg-stone-800"style={{ width: `${telemetry.battery}%`}} />
              </div>
              <span className="text-[9px] font-mono font-bold text-stone-800">{telemetry.battery}%</span>
            </div>
          </div>

          {/* Card 3: Emergency & Teleop */}
          <div className="border rounded-xl p-4 flex flex-col gap-3"style={{ background: '#FFFFFF', borderColor: '#BFBFBD'}}>
            <div className="flex items-center justify-between border-b pb-2"style={{ borderColor: '#BFBFBD'}}>
              <span className="text-[10px] font-bold tracking-widest uppercase"style={{ color: '#8C8C8C'}}>EMERGENCY & TELEOP</span>
              {activeNavGoal && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border animate-pulse"
                  style={{ background: '#262626', color: '#FFFFFF', borderColor: '#262626'}}>NAVIGATING</span>
              )}
            </div>

            {activeNavGoal ? (
              <div className="p-3 rounded-lg border text-xs"style={{ background: '#F2EFE9', borderColor: '#BFBFBD'}}>
                <div className="text-[9px] font-bold tracking-wider mb-1"style={{ color: '#8C8C8C'}}>NAV GOAL ACTIVE</div>
                <div className="font-mono font-bold"style={{ color: '#262626'}}>
                  X: {activeNavGoal.x.toFixed(2)}m — Y: {activeNavGoal.y.toFixed(2)}m
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border text-xs font-mono"style={{ background: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C'}}>
                Click on the SLAM map to set a navigation goal.
              </div>
            )}

            {/* Manual WASD D-Pad Teleop */}
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-[#FAF8F5]"style={{ borderColor: '#BFBFBD'}}>
              <span className="text-[10px] font-bold text-stone-600">LÁI THỦ CÔNG ĐỂ QUÉT PHÒNG (W-A-S-D)</span>
              <div className="flex flex-col items-center gap-1">
                <button
                  onMouseDown={() => startTeleop('forward')}
                  onMouseUp={stopTeleop}
                  onMouseLeave={stopTeleop}
                  onTouchStart={(e) => { e.preventDefault(); startTeleop('forward'); }}
                  onTouchEnd={stopTeleop}
                  className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                  title="Tiến (W)"
                >
                  <ChevronUp className="w-4 h-4"/>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onMouseDown={() => startTeleop('left')}
                    onMouseUp={stopTeleop}
                    onMouseLeave={stopTeleop}
                    onTouchStart={(e) => { e.preventDefault(); startTeleop('left'); }}
                    onTouchEnd={stopTeleop}
                    className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                    title="Rẽ Trái (A)"
                  >
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                  <button
                    onClick={stopTeleop}
                    className="px-2 py-1.5 rounded-lg border bg-stone-200 text-[10px] font-bold shadow-sm hover:bg-stone-300 active:scale-95 cursor-pointer text-stone-800"
                    title="Dừng (Space/X)"
                  >
                    STOP
                  </button>
                  <button
                    onMouseDown={() => startTeleop('right')}
                    onMouseUp={stopTeleop}
                    onMouseLeave={stopTeleop}
                    onTouchStart={(e) => { e.preventDefault(); startTeleop('right'); }}
                    onTouchEnd={stopTeleop}
                    className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                    title="Rẽ Phải (D)"
                  >
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
                <button
                  onMouseDown={() => startTeleop('backward')}
                  onMouseUp={stopTeleop}
                  onMouseLeave={stopTeleop}
                  onTouchStart={(e) => { e.preventDefault(); startTeleop('backward'); }}
                  onTouchEnd={stopTeleop}
                  className="p-2 rounded-lg border bg-white shadow-sm hover:bg-stone-100 active:scale-95 cursor-pointer text-stone-800"
                  title="Lùi (S)"
                >
                  <ChevronDown className="w-4 h-4"/>
                </button>
              </div>
            </div>

            <button
              onClick={handleEmergencyStop}
              className={`w-full py-2.5 text-xs font-black rounded-lg transition-all active:scale-[0.98] cursor-pointer uppercase tracking-widest shadow-md flex items-center justify-center gap-2 border ${
                isExploring || telemetry.linearVelocity !== 0 || telemetry.angularVelocity !== 0
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse ring-2 ring-red-400'
                  : 'bg-red-600 hover:bg-red-700 text-white border-red-700'
              }`}
              title="DỪNG KHẨN CẤP: Ngắt toàn bộ chuyển động bánh xe, dừng quét map và dừng tự hành ngay lập tức"
            >
              <AlertOctagon className="w-4 h-4 text-white"/>
              <span>DỪNG KHẨN CẤP (E-STOP)</span>
            </button>

            <div className="pt-2 border-t flex flex-col gap-2"style={{ borderColor: '#BFBFBD'}}>
              <button
                onClick={() => onSwitchToCamera && onSwitchToCamera()}
                className="w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer"
                style={{ background: '#F2EFE9', color: '#262626', borderColor: '#BFBFBD'}}
              >
                SWITCH TO LIVE CAMERA FPV
              </button>
            </div>
          </div>
        </div>
      </main>



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
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}>
                  Lưu, Khóa Map & Chuyển Navigation
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
                <label className="block text-[11px] font-semibold mb-1"style={{ color: '#8C8C8C'}}>
                  TÊN BẢN ĐỒ (ĐỊNH DANH DUY NHẤT)
                </label>
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
                <span className="font-bold block text-stone-800 mb-1">ĐỊNH DẠNG XUẤT RA:</span>
                • <strong>JSON</strong>: Dành cho Web Admin hiển thị tức thì.<br />
                • <strong>ROS 2 Nav2 (.yaml & .pgm)</strong>: Phục vụ Autonomous Navigation, Map Server & AMCL.<br />
                • <strong>PostgreSQL Database</strong>: Lưu trữ Metadata nghiệp vụ và cấu trúc Waypoints.<br />
                • <strong>Downloads Máy Tính</strong>: Tự động đóng gói file <code>.zip</code> tải trực tiếp về máy của bạn.
              </div>

              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] text-blue-800 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600 shrink-0"/>
                <span>
                  Web sẽ lưu map ROS 2 thật, khóa bản đồ, tự chuyển sang <strong>Navigation map tĩnh</strong> và tải ZIP về máy.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
                <button
                  type="button"
                  onClick={() => setIsSaveMapModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626'}}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingMap}
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF'}}
                >
                  <Save className="w-3.5 h-3.5"/>
                  <span>{isSavingMap ? 'Đang lưu & chuyển chế độ...': 'Lưu & Chạy Navigation'}</span>
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
                <h3 className="text-sm font-bold"style={{ color: '#262626'}}>
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
                  Hãy quét phòng và nhấn "LƯU BẢN ĐỒ"để lưu bản đồ đầu tiên.
                </div>
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
                        type="button"
                        onClick={() => triggerMapDownload(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 cursor-pointer shadow-xs flex items-center gap-1 transition-all"
                        title="Tải gói file bản đồ (.zip gồm .yaml + .pgm) về thư mục Downloads"
                      >
                        <Download className="w-3 h-3 text-blue-600"/>
                        <span>Tải Về</span>
                      </button>
                      <button
                        onClick={() => handleLoadSavedMap(mapItem.name)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-white hover:bg-stone-100 text-stone-800 cursor-pointer shadow-xs"
                        style={{ borderColor: '#BFBFBD'}}
                        title="Nạp bản đồ này vào hệ thống SLAM"
                      >
                        Nạp Bản Đồ
                      </button>
                      <button
                        onClick={() => handleDeleteSavedMap(mapItem.name)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="Xóa bản đồ này"
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
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600"/>
                <h3 className="text-base font-bold text-stone-900">Quét Full Phòng (SLAM Tự Hành)</h3>
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
              <p>
                Robot sẽ kết hợp <strong>ROS 2 SLAM Toolbox</strong> và thuật toán <strong>Frontier Exploration</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-700">
                <li>Tự động nhận diện ranh giới vùng chưa biết (Frontier) mà xe có thể di chuyển tới.</li>
                <li>Tự lái xe di chuyển đến các góc phòng, hành lang để quét mở rộng bản đồ.</li>
                <li>Tránh vật cản theo thời gian thực bằng cảm biến LiDAR A1 360° và cảm biến siêu âm.</li>
                <li>Mở rộng bản đồ SLAM trên RViz2 theo thời gian thực cho đến khi phủ kín phòng.</li>
              </ul>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                ️ Hãy đảm bảo sàn nhà không có bậc thang dốc hoặc hố sâu. Bạn có thể bấm nút "DỪNG QUÉT TỰ HÀNH"bất cứ lúc nào.
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Tên bản đồ sẽ lưu</label>
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
                <span>Tự động lưu file bản đồ khi hoàn thành quét full</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD'}}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleStartExplore}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5"/>
                <span>Bắt Đầu Quét Full Phòng</span>
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
              <div className="flex flex-col gap-2 border-r pr-3"style={{ borderColor: '#E5E4E2'}}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Quy trình đã lưu ({workflowList.length})</span>
                  <button
                    onClick={loadWorkflows}
                    className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3"/> Làm mới
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
                        style={{ borderColor: '#BFBFBD'}}
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
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">Tạo Workflow mới</span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600">Tên Workflow</label>
                    <input
                      type="text"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border text-xs bg-white text-stone-800"
                      style={{ borderColor: '#BFBFBD'}}
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
                        <Plus className="w-3 h-3"/> Thêm bước
                      </button>
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
                            <div className="text-[10px]">
                              Chờ (giây): <input type="number"value={st.wait_sec ?? 3} onChange={(e) => {
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
                    <span>Lưu Workflow Mới</span>
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
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600"/>
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
                ️ <strong>Nguyên tắc:</strong> Tường từ bản đồ Overlay sẽ luôn là vật cản cứng (100% obstacle), đảm bảo thuật toán điều hướng A* không bao giờ dẫn đường xuyên tường.
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
                  style={{ borderColor: '#BFBFBD'}}
                  placeholder="floor_plan_overlay"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded border text-xs"style={{ borderColor: '#BFBFBD'}}>
                <span className="font-semibold text-stone-700">Trạng thái:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${overlayActive ? 'bg-teal-100 text-teal-800': 'bg-stone-100 text-stone-600'}`}>
                  {overlayActive ? 'ĐANG KÍCH HOẠT': 'CHƯA BẬT'}
                </span>
              </div>

              {overlayWaypoints.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-semibold">Điểm mốc (Waypoints) từ Overlay:</span>
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
                  title="Tạo file mẫu JSON trên Pi 5"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-500"/>
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
                    <Check className="w-3.5 h-3.5"/>
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
