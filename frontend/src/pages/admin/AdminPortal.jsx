import React, { useState, useEffect } from 'react';
import { Settings, LogOut, Bell, Menu } from 'lucide-react';
import { AdminDashboardTab } from './tabs/AdminDashboardTab';
import { AdminOperationsTab } from './tabs/AdminOperationsTab';
import { AdminRobotControlTab } from './tabs/AdminRobotControlTab';
import { AdminRobotManagementTab } from './tabs/AdminRobotManagementTab';
import { AdminKnowledgePage } from './tabs/AdminKnowledgePage';
import { AdminDepartmentTab } from './tabs/AdminDepartmentTab';
import { AdminStaffTab } from './tabs/AdminStaffTab';
import { AdminSettingsTab } from './tabs/AdminSettingsTab';
import { AdminLogsTab } from './tabs/AdminLogsTab';
import { AdminAdvertisementsTab } from './tabs/AdminAdvertisementsTab';
import { AdminVideoCallsTab } from './tabs/AdminVideoCallsTab';
import { useLanguage } from '../../context/LanguageContext';
import {
  getInitialAdminTab,
  useAdminNotifications,
  AdminPortalNotificationDrawer,
} from './AdminPortalNotifications';

export const AdminPortal = ({ currentUser, onLogout = () => { }, onNotify = () => { } }) => {
  const { language, t } = useLanguage();

  const [activeMenu, setActiveMenu] = useState(getInitialAdminTab);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [operationsSubTab, setOperationsSubTab] = useState('requests');
  const [robotSubTab, setRobotSubTab] = useState('lidar');
  const [manageRobotSubTab, setManageRobotSubTab] = useState('robot_profile');
  const [knowledgeSubTab, setKnowledgeSubTab] = useState('sources');
  const [logsSubTab, setLogsSubTab] = useState('operational');

  const {
    notifications,
    unreadCount,
    isNotifOpen,
    setIsNotifOpen,
    wsConnected,
    handleToggleRead,
    handleMarkAllRead,
    handleDeleteNotif,
  } = useAdminNotifications({ onNotify, t });

  const handleSelectTab = (tabId) => {
    setActiveMenu(tabId);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tabId);
      params.delete('page');
      window.history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch { }
  };

  useEffect(() => {
    const onPopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) setActiveMenu(tab);
      } catch { }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const menuItems = [
    { id: 'Dashboard', label: t('adminDashboard') },
    { id: 'Operations', label: t('adminOperations') },
    { id: 'Robot Control', label: t('adminRobotControl') },
    { id: 'Manage Robot', label: t('adminManageRobot') },
    { id: 'Knowledge', label: t('adminKnowledge') },
    { id: 'Advertisements', label: t('adminAdvertisements') },
    { id: 'Department', label: t('adminDepartment') },
    { id: 'Video Calls', label: 'Video Calls' },
    { id: 'Account', label: t('adminAccount') },
    { id: 'Logs', label: t('adminLogs') },
  ];

  return (
    <div className="w-full h-screen overflow-hidden text-[#262626] flex font-sans select-none" style={{ background: '#F2EFE9', '--admin-header-height': '4rem', '--admin-header-border': '#BFBFBD' }}>

      {/* SIDEBAR */}
      <aside className="h-full flex flex-col justify-between shrink-0 border-r z-30 transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: isSidebarCollapsed ? '3.5rem' : '14rem', background: '#E9E5DC', borderColor: '#BFBFBD' }}>

        {/* Brand */}
        <div>
          <div className="px-3 border-b flex items-center gap-2 shrink-0" style={{ height: 'var(--admin-header-height)', borderColor: 'var(--admin-header-border)' }}>
            {!isSidebarCollapsed && <>
              <img
                src="/hc-robot-logo.png"
                alt="HC-Robot Logo"
                className="w-8 h-8 object-contain shrink-0 drop-shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black tracking-tight truncate" style={{ color: '#262626' }}>
                  HC-ROBOT
                </div>
                <div className="text-[10px] font-semibold tracking-widest truncate" style={{ color: '#8C8C8C' }}>
                  {t('adminBrandSubtitle')}
                </div>
              </div>
            </>}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              aria-expanded={!isSidebarCollapsed}
              aria-controls="admin-sidebar-navigation admin-sidebar-actions"
              aria-label={t(isSidebarCollapsed ? 'adminExpandSidebar' : 'adminCollapseSidebar')}
              title={t(isSidebarCollapsed ? 'adminExpandSidebar' : 'adminCollapseSidebar')}
              className="ml-auto w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-stone-600 hover:bg-black/5 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600 transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Nav Items */}
          <nav id="admin-sidebar-navigation" hidden={isSidebarCollapsed} className="p-3 space-y-0.5">
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
                        {t('adminSubTechSupport')}
                      </button>
                    </div>
                  )}

                  {/* Robot Control sub-items */}
                  {item.id === 'Robot Control' && activeMenu === 'Robot Control' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setRobotSubTab('lidar')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: ['lidar', 'teleop_odom', 'camera'].includes(robotSubTab) ? '#262626' : 'transparent',
                          color: ['lidar', 'teleop_odom', 'camera'].includes(robotSubTab) ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubControlCamera')}
                      </button>
                      <button
                        onClick={() => setRobotSubTab('phone_camera')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'phone_camera' ? '#262626' : 'transparent',
                          color: robotSubTab === 'phone_camera' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubPhoneCamera')}
                      </button>
                      <button
                        onClick={() => setRobotSubTab('physical_map')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'physical_map' ? '#262626' : 'transparent',
                          color: robotSubTab === 'physical_map' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubPhysicalMap')}
                      </button>
                      <button
                        onClick={() => setRobotSubTab('workflows')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'workflows' ? '#262626' : 'transparent',
                          color: robotSubTab === 'workflows' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubWorkflow')}
                      </button>
                    </div>
                  )}

                  {/* Manage Robot sub-items */}
                  {item.id === 'Manage Robot' && activeMenu === 'Manage Robot' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setManageRobotSubTab('robot_profile')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: ['robot_profile', 'profile'].includes(manageRobotSubTab) ? '#262626' : 'transparent',
                          color: ['robot_profile', 'profile'].includes(manageRobotSubTab) ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubRobotProfile')}
                      </button>
                      <button
                        onClick={() => setManageRobotSubTab('robot_jobs')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: ['robot_jobs', 'history'].includes(manageRobotSubTab) ? '#262626' : 'transparent',
                          color: ['robot_jobs', 'history'].includes(manageRobotSubTab) ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubRobotJobs')}
                      </button>
                      <button
                        onClick={() => setManageRobotSubTab('robot_maintenance')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: ['robot_maintenance', 'maintenance'].includes(manageRobotSubTab) ? '#262626' : 'transparent',
                          color: ['robot_maintenance', 'maintenance'].includes(manageRobotSubTab) ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubRobotMaintenance')}
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
                          background: knowledgeSubTab === 'sources' || knowledgeSubTab === 'vault' ? '#262626' : 'transparent',
                          color: knowledgeSubTab === 'sources' || knowledgeSubTab === 'vault' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubKnowledgeVault')}
                      </button>
                      <button
                        onClick={() => setKnowledgeSubTab('scenarios')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: knowledgeSubTab === 'scenarios' ? '#262626' : 'transparent',
                          color: knowledgeSubTab === 'scenarios' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('adminSubFastPath')}
                      </button>
                    </div>
                  )}

                  {/* Logs sub-items */}
                  {item.id === 'Logs' && activeMenu === 'Logs' && (
                    <div className="ml-3 pl-3 border-l my-0.5 space-y-0.5" style={{ borderColor: '#262626' }}>
                      <button
                        onClick={() => setLogsSubTab('operational')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: logsSubTab === 'operational' ? '#262626' : 'transparent',
                          color: logsSubTab === 'operational' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('logsTabOperational')}
                      </button>
                      <button
                        onClick={() => setLogsSubTab('audit')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: logsSubTab === 'audit' ? '#262626' : 'transparent',
                          color: logsSubTab === 'audit' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('logsTabAudit')}
                      </button>
                      <button
                        onClick={() => setLogsSubTab('conversations')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: logsSubTab === 'conversations' ? '#262626' : 'transparent',
                          color: logsSubTab === 'conversations' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        {t('logsTabAiChat')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar: Notifications, Settings & Admin Profile */}
        <div id="admin-sidebar-actions" hidden={isSidebarCollapsed} className="p-3 border-t space-y-1.5 relative" style={{ borderColor: '#BFBFBD' }}>
          {/* Notifications Nav Item */}
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: isNotifOpen ? '#262626' : 'transparent',
              color: isNotifOpen ? '#FFFFFF' : '#8C8C8C',
            }}
            onMouseEnter={e => { if (!isNotifOpen) { e.currentTarget.style.background = '#BFBFBD'; e.currentTarget.style.color = '#262626'; } }}
            onMouseLeave={e => { if (!isNotifOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C8C8C'; } }}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span>{t('adminNotifications')}</span>
            </div>
            {unreadCount > 0 && (
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: isNotifOpen ? '#FFFFFF' : '#262626',
                  color: isNotifOpen ? '#262626' : '#F2EFE9',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Settings Nav */}
          <button
            onClick={() => handleSelectTab('Settings')}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{
              background: activeMenu === 'Settings' ? '#262626' : 'transparent',
              color: activeMenu === 'Settings' ? '#FFFFFF' : '#8C8C8C',
            }}
            onMouseEnter={e => { if (activeMenu !== 'Settings') { e.currentTarget.style.background = '#BFBFBD'; e.currentTarget.style.color = '#262626'; } }}
            onMouseLeave={e => { if (activeMenu !== 'Settings') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8C8C8C'; } }}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>{t('adminSettings')}</span>
          </button>

          {/* User Profile Card with Logout */}
          <div
            className="p-2 rounded-xl border flex items-center justify-between gap-1.5 shadow-sm mt-1"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* User Avatar & Info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
              >
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-bold truncate" style={{ color: '#262626' }}>
                  {language === 'EN' && currentUser?.full_name === 'Bộ phận Quản trị'
                    ? 'Operations Admin'
                    : (currentUser?.full_name || t('adminRoleAdmin'))}
                </div>
                <div className="text-[10px] font-medium truncate" style={{ color: '#8C8C8C' }}>
                  {language === 'EN' && (currentUser?.role === 'Admin' || currentUser?.role === 'Operations Admin')
                    ? 'Operations Admin'
                    : (currentUser?.role === 'Admin' ? t('adminRoleAdmin') : currentUser?.role || t('adminRoleAdmin'))}
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title={t('adminLogout')}
              className="p-1.5 rounded-lg border hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all cursor-pointer shrink-0"
              style={{ borderColor: '#BFBFBD', color: '#8C8C8C', backgroundColor: '#F2EFE9' }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <AdminPortalNotificationDrawer
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={handleMarkAllRead}
            onToggleRead={handleToggleRead}
            onDeleteNotif={handleDeleteNotif}
          />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Dynamic Tab Body */}
        <main className={`flex-1 min-h-0 ${activeMenu === 'Robot Control' || activeMenu === 'Manage Robot' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} relative`}>

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

          {activeMenu === 'Manage Robot' && (
            <AdminRobotManagementTab
              initialView={manageRobotSubTab}
              onSwitchSubTab={setManageRobotSubTab}
            />
          )}

          {activeMenu === 'Knowledge' && (
            <AdminKnowledgePage
              activeSubView={knowledgeSubTab}
              onSelectSubView={setKnowledgeSubTab}
            />
          )}

          {activeMenu === 'Department' && (
            <AdminDepartmentTab currentUser={currentUser} />
          )}

          {activeMenu === 'Video Calls' && (
            <AdminVideoCallsTab currentUser={currentUser} />
          )}

          {(activeMenu === 'Account' || activeMenu === 'Staff') && (
            <AdminStaffTab currentUser={currentUser} />
          )}

          {activeMenu === 'Settings' && (
            <AdminSettingsTab currentUser={currentUser} />
          )}

          {activeMenu === 'Logs' && (
            <AdminLogsTab
              currentUser={currentUser}
              subTabProp={logsSubTab}
              onSelectSubTab={setLogsSubTab}
            />
          )}

          {(activeMenu === 'Advertisements' || activeMenu === 'Hotel Content') && (
            <AdminAdvertisementsTab currentUser={currentUser} onNotify={onNotify} />
          )}
        </main>
      </div>
    </div>
  );
};
