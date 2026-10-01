import React, { useState, useEffect, useRef } from 'react';
import { Settings, LogOut, Sparkles, Bell, CheckCheck, Trash2, X, Activity, User } from 'lucide-react';
import { AdminDashboardTab } from './tabs/AdminDashboardTab';
import { AdminOperationsTab } from './tabs/AdminOperationsTab';
import { AdminRobotControlTab } from './tabs/AdminRobotControlTab';
import { AdminKnowledgePage } from './tabs/AdminKnowledgePage';
import { AdminStaffTab } from './tabs/AdminStaffTab';
import { AdminAnalyticsTab } from './tabs/AdminAnalyticsTab';
import { AdminSettingsTab } from './tabs/AdminSettingsTab';
import { AdminLogsTab } from './tabs/AdminLogsTab';
import {
  fetchNotifications,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../services/operationsApi';

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
      return validTabs.includes(tab) ? tab : 'Dashboard';
    } catch {
      return 'Dashboard';
    }
  };

  const [activeMenu, setActiveMenu] = useState(getInitialTab);
  const [operationsSubTab, setOperationsSubTab] = useState('requests');
  const [robotSubTab, setRobotSubTab] = useState('lidar');
  const [knowledgeSubTab, setKnowledgeSubTab] = useState('sources');

  // Real-time Notifications Center State
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications('All', 40);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
  };

  // WebSocket for Real-time Notifications
  useEffect(() => {
    loadNotifications();

    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      ws = new WebSocket(`${protocol}//${host}/api/v1/operations/ws/notifications?department=All`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const newNotif = JSON.parse(event.data);
          if (newNotif && newNotif.id) {
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            onNotify(`🔔 [${newNotif.department || 'All'}] ${newNotif.title}`);
          }
        } catch {}
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }

    // Fallback polling every 10s
    const pollInterval = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => {
      if (ws) ws.close();
      clearInterval(pollInterval);
    };
  }, []);

  const handleToggleRead = async (notifId) => {
    try {
      await toggleNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: !n.is_read } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead('All');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onNotify('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch {}
  };

  const handleDeleteNotif = async (notifId) => {
    try {
      await deleteNotification(notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch {}
  };

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
          <div className="h-16 px-4 border-b flex items-center gap-2.5 shrink-0" style={{ borderColor: '#BFBFBD' }}>
            <img
              src="/hc-robot-logo.png"
              alt="HC-Robot Logo"
              className="w-8 h-8 object-contain shrink-0 drop-shadow-xs"
            />
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight truncate" style={{ color: '#262626' }}>
                HC-ROBOT
              </div>
              <div className="text-[10px] font-semibold tracking-widest truncate" style={{ color: '#8C8C8C' }}>
                ADMIN PORTAL
              </div>
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
                          background: robotSubTab === 'studio' || robotSubTab === 'lidar' ? '#262626' : 'transparent',
                          color: robotSubTab === 'studio' || robotSubTab === 'lidar' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Bản Đồ LiDAR Studio
                      </button>
                      <button
                        onClick={() => setRobotSubTab('workflows')}
                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
                        style={{
                          background: robotSubTab === 'workflows' ? '#262626' : 'transparent',
                          color: robotSubTab === 'workflows' ? '#FFFFFF' : '#8C8C8C',
                        }}
                      >
                        Quản Lý Step Workflows
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

        {/* Bottom Sidebar: Notifications, Settings & Admin Profile */}
        <div className="p-3 border-t space-y-1.5 relative" style={{ borderColor: '#BFBFBD' }}>
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
              <span>Notifications</span>
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
            <span>Settings</span>
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
                  {currentUser?.full_name || 'System Admin'}
                </div>
                <div className="text-[10px] font-medium truncate" style={{ color: '#8C8C8C' }}>
                  {currentUser?.role || 'Admin'}
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Đăng xuất"
              className="p-1.5 rounded-lg border hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all cursor-pointer shrink-0"
              style={{ borderColor: '#BFBFBD', color: '#8C8C8C', backgroundColor: '#F2EFE9' }}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notification Drawer Popover (Opens to the right of the sidebar, fixed bottom) */}
          {isNotifOpen && (
            <div
              className="fixed left-58 bottom-4 w-80 sm:w-96 rounded-2xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" style={{ color: '#262626' }} />
                  <span className="text-xs font-bold" style={{ color: '#262626' }}>Trung Tâm Thông Báo</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold" style={{ backgroundColor: '#262626', color: '#F2EFE9' }}>
                    {unreadCount} chưa đọc
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold hover:underline p-1 flex items-center gap-0.5 cursor-pointer"
                      style={{ color: '#262626' }}
                      title="Đọc tất cả"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Đọc hết</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="p-1 cursor-pointer transition-colors"
                    style={{ color: '#8C8C8C' }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                    Không có thông báo mới
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 transition-colors flex items-start justify-between gap-2 ${
                        item.is_read ? 'bg-white opacity-70' : 'bg-[#E9E5DC]/30 font-medium'
                      }`}
                    >
                      <div
                        onClick={() => handleToggleRead(item.id)}
                        className="flex-1 cursor-pointer space-y-0.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded font-mono border" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}>
                            {item.department || 'All'}
                          </span>
                          <span className="text-xs font-bold truncate" style={{ color: '#262626' }}>
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] line-clamp-2" style={{ color: '#8C8C8C' }}>
                          {item.description}
                        </p>
                        <span className="text-[10px]" style={{ color: '#8C8C8C' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteNotif(item.id)}
                        className="p-1 cursor-pointer transition-colors hover:text-red-600"
                        style={{ color: '#8C8C8C' }}
                        title="Xóa thông báo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
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
                Module này sẽ được triển khai trong phiên bản tiếp theo.
              </p>
              <button
                onClick={() => setActiveMenu('Operations')}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{ background: '#262626', color: '#FFFFFF' }}
              >
                Quay lại Operations
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
