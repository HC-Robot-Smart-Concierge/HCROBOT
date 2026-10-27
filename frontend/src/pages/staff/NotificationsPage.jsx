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
  Search,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const NotificationsPage = ({
  currentUser: propUser = null,
  notifications: propNotifications = null,
  onNotify: propNotify = null,
  onToggleRead: propToggleRead = null,
  onMarkAllRead: propMarkAllRead = null,
  onRefresh: propRefresh = null,
}) => {
  const { currentUser: authUser } = useAuth();
  const notifCtx = useNotifications();

  const currentUser = propUser || authUser;
  const notifications = propNotifications || notifCtx?.notifications || [];
  const onNotify = propNotify || notifCtx?.showNotification || (() => {});
  const onToggleRead = propToggleRead || notifCtx?.handleToggleRead || (() => {});
  const onMarkAllRead = propMarkAllRead || notifCtx?.handleMarkAllRead || (() => {});
  const onRefresh = propRefresh || notifCtx?.loadNotifications || (() => {});

  const [filter, setFilter] = useState('All'); // 'All' | 'Unread' | 'Robot' | 'Warning'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pageSize = 10;

  const userDept = currentUser?.department || 'Staff';

  // Tải danh sách thông báo mới nhất khi mở trang
  useEffect(() => {
    onRefresh();
  }, []);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      onNotify('Đã làm mới danh sách thông báo');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getNotifIcon = (notif) => {
    const type = (notif.type || notif.request_type || '').toLowerCase();
    if (type.includes('urgent') || type.includes('warning')) {
      return { Icon: AlertTriangle, color: 'bg-red-50 text-red-600 border border-red-100' };
    }
    if (type.includes('robot')) {
      return { Icon: Bot, color: 'bg-sky-50 text-sky-600 border border-sky-100' };
    }
    if (type.includes('room_service') || type.includes('f&b')) {
      return { Icon: CookingPot, color: 'bg-amber-50 text-amber-600 border border-amber-100' };
    }
    if (type.includes('bell')) {
      return { Icon: Briefcase, color: 'bg-stone-100 text-zinc-700 border border-stone-200' };
    }
    if (type.includes('maint')) {
      return { Icon: Wrench, color: 'bg-orange-50 text-orange-600 border border-orange-100' };
    }
    if (type.includes('directive')) {
      return { Icon: ShieldAlert, color: 'bg-purple-50 text-purple-600 border border-purple-100' };
    }
    return { Icon: Sparkles, color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' };
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
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 pb-28 lg:pb-10 bg-[#FAF8F5] font-sans select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 1. Tái cấu trúc Header: Khắc phục triệt để lỗi bóp méo Badge trên mobile */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          {/* Khối bên trái: Thông tin tiêu đề & Badges */}
          <div>
            {/* Hàng 1 (Badges): Đặt 2 badge nằm ngang gọn gàng phía trên tiêu đề */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 text-white whitespace-nowrap">
                {userDept}
              </span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-200/60 whitespace-nowrap">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>

            {/* Hàng 2: Tiêu đề chính */}
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              Trung Tâm Thông Báo &amp; Cảnh Báo
            </h1>

            {/* Hàng 3: Mô tả */}
            <p className="text-sm text-zinc-500 mt-1">
              Thông báo và chỉ thị điều phối thời gian thực dành riêng cho bộ phận{' '}
              <strong className="text-zinc-800 font-semibold">{userDept}</strong>.
            </p>
          </div>

          {/* Khối bên phải: Cụm nút hành động (Refresh & Đọc Tất Cả) */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
            {/* Nút Refresh */}
            <button
              type="button"
              onClick={handleRefreshClick}
              className="w-10 h-10 rounded-xl bg-white border border-stone-200/80 hover:bg-stone-50 flex items-center justify-center text-zinc-700 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
              title="Làm mới thông báo"
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin text-zinc-900' : ''}`}
              />
            </button>

            {/* Nút Đọc Tất Cả */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onMarkAllRead();
                  onNotify('Đã đánh dấu tất cả thông báo của phòng ban là đã đọc');
                }}
                className="h-10 px-4 rounded-xl bg-white border border-stone-200/80 hover:bg-stone-50 text-zinc-800 text-sm font-medium flex items-center gap-2 shadow-2xs transition-all whitespace-nowrap cursor-pointer active:scale-95"
              >
                <CheckCheck className="w-4 h-4 text-zinc-500" />
                <span>Đọc Tất Cả</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Thanh Công Cụ: Filter Tabs & Ô Tìm Kiếm (Toolbar) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
          {/* Filter Tabs cuộn ngang mượt mà, không gãy chữ */}
          <div className="flex items-center gap-1 p-1 bg-stone-200/60 rounded-xl overflow-x-auto no-scrollbar">
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
                className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ô Tìm Kiếm (100% mobile width, có icon kính lúp) */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-stone-200/80 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* 3. Danh Sách Card Thông Báo Gọn Gàng & Hiện Đại */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-stone-200/80 shadow-2xs space-y-2">
            <div className="w-12 h-12 rounded-xl bg-stone-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="font-semibold text-zinc-800 text-sm">
              Không có thông báo nào trong mục này.
            </p>
            <p className="text-zinc-500 text-xs max-w-sm mx-auto">
              Khi có yêu cầu hoặc chỉ thị mới gửi đến phòng ban, hệ thống sẽ tự động cập nhật ngay tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedNotifications.map((notif) => {
              const { Icon, color } = getNotifIcon(notif);
              const isUnread = notif.is_read === false || notif.isRead === false;

              return (
                <div
                  key={notif.id}
                  onClick={() => onToggleRead(notif.id)}
                  className={`group relative bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs hover:shadow-md transition-all overflow-hidden cursor-pointer ${
                    isUnread ? 'bg-stone-50/30' : 'opacity-90'
                  }`}
                >
                  {/* Chỉ báo chưa đọc (Unread vertical line) */}
                  {isUnread && (
                    <span className="absolute left-0 inset-y-0 w-1 bg-zinc-900" />
                  )}

                  <div className="flex items-start gap-3.5 sm:gap-4">
                    {/* Cột 1: Icon nhận diện */}
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Cột 2: Nội dung chính */}
                    <div className="flex-1 min-w-0">
                      {/* Dòng 1 (Meta Header): Gộp các nhãn phụ lên cùng 1 hàng */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-zinc-700 text-[11px] font-semibold">
                          {notif.department || userDept}
                        </span>
                        {isUnread ? (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[11px] font-semibold">
                            Chưa đọc
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-zinc-400 text-[11px] font-medium">
                            Đã đọc
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-zinc-400 ml-auto hidden sm:inline-block">
                          {notif.id}
                        </span>
                      </div>

                      {/* Dòng 2: Tiêu đề */}
                      <h3
                        className={`text-base font-bold leading-snug ${
                          isUnread ? 'text-zinc-900' : 'text-zinc-800'
                        }`}
                      >
                        {notif.title}
                      </h3>

                      {/* Dòng 3: Nội dung chi tiết */}
                      <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                        {notif.description}
                      </p>

                      {/* Dòng 4 (Footer của Card): Thời gian & Mã ID trên mobile */}
                      <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-zinc-400">
                        <span>
                          {notif.time ||
                            (notif.created_at
                              ? new Date(notif.created_at).toLocaleString('vi-VN')
                              : 'Vừa xong')}
                        </span>
                        <span className="sm:hidden font-mono bg-stone-100 text-zinc-500 px-1.5 py-0.5 rounded text-[11px]">
                          {notif.id}
                        </span>
                        {notif.request_id && (
                          <span className="font-mono text-zinc-500">
                            Mã: {notif.request_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cột 3: Nút đánh dấu đã đọc (Icon dấu tích đôi) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRead(notif.id);
                        onNotify(isUnread ? 'Đã đánh dấu đã đọc' : 'Đã đánh dấu chưa đọc');
                      }}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-all shadow-2xs cursor-pointer active:scale-95 ${
                        isUnread
                          ? 'bg-zinc-900 hover:bg-zinc-800 text-white'
                          : 'bg-stone-100 text-zinc-400 hover:bg-stone-200 hover:text-zinc-700 border border-stone-200/80'
                      }`}
                      title={isUnread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Phân trang (Pagination) */}
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
