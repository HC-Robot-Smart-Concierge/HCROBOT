export const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
export const PI5_API = `http://${PI5_IP}:8000/api/v1`;

export const ROBOT_STATUS_OPTIONS = ['IDLE', 'NAVIGATING', 'INTERACTING', 'CHARGING', 'MAINTENANCE', 'ERROR', 'OFFLINE'];

export const COMPONENT_OPTIONS = [
  { value: 'lidar', vi: 'Cảm biến LiDAR', en: 'LiDAR Sensor' },
  { value: 'battery', vi: 'Pin & Nguồn Pi 5', en: 'Battery & Power' },
  { value: 'motors', vi: 'Động cơ & Bánh xe', en: 'Motors & Wheels' },
  { value: 'camera', vi: 'Camera & Màn hình', en: 'Camera & Display' },
  { value: 'chassis', vi: 'Khung vỏ & Cơ khí', en: 'Chassis & Frame' },
  { value: 'software', vi: 'Phần mềm ROS 2 / AI', en: 'ROS 2 / AI Software' },
  { value: 'general', vi: 'Tổng quát', en: 'General' },
];

export const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'preventive', vi: 'Bảo trì định kỳ', en: 'Preventive' },
  { value: 'inspection', vi: 'Kiểm tra kỹ thuật', en: 'Inspection' },
  { value: 'calibration', vi: 'Hiệu chỉnh (Calibration)', en: 'Calibration' },
  { value: 'repair', vi: 'Sửa chữa / Thay thế', en: 'Repair' },
];

export const mapSubTabToView = (subTab) => {
  if (subTab === 'robot_jobs' || subTab === 'history') return 'history';
  if (subTab === 'robot_maintenance' || subTab === 'maintenance') return 'maintenance';
  return 'profile';
};

export const mapViewToSubTab = (view) => {
  if (view === 'history') return 'robot_jobs';
  if (view === 'maintenance') return 'robot_maintenance';
  return 'robot_profile';
};

export const formatDateTime = (iso) => {
  if (!iso) return '---';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
};

export const toDatetimeLocalInput = (iso) => {
  const dt = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};
