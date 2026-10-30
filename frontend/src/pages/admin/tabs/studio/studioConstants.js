// Chuan Robot Concierge: 3 loai Endpoint duy nhat cho 1 robot (Khong dung emoji)
export const OTTO_ENDPOINT_TEMPLATES = [
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
    borderColor: '#BFDBFE',
    defaultTasks: 'MOVE, STANDBY',
    description: 'Vị trí dừng đỗ chờ sẵn của Robot Concierge khi không có nhiệm vụ phục vụ tại sảnh.',
  },
];

export const getEndpointTemplateInfo = (type) => {
  const norm = (type || 'WAYPOINT').toUpperCase();
  if (norm === 'CHARGER' || norm === 'DOCKING_TARGET') {
    return OTTO_ENDPOINT_TEMPLATES.find((t) => t.type === 'CHARGER') || OTTO_ENDPOINT_TEMPLATES[1];
  }
  if (norm === 'PARK' || norm === 'PARKING_SPOT') {
    return OTTO_ENDPOINT_TEMPLATES.find((t) => t.type === 'PARK') || OTTO_ENDPOINT_TEMPLATES[2];
  }
  return OTTO_ENDPOINT_TEMPLATES.find((t) => t.type === 'WAYPOINT') || OTTO_ENDPOINT_TEMPLATES[0];
};
