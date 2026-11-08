import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  ROS_TOPICS,
  ROS_MSG_TYPES,
  RosbridgeClient,
  parseLaserScan,
  quaternionToYaw,
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
  listMapLayouts,
  fetchMapLayoutImage,
  fetchRos2RuntimeStatus,
  startRos2Navigation,
  updateRos2KeepoutMask,
} from '../../../services/workflowApi';
import { buildCostmapImage, pathMsgToPoints } from './physicalMapCostmap';
import {
  amclPoseIsReliable, composeMapPose, laserPointToMap, localizationFromManager, sendNav2Endpoint,
} from './physicalMapNavigation';
import {
  endpointZoneViolation,
  resizeZoneFromCorner,
  zoneCorners,
  zoneFromCorners,
} from './physicalMapZones';
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
  Square,
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

const SELECTED_MAP_STORAGE_KEY = 'hcrobot.physicalMap.mapId';

// Doi thong so tu API /map/layouts (doc tu .yaml + .pgm) sang cau hinh ve canvas
export const layoutToMapConfig = (layout) => ({
  mapId: layout.map_id,
  name: layout.name,
  widthCells: layout.width,
  heightCells: layout.height,
  resolution: layout.resolution,
  widthMeters: Number((layout.width * layout.resolution).toFixed(3)),
  heightMeters: Number((layout.height * layout.resolution).toFixed(3)),
  originX: layout.origin_x,
  originY: layout.origin_y,
});

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

  // Hardware telemetry is direct from Pi; both views navigate through Nav2.
  const [connectionMode, setConnectionMode] = useState('pi5');
  const [pi5Ip, setPi5Ip] = useState(PI5_IP);

  // Trang thai ket noi
  const [isPiConnected, setIsPiConnected] = useState(false);
  const [isRosConnected, setIsRosConnected] = useState(false);
  const isWsConnected = connectionMode === 'pi5' ? isPiConnected : isRosConnected;
  const [localizationReady, setLocalizationReady] = useState(false);
  const localizationRef = useRef({ mapId: null, requestedAt: 0, confirmed: false });
  // /localization/state tu localization_manager.py tren robot (co thi uu tien hon kiem tra AMCL o Web)
  const [locManager, setLocManager] = useState({ msg: null, at: 0 });
  const locManagerRef = useRef({ msg: null, at: 0 });
  const navigationRef = useRef({ poseAt: 0, costmapAt: 0, costmap: null, healthAt: 0, health: null });
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
  // Duong di A* Pi dang bam theo (cac chang con lai) va map Pi dang nap
  const [navPath, setNavPath] = useState([]);

  // Che do ROS 2 (Nav2 tren laptop WSL): trang thai stack, lop costmap, thoi diem gui goal
  const [nav2Runtime, setNav2Runtime] = useState({ mode: 'OFFLINE', activeMap: null });
  const [isStartingNav2, setIsStartingNav2] = useState(false);
  const [showCostmap, setShowCostmap] = useState(true);
  const costmapRef = useRef(null); // { canvas, originX, originY, widthM, heightM }
  const [costmapVersion, setCostmapVersion] = useState(0);
  const lastGoalSentAtRef = useRef(0);

  // Toc do dieu khien: Giam ve 25% (0.12 m/s) de RPLiDAR A1M8 quet tron ven 360 do
  const [speedPercent, setSpeedPercent] = useState(DEFAULT_SAFE_SPEED_PERCENT);
  const [maxLinearSpeed, setMaxLinearSpeed] = useState(DEFAULT_SAFE_LINEAR_SPEED);
  // Danh sach Endpoints (Waypoints) va Zones quan ly thoi gian thuc
  const [endpoints, setEndpoints] = useState(DEFAULT_LAB_WAYPOINTS);
  const [zones, setZones] = useState(DEFAULT_LAB_ZONES);

  // Che do Ghim nhieu Endpoint truc tiep tren ban do (Click de them)
  const [isAddEndpointMode, setIsAddEndpointMode] = useState(false);
  const [addEndpointType, setAddEndpointType] = useState('WAYPOINT'); // 'WAYPOINT' | 'CHARGER' | 'PARK'
  const [navigatingEndpointId, setNavigatingEndpointId] = useState(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState(null);
  const clickStartRef = useRef(null);

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
  const [isSettingPose, setIsSettingPose] = useState(false);

  // Keo tha tren Canvas
  const [dragState, setDragState] = useState(null);
  const isDraggingRef = useRef(false);

  // Ve vung bang chuot: chon loai vung roi keo hinh chu nhat tren map
  const [zoneDrawType, setZoneDrawType] = useState(null); // null | 'KEEP_OUT' | 'SPEED_ZONE' | 'NO_STOP'
  const [zoneDraft, setZoneDraft] = useState(null); // { type, a: {x,y}, b: {x,y} } toa do the gioi

  // Ban do dang chon (thong so tu .yaml) va anh map (.pgm giai ma thanh canvas)
  const [mapLayouts, setMapLayouts] = useState([]);
  const [mapConfig, setMapConfig] = useState(LAYOUT2_CONFIG);
  const [mapImage, setMapImage] = useState(null);
  const isLegacyMap = mapConfig.mapId === LAYOUT2_CONFIG.mapId;
  const navigationMapReady = isRosConnected && nav2Runtime.mode === 'NAVIGATION' && nav2Runtime.activeMap === mapConfig.mapId;
  const managerLoc = localizationFromManager(locManager.msg, locManager.at);
  const isLocalized = managerLoc.fresh ? managerLoc.localized : localizationReady;
  const dockEndpoint = endpoints.find((ep) => ep.id === 'dock' || ['CHARGER', 'dock'].includes(ep.type));

  // Danh sach map SLAM da luu (robot/maps/*.yaml) cho o chon map
  useEffect(() => {
    let isMounted = true;
    listMapLayouts()
      .then((layouts) => {
        if (!isMounted) return;
        setMapLayouts(layouts);
        const storedId = localStorage.getItem(SELECTED_MAP_STORAGE_KEY);
        const stored = layouts.find((m) => m.map_id === storedId);
        if (stored) setMapConfig(layoutToMapConfig(stored));
      })
      .catch((err) => console.warn('[AdminPhysicalMapTab] Failed to list map layouts:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectMap = (mapId) => {
    if (mapId === mapConfig.mapId) return;
    if (
      (hasUnsavedEndpoints || hasUnsavedZones) &&
      !window.confirm('Điểm mốc / vùng của map hiện tại chưa lưu. Vẫn chuyển map và bỏ thay đổi?')
    ) {
      return;
    }
    const layout = mapLayouts.find((m) => m.map_id === mapId);
    if (!layout) return;
    localStorage.setItem(SELECTED_MAP_STORAGE_KEY, mapId);
    handleStop();
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    setMapConfig(layoutToMapConfig(layout));
    setSelectedEndpoint(null);
    setSelectedZone(null);
    setSelectedGoal(null);
    setNavigatingEndpointId(null);
    setIsAddEndpointMode(false);
    setNavPath([]);
    setPoseDraft(null);
    setTrail([]);
    setHasUnsavedEndpoints(false);
    setHasUnsavedZones(false);
    setNavStatus(`Đã chuyển sang bản đồ "${layout.name}"`);
  };

  // Nap anh map + diem moc / vung cua map dang chon
  useEffect(() => {
    let isMounted = true;
    const mapId = mapConfig.mapId;
    const isLegacy = mapId === LAYOUT2_CONFIG.mapId;
    setMapImage(null);
    setEndpoints(isLegacy ? DEFAULT_LAB_WAYPOINTS : []);
    setZones(isLegacy ? DEFAULT_LAB_ZONES : []);

    fetchMapLayoutImage(mapId)
      .then((img) => {
        if (isMounted) setMapImage(img);
      })
      .catch((err) => {
        console.warn(`[AdminPhysicalMapTab] Failed to load map image "${mapId}":`, err);
        if (!isLegacy) return;
        // Du phong khi backend chua chay: anh tinh layout2.png trong frontend/public
        const img = new Image();
        img.src = '/maps/layout2.png';
        img.onload = () => {
          if (isMounted) setMapImage(img);
        };
      });

    const loadData = async () => {
      if (isLegacy) {
        try {
          // Diem moc mac dinh di kem layout2.json
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
      }

      // Dong bo tu CSDL, chi lay diem / vung thuoc map dang chon.
      // layout2 giu mac dinh neu CSDL rong; map moi thi danh sach rong la dung.
      try {
        const dbWps = await fetchWaypoints(mapId);
        if (isMounted && Array.isArray(dbWps) && (dbWps.length > 0 || !isLegacy)) {
          setEndpoints(dbWps);
        }
      } catch (e) {
        // Giu danh sach hien tai neu API loi
      }

      try {
        const dbZones = await fetchZones(mapId);
        if (isMounted && Array.isArray(dbZones) && (dbZones.length > 0 || !isLegacy)) {
          setZones(dbZones);
        }
      } catch (e) {
        // Giu danh sach hien tai neu API loi
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [mapConfig.mapId]);

  // Nav2's map-specific keepout mask is updated when zones are saved below.
  useEffect(() => {
    if (!rosClientRef.current?.isConnected) return undefined;
    const timer = setTimeout(() => {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(zones));
    }, 400);
    return () => clearTimeout(timer);
  }, [zones, isRosConnected]);

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
          setIsPiConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            // Pi robot_pose and scan_points use the Pi's independent odom frame.
            // Only ROS map-frame poses/scans may drive the map overlay.

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

          } catch (err) {
            console.warn('[AdminPhysicalMapTab] Pi5 WS parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsPiConnected(false);
          reconnectTimeout = setTimeout(connectPi5Ws, 2500);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setIsPiConnected(false);
        };
      } catch (err) {
        if (!isMounted) return;
        setIsPiConnected(false);
        reconnectTimeout = setTimeout(connectPi5Ws, 3000);
      }
    };

    connectPi5Ws();

    return () => {
      isMounted = false;
      setIsPiConnected(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        pi5WsRef.current = null;
      }
    };
  }, [connectionMode, pi5Ip]);

  // Localization, planning and obstacle avoidance use ROS in both hardware views.
  useEffect(() => {
    let active = true;
    const client = new RosbridgeClient(ROSBRIDGE_DEFAULT_URL, {
      onOpen: () => {
        if (!active) return;
        setIsRosConnected(true);
        setNavStatus('Đã kết nối Nav2. Bật Navigation với map đã chọn và đặt vị trí ban đầu.');
      },
      onClose: () => {
        if (!active) return;
        setIsRosConnected(false);
        localizationRef.current.confirmed = false;
        setLocalizationReady(false);
        navigationRef.current.poseAt = 0;
        navigationRef.current.costmapAt = 0;
      },
      onError: () => {
        if (!active) return;
        setIsRosConnected(false);
      },
    });

    rosClientRef.current = client;
    client.connect();

    // Vi tri xe tren map = (map -> odom tu /tf) ∘ (odom -> base_link tu /odom).
    // map -> odom do SLAM Toolbox (che do quet map) hoac AMCL (Navigation) phat,
    // nen cach nay chay ca khi quet map, luc chua co /amcl_pose.
    let mapToOdom = null;
    let odom = null;
    navigationRef.current = { poseAt: 0, costmapAt: 0, costmap: null, healthAt: 0, health: null };
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    const stripSlash = (frame) => String(frame || '').replace(/^\//, '');
    const updateMapPose = () => {
      if (!mapToOdom || !odom || Date.now() - mapToOdom.receivedAt > 2000 || Date.now() - odom.receivedAt > 1000) return;
      const pose = composeMapPose(mapToOdom, odom);
      if (!pose) return;
      navigationRef.current.poseAt = Date.now();
      setRobotPose(pose);
      setTrail((prev) => [...prev.slice(-150), { x: pose.x, y: pose.y }]);
    };

    client.subscribe(
      '/tf',
      'tf2_msgs/TFMessage',
      (msg) => {
        for (const t of msg?.transforms || []) {
          if (stripSlash(t?.header?.frame_id) !== 'map' || stripSlash(t?.child_frame_id) !== 'odom') continue;
          const tr = t.transform?.translation;
          const rot = t.transform?.rotation;
          mapToOdom = { x: tr?.x ?? 0, y: tr?.y ?? 0,
            yaw: quaternionToYaw(rot?.z ?? 0, rot?.w ?? 1), receivedAt: Date.now() };
          updateMapPose();
        }
      }
      // Khong throttle /tf: map->odom xen giua cac TF khac, throttle co the lam roi mat no.
    );

    client.subscribe(
      ROS_TOPICS.ODOM,
      ROS_MSG_TYPES.ODOMETRY,
      (msg) => {
        const pos = msg?.pose?.pose?.position;
        const ori = msg?.pose?.pose?.orientation;
        if (!pos || stripSlash(msg?.header?.frame_id) !== 'odom') return;
        odom = { x: pos.x, y: pos.y, yaw: quaternionToYaw(ori?.z ?? 0, ori?.w ?? 1),
          receivedAt: Date.now(),
          linearVelocity: msg?.twist?.twist?.linear?.x || 0, angularVelocity: msg?.twist?.twist?.angular?.z || 0 };
        updateMapPose();
      },
      { throttleRate: 50 }
    );

    client.subscribe(
      ROS_TOPICS.AMCL_POSE,
      ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
      (msg) => {
        if (stripSlash(msg?.header?.frame_id) !== 'map') return;
        const pos = msg?.pose?.pose?.position;
        if (pos) {
          const request = localizationRef.current;
          const stamp = Number(msg?.header?.stamp?.sec || 0) * 1000 + Number(msg?.header?.stamp?.nanosec || 0) / 1e6;
          // Robot co localization_manager => no quyet dinh (so ca LiDAR voi map), Web khong tu danh gia.
          const managerActive = localizationFromManager(locManagerRef.current.msg, locManagerRef.current.at).fresh;
          if (!managerActive && request.mapId === mapConfig.mapId && request.requestedAt && stamp >= request.requestedAt - 50) {
            const reliable = amclPoseIsReliable(msg);
            if (reliable !== request.confirmed) {
              request.confirmed = reliable;
              setLocalizationReady(reliable);
              setNavStatus(reliable
                ? 'AMCL có độ bất định thấp. Kiểm tra laser khớp tường trước khi chọn endpoint.'
                : 'AMCL chưa ổn định. Kiểm tra vị trí/hướng ban đầu và LiDAR khớp tường trước khi đi.');
            }
          }
          // AMCL reports the pose at a scan's timestamp. Do not alternate it with
          // the current TF + odometry pose: delayed scans make the marker jump
          // backwards. Only updateMapPose owns the displayed pose and freshness.
        }
      },
      { throttleRate: 50 }
    );

    client.subscribe('/robot/sensor_health', ROS_MSG_TYPES.STRING, (msg) => {
      try {
        navigationRef.current.health = JSON.parse(msg.data);
        navigationRef.current.healthAt = Date.now();
        if (!navigationRef.current.health.pi_ws_connected || !navigationRef.current.health.lidar_live) {
          localizationRef.current.confirmed = false;
          setLocalizationReady(false);
        }
      } catch { /* Wait for a valid health sample. */ }
    });

    // Gac cong dinh vi tren robot: UNLOCALIZED / LOCALIZING / LOCALIZED / LOCALIZATION_LOST + ly do.
    client.subscribe('/localization/state', ROS_MSG_TYPES.STRING, (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const previous = locManagerRef.current.msg?.state;
        locManagerRef.current = { msg: data, at: Date.now() };
        setLocManager(locManagerRef.current);
        if (previous && previous !== data.state && data.reason) setNavStatus(data.reason);
      } catch { /* bo qua goi tin hong */ }
    });

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
          setNavigatingEndpointId(null);
        }
      }
    );

    // Duong Nav2 vua lap (planner, ~1 Hz khi dang chay) => ve len map thay cho duong thang.
    client.subscribe(
      '/plan',
      'nav_msgs/Path',
      (msg) => {
        const pts = pathMsgToPoints(msg);
        if (pts.length > 0) setNavPath(pts);
      },
      { throttleRate: 500 }
    );

    // Ket qua goal Nav2 do bridge doc tu /navigate_to_pose/_action/status.
    client.subscribe('/robot/nav_result', ROS_MSG_TYPES.STRING, (msg) => {
      let result = null;
      try {
        result = JSON.parse(msg?.data || '{}').status || null;
      } catch {
        result = null;
      }
      if (!result) return;
      // Gui goal moi khi dang chay => Nav2 huy goal cu (ABORTED); bo qua de khong xoa goal moi.
      if (result !== 'SUCCEEDED' && Date.now() - lastGoalSentAtRef.current < 1500) return;
      setIsNavigating(false);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);
      setNavPath([]);
      if (result === 'SUCCEEDED') setNavStatus('Nav2: đã tới đích');
      else if (result === 'CANCELED') setNavStatus('Nav2: đã huỷ đường đi');
      else setNavStatus('Nav2: không tới được đích (ABORTED). Kiểm tra vị trí ban đầu, vùng cấm, hoặc log Nav2.');
    });

    // Costmap toan cuc cua Nav2 (tuong + vung noi + vung cam) ve chong len map.
    client.subscribe(
      '/global_costmap/costmap',
      ROS_MSG_TYPES.OCCUPANCY_GRID,
      (msg) => {
        const img = buildCostmapImage(msg);
        if (!img || stripSlash(msg?.header?.frame_id) !== 'map') return;
        navigationRef.current.costmap = msg;
        navigationRef.current.costmapAt = Date.now();
        const off = document.createElement('canvas');
        off.width = img.width;
        off.height = img.height;
        off.getContext('2d').putImageData(new ImageData(img.rgba, img.width, img.height), 0, 0);
        costmapRef.current = {
          canvas: off,
          originX: img.originX,
          originY: img.originY,
          widthM: img.width * img.resolution,
          heightM: img.height * img.resolution,
        };
        setCostmapVersion((v) => v + 1);
      },
      { throttleRate: 2000 }
    );

    return () => {
      active = false;
      client.disconnect();
      setIsRosConnected(false);
      rosClientRef.current = null;
      costmapRef.current = null;
    };
  }, [connectionMode, mapConfig.mapId]);

  // Trang thai stack ROS 2 tren laptop (OFFLINE / MAPPING / EXPLORING / NAVIGATION + map dang nap)
  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetchRos2RuntimeStatus()
        .then((d) => {
          if (alive) setNav2Runtime({ mode: d?.mode || 'OFFLINE', activeMap: d?.active_map || null });
        })
        .catch(() => {
          if (alive) setNav2Runtime({ mode: 'OFFLINE', activeMap: null });
        });
    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Bat map_server + AMCL + Nav2 voi map dang chon (backend sinh lai mask vung cam truoc).
  const handleStartNav2 = async () => {
    if (isStartingNav2) return;
    if (
      ['MAPPING', 'EXPLORING'].includes(nav2Runtime.mode) &&
      !window.confirm('Đang quét map. Bật Navigation sẽ dừng phiên quét (map chưa lưu sẽ mất). Tiếp tục?')
    ) {
      return;
    }
    setIsStartingNav2(true);
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    navigationRef.current.poseAt = 0;
    navigationRef.current.costmapAt = 0;
    setNavStatus(`Đang bật Nav2 với map "${mapConfig.mapId}" (map_server + AMCL + Nav2, ~20-30 giây)...`);
    try {
      await startRos2Navigation(mapConfig.mapId, connectionMode === 'pi5' ? pi5Ip : null);
      setNav2Runtime({ mode: 'STARTING', activeMap: mapConfig.mapId });
      setNavStatus(
        `Đang khởi động Nav2 cho "${mapConfig.mapId}". Khi báo NAVIGATION: đặt vị trí ban đầu (Chọn trên map), kiểm tra chấm LiDAR nằm đè lên tường, rồi bấm Tới.`
      );
    } catch (err) {
      setNavStatus(`Không bật được Nav2: ${err.message}`);
    } finally {
      setIsStartingNav2(false);
    }
  };

  // Chuyen doi Toa do Thuc (Meters) sang Canvas Pixels
  const worldToCanvas = useCallback(
    (worldX, worldY, canvasWidth, canvasHeight) =>
      transformWorldToCanvas(worldX, worldY, canvasWidth, canvasHeight, mapConfig),
    [mapConfig]
  );

  // Chuyen doi Canvas Pixels sang Toa do Thuc (Meters)
  const canvasToWorld = useCallback(
    (canvasX, canvasY, canvasWidth, canvasHeight) =>
      transformCanvasToWorld(canvasX, canvasY, canvasWidth, canvasHeight, mapConfig),
    [mapConfig]
  );

  // ==========================================
  // QUAN LY ENDPOINTS (WAYPOINTS)
  // ==========================================
  const handleAddEndpoint = (type = 'WAYPOINT', customCoords = null) => {
    const tmpl = getEndpointTemplateInfo(type);
    const count = endpoints.length + 1;
    const typeLabel = type === 'CHARGER' ? 'Trạm Sạc' : type === 'PARK' ? 'Điểm Đỗ' : 'Điểm Mốc';
    const newEp = {
      id: `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${typeLabel} #${count}`,
      type,
      x: customCoords ? Number(customCoords.x.toFixed(2)) : 1.50,
      y: customCoords ? Number(customCoords.y.toFixed(2)) : 0.00,
      yaw: 0.0,
      color: tmpl.color || '#3B82F6',
      map_id: mapConfig.mapId,
    };
    const nextList = [...endpoints, newEp];
    setEndpoints(nextList);
    setSelectedEndpoint(newEp);
    setSelectedZone(null);
    setHasUnsavedEndpoints(true);
    setActiveRightTab('WAYPOINTS');
    setNavStatus(`Đã tạo ${newEp.name} tại (${newEp.x}m, ${newEp.y}m)`);

    saveWaypoint(newEp).catch((err) => {
      console.warn('Lỗi lưu endpoint vào backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
  };

  const handleNavigateToEndpoint = (ep) => {
    if (!ep) return;
    setSelectedEndpoint(ep);
    setSelectedZone(null);
    setNavigatingEndpointId(ep.id);
    // Bi tu choi (vung cam, chua dinh vi...) thi giu nguyen thong bao loi cua handleSendGoal.
    if (!handleSendGoal(Number(ep.x) || 0.0, Number(ep.y) || 0.0, Number(ep.yaw) || 0.0)) return;
    setNavStatus(`Bấm chọn '${ep.name}' → Đang điều hướng robot tới (${Number(ep.x).toFixed(2)}, ${Number(ep.y).toFixed(2)})...`);
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
        await saveWaypoint({ ...ep, map_id: mapConfig.mapId });
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
    if (navigatingEndpointId === id) {
      setNavigatingEndpointId(null);
      setIsNavigating(false);
      setSelectedGoal(null);
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
  // Luu 1 vung vao CSDL roi tao lai mask Nav2 (vung cam + gioi han toc do): Nav2 dang chay
  // thi ap dung ngay, khong can bam "Lưu".
  const persistZone = (zone, nextList, prefix) => {
    saveZone({ ...zone, map_id: mapConfig.mapId })
      .then(() => refreshNav2Keepout(prefix))
      .catch((err) => {
        console.warn('Lỗi lưu zone vào backend:', err.message);
        setHasUnsavedZones(true);
        setNavStatus(`Chưa lưu được vùng "${zone.name}" vào CSDL: ${err.message}`);
      });
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
  };

  // rect = { x, y, width, height } (vung ve bang chuot); khong co thi dat 1x1 m giua map.
  const handleAddZone = (type = 'KEEP_OUT', rect = null) => {
    const tmpl = ZONE_TEMPLATES.find((t) => t.type === type) || ZONE_TEMPLATES[0];
    const count = zones.length + 1;
    const prefix = type === 'KEEP_OUT' ? 'Cấm Vào' : type === 'SPEED_ZONE' ? 'Giới Hạn Tốc Độ' : 'Cấm Dừng';
    const geometry = rect || {
      x: Number((mapConfig.originX + mapConfig.widthMeters / 2).toFixed(2)),
      y: Number((mapConfig.originY + mapConfig.heightMeters / 2).toFixed(2)),
      width: 1.0,
      height: 1.0,
    };
    const newZone = {
      id: `zone-${Date.now().toString(36)}`,
      name: `${prefix} #${count}`,
      type,
      ...geometry,
      speed_limit: tmpl.defaultSpeed,
      description: tmpl.description,
      map_id: mapConfig.mapId,
    };
    const nextList = [...zones, newZone];
    setZones(nextList);
    setSelectedZone(newZone);
    setSelectedEndpoint(null);
    setActiveRightTab('ZONES');
    persistZone(newZone, nextList, `Đã tạo vùng "${newZone.name}" (${newZone.width} x ${newZone.height} m)`);
  };

  const toggleZoneDraw = (type) => {
    setZoneDraft(null);
    setZoneDrawType((cur) => (cur === type ? null : type));
    setIsAddEndpointMode(false);
    setIsPoseSetMode(false);
    setActiveRightTab('ZONES');
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

  // KEEP_OUT -> mask Keepout Filter, SPEED_ZONE -> mask Speed Filter cua Nav2
  // (robot/maps/keepout|speed/<map>.pgm); Nav2 dang chay thi nap lai ngay, khong thi dung khi
  // bat Navigation lan sau. NO_STOP khong co mask: chan endpoint ngay tren Web (handleSendGoal).
  const refreshNav2Keepout = (prefix) => {
    updateRos2KeepoutMask(mapConfig.mapId)
      .then((res) =>
        setNavStatus(
          `${prefix} • Nav2: ${res?.keepout_zones ?? 0} vùng cấm, ${res?.speed_zones ?? 0} vùng giới hạn tốc độ ${
            res?.reloaded ? 'đã nạp lại ngay' : 'sẽ áp dụng khi bật Navigation'
          }`
        )
      )
      .catch((err) => {
        console.warn('[AdminPhysicalMapTab] Cập nhật mask vùng lỗi:', err.message);
        setNavStatus(`${prefix} • Chưa cập nhật được vùng cho Nav2: ${err.message}`);
      });
  };

  const handleSaveZones = async () => {
    setIsSavingZones(true);
    try {
      for (const z of zones) {
        await saveZone({ ...z, map_id: mapConfig.mapId });
      }
      setHasUnsavedZones(false);
      setNavStatus('Đã lưu toàn bộ vùng chức năng vào CSDL');
      refreshNav2Keepout('Đã lưu vùng chức năng');

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

    deleteZone(id)
      .then(() => refreshNav2Keepout(`Đã xóa vùng "${target?.name || id}"`))
      .catch((err) => {
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
    const scale = Math.min(availWidth / mapConfig.widthMeters, availHeight / mapConfig.heightMeters);
    const offsetX = pad + (availWidth - mapConfig.widthMeters * scale) / 2;
    const offsetY = pad + (availHeight - mapConfig.heightMeters * scale) / 2;

    const roomW = mapConfig.widthMeters * scale;
    const roomH = mapConfig.heightMeters * scale;

    // Nen phong Lab
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(offsetX, offsetY, roomW, roomH);

    // 3. Render Ban do SLAM cua map dang chon
    if (mapImage) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(mapImage, offsetX, offsetY, roomW, roomH);
      ctx.restore();
    }

    // 3b. Lop costmap Nav2 (che do ROS 2): do = vat can/vung cam, cam = vung noi an toan
    const costmap = costmapRef.current;
    if (showCostmap && costmap) {
      const tl = worldToCanvas(costmap.originX, costmap.originY + costmap.heightM, width, height);
      const br = worldToCanvas(costmap.originX + costmap.widthM, costmap.originY, width, height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(costmap.canvas, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    }

    // Luoi toa do 0.5m
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= mapConfig.widthMeters; x += 0.5) {
      const px = offsetX + x * scale;
      ctx.beginPath();
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + roomH);
      ctx.stroke();
    }
    for (let y = 0; y <= mapConfig.heightMeters; y += 0.5) {
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

    // 4b. Vung dang ve bang chuot (chua tha): khung net dut + kich thuoc
    if (zoneDraft) {
      const { a, b } = zoneDraft;
      const tl = worldToCanvas(Math.min(a.x, b.x), Math.max(a.y, b.y), width, height);
      const br = worldToCanvas(Math.max(a.x, b.x), Math.min(a.y, b.y), width, height);
      const tmpl = ZONE_TEMPLATES.find((t) => t.type === zoneDraft.type) || ZONE_TEMPLATES[0];
      ctx.save();
      ctx.fillStyle = tmpl.bgColor;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = tmpl.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = tmpl.color;
      ctx.fillText(
        `${tmpl.badge} ${Math.abs(a.x - b.x).toFixed(2)} x ${Math.abs(a.y - b.y).toFixed(2)} m`,
        tl.x + 4,
        Math.max(12, tl.y - 5)
      );
      ctx.restore();
    }

    // 5. Ve tia Laser RPLiDAR thoi gian thuc
    const { x: rpx, y: rpy } = worldToCanvas(robotPose.x, robotPose.y, width, height);
    const effectiveYaw = robotPose.yaw + (invertHeading ? Math.PI : 0);

    if (showLaserScan && navigationRef.current.poseAt && scanPoints.length > 0) {
      for (const pt of scanPoints) {
        const hit = laserPointToMap(pt, { ...robotPose, yaw: effectiveYaw });
        if (!hit) continue;
        const { x: wx, y: wy } = hit;

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
        const isHovered = hoveredEndpointId === ep.id;
        const isNavTarget =
          isNavigating &&
          (navigatingEndpointId === ep.id ||
            (selectedGoal && Math.hypot(ep.x - selectedGoal.x, ep.y - selectedGoal.y) < 0.15));
        const tmpl = getEndpointTemplateInfo(ep.type);
        const epColor = tmpl.color || ep.color || '#3B82F6';

        // Halo khi dang di toi, hover hoac duoc chon
        if (isNavTarget) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 16, 0, Math.PI * 2);
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (isHovered) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (isSelected) {
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
        ctx.arc(wpx, wpy, isNavTarget ? 8.0 : isHovered ? 6.5 : isSelected ? 6.5 : 5.0, 0, Math.PI * 2);
        ctx.fillStyle = isNavTarget ? '#22D3EE' : epColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = isNavTarget ? 2.0 : 1.5;
        ctx.stroke();

        // Nhãn tên điểm mốc nhỏ gọn, tinh tế
        const nameText = isNavTarget ? `🎯 ${ep.name}` : ep.name || 'Điểm mốc';
        const badgeW = Math.max(22, nameText.length * 5.2 + 12);
        const badgeH = 14;
        const bx = wpx - badgeW / 2;
        const by = wpy - 20;

        ctx.fillStyle = isNavTarget ? '#083344' : isSelected ? '#18181B' : isHovered ? '#1E293B' : '#0F172A';
        ctx.fillRect(bx, by, badgeW, badgeH);
        ctx.strokeStyle = isNavTarget ? '#22D3EE' : isSelected ? epColor : isHovered ? '#38BDF8' : '#475569';
        ctx.lineWidth = isNavTarget ? 1.5 : 0.8;
        ctx.strokeRect(bx, by, badgeW, badgeH);

        // Dot mau loai
        ctx.beginPath();
        ctx.arc(bx + 4.5, by + badgeH / 2, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = isNavTarget ? '#22D3EE' : epColor;
        ctx.fill();

        ctx.fillStyle = isNavTarget ? '#67E8F9' : isSelected || isHovered ? '#FFFFFF' : '#CBD5E1';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nameText.length > 22 ? nameText.slice(0, 20) + '...' : nameText, bx + badgeW / 2 + 2, by + 10);
      }
    }

    // 7b. Ve duong di A* Pi dang bam theo (tu robot qua cac chang con lai)
    if (navPath.length > 0) {
      const startPt = worldToCanvas(robotPose.x, robotPose.y, width, height);
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      for (const [px, py] of navPath) {
        const p = worldToCanvas(px, py, width, height);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#22D3EE';
      for (const [px, py] of navPath.slice(0, -1)) {
        const p = worldToCanvas(px, py, width, height);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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

    const robW = 0.33 * scale;
    const robH = 0.17 * scale;

    ctx.fillStyle = navigationRef.current.poseAt ? '#F59E0B' : '#64748B';
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
    ctx.fillText('Gốc map (0,0)', opx + 6, opy + 12);
  }, [
    mapImage,
    mapConfig,
    showCostmap,
    costmapVersion,
    connectionMode,
    robotPose,
    scanPoints,
    showLaserScan,
    showLaserRays,
    showZones,
    showEndpoints,
    trail,
    selectedGoal,
    navPath,
    endpoints,
    zones,
    selectedEndpoint,
    selectedZone,
    invertHeading,
    poseDraft,
    worldToCanvas,
    isNavigating,
    navigatingEndpointId,
    hoveredEndpointId,
    zoneDraft,
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
    const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);

    // 0. Che do Dat vi tri ban dau: click = vi tri, keo = huong dau xe
    if (isPoseSetMode) {
      setPoseDraft({ x: worldX, y: worldY, yaw: robotPose.yaw });
      setDragState({ type: 'POSE', mouseStartX: canvasX, mouseStartY: canvasY });
      isDraggingRef.current = true;
      return;
    }

    // 0b. Che do Ghim Endpoint: Click de dat endpoint moi ngay tai vi tri click tren ban do
    if (isAddEndpointMode) {
      handleAddEndpoint(addEndpointType, { x: worldX, y: worldY });
      return;
    }

    // 0c. Che do Ve vung: nhan chuot = 1 goc, keo toi goc doi dien, tha chuot = tao vung
    if (zoneDrawType) {
      const p = { x: worldX, y: worldY };
      setZoneDraft({ type: zoneDrawType, a: p, b: p });
      setDragState({ type: 'ZONE_DRAW' });
      isDraggingRef.current = true;
      return;
    }

    // 0d. Vung dang chon: nhan trung o vuong o goc (<= 8px) => keo de doi kich thuoc
    if (showZones && selectedZone) {
      const corners = zoneCorners(selectedZone);
      const hit = Object.keys(corners).find((key) => {
        const c = worldToCanvas(corners[key].x, corners[key].y, canvas.width, canvas.height);
        return Math.hypot(canvasX - c.x, canvasY - c.y) <= 8;
      });
      if (hit) {
        clickStartRef.current = { type: 'ZONE', startX: canvasX, startY: canvasY, hasMoved: false };
        setDragState({ type: 'ZONE_RESIZE', id: selectedZone.id, corner: hit });
        isDraggingRef.current = true;
        return;
      }
    }

    // 1. Kiem tra click trúng Endpoint (r <= 18px)
    if (showEndpoints) {
      for (const ep of endpoints) {
        const { x: epx, y: epy } = worldToCanvas(ep.x, ep.y, canvas.width, canvas.height);
        const dist = Math.hypot(canvasX - epx, canvasY - epy);
        if (dist <= 18) {
          setSelectedEndpoint(ep);
          setSelectedZone(null);
          setActiveRightTab('WAYPOINTS');
          clickStartRef.current = {
            type: 'ENDPOINT',
            ep,
            startX: canvasX,
            startY: canvasY,
            hasMoved: false,
          };
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
          clickStartRef.current = {
            type: 'ZONE',
            zone,
            startX: canvasX,
            startY: canvasY,
            hasMoved: false,
          };
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

    // 3. Neu khong trung: Bo chon (Khong tu dong chay robot khi click vung trong)
    setSelectedEndpoint(null);
    setSelectedZone(null);
    clickStartRef.current = null;
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Kiem tra hover len Endpoint khi khong keo tha de tao con tro chuot pointer
    if (!dragState && showEndpoints) {
      let hovered = null;
      for (const ep of endpoints) {
        const { x: epx, y: epy } = worldToCanvas(ep.x, ep.y, canvas.width, canvas.height);
        if (Math.hypot(canvasX - epx, canvasY - epy) <= 18) {
          hovered = ep.id;
          break;
        }
      }
      setHoveredEndpointId(hovered);
    }

    if (!dragState) return;

    if (clickStartRef.current) {
      const moved = Math.hypot(canvasX - clickStartRef.current.startX, canvasY - clickStartRef.current.startY);
      if (moved > 6) {
        clickStartRef.current.hasMoved = true;
      }
    }

    if (dragState.type === 'POSE') {
      const dx = canvasX - dragState.mouseStartX;
      const dy = canvasY - dragState.mouseStartY;
      // Truc Y canvas huong xuong, truc Y the gioi huong len => dao dau dy
      if (Math.hypot(dx, dy) > 8) {
        setPoseDraft((prev) => (prev ? { ...prev, yaw: Math.atan2(-dy, dx) } : prev));
      }
      return;
    }

    if (dragState.type === 'ZONE_DRAW' || dragState.type === 'ZONE_RESIZE') {
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      if (dragState.type === 'ZONE_DRAW') {
        setZoneDraft((prev) => (prev ? { ...prev, b: { x: worldX, y: worldY } } : prev));
      } else if (selectedZone) {
        const updated = {
          ...selectedZone,
          ...resizeZoneFromCorner(selectedZone, dragState.corner, { x: worldX, y: worldY }),
        };
        setSelectedZone(updated);
        setZones((prev) => prev.map((z) => (z.id === dragState.id ? updated : z)));
      }
      return;
    }

    const { scale } = transformWorldToCanvas(0, 0, canvas.width, canvas.height, mapConfig);
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
    }
  };

  const handleCanvasMouseUp = () => {
    const finishedDrag = dragState;
    const wasPoseDrag = finishedDrag?.type === 'POSE';
    const clickCandidate = clickStartRef.current;

    setDragState(null);
    isDraggingRef.current = false;
    clickStartRef.current = null;

    // Tha chuot sau khi ve: tao vung (qua nho = bam nham, bo qua) va thoat che do ve
    if (finishedDrag?.type === 'ZONE_DRAW') {
      const draft = zoneDraft;
      setZoneDraft(null);
      setZoneDrawType(null);
      const rect = draft && zoneFromCorners(draft.a, draft.b);
      if (rect) {
        handleAddZone(draft.type, rect);
      } else {
        setNavStatus('Vùng quá nhỏ: nhấn giữ chuột rồi kéo thành hình chữ nhật trên bản đồ (mỗi cạnh tối thiểu 20 cm).');
      }
      return;
    }

    // Keo/doi kich thuoc vung xong: luu ngay + cap nhat Nav2
    if ((finishedDrag?.type === 'ZONE' || finishedDrag?.type === 'ZONE_RESIZE') && clickCandidate?.hasMoved) {
      const zone = zones.find((z) => z.id === finishedDrag.id);
      if (zone) {
        persistZone(zone, zones, `Đã cập nhật vùng "${zone.name}" (${zone.width} x ${zone.height} m)`);
      }
    }

    if (wasPoseDrag && poseDraft) {
      handleApplyInitialPose(poseDraft.x, poseDraft.y, poseDraft.yaw);
      return;
    }

    // Neu nguoi dung click vao Endpoint (khong phai keo di xa > 6px) -> Robot di chuyen toi endpoint do!
    if (clickCandidate?.type === 'ENDPOINT' && !clickCandidate.hasMoved) {
      handleNavigateToEndpoint(clickCandidate.ep);
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
      if (!rosClientRef.current?.isConnected) throw new Error('Chưa kết nối Nav2. Bật Nav2 với map này trước.');
      if (nav2Runtime.mode !== 'NAVIGATION' || nav2Runtime.activeMap !== mapConfig.mapId) {
        throw new Error('Bật Navigation với đúng map đang chọn trước khi đặt vị trí.');
      }
      rosClientRef.current.publish('/robot/nav_cancel', 'std_msgs/Empty', {});
      localizationRef.current = { mapId: mapConfig.mapId, requestedAt: Date.now(), confirmed: false };
      setLocalizationReady(false);
      const sent = rosClientRef.current.publish(
          ROS_TOPICS.INITIAL_POSE,
          ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
          createInitialPoseMsg(px, py, pyawRad)
        );
      if (!sent) throw new Error('Không gửi được vị trí tới AMCL.');
      setNavStatus(`Đã gửi vị trí (${px.toFixed(2)}, ${py.toFixed(2)}); chờ AMCL khớp LiDAR với map.`);
      setIsNavigating(false);
      setNavPath([]);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);

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
    const dock = dockEndpoint;
    if (!dock) {
      setNavStatus('Map này chưa có điểm Dock. Dùng “Chọn trên map” tại đúng vị trí xe đang đứng.');
      return;
    }
    handleApplyInitialPose(Number(dock.x) || 0, Number(dock.y) || 0, Number(dock.yaw) || 0);
  };

  const handleRelocalize = async () => {
    if (!navigationRef.current.poseAt) {
      setNavStatus('Chưa có vị trí trên map. Dùng “Chọn trên map” để đặt vị trí trước.');
      return;
    }
    await handleApplyInitialPose(robotPose.x, robotPose.y, robotPose.yaw);
  };

  // Every endpoint uses map-frame localization and Nav2's live obstacle costmap.
  // Tra ve true neu da gui goal toi Nav2.
  const handleSendGoal = (gx, gy, gyaw = 0.0) => {
    try {
      // KEEP_OUT: Nav2 da coi la vat can (mask), nhung bao ro ten vung. NO_STOP: chi duoc di
      // ngang qua => khong nhan dich ben trong (Nav2 khong co khai niem "cam dung").
      const zoneReason = endpointZoneViolation({ x: gx, y: gy }, zones);
      if (zoneReason) throw new Error(zoneReason);
      const loc = localizationFromManager(locManagerRef.current.msg, locManagerRef.current.at);
      sendNav2Endpoint(rosClientRef.current, {
        runtime: nav2Runtime, mapId: mapConfig.mapId, physical: connectionMode === 'pi5',
        localized: loc.fresh
          ? loc.localized
          : localizationRef.current.confirmed && localizationRef.current.mapId === mapConfig.mapId,
        localizationReason: loc.fresh ? loc.reason : undefined,
        ...navigationRef.current,
      }, { x: gx, y: gy, yaw: gyaw }, mapConfig, navigationRef.current.costmap);
      lastGoalSentAtRef.current = Date.now();
      setSelectedGoal({ x: gx, y: gy });
      setIsNavigating(true);
      setNavPath([]);
      setNavStatus(`Nav2 đang lập đường tránh vật cản tới (${gx.toFixed(2)}, ${gy.toFixed(2)})...`);
      return true;
    } catch (err) {
      setNavStatus(err.message);
      setIsNavigating(false);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);
      return false;
    }
  };

  // Dieu khien Teleop thu cong
  const sendTeleopCommand = (commandDirection, linearVel, angularVel) => {
    if (connectionMode === 'pi5') {
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/robot/nav_cancel', 'std_msgs/Empty', {});
      }
      try {
        // Thanh trượt chỉ áp dụng cho tiến/lùi. Xoay tại chỗ gửi speed=null để
        // Pi dùng TELEOP_PWM_TURN riêng (lidar_service.py).
        const isTurn = commandDirection === 'left' || commandDirection === 'right';
        let speed = speedPercent;
        if (commandDirection === 'stop') speed = 0;
        else if (isTurn) speed = null;
        fetch(`http://${pi5Ip}:8000/api/v1/map/teleop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: commandDirection, speed }),
        });
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] Pi5 teleop error:', err);
      }
      return;
    }

    if (rosClientRef.current?.isConnected) {
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
    // Che do ROS 2: huy goal Nav2 (bridge goi cancel_goal + gui stop cho Pi); chi /cmd_vel=0
    // thi controller Nav2 van phat lenh va xe chay tiep.
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/robot/nav_cancel', 'std_msgs/Empty', {});
    }
    sendTeleopCommand('stop', 0.0, 0.0);
    setIsNavigating(false);
    setSelectedGoal(null);
    setNavigatingEndpointId(null);
    setNavPath([]);
    setNavStatus('Đã dừng khẩn cấp (STOP)');
  };

  // Keyboard controls WASD
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        // Huy ve vung dang do dang
        setZoneDrawType(null);
        setZoneDraft(null);
        setDragState((cur) => (cur?.type === 'ZONE_DRAW' ? null : cur));
        return;
      }
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

        {/* Center: O chon ban do SLAM (robot/maps/*.yaml) */}
        <label
          className="hidden md:flex items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs"
          title={`${mapConfig.widthMeters}m × ${mapConfig.heightMeters}m • ${mapConfig.resolution}m/ô • gốc (${mapConfig.originX}, ${mapConfig.originY})`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-400 mr-1.5">Bản đồ:</span>
          <select
            value={mapConfig.mapId}
            onChange={(e) => handleSelectMap(e.target.value)}
            disabled={mapLayouts.length === 0}
            className="bg-slate-900 text-[11px] font-semibold text-slate-200 outline-none cursor-pointer disabled:cursor-not-allowed max-w-[220px]"
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
          {/* Quick Endpoint Strip & Mode Toggle */}
          <div className="w-full max-w-[960px] mb-2 z-20 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-800 shadow-lg text-xs backdrop-blur-md">
            {/* Left: Nut bat/tat che do Ghim Endpoint */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddEndpointMode(!isAddEndpointMode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                  isAddEndpointMode
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
                title={isAddEndpointMode ? 'Nhấn để tắt chế độ ghim' : 'Bật để click thêm nhiều điểm mốc trực tiếp trên bản đồ'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddEndpointMode ? 'Đang Ghim (Click Map)' : '+ Ghim Endpoint'}</span>
              </button>

              {isAddEndpointMode && (
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setAddEndpointType('WAYPOINT')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      addEndpointType === 'WAYPOINT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Waypoint
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddEndpointType('CHARGER')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      addEndpointType === 'CHARGER' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Trạm Sạc
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddEndpointType('PARK')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      addEndpointType === 'PARK' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Điểm Đỗ
                  </button>
                </div>
              )}
            </div>

            {/* Right: Quick Endpoint Navigation Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5 scrollbar-thin">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Bấm để tới:
              </span>
              {endpoints.length === 0 ? (
                <span className="text-[10px] text-slate-500 italic">Chưa có điểm mốc nào</span>
              ) : (
                endpoints.map((ep) => {
                  const tmpl = getEndpointTemplateInfo(ep.type);
                  const isNavTarget = isNavigating && navigatingEndpointId === ep.id;
                  const isSelected = selectedEndpoint?.id === ep.id;

                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => handleNavigateToEndpoint(ep)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all border ${
                        isNavTarget
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-2 ring-cyan-400/50 animate-pulse'
                          : isSelected
                          ? 'bg-slate-800 text-cyan-300 border-cyan-500'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
                      }`}
                      title={`Bấm để robot di chuyển ngay tới ${ep.name} (${ep.x.toFixed(2)}m, ${ep.y.toFixed(2)}m)`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tmpl.color || ep.color }}
                      />
                      <span className="truncate max-w-[100px]">{ep.name}</span>
                      {isNavTarget && <Navigation className="w-2.5 h-2.5 text-white animate-spin" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Floating Controls Overlay o goc tren trai */}
          <div className="absolute top-14 left-5 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 shadow-xl text-xs">
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

            {(
              <button
                onClick={() => setShowCostmap(!showCostmap)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showCostmap ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Costmap Nav2: đỏ = vật cản / vùng cấm (xe chạm là va chạm), cam = vùng nới an toàn quanh vật cản"
              >
                <Layers className="w-3 h-3" />
                <span>Costmap{costmapVersion === 0 ? ' (chưa có)' : ''}</span>
              </button>
            )}

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
            onMouseLeave={() => setHoveredEndpointId(null)}
            className={`w-full h-full max-w-[960px] max-h-[640px] rounded-xl border border-slate-800 shadow-2xl bg-slate-900 object-contain ${
              zoneDrawType
                ? 'cursor-crosshair'
                : dragState
                ? 'cursor-grabbing'
                : isPoseSetMode
                ? 'cursor-crosshair'
                : isAddEndpointMode
                ? 'cursor-copy'
                : hoveredEndpointId
                ? 'cursor-pointer'
                : 'cursor-default'
            } ${
              zoneDrawType
                ? 'ring-2 ring-amber-500/70'
                : isPoseSetMode
                ? 'ring-2 ring-emerald-500/70'
                : isAddEndpointMode
                ? 'ring-2 ring-blue-500/70'
                : ''
            }`}
          />

          {zoneDrawType && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-amber-950/90 border border-amber-700 text-[11px] font-semibold text-amber-200 shadow-xl">
              Vẽ vùng {ZONE_TEMPLATES.find((t) => t.type === zoneDrawType)?.badge}: nhấn giữ chuột ở 1 góc → kéo tới góc đối diện → thả chuột (Esc để hủy)
            </div>
          )}

          {isPoseSetMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-[11px] font-semibold text-emerald-300 shadow-xl">
              Đặt vị trí ban đầu: click chỗ robot đứng → kéo theo hướng mũi xe → thả chuột
            </div>
          )}

          {isAddEndpointMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-lg bg-blue-950/95 border border-blue-500 text-xs font-semibold text-blue-200 shadow-2xl flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
              <span>Chế độ ghim Endpoint: Click vị trí bất kỳ trên bản đồ để thêm {addEndpointType === 'CHARGER' ? 'Trạm Sạc' : addEndpointType === 'PARK' ? 'Điểm Đỗ' : 'Waypoint'}</span>
              <button
                type="button"
                onClick={() => setIsAddEndpointMode(false)}
                className="ml-2 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
              >
                Xong
              </button>
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
                    title="Tốc độ tối đa trong vùng (Nav2 Speed Filter). Xe thật chạy chậm nhất ~0.14 m/s (sàn PWM), đặt thấp hơn thì xe vẫn chạy ~0.14 m/s."
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

          {/* NUT DUNG NOI: luon hien khi robot dang tu hanh toi dich */}
          {isNavigating && (
            <button
              type="button"
              onClick={handleStop}
              className="absolute top-5 right-5 z-30 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-2xl border border-rose-400 cursor-pointer"
              title="Dừng robot ngay (Space)"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>DỪNG</span>
            </button>
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

              {/* Nut Dieu Huong Toi Day / Dung khi dang chay */}
              {isNavigating && navigatingEndpointId === selectedEndpoint.id ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Dừng robot ngay (Space)"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavigateToEndpoint(selectedEndpoint)}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Điều hướng robot chạy tới điểm này"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Tới Đích</span>
                </button>
              )}

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
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between w-full max-w-[960px]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block animate-pulse" />
              <span>Bấm vào điểm mốc bất kỳ để điều hướng robot tới đó • Bật <strong>'Ghim Endpoint'</strong> để click tạo nhiều điểm mốc trên bản đồ ({mapConfig.widthMeters}m × {mapConfig.heightMeters}m)</span>
            </span>
            {isNavigating && (
              <button
                type="button"
                onClick={handleStop}
                className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold cursor-pointer text-[10px] flex items-center gap-1 transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Dừng xe</span>
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

          {/* Card Nav2 (che do ROS 2): bat map_server + AMCL + Nav2 voi map dang chon */}
          {(
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
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
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
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
                    type="button"
                    onClick={() => setIsAddEndpointMode(!isAddEndpointMode)}
                    className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      isAddEndpointMode
                        ? 'bg-emerald-600 text-white animate-pulse ring-1 ring-emerald-300'
                        : 'bg-indigo-600/80 hover:bg-indigo-600 text-white'
                    }`}
                    title="Bật chế độ ghim để click tạo điểm mốc trực tiếp trên bản đồ"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>{isAddEndpointMode ? 'Đang Ghim' : 'Ghim Map'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEndpoint('WAYPOINT')}
                    className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm điểm Waypoint trung gian"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Waypoint</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEndpoint('CHARGER')}
                    className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm trạm sạc pin"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Trạm Sạc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEndpoint('PARK')}
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm điểm đỗ chờ"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Điểm Đỗ</span>
                  </button>
                </div>

                <button
                  type="button"
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
                  const isNavTarget = isNavigating && navigatingEndpointId === ep.id;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleNavigateToEndpoint(ep)}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                        isNavTarget
                          ? 'bg-cyan-950/80 border-cyan-500 shadow-md ring-1 ring-cyan-400'
                          : isSelected
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
                          <span className="text-xs font-semibold text-slate-200 block truncate flex items-center gap-1.5">
                            <span>{ep.name}</span>
                            {isNavTarget && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold border border-cyan-500/40">
                                Đang tới...
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ({Number(ep.x).toFixed(2)}m, {Number(ep.y).toFixed(2)}m) • {tmpl.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToEndpoint(ep);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                            isNavTarget
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white'
                          }`}
                          title="Bấm để robot di chuyển tới điểm này"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Tới</span>
                        </button>
                        <button
                          type="button"
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
                    onClick={() => toggleZoneDraw('KEEP_OUT')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'KEEP_OUT' ? 'bg-rose-600 ring-2 ring-white/70' : 'bg-rose-600/80 hover:bg-rose-600'
                    }`}
                    title="Vẽ khu vực cấm vào: kéo chuột trên bản đồ. Nav2 sẽ đi đường vòng, không nhận endpoint bên trong."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'KEEP_OUT' ? 'Đang Vẽ...' : 'Cấm Vào'}</span>
                  </button>
                  <button
                    onClick={() => toggleZoneDraw('SPEED_ZONE')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'SPEED_ZONE' ? 'bg-amber-600 ring-2 ring-white/70' : 'bg-amber-600/80 hover:bg-amber-600'
                    }`}
                    title="Vẽ vùng giới hạn tốc độ: kéo chuột trên bản đồ. Robot tự chạy chậm lại khi vào vùng."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'SPEED_ZONE' ? 'Đang Vẽ...' : 'Tốc Độ'}</span>
                  </button>
                  <button
                    onClick={() => toggleZoneDraw('NO_STOP')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'NO_STOP' ? 'bg-pink-600 ring-2 ring-white/70' : 'bg-pink-600/80 hover:bg-pink-600'
                    }`}
                    title="Vẽ vùng cấm dừng: kéo chuột trên bản đồ. Robot được đi ngang qua nhưng không nhận endpoint bên trong."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'NO_STOP' ? 'Đang Vẽ...' : 'Cấm Dừng'}</span>
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
              </div>            </div>
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
