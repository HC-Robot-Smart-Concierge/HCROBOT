import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Bell,
  Globe,
  Bot,
  Map,
  Clock,
  CheckCircle2,
  Lock,
  LogOut,
  Save,
  Camera,
  Edit3,
  MapPin,
  Briefcase,
  Hash,
} from 'lucide-react';
import { changeStaffPassword, updateStaffProfile } from '../../services/operationsApi';

export const ProfilePage = ({
  currentUser,
  onUpdateUser = () => {},
  onLogout = () => {},
  onNotify = () => {},
}) => {
  const staffUsername = currentUser?.username || 'housekeeping';
  const staffDept = currentUser?.department || 'Housekeeping';

  // Personal info form state
  const [fullName, setFullName] = useState(currentUser?.full_name || currentUser?.name || 'Maria Santos');
  const [role, setRole] = useState(currentUser?.role || 'Housekeeping Lead');
  const [code, setCode] = useState(currentUser?.code || 'MS-01');
  const [location, setLocation] = useState(currentUser?.location || 'Tầng 4 & 5');
  const [avatarUrl, setAvatarUrl] = useState(
    currentUser?.avatar_url ||
      currentUser?.avatar ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
  );
  const [shiftStatus, setShiftStatus] = useState(currentUser?.status || 'available');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || currentUser.name || '');
      setRole(currentUser.role || '');
      setCode(currentUser.code || '');
      setLocation(currentUser.location || 'Tầng 4 & 5');
      if (currentUser.avatar_url || currentUser.avatar) {
        setAvatarUrl(currentUser.avatar_url || currentUser.avatar);
      }
      if (currentUser.status) {
        setShiftStatus(currentUser.status);
      }
    }
  }, [currentUser]);

  // Action: Save Personal Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onNotify('Vui lòng nhập họ và tên!');
      return;
    }

    setIsSavingProfile(true);
    const profilePayload = {
      username: staffUsername,
      full_name: fullName.trim(),
      role: role.trim(),
      code: code.trim(),
      location: location.trim(),
      avatar_url: avatarUrl.trim(),
      status: shiftStatus,
      department: staffDept,
    };

    const res = await updateStaffProfile(profilePayload);
    setIsSavingProfile(false);
    setIsEditingProfile(false);

    const updatedUser = {
      ...currentUser,
      ...profilePayload,
      name: fullName.trim(),
      avatar: avatarUrl.trim(),
    };

    // Update global state and localStorage
    try {
      localStorage.setItem('aurora_user', JSON.stringify(updatedUser));
    } catch (err) {}
    onUpdateUser(updatedUser);

    onNotify('Đã cập nhật thông tin cá nhân thành công!');
  };

  // Action: Change Password (3-field validation)
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      onNotify('Vui lòng nhập mật khẩu hiện tại!');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      onNotify('Mật khẩu mới phải có ít nhất 6 ký tự!');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify('Mật khẩu mới và xác nhận mật khẩu không trùng khớp!');
      return;
    }

    setIsSavingPassword(true);
    const res = await changeStaffPassword(currentPassword, newPassword, staffUsername);
    setIsSavingPassword(false);

    if (res && !res.error) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
      onNotify('Đã cập nhật mật khẩu mới thành công!');
    } else {
      onNotify(res?.detail || 'Mật khẩu hiện tại không đúng. Vui lòng thử lại.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#FAF8F5] font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#1A1917]">Hồ Sơ Nhân Viên & Cài Đặt</h2>
          <p className="text-xs text-[#78716C] mt-1">
            Quản lý thông tin ca trực, phân quyền thiết bị robot và thông tin cá nhân.
          </p>
        </div>

        {/* Profile Header Card */}
        <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-20 h-20 rounded-3xl object-cover border-2 border-stone-200 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-[#18181B] text-white flex items-center justify-center text-2xl font-bold shadow-md">
                {fullName.charAt(0)}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                shiftStatus === 'available'
                  ? 'bg-emerald-500'
                  : shiftStatus === 'busy'
                  ? 'bg-amber-500'
                  : 'bg-stone-400'
              }`}
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#1A1917]">{fullName}</h3>
                <p className="text-xs font-semibold text-[#78716C]">
                  {role} • <span className="text-stone-900 font-bold">{staffDept}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 self-center sm:self-auto">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    shiftStatus === 'available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : shiftStatus === 'busy'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      shiftStatus === 'available'
                        ? 'bg-emerald-500 animate-pulse'
                        : shiftStatus === 'busy'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                  <span>
                    {shiftStatus === 'available'
                      ? 'Đang Trực Ca'
                      : shiftStatus === 'busy'
                      ? 'Đang Xử Lý Việc'
                      : 'Nghỉ Ca'}
                  </span>
                </span>

                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isEditingProfile
                      ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                      : 'bg-[#18181B] hover:bg-black text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingProfile ? 'Đóng Chỉnh Sửa' : 'Chỉnh Sửa Thông Tin'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2 text-xs text-stone-600">
              <span className="px-3 py-1 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] font-mono">
                Mã NV: <strong className="text-stone-900">{code}</strong>
              </span>
              <span className="px-3 py-1 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] font-mono">
                Tài khoản: <strong className="text-stone-900">{staffUsername}</strong>
              </span>
              <span className="px-3 py-1 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]">
                Khu vực: <strong className="text-stone-900">{location}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Form: Chỉnh Sửa Thông Tin Cá Nhân (CHỈ HIỂN THỊ KHI BẤM BUTTON) */}
        {isEditingProfile && (
          <div className="p-6 rounded-3xl bg-white border-2 border-stone-800/80 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE3]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1A1917]" />
                <h4 className="text-sm font-bold text-[#1A1917]">Chỉnh Sửa Thông Tin Cá Nhân</h4>
              </div>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-stone-400 hover:text-stone-800 text-xs font-bold cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-stone-500" />
                    <span>Họ và Tên</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập họ và tên đầy đủ"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
                    required
                  />
                </div>

                {/* Chức danh / Vai trò */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-stone-500" />
                    <span>Chức Danh / Vai Trò</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Housekeeping Lead, Shift Leader..."
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
                  />
                </div>

                {/* Mã nhân viên */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-stone-500" />
                    <span>Mã Nhân Viên</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: MS-01, ER-01..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-mono font-bold text-stone-900 outline-none focus:border-stone-400"
                  />
                </div>

                {/* Khu vực phân công */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-500" />
                    <span>Khu Vực Trực Ca / Vị Trí</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Tầng 4 & 5, Sảnh Lobby, Bếp F&B..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-400"
                  />
                </div>

                {/* Link Avatar */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-stone-500" />
                    <span>Đường Dẫn Ảnh Đại Diện (Avatar URL)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs text-stone-800 outline-none focus:border-stone-400"
                  />
                </div>

                {/* Trạng thái ca trực */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1">
                    Trạng Thái Làm Việc Hiện Tại
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'available', label: '🟢 Sẵn Sàng (Trực Ca)' },
                      { id: 'busy', label: '🟡 Đang Bận (Xử Lý Việc)' },
                      { id: 'off_shift', label: '⚪ Nghỉ Ca' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setShiftStatus(s.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          shiftStatus === s.id
                            ? 'bg-[#18181B] text-white border-black shadow-sm'
                            : 'bg-[#FAF8F5] text-stone-700 border-[#E0DCD3] hover:bg-[#EFECE6]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-5 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer"
                >
                  ✕ Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2-Column Grid: Shift Details & Robot Clearance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shift Details */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0ECE3]">
              <Clock className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-bold text-[#1A1917]">Lịch Trình & Ca Trực</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Ca trực hiện tại:</span>
                <span className="font-bold text-stone-900">Ca sáng (06:00 - 14:30)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Khu vực phân công:</span>
                <span className="font-bold text-stone-900">{location}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Tổng giờ làm tuần này:</span>
                <span className="font-bold text-stone-900">38.5 giờ</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#78716C]">Đánh giá chất lượng:</span>
                <span className="font-bold text-emerald-700">★★★★★ 4.95 / 5.0</span>
              </div>
            </div>
          </div>

          {/* Robot Clearance */}
          <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F0ECE3]">
              <Bot className="w-4 h-4 text-sky-600" />
              <h4 className="text-sm font-bold text-[#1A1917]">Quyền Hạn Robot & Hệ Thống</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Điều phối xe tự hành HCRobot:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Được cấp phép
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Truy cập bản đồ LiDAR SLAM:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                  Toàn quyền xem
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#F5F2EB]">
                <span className="text-[#78716C]">Chỉ thị khẩn cấp:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-bold">
                  {staffDept === 'Executive' ? 'Có quyền phát lệnh' : 'Quyền nhận lệnh'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#78716C]">Xác thực bảo mật:</span>
                <span className="font-bold text-stone-800 font-mono">JWT Bearer HS256</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card with Button Toggle */}
        <div className="p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0ECE3]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-stone-700" />
              <div>
                <h4 className="text-sm font-bold text-[#1A1917]">Bảo Mật & Đổi Mật Khẩu Đăng Nhập</h4>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  Cập nhật mật khẩu định kỳ để bảo vệ tài khoản tác vụ.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsChangingPassword(!isChangingPassword);
                if (isChangingPassword) {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 self-start sm:self-auto ${
                isChangingPassword
                  ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                  : 'bg-[#18181B] hover:bg-black text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isChangingPassword ? 'Đóng Lại' : 'Đổi Mật Khẩu'}</span>
            </button>
          </div>

          {/* Form 3 Fields: CHỈ HIỂN THỊ KHI BẤM NÚT */}
          {isChangingPassword && (
            <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in zoom-in-95 duration-200 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Mật khẩu hiện tại */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu hiện tại"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs outline-none focus:border-stone-400"
                    required
                  />
                </div>

                {/* 2. Mật khẩu mới */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs outline-none focus:border-stone-400"
                    required
                  />
                </div>

                {/* 3. Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-[11px] font-bold text-[#78716C] uppercase mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs outline-none focus:border-stone-400"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-5 py-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all cursor-pointer"
                >
                  ✕ Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-6 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingPassword ? 'Đang lưu...' : 'Lưu Thay Đổi Mật Khẩu'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Logout Section */}
        <div className="p-6 rounded-3xl bg-red-50/50 border border-red-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-red-900">Đăng Xuất Khỏi Thiết Bị</h4>
          </div>

          <button
            onClick={onLogout}
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
};
