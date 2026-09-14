// Chuẩn Otto Motors: Default Endpoint Templates (Không bao gồm Trạm Sạc theo yêu cầu)
export const OTTO_ENDPOINT_TEMPLATES = [
  {
    type: 'WAYPOINT',
    label: 'Waypoint (Điểm Mốc Hành Trình)',
    badge: 'WAYPOINT',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: '#C4B5FD',
    defaultTasks: 'MOVE, WAIT',
    description: 'Điểm mốc định vị trên bản đồ để robot di chuyển qua hoặc căn chỉnh hướng.',
  },
  {
    type: 'PARKING_SPOT',
    label: 'Parking Spot (Bãi Đỗ / Điểm Chờ)',
    badge: 'PARKING',
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    defaultTasks: 'MOVE, STANDBY',
    description: 'Khu vực đỗ chờ sẵn của robot khi không có nhiệm vụ khách sạn.',
  },
  {
    type: 'DOCKING_TARGET',
    label: 'Docking Target (Điểm Tiếp Đón / Quầy)',
    badge: 'DOCKING',
    color: '#0284C7',
    bgColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    defaultTasks: 'MOVE, DOCK, GREET, SPEAK',
    description: 'Điểm tiếp cận quầy Lễ tân, bàn tiếp đón với độ chính xác cao.',
  },
  {
    type: 'PICKUP_DROPOFF',
    label: 'Carts & Pallets (Giao Nhận Đồ)',
    badge: 'PICKUP/DROP',
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    defaultTasks: 'MOVE, LOAD, TRANSPORT, UNLOAD',
    description: 'Khu vực giao nhận khay hành lý, đồ dùng phòng hoặc giao đồ ăn.',
  },
  {
    type: 'SERVICE_STATION',
    label: 'Service Station (Trạm Tiện Ích)',
    badge: 'SERVICE',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    defaultTasks: 'MOVE, SHOW, RECOMMEND',
    description: 'Trạm tiện ích khách sạn (Hồ bơi, Nhà hàng, Spa, Thang máy).',
  },
];

export const getEndpointTemplateInfo = (type) => {
  return OTTO_ENDPOINT_TEMPLATES.find((t) => t.type === type) || OTTO_ENDPOINT_TEMPLATES[0];
};
