import React from 'react';
import { ConciergeDashboard } from './ConciergeDashboard';

// Tương thích ngược: Gom tính năng Đặt xe & Vận chuyển vào bộ phận Concierge
export const TaxiDashboard = (props) => {
  return <ConciergeDashboard {...props} />;
};

export default TaxiDashboard;
