import { isPointInZone as containsZonePoint } from './physicalMapZones';

/**
 * Kiểm tra một tọa độ (px, py) có nằm trong vùng hình chữ nhật của Zone hay không
 */
export const isPointInZone = (px, py, zone) => {
  if (!zone) return false;
  return containsZonePoint(px, py, zone);
};

// Hotel Concierge Standard: Zone Templates (Bao gồm Keep-Out, Speed Zone, No-Stop Zone)
export const CONCIERGE_ZONE_TEMPLATES = [
  {
    type: 'KEEP_OUT',
    label: 'Khu Vực Cấm Vào (Keep-Out Zone)',
    badge: 'KEEP OUT',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    description: 'Cầu thang bộ, khu vực bảo trì, bếp. Robot tuyệt đối không đi vào hay qua.',
  },
  {
    type: 'SPEED_ZONE',
    label: 'Khu Vực Giới Hạn Tốc Độ (Speed Zone)',
    badge: 'SPEED ZONE',
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    description: 'Khu vực đông người qua lại sảnh. Tự động áp đặt vận tốc tối đa an toàn (m/s).',
  },
  {
    type: 'NO_STOP',
    label: 'Khu Vực Cấm Dừng (No-Stop Zone)',
    badge: 'NO STOP',
    color: '#E11D48',
    bgColor: '#FFF1F2',
    borderColor: '#FECDD3',
    description: 'Cửa thông sảnh, cửa thang máy, lối thoát hiểm. Robot chỉ được phép đi qua, cấm dừng/đỗ.',
  },
  {
    type: 'SLOW_SPEED',
    label: 'Vùng Giảm Tốc An Toàn (Low Speed Zone)',
    badge: 'SLOW SPEED',
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    description: 'Khu vực đông người qua lại sảnh. Tự động hạ vận tốc tối đa (0.3 m/s).',
  },
  {
    type: 'SILENT_ZONE',
    label: 'Vùng Yên Lặng VIP (Quiet / Silent Zone)',
    badge: 'SILENT ZONE',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    description: 'Phòng hội nghị, VIP Lounge. Robot tự động tắt tiếng/loa thoại.',
  },
  {
    type: 'GREETING_ZONE',
    label: 'Vùng Đón Khách AI (Greeting / Interaction Zone)',
    badge: 'GREETING ZONE',
    color: '#34D399',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    description: 'Sảnh đón khách chính. Bật AI Person Detector chủ động tiếp cận chào khách.',
  },
  {
    type: 'SERVICE_PRIORITY',
    label: 'Vùng Tiện Ích Ưu Tiên (Service Priority Zone)',
    badge: 'SERVICE ZONE',
    color: '#0284C7',
    bgColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    description: 'Hành lang ưu tiên di chuyển phục vụ đồ uống và thông báo.',
  },
];

export const getZoneTemplateInfo = (type) => {
  return CONCIERGE_ZONE_TEMPLATES.find((t) => t.type === type) || CONCIERGE_ZONE_TEMPLATES[0];
};

// Hotel Concierge Standard: 3 loai Endpoint duy nhat cho 1 robot (Khong dung emoji)
export const CONCIERGE_ENDPOINT_TEMPLATES = [
  {
    type: 'WAYPOINT',
    label: 'Waypoint Endpoint (Điểm đường / Điểm trung gian)',
    badge: 'WAYPOINT',
    color: '#94A3B8',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    defaultTasks: 'MOVE, WAIT',
    description: 'Điểm mốc định vị sảnh để robot di chuyển qua hoặc căn chỉnh hướng hành trình.',
  },
  {
    type: 'CHARGER',
    label: 'Charger Endpoint (Điểm sạc)',
    badge: 'CHARGER',
    color: '#34D399',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    defaultTasks: 'MOVE, DOCK, CHARGE',
    description: 'Trạm sạc tự động của Robot Concierge, phục vụ nạp pin khi mức pin thấp hoặc ngoài ca trực.',
  },
  {
    type: 'PARK',
    label: 'Park Endpoint (Điểm đỗ / chờ)',
    badge: 'PARK',
    color: '#60A5FA',
    bgColor: '#EFF6FF',
    borderColor: '#CBD5E1',
    defaultTasks: 'MOVE, STANDBY',
    description: 'Vị trí dừng đỗ chờ sẵn của Robot Concierge khi không có nhiệm vụ phục vụ tại sảnh.',
  },
];

export const OTTO_ENDPOINT_TEMPLATES = CONCIERGE_ENDPOINT_TEMPLATES;

export const getEndpointTemplateInfo = (type) => {
  const norm = (type || 'WAYPOINT').toUpperCase();
  if (norm === 'CHARGER' || norm === 'DOCKING_TARGET') {
    return CONCIERGE_ENDPOINT_TEMPLATES.find((t) => t.type === 'CHARGER') || CONCIERGE_ENDPOINT_TEMPLATES[1];
  }
  if (norm === 'PARK' || norm === 'PARKING_SPOT') {
    return CONCIERGE_ENDPOINT_TEMPLATES.find((t) => t.type === 'PARK') || CONCIERGE_ENDPOINT_TEMPLATES[2];
  }
  return CONCIERGE_ENDPOINT_TEMPLATES.find((t) => t.type === 'WAYPOINT') || CONCIERGE_ENDPOINT_TEMPLATES[0];
};

// Pi5 Connection
const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;
const PI5_WS = `ws://${PI5_IP}:8000/api/v1`;

export const INITIAL_GRID_METADATA = {
  width: 200,
  height: 200,
  resolution: 0.05,
  origin_x: -5.0,
  origin_y: -5.0,
};

export const INITIAL_ENDPOINT_FORM = {
  id: '',
  name: '',
  floor: 'Sảnh Tầng 1',
  x: 0,
  y: 0,
  yaw: 0,
  type: 'WAYPOINT',
  description: '',
};

export const INITIAL_ZONE_FORM = {
  id: '',
  name: '',
  type: 'KEEP_OUT',
  x: 0,
  y: 0,
  width: 2.0,
  height: 2.0,
  speed_limit: 0.3,
  floor: 'Sảnh Tầng 1',
  description: '',
};

export { PI5_API, PI5_WS };
