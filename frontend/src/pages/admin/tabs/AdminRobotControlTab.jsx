import React, { useState, useEffect } from 'react';
import { AdminLidarPage } from '../AdminLidarPage';
import { AdminCameraTab } from './AdminCameraTab';
import { AdminWorkflowTab } from './AdminWorkflowTab';
import { AdminPhysicalMapTab } from './AdminPhysicalMapTab';

export const AdminRobotControlTab = ({
  currentUser,
  subTabProp = 'teleop_odom',
  onSelectSubTab,
}) => {
  const [localSubTab, setLocalSubTab] = useState(() => {
    if (subTabProp === 'camera') return 'camera';
    if (subTabProp === 'workflows') return 'workflows';
    if (subTabProp === 'physical_map') return 'physical_map';
    return 'teleop_odom';
  });

  useEffect(() => {
    if (subTabProp) {
      const target =
        subTabProp === 'camera'
          ? 'camera'
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
        {localSubTab === 'teleop_odom' || localSubTab === 'lidar' ? (
          <div className="w-full h-full overflow-hidden">
            <AdminLidarPage onSwitchToCamera={() => handleSwitchTab('camera')} />
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
            <AdminCameraTab currentUser={currentUser} />
          </div>
        )}
      </div>
    </div>
  );
};
