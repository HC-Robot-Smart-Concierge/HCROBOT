import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotificationWebSocket } from '../hooks/useNotificationWebSocket';
import {
  fetchNotifications,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../services/operationsApi';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { currentUser, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Modal triggers
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showQuickRequestModal, setShowQuickRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState(null);

  const seenNotificationIdsRef = useRef(new Set());
  const isInitialNotifLoadRef = useRef(true);

  const showNotification = useCallback((message, duration = 3500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  const openFeedbackModal = useCallback((sessionId) => {
    setFeedbackSessionId(sessionId);
    setShowFeedbackModal(true);
  }, []);

  const activeDepartment = currentUser
    ? (isAdmin ? 'All' : (currentUser.department || 'Staff'))
    : 'All';

  // Real-time WebSocket connection
  useNotificationWebSocket({
    department: activeDepartment,
    enabled: !!currentUser,
    onNotificationReceived: useCallback((newNotif) => {
      if (!newNotif || !newNotif.id) return;
      if (seenNotificationIdsRef.current.has(newNotif.id)) return;
      seenNotificationIdsRef.current.add(newNotif.id);

      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
      showNotification(`🔔 [${newNotif.department}] ${newNotif.title}`);
    }, [showNotification]),
  });

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    const dept = isAdmin ? 'All' : (currentUser.department || 'Staff');
    try {
      const data = await fetchNotifications(dept);
      if (Array.isArray(data)) {
        if (!isInitialNotifLoadRef.current) {
          data.forEach((n) => {
            if (!seenNotificationIdsRef.current.has(n.id) && (n.is_read === false || n.isRead === false)) {
              showNotification(`🔔 [${n.department}] ${n.title}`);
            }
          });
        }
        data.forEach((n) => seenNotificationIdsRef.current.add(n.id));
        isInitialNotifLoadRef.current = false;
        setNotifications(data);
      }
    } catch (err) {
      console.warn('[NotificationContext] loadNotifications error:', err);
    }
  }, [currentUser, isAdmin, showNotification]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleToggleRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: !n.is_read, isRead: !n.isRead } : n))
    );
    await toggleNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, isRead: true }))
    );
    const dept = isAdmin ? 'All' : (currentUser?.department || 'Staff');
    await markAllNotificationsRead(dept);
  };

  const handleDelete = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
  };

  const unreadNotifCount = notifications.filter(
    (n) => n.is_read === false || n.isRead === false
  ).length;

  const value = {
    notifications,
    unreadNotifCount,
    toastMessage,
    showNotification,
    loadNotifications,
    handleToggleRead,
    handleMarkAllRead,
    handleDelete,
    showNotifModal,
    setShowNotifModal,
    showQuickRequestModal,
    setShowQuickRequestModal,
    showProfileModal,
    setShowProfileModal,
    showFeedbackModal,
    setShowFeedbackModal,
    feedbackSessionId,
    setFeedbackSessionId,
    openFeedbackModal,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
