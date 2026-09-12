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

      {/* Sub-header Navigation Bar */}
      <div className="border-b px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-4"
        style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}>

        {/* Left: Module Title */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight" style={{ color: '#262626' }}>
              Robot Control Center
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded border"
              style={{ background: '#F2EFE9', color: '#8C8C8C', borderColor: '#BFBFBD' }}>
              UNIT RC-001
            </span>
          </div>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: '#8C8C8C' }}>
            Hợp nhất bản đồ LiDAR SLAM và Trình thiết kế Chu trình Step Workflows (Otto Motors Concept)
          </p>
        </div>

        {/* Right: Sub-View Toggle (Studio vs Camera) */}
        <div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: '#BFBFBD' }}>
          <button
            onClick={() => handleSwitchTab('studio')}
            className="px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
            style={{
              background: localSubTab === 'studio' ? '#262626' : '#F2EFE9',
              color: localSubTab === 'studio' ? '#FFFFFF' : '#8C8C8C',
            }}
          >
            Studio Bản Đồ &amp; Step Workflows
          </button>
          <div style={{ width: '1px', background: '#BFBFBD', alignSelf: 'stretch' }} />
          <button
            onClick={() => handleSwitchTab('camera')}
            className="px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
            style={{
              background: localSubTab === 'camera' ? '#262626' : '#F2EFE9',
              color: localSubTab === 'camera' ? '#FFFFFF' : '#8C8C8C',
            }}
          >
            Live Camera FPV
          </button>
        </div>
      </div>

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
