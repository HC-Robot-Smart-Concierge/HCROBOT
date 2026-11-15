import {
  MapPin,
  Compass,
  Gamepad2,
  ShieldBan,
  LocateFixed,
  Gauge,
} from 'lucide-react';
import { mapFrame } from './physicalMapView';

// Icon cho tung phan cua thanh ben phai (thu tu = PANEL_SECTIONS)
export const PANEL_ICONS = {
  telemetry: Gauge,
  nav2: Compass,
  pose: LocateFixed,
  WAYPOINTS: MapPin,
  ZONES: ShieldBan,
  TELEOP: Gamepad2,
};

export const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
export const PI5_API = `http://${PI5_IP}:8000/api/v1`;
export const PI5_WS = `ws://${PI5_IP}:8000/api/v1/map/ws`;
export const ROSBRIDGE_DEFAULT_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';

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

export const SELECTED_MAP_STORAGE_KEY = 'hcrobot.physicalMap.mapId';

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

// config.view (tuy chon) = zoom/keo map (physicalMapView.js); khong co = "vua khung" nhu cu.
export const transformWorldToCanvas = (worldX, worldY, canvasWidth, canvasHeight, config = LAYOUT2_CONFIG) => {
  const { scale, offsetX, offsetY } = mapFrame(canvasWidth, canvasHeight, config);

  const relX = worldX - config.originX;
  const relY = worldY - config.originY;

  const px = offsetX + relX * scale;
  const py = offsetY + (config.heightMeters - relY) * scale;

  return { x: px, y: py, scale };
};

export const transformCanvasToWorld = (canvasX, canvasY, canvasWidth, canvasHeight, config = LAYOUT2_CONFIG) => {
  const { scale, offsetX, offsetY } = mapFrame(canvasWidth, canvasHeight, config);

  const relX = (canvasX - offsetX) / scale;
  const relY = config.heightMeters - (canvasY - offsetY) / scale;

  const worldX = relX + config.originX;
  const worldY = relY + config.originY;

  return { worldX, worldY, scale };
};

