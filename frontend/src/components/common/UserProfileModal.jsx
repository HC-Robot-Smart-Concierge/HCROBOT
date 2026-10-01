import React, { useState, useEffect } from 'react';
import { User, KeyRound, CheckCircle2, AlertCircle, X, Save } from 'lucide-react';
import { fetchCurrentUser, updateUserProfile, changePassword, getStoredUser } from '../../services/authApi';

export function UserProfileModal({ isOpen, onClose, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [location, setLocation] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
        setFullName(stored.full_name || '');
        setCode(stored.code || '');
        setAvatarUrl(stored.avatar_url || '');
        setLocation(stored.location || '');
      }

      // Fetch freshest profile from backend
      fetchCurrentUser().then((fresh) => {
        if (fresh) {
          setUser(fresh);
          setFullName(fresh.full_name || '');
          setCode(fresh.code || '');
          setAvatarUrl(fresh.avatar_url || '');
          setLocation(fresh.location || '');
        }
      });
      setSuccessMsg('');
      setErrorMsg('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await updateUserProfile({
        full_name: fullName.trim(),
        code: code.trim(),
        avatar_url: avatarUrl.trim(),
        location: location.trim(),
      });

      if (res.success) {
        setUser(res.user);
        setSuccessMsg('Hồ sơ đã được cập nhật thành công!');
        if (onUserUpdated) onUserUpdated(res.user);
      } else {
        setErrorMsg(res.error || 'Cập nhật hồ sơ thất bại.');
      }
    } catch (err) {
      setErrorMsg('Không thể cập nhật thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await changePassword(currentPassword, newPassword, user?.username);
      if (res.success) {
        setSuccessMsg(res.message || 'Mật khẩu đã được đổi thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(res.error || 'Đổi mật khẩu thất bại.');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối tới máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hc-modal-overlay">
      <div className="hc-modal-box max-w-md w-full p-6 bg-white border border-palette-silver rounded-2xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-palette-silver">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-palette-stone flex items-center justify-center text-palette-charcoal font-bold text-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 className="text-base font-bold text-palette-charcoal">
                {user?.full_name || 'Hồ Sơ Nhân Sự'}
              </h3>
              <p className="text-xs text-palette-slate font-medium">
                @{user?.username || 'user'} • {user?.department || 'Khách sạn'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-palette-stone text-palette-slate hover:text-palette-charcoal transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selectors */}
        <div className="flex border-b border-palette-silver my-3">
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'border-palette-charcoal text-palette-charcoal'
                : 'border-transparent text-palette-slate hover:text-palette-charcoal'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Thông tin cá nhân
          </button>
          <button
            onClick={() => { setActiveTab('password'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'password'
                ? 'border-palette-charcoal text-palette-charcoal'
                : 'border-transparent text-palette-slate hover:text-palette-charcoal'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Đổi mật khẩu
          </button>
        </div>

        {/* Alert Feedback */}
        {successMsg && (
          <div className="p-3 mb-3 rounded-xl bg-palette-stone border border-palette-silver flex items-center gap-2 text-xs font-bold text-palette-charcoal">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-bold text-red-600">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {/* Tab Profile Content */}
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Họ và tên</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="hc-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-palette-charcoal mb-1">Mã nhân sự</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="hc-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-palette-charcoal mb-1">Vị trí / Quầy</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="hc-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Đường dẫn ảnh đại diện (Avatar URL)</label>
              <input
                type="url"
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="hc-input"
              />
            </div>

            <div className="pt-3 border-t border-palette-silver flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-palette-silver text-palette-charcoal hover:bg-palette-stone transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="hc-btn-primary gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        )}

        {/* Tab Password Content */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Mật khẩu hiện tại</label>
              <input
                type="password"
                required
                placeholder="Mật khẩu hiện tại (mặc định 123456)"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="hc-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Mật khẩu mới</label>
              <input
                type="password"
                required
                placeholder="Tối thiểu 6 ký tự"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="hc-input"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-palette-charcoal mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="hc-input"
              />
            </div>

            <div className="pt-3 border-t border-palette-silver flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-palette-silver text-palette-charcoal hover:bg-palette-stone transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="hc-btn-primary gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
