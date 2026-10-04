import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Trash2, X, RefreshCw, Filter } from 'lucide-react';
import {
  fetchNotifications,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../services/operationsApi';

export function NotificationCenterModal({ isOpen, onClose, currentDepartment = 'All' }) {
  const [notifications, setNotifications] = useState([]);
  const [selectedDept, setSelectedDept] = useState(currentDepartment || 'All');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications(selectedDept, 50);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  const handleToggleRead = async (notifId) => {
    try {
      await toggleNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: !n.is_read } : n))
      );
    } catch (err) {
      console.error('Lỗi cập nhật thông báo:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(selectedDept);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setActionMsg('Đã đánh dấu đọc toàn bộ thông báo.');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc toàn bộ:', err);
    }
  };

  const handleDelete = async (notifId) => {
    try {
      await deleteNotification(notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const departmentFilters = [
    { label: 'Tất cả', value: 'All' },
    { label: 'Lễ tân', value: 'Reception' },
    { label: 'Buồng phòng', value: 'Housekeeping' },
    { label: 'Phục vụ phòng', value: 'Room Service' },
    { label: 'Hành lý', value: 'Bell Services' },
    { label: 'Kỹ thuật', value: 'Maintenance' },
    { label: 'Bếp / Kitchen', value: 'Kitchen' },
    { label: 'Taxi', value: 'Taxi' },
    { label: 'Concierge', value: 'Concierge' },
  ];

  return (
    <div className="hc-modal-overlay">
      <div className="hc-modal-box max-w-2xl w-full p-6 bg-white border border-palette-silver rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-palette-silver">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-palette-stone flex items-center justify-center text-palette-charcoal">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-palette-charcoal">Trung tâm Thông báo</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-palette-charcoal text-palette-cream">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p className="text-xs text-palette-slate">Hệ thống thông báo đồng bộ thời gian thực</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-palette-stone text-palette-slate hover:text-palette-charcoal transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-palette-silver">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-md">
            <Filter className="w-3.5 h-3.5 text-palette-slate shrink-0" />
            {departmentFilters.map((df) => (
              <button
                key={df.value}
                onClick={() => setSelectedDept(df.value)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition ${
                  selectedDept === df.value
                    ? 'bg-palette-charcoal text-palette-cream'
                    : 'bg-palette-stone text-palette-charcoal hover:bg-palette-silver'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadNotifications}
              disabled={loading}
              title="Tải lại thông báo"
              className="p-1.5 text-palette-slate hover:text-palette-charcoal rounded-lg hover:bg-palette-stone transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-palette-stone hover:bg-palette-silver text-palette-charcoal transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đã đọc tất cả
              </button>
            )}
          </div>
        </div>

        {/* Action feedback */}
        {actionMsg && (
          <div className="mt-2 p-2 bg-palette-stone text-palette-charcoal text-xs rounded-lg text-center font-medium">
            {actionMsg}
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-palette-silver my-2 pr-1">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-palette-slate">Đang tải thông báo...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-palette-silver mx-auto mb-2 opacity-50" />
              <p className="text-xs text-palette-slate font-medium">Không có thông báo nào trong bộ phận này.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`py-3 px-2 flex items-start justify-between gap-3 transition rounded-xl ${
                  !item.is_read ? 'bg-palette-stone/60' : 'hover:bg-palette-cream/40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-palette-charcoal text-palette-cream">
                      {item.department || 'Chung'}
                    </span>
                    <span className="text-xs font-bold text-palette-charcoal truncate">{item.title}</span>
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-palette-charcoal shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-palette-slate line-clamp-2">{item.description}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-palette-slate">
                    <span>{item.created_at ? new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}</span>
                    {item.request_id && (
                      <span className="font-mono text-[10px] text-palette-charcoal">Mã: {item.request_id}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-1">
                  <button
                    onClick={() => handleToggleRead(item.id)}
                    title={item.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      item.is_read
                        ? 'text-palette-slate hover:bg-palette-stone hover:text-palette-charcoal'
                        : 'text-palette-charcoal bg-palette-stone hover:bg-palette-silver'
                    }`}
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Xóa thông báo"
                    className="p-1.5 rounded-lg text-palette-slate hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-palette-silver flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-palette-charcoal text-palette-cream hover:bg-neutral-800 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
