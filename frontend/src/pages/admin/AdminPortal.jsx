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
      return validTabs.includes(tab) ? tab : 'Operations';
    } catch {
      return 'Operations';
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
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Header Bar */}
        <header
          className="h-12 border-b flex items-center justify-between px-6 shrink-0 z-20"
          style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: '#8C8C8C' }}>Admin Portal</span>
            <span style={{ color: '#8C8C8C' }}>/</span>
            <span className="font-bold text-stone-900">{activeMenu}</span>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Realtime Status Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-stone-200 text-[11px] font-semibold">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              <span className="text-stone-700">{wsConnected ? 'WebSocket Live' : 'Polling Sync'}</span>
            </div>

            {/* Notification Bell Button */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-1.5 rounded-lg border bg-white hover:bg-stone-50 transition-all cursor-pointer relative"
                style={{ borderColor: '#BFBFBD', color: '#262626' }}
                title="Thông báo toàn hệ thống"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Drawer */}
              {isNotifOpen && (
                <div
                  className="absolute right-0 top-10 w-80 sm:w-96 rounded-2xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}
                >
                  <div className="p-3 border-b flex items-center justify-between bg-stone-50" style={{ borderColor: '#E9E5DC' }}>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-stone-800" />
                      <span className="text-xs font-bold text-stone-900">Trung Tâm Thông Báo</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                        {unreadCount} chưa đọc
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 p-1 flex items-center gap-0.5 cursor-pointer"
                          title="Đọc tất cả"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Đọc hết</span>
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-stone-100 text-xs">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-stone-400 text-xs">
                        Không có thông báo mới
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3 transition-colors flex items-start justify-between gap-2 ${
                            item.is_read ? 'bg-white opacity-70' : 'bg-stone-50/70 font-medium'
                          }`}
                        >
                          <div
                            onClick={() => handleToggleRead(item.id)}
                            className="flex-1 cursor-pointer space-y-0.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-stone-200 text-stone-800 font-mono">
                                {item.department || 'All'}
                              </span>
                              <span className="text-xs font-bold text-stone-900 truncate">
                                {item.title}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-600 line-clamp-2">
                              {item.description}
                            </p>
                            <span className="text-[10px] text-stone-400">
                              {item.created_at ? new Date(item.created_at).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeleteNotif(item.id)}
                            className="text-stone-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
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

            {/* Current User Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-300">
              <div className="w-7 h-7 rounded-full bg-[#262626] text-white flex items-center justify-center text-xs font-bold">
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-bold text-stone-900">
                  {currentUser?.full_name || 'Quản trị viên'}
                </div>
                <div className="text-[10px] text-stone-500 font-medium">
                  {currentUser?.role || 'Admin'}
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
