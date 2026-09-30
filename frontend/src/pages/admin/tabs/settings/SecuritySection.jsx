import React, { useState } from 'react';
import { ChevronDown, LogOut, KeyRound, UserCheck, ShieldCheck } from 'lucide-react';
import { changeStaffPassword, updateStaffProfile } from '../../../../services/operationsApi';

export const SecuritySection = ({ settings, setSettings, showToast, currentUser = {} }) => {
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile update state
  const [fullName, setFullName] = useState(currentUser?.full_name || 'Quản trị viên');
  const [email, setEmail] = useState(currentUser?.email || 'admin@aurora.hotel');
  const [phone, setPhone] = useState(currentUser?.phone || '+84 90 123 4567');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('⚠️ Mật khẩu mới phải có ít nhất 6 ký tự!');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('⚠️ Mật khẩu xác nhận không khớp!');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changeStaffPassword(currentPassword, newPassword, currentUser?.username || 'admin');
      if (res && (res.message || res.success)) {
        showToast('✅ Đã đổi mật khẩu tài khoản Admin thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast('⚠️ Đổi mật khẩu không thành công. Vui lòng kiểm tra mật khẩu hiện tại.');
      }
    } catch {
      showToast('⚠️ Lỗi khi kết nối tới máy chủ đổi mật khẩu.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdateProfileSubmit = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const res = await updateStaffProfile({
        username: currentUser?.username || 'admin',
        full_name: fullName,
        email,
        phone,
      });
      if (res) {
        showToast('✅ Đã cập nhật hồ sơ cá nhân Quản trị viên thành công!');
      }
    } catch {
      showToast('⚠️ Lỗi khi cập nhật thông tin hồ sơ.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Card 0: Admin Account & Password Management (Connected to Real Backend Auth API) */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/40 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Tài Khoản Quản Trị & Đổi Mật Khẩu (Admin Account)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Cập nhật thông tin định danh và mật khẩu đăng nhập trực tiếp trên cơ sở dữ liệu PostgreSQL.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {currentUser?.username || 'admin'} • {currentUser?.role || 'Admin'}
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Left Form: Profile Details */}
          <form onSubmit={handleUpdateProfileSubmit} className="space-y-4 pr-0 lg:pr-4 border-b lg:border-b-0 lg:border-r border-stone-200 pb-6 lg:pb-0">
            <div className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-stone-600" />
              <span>Thông Tin Hồ Sơ Quản Trị</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                HỌ VÀ TÊN:
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  EMAIL:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  SỐ ĐIỆN THOẠI:
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs cursor-pointer transition-all shadow-sm"
            >
              {isUpdatingProfile ? 'Đang cập nhật...' : 'Lưu Thay Đổi Hồ Sơ'}
            </button>
          </form>

          {/* Right Form: Change Password */}
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            <div className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-stone-600" />
              <span>Đổi Mật Khẩu Đăng Nhập</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                MẬT KHẨU HIỆN TẠI:
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  MẬT KHẨU MỚI:
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                  XÁC NHẬN MẬT KHẨU:
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all shadow-sm"
            >
              {isChangingPassword ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}
            </button>
          </form>
        </div>
      </div>

      {/* Card 1: Admin Access Control */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/40">
          <h3 className="text-base font-extrabold text-stone-900">Chính Sách Phiên & Truy Cập (Access Policies)</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Quản lý phiên làm việc và bảo vệ phiên đăng nhập của bảng điều khiển.
          </p>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* 2FA Toggle */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <p className="font-extrabold text-stone-900">
                Yêu cầu xác thực hai lớp (2FA) cho tất cả Quản trị viên
              </p>
              <p className="text-[11px] text-stone-500">
                Thêm một lớp bảo mật khi đăng nhập vào hệ thống khách sạn.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.require2FA}
                onChange={(e) => setSettings({ ...settings, require2FA: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Idle Session Timeout */}
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
              THỜI GIAN CHỜ HẾT HẠN PHIÊN (IDLE SESSION TIMEOUT)
            </label>
            <div className="relative">
              <select
                value={settings.idleTimeout}
                onChange={(e) => setSettings({ ...settings, idleTimeout: e.target.value })}
                className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
              >
                <option value="15 Minutes">15 Phút</option>
                <option value="30 Minutes">30 Phút</option>
                <option value="1 Hour">1 Giờ</option>
                <option value="4 Hours">4 Giờ</option>
                <option value="8 Hours">8 Giờ</option>
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Reset All Sessions Button */}
          <div>
            <button
              type="button"
              onClick={() => showToast('Đã thu hồi và đăng xuất tất cả các phiên làm việc quản trị.')}
              className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng Xuất Mọi Thiết Bị Khác</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Robot Security Policies */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/40">
          <h3 className="text-base font-extrabold text-stone-900">Chính Sách An Ninh Robot (Robot Security Policies)</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Cấu hình giao thức xác thực khi nhận đồ và an toàn di chuyển cho Robot Concierge.
          </p>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Delivery Auth */}
          <div>
            <label className="block text-[11px] font-black text-stone-600 uppercase tracking-wider mb-1.5">
              XÁC THỰC KHÁCH KHI GIAO ĐỒ
            </label>
            <div className="relative">
              <select
                value={settings.guestAuthForDeliveries}
                onChange={(e) => setSettings({ ...settings, guestAuthForDeliveries: e.target.value })}
                className="w-full appearance-none px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-10"
              >
                <option value="Room Number + PIN">Room Number + PIN (Số phòng + Mã PIN ngẫu nhiên)</option>
                <option value="NFC Keycard Tap">NFC Keycard Tap (Quẹt thẻ phòng lên Robot)</option>
                <option value="Facial Recognition">Facial Recognition (Nhận diện khuôn mặt khách VIP)</option>
                <option value="Direct Delivery - No Auth">Direct Delivery - No Auth (Giao trực tiếp khi đến cửa)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Restricted Zones Toggle */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <p className="font-extrabold text-stone-900">
                Cho phép di chuyển vào khu vực hạn chế (Khu vực Nhân viên)
              </p>
              <p className="text-[11px] text-stone-500">
                Robot có thể đi vào bếp và thang máy nhân viên khi vận chuyển đồ.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.allowRestrictedZones}
                onChange={(e) => setSettings({ ...settings, allowRestrictedZones: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
