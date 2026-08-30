import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Bot,
  CookingPot,
  Sparkles,
  ShieldAlert,
  Briefcase,
  Wrench,
  RefreshCw,
  Inbox,
  CheckCircle2,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';

export const NotificationsPage = ({
  currentUser = null,
  notifications = [],
  onNotify = () => {},
  onToggleRead = () => {},
  onMarkAllRead = () => {},
  onRefresh = () => {},
}) => {
  const [filter, setFilter] = useState('All'); // 'All' | 'Unread' | 'Robot' | 'Warning'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const userDept = currentUser?.department || 'Staff';

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const getNotifIcon = (notif) => {
    const type = (notif.type || notif.request_type || '').toLowerCase();
    if (type.includes('urgent') || type.includes('warning')) {
      return { Icon: AlertTriangle, color: 'bg-red-100 text-red-600' };
    }
    if (type.includes('robot')) {
      return { Icon: Bot, color: 'bg-sky-100 text-sky-600' };
    }
    if (type.includes('room_service') || type.includes('f&b')) {
      return { Icon: CookingPot, color: 'bg-amber-100 text-amber-700' };
    }
    if (type.includes('bell')) {
      return { Icon: Briefcase, color: 'bg-stone-100 text-stone-700' };
    }
    if (type.includes('maint')) {
      return { Icon: Wrench, color: 'bg-orange-100 text-orange-700' };
    }
    if (type.includes('directive')) {
      return { Icon: ShieldAlert, color: 'bg-purple-100 text-purple-700' };
    }
    return { Icon: Sparkles, color: 'bg-emerald-100 text-emerald-700' };
  };

  const filtered = notifications.filter((n) => {
    const isUnread = n.is_read === false || n.isRead === false;
    const type = (n.type || n.request_type || '').toLowerCase();

    if (filter === 'Unread' && !isUnread) return false;
    if (filter === 'Robot' && !type.includes('robot')) return false;
    if (filter === 'Warning' && !type.includes('warning') && !type.includes('urgent')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchDesc = (n.description || '').toLowerCase().includes(q);
      const matchDept = (n.department || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchDept) return false;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => n.is_read === false || n.isRead === false).length;

  const paginatedNotifications = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-[#1A1917]">Trung Tâm Thông Báo &amp; Cảnh Báo</h2>
              <span className="px-3 py-1 rounded-full bg-[#18181B] text-white text-xs font-bold">
                {userDept}
              </span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              Thông báo và chỉ thị điều phối thời gian thực dành riêng cho bộ phận <strong className="text-stone-800">{userDept}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-full bg-white border border-[#DDD8CE] text-stone-700 hover:bg-[#F5F2EB] transition-all shadow-sm cursor-pointer"
              title="Làm mới thông báo"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onMarkAllRead();
                  onNotify('Đã đánh dấu tất cả thông báo của phòng ban là đã đọc');
                }}
                className="px-4 py-2 rounded-full bg-white border border-[#DDD8CE] text-xs font-bold text-stone-700 hover:bg-[#F5F2EB] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đọc Tất Cả</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] w-fit">
            {[
              { id: 'All', label: 'Tất Cả' },
              { id: 'Unread', label: `Chưa Đọc (${unreadCount})` },
              { id: 'Robot', label: 'Robot Telemetry' },
              { id: 'Warning', label: 'Cảnh Báo' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-[#1A1917] shadow-sm'
                    : 'text-[#78716C] hover:text-[#1A1917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-64">
            <input
              type="text"
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-full bg-white border border-[#DDD8CE] text-xs font-medium text-stone-900 outline-none focus:border-stone-500 shadow-sm"
            />
          </div>
        </div>

        {/* Notifications List Container */}
        <div className="bg-white rounded-3xl border border-[#E5E1D8] shadow-sm overflow-hidden divide-y divide-[#F0ECE3]">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-stone-300" />
              <p className="font-semibold text-stone-700">Không có thông báo nào trong mục này.</p>
              <p className="text-stone-400">Khi có yêu cầu hoặc chỉ thị mới gửi đến phòng ban, hệ thống sẽ tự động cập nhật ngay tại đây.</p>
            </div>
          ) : (
            paginatedNotifications.map((notif) => {
              const { Icon, color } = getNotifIcon(notif);
              const isUnread = notif.is_read === false || notif.isRead === false;

              return (
                <div
                  key={notif.id}
                  onClick={() => onToggleRead(notif.id)}
                  className={`p-5 transition-all flex items-start justify-between gap-4 cursor-pointer hover:bg-[#FAF8F5] ${
                    isUnread
                      ? 'bg-amber-50/25 border-l-4 border-l-stone-900'
                      : 'opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-stone-600">{notif.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-stone-800 text-[10px] font-bold">
                          {notif.department}
                        </span>
                        <h4 className={`text-sm ${isUnread ? 'font-bold text-[#1A1917]' : 'font-semibold text-stone-700'}`}>
                          {notif.title}
                        </h4>
                        {isUnread ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                            Chưa đọc
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-medium">
                            Đã đọc
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#78716C] leading-relaxed max-w-3xl">{notif.description}</p>
                      
                      <div className="flex items-center gap-4 text-[11px] text-stone-400 font-medium pt-1">
                        <span>
                          {notif.time || (notif.created_at ? new Date(notif.created_at).toLocaleString('vi-VN') : 'Vừa xong')}
                        </span>
                        {notif.request_id && (
                          <span className="text-stone-500 font-mono">Mã yêu cầu: {notif.request_id}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action: Only mark read/unread allowed for staff */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRead(notif.id);
                        onNotify(isUnread ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu chưa đọc');
                      }}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isUnread
                          ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                          : 'bg-white text-stone-400 border-[#DDD8CE] hover:bg-stone-100 hover:text-stone-700'
                      }`}
                      title={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Footer */}
          {filtered.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>
    </div>
  );
};
