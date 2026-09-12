import React, { useState, useEffect } from 'react';
import { Settings, LogOut, Sparkles } from 'lucide-react';
import { AdminDashboardTab } from './tabs/AdminDashboardTab';
import { AdminOperationsTab } from './tabs/AdminOperationsTab';
import { AdminRobotControlTab } from './tabs/AdminRobotControlTab';
import { AdminKnowledgePage } from './tabs/AdminKnowledgePage';
import { AdminStaffTab } from './tabs/AdminStaffTab';
import { AdminAnalyticsTab } from './tabs/AdminAnalyticsTab';
import { AdminSettingsTab } from './tabs/AdminSettingsTab';
import { AdminLogsTab } from './tabs/AdminLogsTab';

// Color tokens
// --bg-primary:    #F2EFE9  (main page background)
// --bg-secondary:  #E9E5DC  (sidebar, cards)
// --border:        #BFBFBD  (borders, dividers)
// --text-muted:    #8C8C8C  (labels, secondary text)
// --text-primary:  #262626  (headings, body text)
// --accent:        #262626  (active nav, CTA buttons)

export const AdminPortal = ({ currentUser, onLogout = () => {}, onNotify = () => {} }) => {
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const validTabs = [
        'Dashboard',
        'Operations',
        'Robot Control',
        'Knowledge',
        'Hotel Content',
        'Staff',
        'Analytics',
        'Logs',
        'Settings',
      ];
      return validTabs.includes(tab) ? tab : 'Operations';
    } catch {
      return 'Operations';
    }
  };

  const [activeMenu, setActiveMenu] = useState(getInitialTab);
  const [operationsSubTab, setOperationsSubTab] = useState('requests');
  const [robotSubTab, setRobotSubTab] = useState('lidar');
  const [knowledgeSubTab, setKnowledgeSubTab] = useState('sources');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectTab = (tabId) => {
    setActiveMenu(tabId);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tabId);
      params.delete('page');
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {}
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) setActiveMenu(tab);
      } catch {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const menuItems = [
    { id: 'Dashboard',     label: 'Dashboard' },
    { id: 'Operations',    label: 'Operations' },
    { id: 'Robot Control', label: 'Robot Control' },
    { id: 'Knowledge',     label: 'Knowledge' },
    { id: 'Hotel Content', label: 'Hotel Content' },
    { id: 'Staff',         label: 'Staff' },
    { id: 'Analytics',     label: 'Analytics' },
    { id: 'Logs',          label: 'Logs' },
  ];

  return (
    <div className="w-full h-screen overflow-hidden text-[#262626] flex font-sans select-none" style={{ background: '#F2EFE9' }}>

      {/* SIDEBAR */}
      <aside className="w-56 h-full flex flex-col justify-between shrink-0 border-r z-30"
        style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}>

        {/* Brand */}
        <div>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-sm font-black tracking-tight" style={{ color: '#262626' }}>
              RoboConcierge
            </div>
            <div className="text-[10px] font-semibold tracking-widest mt-0.5" style={{ color: '#8C8C8C' }}>
              V2.4.1 — ADMIN PORTAL
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-0.5">
            {menuItems.map((item) => {
              const isActive = activeMenu === item.id;
              return (
                <div key={item.id} className="space-y-0.5">
                  <button
                    onClick={() => handleSelectTab(item.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      background: isActive ? '#262626' : 'transparent',
                      color: isActive ? '#FFFFFF' : '#8C8C8C',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#BFBFBD'; e.currentTarget.style.color = '#262626'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C8C8C'; } }}
                  >
                    {item.label}
                  </button>

                  {/* Operations sub-items */}
                  {item.id === 'Operations' && activeMenu === 'Operations' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setOperationsSubTab('support')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: operationsSubTab === 'support' || operationsSubTab === 'requests' ? '#262626' : 'transparent',
                          color: operationsSubTab === 'support' || operationsSubTab === 'requests' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Technical Support Requests
                      </button>
                    </div>
                  )}

                  {/* Robot Control sub-items */}
                  {item.id === 'Robot Control' && activeMenu === 'Robot Control' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setRobotSubTab('studio')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'studio' || robotSubTab === 'lidar' || robotSubTab === 'workflows' ? '#262626' : 'transparent',
                          color: robotSubTab === 'studio' || robotSubTab === 'lidar' || robotSubTab === 'workflows' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Bản Đồ &amp; Step Workflows
                      </button>
                      <button
                        onClick={() => setRobotSubTab('camera')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'camera' ? '#262626' : 'transparent',
                          color: robotSubTab === 'camera' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Live Camera FPV
                      </button>
                    </div>
                  )}

                  {/* Knowledge sub-items */}
                  {item.id === 'Knowledge' && activeMenu === 'Knowledge' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setKnowledgeSubTab('sources')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: knowledgeSubTab === 'sources' ? '#262626' : 'transparent',
                          color: knowledgeSubTab === 'sources' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Source Files
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Settings & Logout */}
        <div className="p-3 border-t space-y-0.5" style={{ borderColor: '#BFBFBD' }}>
          <button
            onClick={() => handleSelectTab('Settings')}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: activeMenu === 'Settings' ? '#262626' : 'transparent',
              color: activeMenu === 'Settings' ? '#FFFFFF' : '#8C8C8C',
            }}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{ color: '#8C8C8C' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#BFBFBD'; e.currentTarget.style.color = '#262626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C8C8C'; }}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Dang xuat</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">

        {/* Top Header Bar */}
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 z-20 mobile-safe-header pt-10 md:pt-0"
          style={{ background: '#F2EFE9', borderColor: '#BFBFBD' }}>

          {/* Left */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-black tracking-tight" style={{ color: '#262626' }}>
              Hotel Concierge Admin
            </span>
            <span style={{ color: '#BFBFBD' }}>|</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded"
              style={{ background: '#262626', color: '#FFFFFF' }}>
              {activeMenu}
            </span>
          </div>

          {/* Center Search */}
          <div className="hidden md:flex items-center relative w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
              style={{
                background: '#FFFFFF',
                border: '1px solid #BFBFBD',
                color: '#262626',
              }}
            />
          </div>

          {/* Right: User Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 pl-3 border-l" style={{ borderColor: '#BFBFBD' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{ background: '#262626', color: '#FFFFFF' }}>
                {(currentUser?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block">
                <div className="text-xs font-bold leading-tight" style={{ color: '#262626' }}>
                  {currentUser?.full_name || 'System Administrator'}
                </div>
                <div className="text-[10px] font-semibold" style={{ color: '#8C8C8C' }}>
                  {currentUser?.role || 'Operations Admin'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main className={`flex-1 min-h-0 ${activeMenu === 'Robot Control' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} relative`}>

          {activeMenu === 'Dashboard' && (
            <AdminDashboardTab
              onNavigateToOperations={() => setActiveMenu('Operations')}
              onNavigateToRobots={() => { setActiveMenu('Robot Control'); setRobotSubTab('lidar'); }}
            />
          )}

          {activeMenu === 'Operations' && (
            <AdminOperationsTab
              currentUser={currentUser}
              onNotify={onNotify}
              subTabProp={operationsSubTab}
              onSelectSubTab={setOperationsSubTab}
            />
          )}

          {activeMenu === 'Robot Control' && (
            <AdminRobotControlTab
              currentUser={currentUser}
              subTabProp={robotSubTab}
              onSelectSubTab={setRobotSubTab}
            />
          )}

          {activeMenu === 'Knowledge' && (
            <AdminKnowledgePage activeSubView={knowledgeSubTab} />
          )}

          {activeMenu === 'Staff' && (
            <AdminStaffTab currentUser={currentUser} />
          )}

          {activeMenu === 'Analytics' && (
            <AdminAnalyticsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Settings' && (
            <AdminSettingsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Logs' && (
            <AdminLogsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Hotel Content' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
              <h3 className="text-lg font-extrabold" style={{ color: '#262626' }}>
                {activeMenu}
              </h3>
              <p className="text-xs max-w-md" style={{ color: '#8C8C8C' }}>
                Module nay se duoc trien khai trong phien ban tiep theo.
              </p>
              <button
                onClick={() => setActiveMenu('Operations')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{ background: '#262626', color: '#FFFFFF' }}
              >
                Quay lai Operations
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
