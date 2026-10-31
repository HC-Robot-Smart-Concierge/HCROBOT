import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  ROS_TOPICS,
  ROS_MSG_TYPES,
  RosbridgeClient,
  parseLaserScan,
  quaternionToYaw,
  createGoalPoseMsg,
  createInitialPoseMsg,
  createWaypointSyncMsg,
  createZoneSyncMsg,
} from '../../../services/rosbridgeService';
import {
  fetchWaypoints,
  saveWaypoint,
  deleteWaypoint,
  fetchZones,
  saveZone,
  deleteZone,
} from '../../../services/workflowApi';
import {
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
} from './studio/studioConstants';
import {
  Activity,
  Cpu,
  Wifi,
  WifiOff,
  MapPin,
  Zap,
  RefreshCw,
  Sliders,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Layers,
  RotateCcw,
  Radio,
  Eye,
  EyeOff,
  ShieldCheck,
  Battery,
  Compass,
  Plus,
  Save,
  Trash2,
  Check,
  X,
  Edit2,
  AlertTriangle,
  Crosshair,
  Home,
} from 'lucide-react';

const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;
const PI5_WS = `ws://${PI5_IP}:8000/api/v1/map/ws`;
const ROSBRIDGE_DEFAULT_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';

// Thong so vat ly chuan tu robot/maps/layout2.yaml (111 x 71 cells, resolution: 0.05m)
export const LAYOUT2_CONFIG = {
  mapId: 'layout2',
  name: 'Bản Đồ Thực Tế Lab',
  widthCells: 111,
  heightCells: 71,
  resolution: 0.05,
  widthMeters: 5.55,
  heightMeters: 3.55,
  originX: -0.711,
  originY: -1.765,
};

// Toc do quet an toan mac dinh de RPLiDAR A1M8 (5.5Hz) quet net 360 do, triet tieu truot banh va meo point cloud
export const DEFAULT_SAFE_SPEED_PERCENT = 25;
export const DEFAULT_SAFE_LINEAR_SPEED = 0.12;

// Danh sach diem moc co dinh phong Lab dong bo voi robot/maps/layout2.json
export const DEFAULT_LAB_WAYPOINTS = [
  { id: 'dock', name: 'Trạm Sạc (Home)', x: 0.0, y: 0.0, yaw: 0.0, type: 'CHARGER', color: '#10B981' },
  { id: 'desk', name: 'Bàn Kỹ Thuật Lab', x: 3.2, y: 0.8, yaw: 1.57, type: 'WAYPOINT', color: '#3B82F6' },
  { id: 'door', name: 'Cửa Ra Vào', x: 1.0, y: -1.0, yaw: -1.57, type: 'WAYPOINT', color: '#F59E0B' },
  { id: 'test_zone', name: 'Khu Thử Nghiệm LiDAR', x: 2.5, y: -0.5, yaw: 0.0, type: 'WAYPOINT', color: '#8B5CF6' },
  { id: 'center_gate', name: 'Lối Đi Trung Tâm', x: 1.8, y: 0.3, yaw: 0.0, type: 'WAYPOINT', color: '#06B6D4' },
  { id: 'rack_shelf', name: 'Kệ Thiết Bị Linh Kiện', x: 0.5, y: 1.2, yaw: 0.0, type: 'PARK', color: '#6B7280' },
];

// Danh sach Vung Chuc Nang mac dinh trong phong Lab
export const DEFAULT_LAB_ZONES = [
  {
    id: 'zone-keepout-lab-center',
    name: 'Phân Vùng Kỹ Thuật (Cấm Vào)',
    type: 'KEEP_OUT',
    x: 2.05,
    y: -0.75,
    width: 0.80,
    height: 1.40,
    speed_limit: 0.0,
    description: 'Vách ngăn kỹ thuật trung tâm, cấm robot đi vào.',
  },
  {
    id: 'zone-speed-lab-entrance',
    name: 'Cửa Ra Vào (Giới Hạn Tốc Độ)',
    type: 'SPEED_ZONE',
    x: 1.0,
    y: -1.0,
    width: 1.20,
    height: 1.00,
    speed_limit: 0.12,
    description: 'Khu vực người qua lại gần cửa, robot giảm tốc độ tối đa 0.12m/s.',
  },
  {
    id: 'zone-nostop-corridor',
    name: 'Lối Đi Trung Tâm (Cấm Dừng)',
    type: 'NO_STOP',
    x: 1.8,
    y: 0.3,
    width: 1.00,
    height: 1.20,
    speed_limit: 0.15,
    description: 'Lối đi huyết mạch nối bàn lab và trạm sạc, robot cấm dừng đỗ.',
  },
];

// Mau va mau sac chuan cho cac loai Vung Chuc Nang
export const ZONE_TEMPLATES = [
  {
    type: 'KEEP_OUT',
    label: 'Khu vực cấm vào (KEEP OUT)',
    badge: 'CẤM VÀO',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: '#DC2626',
    defaultSpeed: 0.0,
    description: 'Robot tuyệt đối không đi vào hay nhận điểm đến trong vùng này.',
  },
  {
    type: 'SPEED_ZONE',
    label: 'Giới hạn tốc độ (SPEED ZONE)',
    badge: 'GIỚI HẠN TỐC ĐỘ',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: '#D97706',
    defaultSpeed: 0.12,
    description: 'Tốc độ của robot tự động giảm xuống ngưỡng an toàn khi qua vùng này.',
  },
  {
    type: 'NO_STOP',
    label: 'Khu vực cấm dừng (NO STOP)',
    badge: 'CẤM DỪNG',
    color: '#FB7185',
    bgColor: 'rgba(244, 63, 94, 0.16)',
    borderColor: '#E11D48',
    defaultSpeed: 0.15,
    description: 'Lối đi đông người hoặc cửa ra vào, robot chỉ được phép đi qua, cấm dừng chờ.',
  },
];

// Khung vat can hinh hoc chinh de ve vector min hoa (loai bo gai goc loi lom tu SLAM)
export const LAB_GEOMETRIC_OBSTACLES = [
  { id: 'center_partition', x: 2.05, y: -0.75, width: 0.70, height: 1.35, label: 'Phân Vùng Trung Tâm' },
  { id: 'desk_top_left', x: 0.60, y: 0.55, width: 0.45, height: 0.45, label: 'Bàn Kỹ Thuật' },
  { id: 'pillar_mid_left', x: 1.10, y: -0.40, width: 0.40, height: 0.40, label: 'Cột Kỹ Thuật' },
  { id: 'pillar_bot_left', x: 0.35, y: -1.30, width: 0.40, height: 0.40, label: 'Kệ Thiết Bị' },
];

export const transformWorldToCanvas = (worldX, worldY, canvasWidth, canvasHeight, config = LAYOUT2_CONFIG) => {
  const pad = 40;
  const availWidth = canvasWidth - pad * 2;
  const availHeight = canvasHeight - pad * 2;

  const scaleX = availWidth / config.widthMeters;
  const scaleY = availHeight / config.heightMeters;
  const scale = Math.min(scaleX, scaleY);

  const relX = worldX - config.originX;
  const relY = worldY - config.originY;

  const px = pad + (availWidth - config.widthMeters * scale) / 2 + relX * scale;
  const py = pad + (availHeight - config.heightMeters * scale) / 2 + (config.heightMeters - relY) * scale;

  return { x: px, y: py, scale };
};

export const transformCanvasToWorld = (canvasX, canvasY, canvasWidth, canvasHeight, config = LAYOUT2_CONFIG) => {
  const pad = 40;
  const availWidth = canvasWidth - pad * 2;
  const availHeight = canvasHeight - pad * 2;

  const scaleX = availWidth / config.widthMeters;
  const scaleY = availHeight / config.heightMeters;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = pad + (availWidth - config.widthMeters * scale) / 2;
  const offsetY = pad + (availHeight - config.heightMeters * scale) / 2;

  const relX = (canvasX - offsetX) / scale;
  const relY = config.heightMeters - (canvasY - offsetY) / scale;

  const worldX = relX + config.originX;
  const worldY = relY + config.originY;

  return { worldX, worldY, scale };
};

export const AdminPhysicalMapTab = ({ currentUser }) => {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const rosClientRef = useRef(null);
  const pi5WsRef = useRef(null);

  // Che do ket noi: 'pi5' (Xe that Raspberry Pi 5) hoac 'ros2' (Gia lap Rosbridge Port 9090)
  const [connectionMode, setConnectionMode] = useState('pi5');
  const [pi5Ip, setPi5Ip] = useState(PI5_IP);

  // Trang thai ket noi
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [hardwareInfo, setHardwareInfo] = useState({
    model: 'RPLiDAR A1M8',
    port: '/dev/ttyUSB1',
    firmware: '1.29',
    health: 'Good',
    battery: 100,
  });

  // Dao huong dau xe 180 do neu dau robot nguoc voi vi tri dock
  const [invertHeading, setInvertHeading] = useState(false);

  // Du lieu Telemetry Robot thoi gian thuc
  const [robotPose, setRobotPose] = useState({
    x: 0.0,
    y: 0.0,
    yaw: 0.0,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
  });

  // Vet di chuyen cua robot
  const [trail, setTrail] = useState([]);

  // Tia quet LiDAR thoi gian thuc
  const [scanPoints, setScanPoints] = useState([]);
  const [showLaserScan, setShowLaserScan] = useState(true);
  const [showLaserRays, setShowLaserRays] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showEndpoints, setShowEndpoints] = useState(true);

  // Diem dich den dang chon (Click-to-Navigate)
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [navStatus, setNavStatus] = useState('Sẵn sàng');
  const [isNavigating, setIsNavigating] = useState(false);

  // Toc do dieu khien: Giam ve 25% (0.12 m/s) de RPLiDAR A1M8 quet tron ven 360 do
  const [speedPercent, setSpeedPercent] = useState(DEFAULT_SAFE_SPEED_PERCENT);
  const [maxLinearSpeed, setMaxLinearSpeed] = useState(DEFAULT_SAFE_LINEAR_SPEED);

  // Danh sach Endpoints (Waypoints) va Zones quan ly thoi gian thuc
  const [endpoints, setEndpoints] = useState(DEFAULT_LAB_WAYPOINTS);
  const [zones, setZones] = useState(DEFAULT_LAB_ZONES);

  // Che do chon va sua Endpoint / Zone
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [hasUnsavedEndpoints, setHasUnsavedEndpoints] = useState(false);
  const [hasUnsavedZones, setHasUnsavedZones] = useState(false);
  const [isSavingEndpoints, setIsSavingEndpoints] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);

  // Tab hien thi o Right Control Panel: 'WAYPOINTS' | 'ZONES' | 'TELEOP'
  const [activeRightTab, setActiveRightTab] = useState('WAYPOINTS');

  // Dat vi tri ban dau (2D Pose Estimate): click chon vi tri, keo de chon huong dau xe
  const [isPoseSetMode, setIsPoseSetMode] = useState(false);
  const [poseDraft, setPoseDraft] = useState(null); // { x, y, yaw } toa do the gioi, yaw radian
  const [refinePoseWithLidar, setRefinePoseWithLidar] = useState(true);
  const [isSettingPose, setIsSettingPose] = useState(false);

  // Keo tha tren Canvas
  const [dragState, setDragState] = useState(null);
  const isDraggingRef = useRef(false);

  // Anh map tinh layout2.png
  const [mapImage, setMapImage] = useState(null);

  // Load anh layout2.png va lay danh sach toa do diem tu layout2.json va API backend
  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.src = '/maps/layout2.png';
    img.onload = () => {
      if (isMounted) setMapImage(img);
    };
    img.onerror = () => console.warn('[AdminPhysicalMapTab] Failed to load /maps/layout2.png');

    const loadData = async () => {
      try {
        // 1. Thu tai tu file layout2.json
        const res = await fetch('/maps/layout2.json');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.waypoints) && data.waypoints.length > 0) {
            setEndpoints(data.waypoints);
          }
          if (isMounted && Array.isArray(data.zones) && data.zones.length > 0) {
            setZones(data.zones);
          }
        }
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] Failed to fetch /maps/layout2.json:', err);
      }

      // 2. Thu dong bo tu backend CSDL
      try {
        const dbWps = await fetchWaypoints();
        if (isMounted && Array.isArray(dbWps) && dbWps.length > 0) {
          setEndpoints(dbWps);
        }
      } catch (e) {
        // Giu default endpoints neu API loi
      }

      try {
        const dbZones = await fetchZones();
        if (isMounted && Array.isArray(dbZones) && dbZones.length > 0) {
          setZones(dbZones);
        }
      } catch (e) {
        // Giu default zones neu API loi
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. KET NOI XE THAT (Pi 5 WebSocket: ws://100.99.72.51:8000/api/v1/map/ws)
  useEffect(() => {
    if (connectionMode !== 'pi5') return;

    let ws = null;
    let isMounted = true;
    let reconnectTimeout = null;

    const connectPi5Ws = () => {
      try {
        const url = `ws://${pi5Ip}:8000/api/v1/map/ws`;
        ws = new WebSocket(url);
        pi5WsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsWsConnected(true);
          setNavStatus('Đã kết nối xe thật Pi 5');
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.robot_pose) {
              const ryawDeg = Number(data.robot_pose.yaw || 0.0);
              const ryawRad = (ryawDeg * Math.PI) / 180.0;
              setRobotPose({
                x: Number(data.robot_pose.x || 0.0),
                y: Number(data.robot_pose.y || 0.0),
                yaw: ryawRad,
                linearVelocity: Number(data.linear_velocity ?? data.robot_pose.linear_velocity ?? 0.0),
                angularVelocity: Number(data.angular_velocity ?? data.robot_pose.angular_velocity ?? 0.0),
              });
              setTrail((prev) => [
                ...prev.slice(-150),
                { x: Number(data.robot_pose.x || 0.0), y: Number(data.robot_pose.y || 0.0) },
              ]);
            }

            // Pi 5 (robot/scripts/lidar_service.py) gui 'scan_points' da quy doi sang toa do the gioi (x, y)
            const lidarPoints = Array.isArray(data.scan_points) ? data.scan_points : data.lidar_scan;
            if (Array.isArray(lidarPoints)) {
              setScanPoints(lidarPoints);
            }

            if (typeof data.battery === 'number') {
              setHardwareInfo((prev) => ({ ...prev, battery: data.battery }));
            }

            if (data.hardware_info) {
              setHardwareInfo((prev) => ({
                ...prev,
                battery: data.hardware_info.battery ?? prev.battery,
                port: data.hardware_info.port ?? prev.port,
              }));
            }

            if (data.nav_status) {
              setNavStatus(data.nav_status);
              if (data.nav_status.includes('Đã tới đích')) {
                setIsNavigating(false);
                setSelectedGoal(null);
              }
            }
          } catch (err) {
            console.warn('[AdminPhysicalMapTab] Pi5 WS parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsWsConnected(false);
          setNavStatus('Mất kết nối Pi 5. Đang thử lại...');
          reconnectTimeout = setTimeout(connectPi5Ws, 2500);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setIsWsConnected(false);
        };
      } catch (err) {
        if (!isMounted) return;
        setIsWsConnected(false);
        reconnectTimeout = setTimeout(connectPi5Ws, 3000);
      }
    };

    connectPi5Ws();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        pi5WsRef.current = null;
      }
    };
  }, [connectionMode, pi5Ip]);

  // 2. KET NOI ROS 2 GIA LAP (Rosbridge WebSocket: ws://127.0.0.1:9090)
  useEffect(() => {
    if (connectionMode !== 'ros2') return;

    const client = new RosbridgeClient(ROSBRIDGE_DEFAULT_URL, {
      onConnect: () => {
        setIsWsConnected(true);
        setNavStatus('Đã kết nối ROS 2 Rosbridge (Port 9090)');
      },
      onDisconnect: () => {
        setIsWsConnected(false);
        setNavStatus('Mất kết nối ROS 2');
      },
      onError: () => {
        setIsWsConnected(false);
      },
    });

    rosClientRef.current = client;
    client.connect();

    client.subscribe(
      ROS_TOPICS.AMCL_POSE,
      ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
      (msg) => {
        const pos = msg?.pose?.pose?.position;
        const ori = msg?.pose?.pose?.orientation;
        if (pos) {
          const yaw = quaternionToYaw(ori?.z ?? 0, ori?.w ?? 1);
          setRobotPose((prev) => ({
            ...prev,
            x: pos.x,
            y: pos.y,
            yaw,
          }));
          setTrail((prev) => [...prev.slice(-150), { x: pos.x, y: pos.y }]);
        }
      },
      { throttleRate: 50 }
    );

    client.subscribe(
      ROS_TOPICS.SCAN,
      ROS_MSG_TYPES.LASER_SCAN,
      (msg) => {
        const pts = parseLaserScan(msg);
        setScanPoints(pts);
      },
      { throttleRate: 80 }
    );

    client.subscribe(
      ROS_TOPICS.GOAL_REACHED,
      ROS_MSG_TYPES.STRING,
      (msg) => {
        if (msg?.data) {
          setNavStatus(`Đã tới đích: ${msg.data}`);
          setIsNavigating(false);
          setSelectedGoal(null);
        }
      }
    );

    return () => {
      client.disconnect();
      rosClientRef.current = null;
    };
  }, [connectionMode]);

  // Chuyen doi Toa do Thuc (Meters) sang Canvas Pixels
  const worldToCanvas = useCallback(
    (worldX, worldY, canvasWidth, canvasHeight) =>
      transformWorldToCanvas(worldX, worldY, canvasWidth, canvasHeight, LAYOUT2_CONFIG),
    []
  );

  // Chuyen doi Canvas Pixels sang Toa do Thuc (Meters)
  const canvasToWorld = useCallback(
    (canvasX, canvasY, canvasWidth, canvasHeight) =>
      transformCanvasToWorld(canvasX, canvasY, canvasWidth, canvasHeight, LAYOUT2_CONFIG),
    []
  );

  // ==========================================
  // QUAN LY ENDPOINTS (WAYPOINTS)
  // ==========================================
  const handleAddEndpoint = (type = 'WAYPOINT') => {
    const tmpl = getEndpointTemplateInfo(type);
    const count = endpoints.length + 1;
    const newEp = {
      id: `wp-${Date.now().toString(36)}`,
      name: `Điểm Mốc #${count}`,
      type,
      x: 1.50,
      y: 0.00,
      yaw: 0.0,
      color: tmpl.color || '#3B82F6',
    };
    const nextList = [...endpoints, newEp];
    setEndpoints(nextList);
    setSelectedEndpoint(newEp);
    setSelectedZone(null);
    setHasUnsavedEndpoints(true);
    setActiveRightTab('WAYPOINTS');

    saveWaypoint(newEp).catch((err) => {
      console.warn('Lỗi lưu endpoint vào backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
  };

  const handleUpdateSelectedEndpoint = (field, value) => {
    if (!selectedEndpoint) return;
    const updated = { ...selectedEndpoint, [field]: value };
    if (field === 'type') {
      const tmpl = getEndpointTemplateInfo(value);
      updated.color = tmpl.color || updated.color;
    }
    setSelectedEndpoint(updated);
    const nextList = endpoints.map((ep) => (ep.id === updated.id ? updated : ep));
    setEndpoints(nextList);
    setHasUnsavedEndpoints(true);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
  };

  const handleSaveEndpoints = async () => {
    setIsSavingEndpoints(true);
    try {
      for (const ep of endpoints) {
        await saveWaypoint(ep);
      }
      setHasUnsavedEndpoints(false);
      setNavStatus('Đã lưu toàn bộ điểm mốc vào CSDL');

      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(endpoints));
      }
      if (pi5WsRef.current && pi5WsRef.current.readyState === WebSocket.OPEN) {
        pi5WsRef.current.send(JSON.stringify({ type: 'SYNC_WAYPOINTS', waypoints: endpoints }));
      }
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Failed to save endpoints:', err);
      setNavStatus('Lỗi khi lưu điểm mốc vào CSDL');
    } finally {
      setIsSavingEndpoints(false);
    }
  };

  const handleDeleteEndpoint = (id) => {
    const target = endpoints.find((ep) => ep.id === id);
    const nextList = endpoints.filter((ep) => ep.id !== id);
    setEndpoints(nextList);
    if (selectedEndpoint?.id === id) {
      setSelectedEndpoint(null);
    }
    setHasUnsavedEndpoints(true);

    deleteWaypoint(id).catch((err) => {
      console.warn('Lỗi khi xóa endpoint ở backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
    setNavStatus(`Đã xóa điểm mốc "${target?.name || id}"`);
  };

  // ==========================================
  // QUAN LY ZONES (VUNG CHUC NANG)
  // ==========================================
  const handleAddZone = (type = 'KEEP_OUT') => {
    const tmpl = ZONE_TEMPLATES.find((t) => t.type === type) || ZONE_TEMPLATES[0];
    const count = zones.length + 1;
    const prefix = type === 'KEEP_OUT' ? 'Cấm Vào' : type === 'SPEED_ZONE' ? 'Giới Hạn Tốc Độ' : 'Cấm Dừng';
    const newZone = {
      id: `zone-${Date.now().toString(36)}`,
      name: `${prefix} #${count}`,
      type,
      x: 2.00,
      y: 0.00,
      width: 1.00,
      height: 1.00,
      speed_limit: tmpl.defaultSpeed,
      description: tmpl.description,
    };
    const nextList = [...zones, newZone];
    setZones(nextList);
    setSelectedZone(newZone);
    setSelectedEndpoint(null);
    setHasUnsavedZones(true);
    setActiveRightTab('ZONES');

    saveZone(newZone).catch((err) => {
      console.warn('Lỗi lưu zone vào backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
  };

  const handleUpdateSelectedZone = (field, value) => {
    if (!selectedZone) return;
    const updated = { ...selectedZone, [field]: value };
    setSelectedZone(updated);
    const nextList = zones.map((z) => (z.id === updated.id ? updated : z));
    setZones(nextList);
    setHasUnsavedZones(true);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
  };

  const handleSaveZones = async () => {
    setIsSavingZones(true);
    try {
      for (const z of zones) {
        await saveZone(z);
      }
      setHasUnsavedZones(false);
      setNavStatus('Đã lưu toàn bộ vùng chức năng vào CSDL');

      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(zones));
      }
      if (pi5WsRef.current && pi5WsRef.current.readyState === WebSocket.OPEN) {
        pi5WsRef.current.send(JSON.stringify({ type: 'SYNC_ZONES', zones }));
      }
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Failed to save zones:', err);
      setNavStatus('Lỗi khi lưu vùng chức năng vào CSDL');
    } finally {
      setIsSavingZones(false);
    }
  };

  const handleDeleteZone = (id) => {
    const target = zones.find((z) => z.id === id);
    const nextList = zones.filter((z) => z.id !== id);
    setZones(nextList);
    if (selectedZone?.id === id) {
      setSelectedZone(null);
    }
    setHasUnsavedZones(true);

    deleteZone(id).catch((err) => {
      console.warn('Lỗi xóa zone ở backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
    setNavStatus(`Đã xóa vùng "${target?.name || id}"`);
  };

  // ==========================================
  // RENDER CANVAS CHINH
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Bat che do lam min do hoa Canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Xoa canvas voi mau nen Slate hien dai
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Tinh toan padding va ti le thu phong
    const pad = 40;
    const availWidth = width - pad * 2;
    const availHeight = height - pad * 2;
    const scale = Math.min(availWidth / LAYOUT2_CONFIG.widthMeters, availHeight / LAYOUT2_CONFIG.heightMeters);
    const offsetX = pad + (availWidth - LAYOUT2_CONFIG.widthMeters * scale) / 2;
    const offsetY = pad + (availHeight - LAYOUT2_CONFIG.heightMeters * scale) / 2;

    const roomW = LAYOUT2_CONFIG.widthMeters * scale;
    const roomH = LAYOUT2_CONFIG.heightMeters * scale;

    // Nen phong Lab
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(offsetX, offsetY, roomW, roomH);

    // 3. Render Ban do SLAM thuc te layout2.png
    if (mapImage) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(mapImage, offsetX, offsetY, roomW, roomH);
      ctx.restore();
    }

    // Luoi toa do 0.5m
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= LAYOUT2_CONFIG.widthMeters; x += 0.5) {
      const px = offsetX + x * scale;
      ctx.beginPath();
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + roomH);
      ctx.stroke();
    }
    for (let y = 0; y <= LAYOUT2_CONFIG.heightMeters; y += 0.5) {
      const py = offsetY + y * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, py);
      ctx.lineTo(offsetX + roomW, py);
      ctx.stroke();
    }

    // 4. VE CAC VUNG CHUC NANG (ZONES: KEEP-OUT, SPEED-ZONE, NO-STOP)
    if (showZones && zones.length > 0) {
      for (const zone of zones) {
        const isSelected = selectedZone?.id === zone.id;
        const halfW = (Number(zone.width) || 1.0) / 2;
        const halfH = (Number(zone.height) || 1.0) / 2;
        const zx = Number(zone.x) || 0;
        const zy = Number(zone.y) || 0;

        const tl = worldToCanvas(zx - halfW, zy + halfH, width, height);
        const br = worldToCanvas(zx + halfW, zy - halfH, width, height);
        const zw = Math.max(8, br.x - tl.x);
        const zh = Math.max(8, br.y - tl.y);

        const isKeepOut = zone.type === 'KEEP_OUT';
        const isSpeed = zone.type === 'SPEED_ZONE';
        const color = isKeepOut ? '#EF4444' : isSpeed ? '#F59E0B' : '#FB7185';
        const fill = isKeepOut
          ? 'rgba(239, 68, 68, 0.16)'
          : isSpeed
          ? 'rgba(245, 158, 11, 0.16)'
          : 'rgba(244, 63, 94, 0.16)';

        // Nen vung
        ctx.fillStyle = fill;
        ctx.fillRect(tl.x, tl.y, zw, zh);

        // Pattern soc chéo
        ctx.save();
        ctx.beginPath();
        ctx.rect(tl.x, tl.y, zw, zh);
        ctx.clip();
        ctx.strokeStyle = isKeepOut
          ? 'rgba(239, 68, 68, 0.28)'
          : isSpeed
          ? 'rgba(245, 158, 11, 0.28)'
          : 'rgba(244, 63, 94, 0.28)';
        ctx.lineWidth = 1.2;
        for (let i = -zh; i <= zw; i += 12) {
          ctx.beginPath();
          ctx.moveTo(tl.x + i, tl.y);
          ctx.lineTo(tl.x + i + zh, tl.y + zh);
          ctx.stroke();
        }
        ctx.restore();

        // Vien bao net dut
        ctx.save();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : color;
        ctx.lineWidth = isSelected ? 2.2 : 1.2;
        ctx.setLineDash(isKeepOut ? [6, 4] : isSpeed ? [5, 3] : [4, 3]);
        ctx.strokeRect(tl.x, tl.y, zw, zh);
        ctx.restore();

        // Neu duoc chon: Ve 4 goc handles
        if (isSelected) {
          ctx.fillStyle = '#FFFFFF';
          [tl.x, br.x].forEach((hx) => {
            [tl.y, br.y].forEach((hy) => {
              ctx.fillRect(hx - 3, hy - 3, 6, 6);
            });
          });
        }

        // Nhãn tên vùng nhỏ gọn tinh tế
        const labelText = zone.name || (isKeepOut ? 'CẤM VÀO' : isSpeed ? `${zone.speed_limit}m/s` : 'CẤM DỪNG');
        ctx.fillStyle = isSelected ? '#0F172A' : 'rgba(15, 23, 42, 0.85)';
        const textW = Math.max(28, labelText.length * 5.2 + 8);
        ctx.fillRect(tl.x + 3, tl.y + 3, textW, 14);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(tl.x + 3, tl.y + 3, textW, 14);

        ctx.fillStyle = isSelected ? '#FFFFFF' : color;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labelText.length > 20 ? labelText.slice(0, 18) + '...' : labelText, tl.x + 3 + textW / 2, tl.y + 13);
      }
    }

    // 5. Ve tia Laser RPLiDAR thoi gian thuc
    const { x: rpx, y: rpy } = worldToCanvas(robotPose.x, robotPose.y, width, height);
    const effectiveYaw = robotPose.yaw + (invertHeading ? Math.PI : 0);

    if (showLaserScan && scanPoints.length > 0) {
      for (const pt of scanPoints) {
        let wx = 0.0;
        let wy = 0.0;
        if (pt.x !== undefined && pt.y !== undefined) {
          wx = pt.x;
          wy = pt.y;
        } else if (pt.range !== undefined && pt.angle !== undefined) {
          const globalAngle = effectiveYaw + pt.angle;
          wx = robotPose.x + pt.range * Math.cos(globalAngle);
          wy = robotPose.y + pt.range * Math.sin(globalAngle);
        } else {
          continue;
        }

        const { x: lpx, y: lpy } = worldToCanvas(wx, wy, width, height);

        if (showLaserRays) {
          ctx.beginPath();
          ctx.moveTo(rpx, rpy);
          ctx.lineTo(lpx, lpy);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(lpx, lpy, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 6. Ve Vet Di Chuyen (Trail)
    if (trail.length > 1) {
      ctx.beginPath();
      const first = worldToCanvas(trail[0].x, trail[0].y, width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < trail.length; i++) {
        const pt = worldToCanvas(trail[i].x, trail[i].y, width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Ve cac Diem Moc Endpoints (Waypoints tu layout2.json)
    if (showEndpoints && endpoints.length > 0) {
      for (const ep of endpoints) {
        const { x: wpx, y: wpy } = worldToCanvas(ep.x, ep.y, width, height);
        const isSelected = selectedEndpoint?.id === ep.id;
        const tmpl = getEndpointTemplateInfo(ep.type);
        const epColor = tmpl.color || ep.color || '#3B82F6';

        // Halo khi duoc chon
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 13, 0, Math.PI * 2);
          ctx.strokeStyle = epColor;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Diem tron filled
        ctx.beginPath();
        ctx.arc(wpx, wpy, isSelected ? 6.5 : 5.0, 0, Math.PI * 2);
        ctx.fillStyle = epColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Nhãn tên điểm mốc nhỏ gọn, tinh tế
        const nameText = ep.name || 'Điểm mốc';
        const badgeW = Math.max(22, nameText.length * 5.0 + 12);
        const badgeH = 13;
        const bx = wpx - badgeW / 2;
        const by = wpy - 18;

        ctx.fillStyle = isSelected ? '#18181B' : '#0F172A';
        ctx.fillRect(bx, by, badgeW, badgeH);
        ctx.strokeStyle = isSelected ? epColor : '#475569';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx, by, badgeW, badgeH);

        // Dot mau loai
        ctx.beginPath();
        ctx.arc(bx + 4.5, by + badgeH / 2, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = epColor;
        ctx.fill();

        ctx.fillStyle = isSelected ? '#FFFFFF' : '#CBD5E1';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nameText.length > 20 ? nameText.slice(0, 18) + '...' : nameText, bx + badgeW / 2 + 2, by + 9.5);
      }
    }

    // 8. Ve Diem Dich Den (Selected Goal)
    if (selectedGoal) {
      const { x: gpx, y: gpy } = worldToCanvas(selectedGoal.x, selectedGoal.y, width, height);

      ctx.beginPath();
      ctx.arc(gpx, gpy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(gpx, gpy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Mục tiêu (${selectedGoal.x.toFixed(2)}, ${selectedGoal.y.toFixed(2)})`, gpx, gpy - 16);
    }

    // 9. Ve Robot HC-Robot
    ctx.save();
    ctx.translate(rpx, rpy);
    ctx.rotate(-effectiveYaw);

    const robW = 0.40 * scale;
    const robH = 0.30 * scale;

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-robW / 2, -robH / 2, robW, robH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(-robW / 2, -robH / 2, robW, robH);

    // Mui xe phia truoc (Heading indicator)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(robW / 2, 0);
    ctx.lineTo(robW / 2 - 8, -5);
    ctx.lineTo(robW / 2 - 8, 5);
    ctx.closePath();
    ctx.fill();

    // Tam RPLiDAR
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#06B6D4';
    ctx.fill();

    ctx.restore();

    // 9b. Vi tri ban dau dang chon (2D Pose Estimate): vong tron + mui ten huong dau xe
    if (poseDraft) {
      const { x: dpx, y: dpy } = worldToCanvas(poseDraft.x, poseDraft.y, width, height);
      const arrowLen = 0.45 * scale;
      const ax = dpx + arrowLen * Math.cos(poseDraft.yaw);
      const ay = dpy - arrowLen * Math.sin(poseDraft.yaw);

      ctx.beginPath();
      ctx.arc(dpx, dpy, 0.22 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(dpx, dpy);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 3;
      ctx.stroke();

      const head = 9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - head * Math.cos(poseDraft.yaw - 0.45), ay + head * Math.sin(poseDraft.yaw - 0.45));
      ctx.lineTo(ax - head * Math.cos(poseDraft.yaw + 0.45), ay + head * Math.sin(poseDraft.yaw + 0.45));
      ctx.closePath();
      ctx.fillStyle = '#22C55E';
      ctx.fill();

      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Start (${poseDraft.x.toFixed(2)}, ${poseDraft.y.toFixed(2)}, ${((poseDraft.yaw * 180) / Math.PI).toFixed(0)}°)`,
        dpx,
        dpy + 0.22 * scale + 14
      );
    }

    // 10. Toa do truc goc Oxy (0, 0)
    const { x: opx, y: opy } = worldToCanvas(0.0, 0.0, width, height);
    ctx.beginPath();
    ctx.arc(opx, opy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10B981';
    ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('Dock (0,0)', opx + 6, opy + 12);
  }, [
    mapImage,
    robotPose,
    scanPoints,
    showLaserScan,
    showLaserRays,
    showZones,
    showEndpoints,
    trail,
    selectedGoal,
    endpoints,
    zones,
    selectedEndpoint,
    selectedZone,
    invertHeading,
    poseDraft,
    worldToCanvas,
  ]);

  // ==========================================
  // TUONG TAC CHUOT (SELECT, DRAG & DROP)
  // ==========================================
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

    // 0. Che do Dat vi tri ban dau: click = vi tri, keo = huong dau xe
    if (isPoseSetMode) {
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      setPoseDraft({ x: worldX, y: worldY, yaw: robotPose.yaw });
      setDragState({ type: 'POSE', mouseStartX: canvasX, mouseStartY: canvasY });
      isDraggingRef.current = true;
      return;
    }

    // 1. Kiem tra click trúng Endpoint (r <= 16px)
    if (showEndpoints) {
      for (const ep of endpoints) {
        const { x: epx, y: epy } = worldToCanvas(ep.x, ep.y, canvas.width, canvas.height);
        const dist = Math.hypot(canvasX - epx, canvasY - epy);
        if (dist <= 16) {
          setSelectedEndpoint(ep);
          setSelectedZone(null);
          setActiveRightTab('WAYPOINTS');
          setDragState({
            type: 'ENDPOINT',
            id: ep.id,
            mouseStartX: canvasX,
            mouseStartY: canvasY,
            initX: ep.x,
            initY: ep.y,
          });
          isDraggingRef.current = true;
          return;
        }
      }
    }

    // 2. Kiem tra click trúng Zone
    if (showZones) {
      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i];
        const halfW = (Number(zone.width) || 1.0) / 2;
        const halfH = (Number(zone.height) || 1.0) / 2;
        const tl = worldToCanvas(zone.x - halfW, zone.y + halfH, canvas.width, canvas.height);
        const br = worldToCanvas(zone.x + halfW, zone.y - halfH, canvas.width, canvas.height);

        if (canvasX >= tl.x && canvasX <= br.x && canvasY >= tl.y && canvasY <= br.y) {
          setSelectedZone(zone);
          setSelectedEndpoint(null);
          setActiveRightTab('ZONES');
          setDragState({
            type: 'ZONE',
            id: zone.id,
            mouseStartX: canvasX,
            mouseStartY: canvasY,
            initX: zone.x,
            initY: zone.y,
          });
          isDraggingRef.current = true;
          return;
        }
      }
    }

    // 3. Neu khong trung: Bo chon va dat Selected Goal
    setSelectedEndpoint(null);
    setSelectedZone(null);

    const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
    setSelectedGoal({ x: worldX, y: worldY });
    handleSendGoal(worldX, worldY, 0.0);
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (dragState.type === 'POSE') {
      const dx = canvasX - dragState.mouseStartX;
      const dy = canvasY - dragState.mouseStartY;
      // Truc Y canvas huong xuong, truc Y the gioi huong len => dao dau dy
      if (Math.hypot(dx, dy) > 8) {
        setPoseDraft((prev) => (prev ? { ...prev, yaw: Math.atan2(-dy, dx) } : prev));
      }
      return;
    }

    const { scale } = transformWorldToCanvas(0, 0, canvas.width, canvas.height, LAYOUT2_CONFIG);
    const dxMeters = (canvasX - dragState.mouseStartX) / scale;
    const dyMeters = -(canvasY - dragState.mouseStartY) / scale;

    if (dragState.type === 'ENDPOINT') {
      const newX = Number((dragState.initX + dxMeters).toFixed(2));
      const newY = Number((dragState.initY + dyMeters).toFixed(2));
      const updated = { ...selectedEndpoint, x: newX, y: newY };
      setSelectedEndpoint(updated);
      setEndpoints((prev) => prev.map((ep) => (ep.id === dragState.id ? updated : ep)));
      setHasUnsavedEndpoints(true);
    } else if (dragState.type === 'ZONE') {
      const newX = Number((dragState.initX + dxMeters).toFixed(2));
      const newY = Number((dragState.initY + dyMeters).toFixed(2));
      const updated = { ...selectedZone, x: newX, y: newY };
      setSelectedZone(updated);
      setZones((prev) => prev.map((z) => (z.id === dragState.id ? updated : z)));
      setHasUnsavedZones(true);
    }
  };

  const handleCanvasMouseUp = () => {
    const wasPoseDrag = dragState?.type === 'POSE';
    setDragState(null);
    isDraggingRef.current = false;
    if (wasPoseDrag && poseDraft) {
      handleApplyInitialPose(poseDraft.x, poseDraft.y, poseDraft.yaw);
    }
  };

  // ==========================================
  // DAT VI TRI BAN DAU (INITIAL POSE) TREN BAN DO DA QUET
  // ==========================================
  const handleApplyInitialPose = async (px, py, pyawRad) => {
    setIsSettingPose(true);
    setPoseDraft({ x: px, y: py, yaw: pyawRad });
    setNavStatus(`Đang đặt vị trí ban đầu (${px.toFixed(2)}, ${py.toFixed(2)})...`);

    try {
      if (connectionMode === 'pi5') {
        const res = await fetch(`http://${pi5Ip}:8000/api/v1/map/set_pose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            x: px,
            y: py,
            yaw: (pyawRad * 180) / Math.PI, // Pi 5 dung don vi do
            refine: refinePoseWithLidar,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const finalYaw = (Number(data.yaw ?? 0) * Math.PI) / 180;
        setRobotPose((prev) => ({ ...prev, x: Number(data.x ?? px), y: Number(data.y ?? py), yaw: finalYaw }));
        setNavStatus(
          data.refined
            ? `Đã định vị: (${Number(data.x).toFixed(2)}, ${Number(data.y).toFixed(2)}, ${Number(data.yaw).toFixed(0)}°) — LiDAR khớp ${data.score_before} → ${data.score_after}`
            : `Đã đặt vị trí ban đầu (${Number(data.x).toFixed(2)}, ${Number(data.y).toFixed(2)}, ${Number(data.yaw).toFixed(0)}°). ${data.message || ''}`
        );
      } else if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish(
          ROS_TOPICS.INITIAL_POSE,
          ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
          createInitialPoseMsg(px, py, pyawRad)
        );
        setNavStatus(`Đã gửi /initialpose (${px.toFixed(2)}, ${py.toFixed(2)}) cho AMCL`);
      } else {
        throw new Error('Chưa kết nối robot');
      }

      // Pose da duoc dat dung huong that => khong can dao dau xe 180° tren giao dien nua
      setInvertHeading(false);
      setTrail([]);
      setIsPoseSetMode(false);
      setPoseDraft(null);
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Set initial pose error:', err);
      setNavStatus(`Lỗi đặt vị trí ban đầu: ${err.message}`);
    } finally {
      setIsSettingPose(false);
    }
  };

  const handleSetPoseAtDock = () => {
    const dock =
      endpoints.find((ep) => ep.id === 'dock') ||
      endpoints.find((ep) => ['CHARGER', 'dock'].includes(ep.type)) ||
      { x: 0, y: 0, yaw: 0 };
    handleApplyInitialPose(Number(dock.x) || 0, Number(dock.y) || 0, Number(dock.yaw) || 0);
  };

  const handleRelocalize = async () => {
    if (connectionMode !== 'pi5') {
      setNavStatus('Định vị lại bằng LiDAR chỉ hỗ trợ xe thật Pi 5 (ROS 2 dùng AMCL tự động).');
      return;
    }
    setIsSettingPose(true);
    try {
      const res = await fetch(`http://${pi5Ip}:8000/api/v1/map/localize`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNavStatus(
        data.refined
          ? `Đã định vị lại: (${Number(data.x).toFixed(2)}, ${Number(data.y).toFixed(2)}, ${Number(data.yaw).toFixed(0)}°)`
          : data.message || 'Pose hiện tại đã khớp bản đồ.'
      );
    } catch (err) {
      setNavStatus(`Lỗi định vị lại: ${err.message}`);
    } finally {
      setIsSettingPose(false);
    }
  };

  // Gui toa do dich den toi Pi 5 hoac ROS 2
  const handleSendGoal = (gx, gy, gyaw = 0.0) => {
    setSelectedGoal({ x: gx, y: gy });
    setIsNavigating(true);
    setNavStatus(`Đang di chuyển tới (${gx.toFixed(2)}, ${gy.toFixed(2)})...`);

    // WebSocket /map/ws tren Pi 5 chi phat telemetry, khong doc lenh => gui dich qua REST
    if (connectionMode === 'pi5') {
      fetch(`http://${pi5Ip}:8000/api/v1/map/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_x: gx,
          target_y: gy,
          target_yaw: gyaw,
          speed: speedPercent,
          linear_speed: maxLinearSpeed,
        }),
      }).catch((err) => {
        console.warn('[AdminPhysicalMapTab] Pi5 send goal error:', err);
        setNavStatus(`Lỗi gửi đích tới Pi 5: ${err.message}`);
        setIsNavigating(false);
      });
    }

    if (connectionMode === 'ros2' && rosClientRef.current && isWsConnected) {
      try {
        const goalMsg = createGoalPoseMsg(gx, gy, gyaw);
        rosClientRef.current.publish(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED, goalMsg);
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] ROS2 send goal error:', err);
      }
    }
  };

  // Dieu khien Teleop thu cong
  const sendTeleopCommand = (commandDirection, linearVel, angularVel) => {
    if (connectionMode === 'pi5') {
      try {
        fetch(`${PI5_API}/map/teleop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: commandDirection,
            speed: commandDirection === 'stop' ? 0 : speedPercent,
          }),
        });
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] Pi5 teleop error:', err);
      }
    }

    if (rosClientRef.current && isWsConnected) {
      try {
        rosClientRef.current.publish(ROS_TOPICS.CMD_VEL, ROS_MSG_TYPES.TWIST, {
          linear: { x: linearVel, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: angularVel },
        });
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] ROS2 cmd_vel error:', err);
      }
    }
  };

  const handleStop = () => {
    sendTeleopCommand('stop', 0.0, 0.0);
    setIsNavigating(false);
    setSelectedGoal(null);
    setNavStatus('Đã dừng khẩn cấp (STOP)');
  };

  // Keyboard controls WASD
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        sendTeleopCommand('forward', maxLinearSpeed, 0.0);
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        sendTeleopCommand('backward', -maxLinearSpeed, 0.0);
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        sendTeleopCommand('left', 0.0, 0.5);
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        sendTeleopCommand('right', 0.0, -0.5);
      } else if (key === ' ') {
        e.preventDefault();
        handleStop();
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        sendTeleopCommand('stop', 0.0, 0.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [maxLinearSpeed]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Header: Title, Realtime Status & Switch Mode */}
      <header className="h-14 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>HC-ROBOT • BẢN ĐỒ VẬT LÝ & KHÔNG GIAN THỰC TẾ (SLAM LAB)</span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block animate-ping" />
              <span>{navStatus}</span>
            </p>
          </div>
        </div>

        {/* Center: Che do ban do SLAM goc layout2 */}
        <div className="hidden lg:flex items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-cyan-400 mr-1.5" />
          <span className="text-[11px] font-semibold text-slate-300">Bản Đồ SLAM Gốc Lab (layout2.png)</span>
        </div>

        {/* Right: Target Selector (Pi 5 vs ROS 2) & Status Pill */}
        <div className="flex items-center gap-2">
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
              <span>ROS 2 Giả Lập</span>
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
            <span className="hidden sm:inline">
              {isWsConnected
                ? connectionMode === 'pi5'
                  ? `Pi 5 (${pi5Ip})`
                  : 'ROS 2 Live'
                : 'Mất kết nối'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace: Canvas Map Area + Right Control Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas Lab Viewport */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-3 bg-slate-950 overflow-hidden select-none">
          {/* Floating Controls Overlay o goc tren trai */}
          <div className="absolute top-5 left-5 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 shadow-xl text-xs">
            <button
              onClick={() => setShowLaserScan(!showLaserScan)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                showLaserScan ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Laser: {showLaserScan ? 'BẬT' : 'TẮT'}</span>
            </button>

            <button
              onClick={() => setShowLaserRays(!showLaserRays)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                showLaserRays ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Vẽ các đường tia quét từ robot tới điểm va chạm"
            >
              {showLaserRays ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Rays</span>
            </button>

            <button
              onClick={() => setShowZones(!showZones)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                showZones ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Bật/Tắt hiển thị Vùng chức năng (Keep-out, Speed, No-stop)"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Vùng ({zones.length})</span>
            </button>

            <button
              onClick={() => setShowEndpoints(!showEndpoints)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                showEndpoints ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Bật/Tắt hiển thị Điểm mốc"
            >
              <MapPin className="w-3 h-3" />
              <span>Điểm ({endpoints.length})</span>
            </button>

            <button
              onClick={() => setTrail([])}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xóa Vệt</span>
            </button>

            <button
              onClick={() => setInvertHeading(!invertHeading)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                invertHeading ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Đảo hướng đầu xe và góc quét LiDAR 180 độ nếu ngược hướng thực tế"
            >
              <Compass className="w-3 h-3" />
              <span>{invertHeading ? 'Đảo Đầu: 180°' : 'Đầu Chuẩn: 0°'}</span>
            </button>

            {scanPoints.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 text-[10px] font-mono">
                {scanPoints.length} pts
              </span>
            )}
          </div>

          {/* Canvas Render Element */}
          <canvas
            ref={canvasRef}
            width={850}
            height={560}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`w-full h-full max-w-[960px] max-h-[640px] rounded-xl border border-slate-800 shadow-2xl bg-slate-900 object-contain ${
              dragState ? 'cursor-grabbing' : 'cursor-crosshair'
            } ${isPoseSetMode ? 'ring-2 ring-emerald-500/70' : ''}`}
          />

          {isPoseSetMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-[11px] font-semibold text-emerald-300 shadow-xl">
              Đặt vị trí ban đầu: click chỗ robot đứng → kéo theo hướng mũi xe → thả chuột
            </div>
          )}

          {/* FLOATING ACTION BAR O DAY CANAS: CHINH SUA ZONE HOAC ENDPOINT Y CHANG GIA LAP */}
          {selectedZone && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-2 rounded-xl border shadow-2xl backdrop-blur-md bg-slate-900/95 border-slate-700 text-xs text-slate-100 max-w-[95%] overflow-x-auto">
              {/* Loai Vung Dropdown */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      selectedZone.type === 'KEEP_OUT'
                        ? '#EF4444'
                        : selectedZone.type === 'SPEED_ZONE'
                        ? '#F59E0B'
                        : '#FB7185',
                  }}
                />
                <select
                  value={selectedZone.type || 'KEEP_OUT'}
                  onChange={(e) => handleUpdateSelectedZone('type', e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-bold text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  <option value="KEEP_OUT">Cấm Vào (KEEP OUT)</option>
                  <option value="SPEED_ZONE">Giới Hạn Tốc Độ</option>
                  <option value="NO_STOP">Cấm Dừng (NO STOP)</option>
                </select>
              </div>

              {/* Input Ten Vung */}
              <input
                type="text"
                value={selectedZone.name || ''}
                onChange={(e) => handleUpdateSelectedZone('name', e.target.value)}
                placeholder="Đặt tên vùng..."
                className="w-40 sm:w-48 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none"
              />

              {/* Neu la SPEED_ZONE: input toc do */}
              {selectedZone.type === 'SPEED_ZONE' && (
                <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-amber-400 font-semibold">Tối đa:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="0.5"
                    value={selectedZone.speed_limit || 0.12}
                    onChange={(e) => handleUpdateSelectedZone('speed_limit', parseFloat(e.target.value) || 0.12)}
                    className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-amber-400 text-xs focus:outline-none"
                  />
                  <span className="text-slate-400 text-[10px]">m/s</span>
                </div>
              )}

              {/* Tam & Kich thuoc */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] shrink-0 text-slate-300">
                <span className="text-slate-400">Tâm:</span>
                <span className="font-bold text-cyan-400">
                  ({Number(selectedZone.x).toFixed(2)}, {Number(selectedZone.y).toFixed(2)})
                </span>
                <span className="text-slate-400 ml-1">KT:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="5.0"
                  value={selectedZone.width || 1.0}
                  onChange={(e) => handleUpdateSelectedZone('width', Math.max(0.2, parseFloat(e.target.value) || 0.3))}
                  className="w-11 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  title="Chiều rộng (m)"
                />
                <span>×</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="5.0"
                  value={selectedZone.height || 1.0}
                  onChange={(e) => handleUpdateSelectedZone('height', Math.max(0.2, parseFloat(e.target.value) || 0.3))}
                  className="w-11 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  title="Chiều dài (m)"
                />
                <span>m</span>
              </div>

              {/* Nut Luu Vung */}
              <button
                type="button"
                onClick={handleSaveZones}
                disabled={isSavingZones || !hasUnsavedZones}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
                  hasUnsavedZones
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
                title={isSavingZones ? 'Đang lưu...' : 'Lưu vùng vào CSDL'}
              >
                <Save className={`w-3.5 h-3.5 ${isSavingZones ? 'animate-spin' : ''}`} />
              </button>

              {/* Nut Xoa Vung */}
              <button
                type="button"
                onClick={() => handleDeleteZone(selectedZone.id)}
                className="p-1.5 rounded-lg border text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border-rose-800 cursor-pointer transition-colors shrink-0"
                title="Xóa vùng này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Nut Hoan Tat */}
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer transition-colors shrink-0"
                title="Đóng thanh chỉnh sửa"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          )}

          {/* FLOATING ACTION BAR: CHINH SUA ENDPOINT */}
          {selectedEndpoint && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-2 rounded-xl border shadow-2xl backdrop-blur-md bg-slate-900/95 border-slate-700 text-xs text-slate-100 max-w-[95%] overflow-x-auto">
              {/* Dropdown Loai Endpoint */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getEndpointTemplateInfo(selectedEndpoint.type).color }}
                />
                <select
                  value={selectedEndpoint.type || 'WAYPOINT'}
                  onChange={(e) => handleUpdateSelectedEndpoint('type', e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-bold text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.type} value={tmpl.type}>
                      {tmpl.type === 'WAYPOINT' ? 'Waypoint' : tmpl.type === 'CHARGER' ? 'Trạm Sạc' : 'Điểm Đỗ'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Ten Endpoint */}
              <input
                type="text"
                value={selectedEndpoint.name || ''}
                onChange={(e) => handleUpdateSelectedEndpoint('name', e.target.value)}
                placeholder="Đặt tên điểm mốc..."
                className="w-40 sm:w-48 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none"
              />

              {/* Toa do X, Y */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] shrink-0 text-slate-300">
                <span className="text-slate-400">X:</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedEndpoint.x}
                  onChange={(e) => handleUpdateSelectedEndpoint('x', parseFloat(e.target.value) || 0.0)}
                  className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-cyan-400 focus:outline-none"
                />
                <span className="text-slate-400">Y:</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedEndpoint.y}
                  onChange={(e) => handleUpdateSelectedEndpoint('y', parseFloat(e.target.value) || 0.0)}
                  className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-cyan-400 focus:outline-none"
                />
                <span>m</span>
              </div>

              {/* Nut Dieu Huong Toi Day */}
              <button
                type="button"
                onClick={() => handleSendGoal(selectedEndpoint.x, selectedEndpoint.y, selectedEndpoint.yaw || 0.0)}
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="Điều hướng robot chạy tới điểm này"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Tới Đích</span>
              </button>

              {/* Nut Luu Endpoint */}
              <button
                type="button"
                onClick={handleSaveEndpoints}
                disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
                  hasUnsavedEndpoints
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
                title={isSavingEndpoints ? 'Đang lưu...' : 'Lưu điểm mốc vào CSDL'}
              >
                <Save className={`w-3.5 h-3.5 ${isSavingEndpoints ? 'animate-spin' : ''}`} />
              </button>

              {/* Nut Xoa Endpoint */}
              <button
                type="button"
                onClick={() => handleDeleteEndpoint(selectedEndpoint.id)}
                className="p-1.5 rounded-lg border text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border-rose-800 cursor-pointer transition-colors shrink-0"
                title="Xóa điểm mốc này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Nut Hoan Tat */}
              <button
                type="button"
                onClick={() => setSelectedEndpoint(null)}
                className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer transition-colors shrink-0"
                title="Đóng thanh chỉnh sửa"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          )}

          {/* Bottom helper text */}
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-3">
            <span>Kéo thả để di chuyển Điểm mốc / Vùng • Click vùng trống để chọn đích đến ({LAYOUT2_CONFIG.widthMeters}m × {LAYOUT2_CONFIG.heightMeters}m)</span>
            {selectedGoal && (
              <button
                onClick={() => setSelectedGoal(null)}
                className="text-rose-400 hover:underline cursor-pointer text-[10px]"
              >
                Hủy đích
              </button>
            )}
          </div>
        </div>

        {/* Right: Workspace Control Panel với 3 TAB y hệt Giả lập */}
        <div className="w-84 xl:w-96 bg-slate-900 border-l border-slate-800 flex flex-col p-3 overflow-y-auto space-y-3">
          {/* Card 1: Telemetry Realtime & Hardware */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
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
                {isNavigating ? 'Đang Di Chuyển' : 'Sẵn Sàng'}
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

          {/* Card 2: Dat vi tri ban dau (Initial Pose / 2D Pose Estimate) */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                Vị Trí Ban Đầu Robot
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
                }}
                disabled={isSettingPose}
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
                disabled={isSettingPose}
                className="px-2 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                title="Robot đang đứng tại Trạm Sạc (Home), mũi xe theo hướng yaw của điểm dock"
              >
                <Home className="w-3 h-3" />
                Đặt tại Dock
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refinePoseWithLidar}
                  onChange={(e) => setRefinePoseWithLidar(e.target.checked)}
                  className="accent-emerald-500"
                />
                Tinh chỉnh bằng LiDAR
              </label>
              <button
                type="button"
                onClick={handleRelocalize}
                disabled={isSettingPose || connectionMode !== 'pi5'}
                className="px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border bg-slate-900 text-cyan-300 border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Khớp lại tia LiDAR với bản đồ quanh vị trí hiện tại để sửa trôi odometry"
              >
                <RefreshCw className="w-3 h-3" />
                Định vị lại
              </button>
            </div>

            {isPoseSetMode && (
              <p className="text-[10px] text-emerald-300/90 leading-snug">
                Click vào chỗ robot đang đứng, giữ chuột và kéo theo hướng mũi xe, rồi thả chuột.
              </p>
            )}
          </div>

          {/* TAB SELECTOR: WAYPOINTS vs ZONES vs TELEOP */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveRightTab('WAYPOINTS')}
              className={`flex-1 py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'WAYPOINTS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Điểm Mốc ({endpoints.length})</span>
            </button>
            <button
              onClick={() => setActiveRightTab('ZONES')}
              className={`flex-1 py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'ZONES'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vùng ({zones.length})</span>
            </button>
            <button
              onClick={() => setActiveRightTab('TELEOP')}
              className={`flex-1 py-1.5 rounded text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                activeRightTab === 'TELEOP'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Điều Khiển</span>
            </button>
          </div>

          {/* NOI DUNG TAB 1: DANH SACH DIEM MOC (WAYPOINTS) */}
          {activeRightTab === 'WAYPOINTS' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              {/* Toolbar them & luu endpoint */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddEndpoint('WAYPOINT')}
                    className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm điểm Waypoint trung gian"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Waypoint</span>
                  </button>
                  <button
                    onClick={() => handleAddEndpoint('CHARGER')}
                    className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm trạm sạc pin"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Trạm Sạc</span>
                  </button>
                  <button
                    onClick={() => handleAddEndpoint('PARK')}
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm điểm đỗ chờ"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Điểm Đỗ</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveEndpoints}
                  disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    hasUnsavedEndpoints
                      ? 'bg-emerald-600 text-white shadow-sm animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Lưu tất cả điểm mốc vào CSDL"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingEndpoints ? 'Lưu...' : 'Lưu'}</span>
                </button>
              </div>

              {/* Danh sach Waypoints */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {endpoints.map((ep) => {
                  const tmpl = getEndpointTemplateInfo(ep.type);
                  const isSelected = selectedEndpoint?.id === ep.id;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => {
                        setSelectedEndpoint(ep);
                        setSelectedZone(null);
                      }}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tmpl.color || ep.color }}
                        />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-200 block truncate">{ep.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ({Number(ep.x).toFixed(2)}m, {Number(ep.y).toFixed(2)}m) • {tmpl.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendGoal(ep.x, ep.y, ep.yaw || 0.0);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Tới
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEndpoint(ep.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Xóa điểm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOI DUNG TAB 2: DANH SACH VUNG CHUC NANG (ZONES) */}
          {activeRightTab === 'ZONES' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              {/* Toolbar them & luu zone */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAddZone('KEEP_OUT')}
                    className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm khu vực cấm vào"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cấm Vào</span>
                  </button>
                  <button
                    onClick={() => handleAddZone('SPEED_ZONE')}
                    className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm vùng giới hạn tốc độ"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tốc Độ</span>
                  </button>
                  <button
                    onClick={() => handleAddZone('NO_STOP')}
                    className="px-2 py-1 rounded bg-pink-600/80 hover:bg-pink-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm vùng cấm dừng"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cấm Dừng</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveZones}
                  disabled={isSavingZones || !hasUnsavedZones}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    hasUnsavedZones
                      ? 'bg-emerald-600 text-white shadow-sm animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Lưu tất cả vùng vào CSDL"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingZones ? 'Lưu...' : 'Lưu'}</span>
                </button>
              </div>

              {/* Danh sach Zones */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {zones.map((zone) => {
                  const isSelected = selectedZone?.id === zone.id;
                  const isKeepOut = zone.type === 'KEEP_OUT';
                  const isSpeed = zone.type === 'SPEED_ZONE';
                  const color = isKeepOut ? '#EF4444' : isSpeed ? '#F59E0B' : '#FB7185';
                  return (
                    <div
                      key={zone.id}
                      onClick={() => {
                        setSelectedZone(zone);
                        setSelectedEndpoint(null);
                      }}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-200 block truncate">{zone.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Tâm ({Number(zone.x).toFixed(2)}, {Number(zone.y).toFixed(2)}) • {Number(zone.width).toFixed(1)}m×{Number(zone.height).toFixed(1)}m
                            {isSpeed && ` • ${zone.speed_limit}m/s`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedZone(zone);
                            setSelectedEndpoint(null);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Sửa vùng"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Xóa vùng"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOI DUNG TAB 3: TELEOP DIEU KHIEN THU CONG */}
          {activeRightTab === 'TELEOP' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Điều Khiển Thủ Công (D-Pad & Phím WASD)
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {speedPercent}% ({maxLinearSpeed.toFixed(2)}m/s)
                </span>
              </div>

              {/* D-Pad Buttons */}
              <div className="flex flex-col items-center justify-center gap-2 my-2">
                <button
                  onMouseDown={() => sendTeleopCommand('forward', maxLinearSpeed, 0.0)}
                  onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  onTouchStart={() => sendTeleopCommand('forward', maxLinearSpeed, 0.0)}
                  onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                  title="Tiến lên (W / Up)"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={() => sendTeleopCommand('left', 0.0, 0.5)}
                    onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    onTouchStart={() => sendTeleopCommand('left', 0.0, 0.5)}
                    onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                    title="Quay trái (A / Left)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleStop}
                    className="w-12 h-10 rounded-lg bg-rose-700 hover:bg-rose-600 border border-rose-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-md"
                    title="Dừng khẩn cấp (Space)"
                  >
                    STOP
                  </button>

                  <button
                    onMouseDown={() => sendTeleopCommand('right', 0.0, -0.5)}
                    onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    onTouchStart={() => sendTeleopCommand('right', 0.0, -0.5)}
                    onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                    title="Quay phải (D / Right)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onMouseDown={() => sendTeleopCommand('backward', -maxLinearSpeed, 0.0)}
                  onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  onTouchStart={() => sendTeleopCommand('backward', -maxLinearSpeed, 0.0)}
                  onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                  title="Lùi lại (S / Down)"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Speed slider toi uu cho LiDAR A1M8 quet tron ven */}
              <div className="mt-2 text-xs">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-semibold text-amber-400">
                    Tốc độ quét an toàn: {speedPercent}% ({maxLinearSpeed.toFixed(2)} m/s)
                  </span>
                  <span>Max an toàn: 50%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="50"
                  step="5"
                  value={speedPercent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSpeedPercent(val);
                    setMaxLinearSpeed(Number((val * 0.0048).toFixed(2)));
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="mt-1 text-[9px] text-slate-400 italic">
                  * Giảm tốc độ giúp RPLiDAR A1M8 (5.5Hz) quét đủ mật độ điểm, chống trượt bánh và chống méo bản đồ.
                </p>
              </div>
            </div>
          )}

          {/* Hardware connection info */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">Thông Tin Kết Nối Thực Tế:</span>
            <div className="flex justify-between text-[10px]">
              <span>Cổng Serial RPLiDAR:</span>
              <span className="text-cyan-400 font-mono">{hardwareInfo.port}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Địa chỉ IP Pi 5:</span>
              <span className="text-emerald-400 font-mono">{pi5Ip}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Tia quét nhận diện:</span>
              <span className="text-amber-400 font-mono">{scanPoints.length} điểm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
