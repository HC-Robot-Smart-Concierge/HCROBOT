import React, { useState, useEffect } from 'react';
import { AdminLidarPage } from '../AdminLidarPage';
import { AdminWorkflowTab } from './AdminWorkflowTab';
import { AdminPhysicalMapTab } from './AdminPhysicalMapTab';
import { AdminPhoneCameraTab } from './AdminPhoneCameraTab';

export const AdminRobotControlTab = ({
  currentUser,
  subTabProp = 'teleop_odom',
  onSelectSubTab,
}) => {
  const [localSubTab, setLocalSubTab] = useState(() => {
    if (subTabProp === 'camera') return 'camera';
    if (subTabProp === 'phone_camera') return 'phone_camera';
    if (subTabProp === 'workflows') return 'workflows';
    if (subTabProp === 'physical_map') return 'physical_map';
    return 'teleop_odom';
  });

  useEffect(() => {
    if (subTabProp) {
      const target =
        subTabProp === 'camera'
          ? 'camera'
          : subTabProp === 'phone_camera'
          ? 'phone_camera'
          : subTabProp === 'workflows'
          ? 'workflows'
          : subTabProp === 'physical_map'
          ? 'physical_map'
          : 'teleop_odom';
      if (target !== localSubTab) {
        setLocalSubTab(target);
      }
    }
  }, [subTabProp]);

  const handleSwitchTab = (tabKey) => {
    setLocalSubTab(tabKey);
    if (onSelectSubTab) {
      onSelectSubTab(tabKey);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: '#F2EFE9' }}>
      {/* Sub-View Body */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {['teleop_odom', 'lidar', 'camera'].includes(localSubTab) ? (
          <div className="w-full h-full overflow-hidden">
            <AdminLidarPage currentUser={currentUser} initialView={localSubTab === 'camera' ? 'camera' : 'slam'} />
          </div>
        ) : localSubTab === 'phone_camera' ? (
          <div className="w-full h-full overflow-hidden">
            <AdminPhoneCameraTab currentUser={currentUser} />
          </div>
        ) : localSubTab === 'physical_map' ? (
          <div className="w-full h-full overflow-hidden">
            <AdminPhysicalMapTab currentUser={currentUser} />
          </div>
        ) : localSubTab === 'workflows' ? (
          <div className="w-full h-full overflow-y-auto custom-scrollbar">
            <AdminWorkflowTab />
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto custom-scrollbar">
            <AdminLidarPage currentUser={currentUser} />
          </div>
        )}
      </div>
    </div>
  );
};
