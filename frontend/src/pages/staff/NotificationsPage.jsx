import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Bot,
  CookingPot,
  Sparkles,
  ShieldAlert,
  Info,
  Clock,
} from 'lucide-react';

export const NotificationsPage = ({ onNotify = () => {} }) => {
  const [filter, setFilter] = useState('All'); // 'All' | 'Unread' | 'Urgent' | 'Robot'

  const [notifications, setNotifications] = useState([
    {
      id: 'NOTIF-01',
      title: 'Sự cố tràn nước khẩn cấp tại Phòng 502',
      description: 'Phát hiện sự cố tràn rượu vang trên thảm qua hệ thống Camera AI của HCRobot.',
      time: '2 phút trước',
      type: 'Urgent',
      isRead: false,
      icon: AlertTriangle,
      iconColor: 'bg-red-100 text-red-600',
    },
    {
      id: 'NOTIF-02',
      title: 'Cảnh báo mức tồn kho thấp: Artisan Cola còn 6 lon',
      description: 'Mặt hàng nước giải khát F&B sắp hết trong kho tầng 2, cần nhập hàng bổ sung.',
      time: '12 phút trước',
      type: 'Warning',
      isRead: false,
      icon: CookingPot,
      iconColor: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'NOTIF-03',
      title: 'HCRobot Unit 02 hoàn tất giao hàng tại Phòng 412',
      description: 'Khách hàng đã nhận đơn ăn nhẹ và xác nhận mã PIN mở khoang thành công.',
      time: '25 phút trước',
      type: 'Robot',
      isRead: true,
      icon: Bot,
      iconColor: 'bg-sky-100 text-sky-700',
    },
    {
      id: 'NOTIF-04',
      title: 'Chỉ thị điều hành mới từ Tổng Quản Lý Marcus Vane',
      description: 'Chỉ thị #M-101: Tăng cường nhân sự hỗ trợ khu vực sảnh Lobby trong khung giờ 10:00 - 12:00.',
      time: '1 giờ trước',
      type: 'Directive',
      isRead: true,
      icon: ShieldAlert,
      iconColor: 'bg-stone-100 text-stone-700',
    },
    {
      id: 'NOTIF-05',
      title: 'HCRobot Unit 03 đã kết nối trạm sạc Dock 2',
      description: 'Dung lượng pin đạt 84%, tự động kích hoạt chế độ sạc nhanh và chờ lệnh tiếp theo.',
      time: '2 giờ trước',
      type: 'Robot',
      isRead: true,
      icon: Bot,
      iconColor: 'bg-emerald-100 text-emerald-700',
    },
  ]);

  const filtered = notifications.filter((n) => {
    if (filter === 'Unread') return !n.isRead;
    if (filter === 'Urgent') return n.type === 'Urgent';
    if (filter === 'Robot') return n.type === 'Robot';
    return true;
  });

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onNotify('Đã đánh dấu tất cả thông báo là đã đọc');
  };

  const handleToggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n))
    );
  };

  const handleDelete = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    onNotify('Đã xóa thông báo');
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-[#1A1917]">Trung Tâm Thông Báo & Cảnh Báo</h2>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              Cập nhật cảnh báo thời gian thực từ robot tự hành và các bộ phận nghiệp vụ.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-full bg-white border border-[#DDD8CE] text-xs font-bold text-stone-700 hover:bg-[#F5F2EB] transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đọc Tất Cả</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-[#EFECE6] p-1 rounded-full border border-[#DDD8CE] w-fit">
          {[
            { id: 'All', label: 'Tất Cả' },
            { id: 'Unread', label: `Chưa Đọc (${unreadCount})` },
            { id: 'Urgent', label: 'Khẩn Cấp' },
            { id: 'Robot', label: 'Robot Telemetry' },
          ].map((tab) => (
            <button
              key={tab.id}
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

        {/* Notifications List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#E5E1D8] text-xs text-stone-500">
              Không có thông báo nào trong mục này.
            </div>
          ) : (
            filtered.map((notif) => {
              const Icon = notif.icon || Bell;
              return (
                <div
                  key={notif.id}
                  className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                    !notif.isRead
                      ? 'bg-white border-stone-300 shadow-sm border-l-4 border-l-red-500'
                      : 'bg-[#FAF8F5]/80 border-[#EAE6DE] opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${notif.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#1A1917]">{notif.title}</h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        )}
                      </div>
                      <p className="text-xs text-[#78716C] leading-relaxed">{notif.description}</p>
                      <p className="text-[11px] text-stone-400 font-medium pt-1">{notif.time}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleRead(notif.id)}
                      className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors"
                      title={notif.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
                      title="Xóa thông báo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
