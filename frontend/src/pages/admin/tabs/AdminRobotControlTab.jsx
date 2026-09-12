import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { AdminUnifiedStudioTab } from './AdminUnifiedStudioTab';
import { AdminCameraTab } from './AdminCameraTab';

export const AdminRobotControlTab = ({
  currentUser,
  subTabProp = 'studio',
  onSelectSubTab,
}) => {
  const [localSubTab, setLocalSubTab] = useState(() => {
    if (subTabProp === 'camera') return 'camera';
    return 'studio';
  });

  useEffect(() => {
    if (subTabProp) {
      const target = subTabProp === 'camera' ? 'camera' : 'studio';
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
        {localSubTab === 'studio' ? (
          <div className="w-full h-full overflow-hidden">
            <AdminUnifiedStudioTab onSwitchToCamera={() => handleSwitchTab('camera')} />
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
