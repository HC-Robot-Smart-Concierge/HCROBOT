import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import {
  fetchNotifications,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../services/operationsApi';

const VALID_ADMIN_TABS = [
  'Dashboard',
  'Operations',
  'Robot Control',
  'Manage Robot',
  'Knowledge',
  'Hotel Content',
  'Advertisements',
  'Department',
  'Account',
  'Staff',
  'Video Calls',
  'Logs',
  'Settings',
];

export const getInitialAdminTab = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'Analytics') return 'Dashboard';
    if (tab === 'Staff') return 'Account';
    if (tab === 'Hotel Content') return 'Advertisements';
    return VALID_ADMIN_TABS.includes(tab) ? tab : 'Dashboard';
  } catch {
    return 'Dashboard';
  }
};

export const useAdminNotifications = ({ onNotify, t }) => {
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications('Admin', 40);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    loadNotifications();

    let ws = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      ws = new WebSocket(`${protocol}//${host}/api/v1/operations/ws/notifications?department=Admin`);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const parsed = JSON.parse(event.data);
          const newNotif = parsed?.type === 'NEW_NOTIFICATION' && parsed.data ? parsed.data : parsed;
          if (newNotif && newNotif.id) {
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            onNotify(`🔔 [${newNotif.department || 'Admin'}] ${newNotif.title}`);
          }
        } catch { }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => setWsConnected(false);
    } catch {
      setWsConnected(false);
    }

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
    } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead('All');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onNotify(t('adminMarkAllReadNotice'));
    } catch { }
  };

  const handleDeleteNotif = async (notifId) => {
    try {
      await deleteNotification(notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { }
  };

  return {
    notifications,
    unreadCount,
    isNotifOpen,
    setIsNotifOpen,
    wsConnected,
    handleToggleRead,
    handleMarkAllRead,
    handleDeleteNotif,
  };
};

export const AdminPortalNotificationDrawer = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onToggleRead,
  onDeleteNotif,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed left-58 bottom-4 w-80 sm:w-96 rounded-2xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ background: '#FFFFFF', borderColor: '#BFBFBD' }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: '#262626' }} />
          <span className="text-xs font-bold" style={{ color: '#262626' }}>Notification Center</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold" style={{ backgroundColor: '#262626', color: '#F2EFE9' }}>
            {unreadCount} unread
          </span>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[10px] font-bold hover:underline p-1 flex items-center gap-0.5 cursor-pointer"
              style={{ color: '#262626' }}
              title="Mark all read"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Mark all read</span>
            </button>
          )}
          <button
            onClick={onClose}
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
            No new notifications
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-3 transition-colors flex items-start justify-between gap-2 ${
                item.is_read ? 'bg-white opacity-70' : 'bg-[#E9E5DC]/30 font-medium'
              }`}
            >
              <div onClick={() => onToggleRead(item.id)} className="flex-1 cursor-pointer space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.2 rounded font-mono border"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
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
                  {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-US') : 'Just now'}
                </span>
              </div>

              <button
                onClick={() => onDeleteNotif(item.id)}
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
  );
};
