import { useStaffText, staffDepartmentLabel } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Upload,
  Image,
  Trash2,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { changeStaffPassword, updateStaffProfile } from '../../services/operationsApi';
import { updateStoredUser } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';

const AVATAR_PRESETS = [
  {
    id: 'p1',
    label: "Woman 1",
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p2',
    label: "Man 1",
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p3',
    label: "Woman 2",
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p4',
    label: "Man 2",
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p5',
    label: "Woman 3",
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p6',
    label: "Man 3",
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  },
];

export const ProfilePage = ({
  currentUser,
  onUpdateUser,
  onUserUpdated,
  onLogout,
  onNotify = () => {},
}) => {
  const st = useStaffText();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleUserSync = onUpdateUser || onUserUpdated || (() => {});
  const staffUsername = currentUser?.username || '';
  const staffDept = currentUser?.department || st('Staff');
  const fileInputRef = useRef(null);

  // Personal info form state
  const [fullName, setFullName] = useState(
    currentUser?.full_name || currentUser?.name || 'Maria Santos'
  );
  const [role, setRole] = useState(currentUser?.role || '');
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || currentUser.name || '');
      setRole(currentUser.role || '');
      setCode(currentUser.code || '');
      setLocation(currentUser.location || 'Tầng 4 & 5');
      setAvatarUrl(currentUser.avatar_url || currentUser.avatar || '');
      if (currentUser.status) {
        setShiftStatus(currentUser.status);
      }
    }
  }, [currentUser]);

  // Cancel edit and reset all draft fields back to saved currentUser
  const handleCancelEdit = () => {
    if (currentUser) {
      setFullName(currentUser.full_name || currentUser.name || '');
      setRole(currentUser.role || '');
      setCode(currentUser.code || '');
      setLocation(currentUser.location || 'Tầng 4 & 5');
      setAvatarUrl(currentUser.avatar_url || currentUser.avatar || '');
      setShiftStatus(currentUser.status || 'available');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsEditingProfile(false);
  };

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onNotify(st("Choose a valid image file (PNG, JPG, WEBP or GIF)."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onNotify(st("The maximum image size is 5 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setAvatarUrl(base64);
      onNotify(st("Picture uploaded. Select Save profile to finish."));
    };
    reader.readAsDataURL(file);
  };

  // Action: Save Personal Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onNotify(st("Enter your full name."));
      return;
    }

    setIsSavingProfile(true);
    const profilePayload = {
      username: staffUsername,
      full_name: fullName.trim(),
      role: role.trim(),
      code: code.trim(),
      location: location.trim(),
      avatar_url: avatarUrl ? avatarUrl.trim() : '',
      status: shiftStatus,
      department: staffDept,
    };

    const res = await updateStaffProfile(profilePayload);
    setIsSavingProfile(false);
    setIsEditingProfile(false);

    const updatedUser = {
      ...currentUser,
      ...(res && typeof res === 'object' ? res : {}),
      ...profilePayload,
      full_name: fullName.trim(),
      name: fullName.trim(),
      avatar_url: avatarUrl ? avatarUrl.trim() : '',
      avatar: avatarUrl ? avatarUrl.trim() : '',
    };

    // Update global state and localStorage across all storage keys
    updateStoredUser(updatedUser);
    handleUserSync(updatedUser);

    onNotify(st("Profile updated."));
  };

  // Action: Change Password (3-field validation)
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      onNotify(st("Enter your current password."));
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      onNotify(st("The new password must contain at least 6 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify(st("The new password and confirmation do not match."));
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
      onNotify(st("Password updated."));
    } else {
      onNotify(res?.detail || st("The current password is incorrect. Please try again."));
    }
  };

  // Action: Secure Logout Handler (supports prop, AuthContext, notifications and redirect)
  const handleLogoutAction = async () => {
    try {
      if (typeof onLogout === 'function') {
        await onLogout();
        return;
      }
      await logout();
      onNotify(st("Signed out successfully."));
      navigate('/');
    } catch (err) {
      console.error('[ProfilePage] Logout error:', err);
      navigate('/');
    }
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar bg-[#F8F7F4] font-sans p-4 sm:p-6 lg:p-8 pb-28 lg:pb-10 select-none">
      <div className="staff-page-container max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <StaffPageHeader>
          <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">{st("Staff profile")} </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{st("Manage your shift, robot permissions and personal details.")} </p>
          </div>
        </StaffPageHeader>

        {/* 1. Header Card (Employee Profile Overview) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all">
          {/* Left: Avatar + Identity */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-16 h-16 rounded-2xl object-cover border border-stone-200/90 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-xl font-bold shadow-xs">
                  {fullName.charAt(0) || 'U'}
                </div>
              )}
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-white ${
                  shiftStatus === 'available'
                    ? 'bg-emerald-500'
                    : shiftStatus === 'busy'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
                title={
                  shiftStatus === 'available'
                    ? st("On duty")
                    : shiftStatus === 'busy'
                    ? st("Busy")
                    : st("Off duty")
                }
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 truncate">
                {fullName}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-zinc-500 flex items-center gap-1.5 flex-wrap">
                <span>{role}</span>
                <span className="text-stone-300">•</span>
                <span className="text-zinc-900 font-semibold">{st(staffDepartmentLabel(staffDept))}</span>
              </p>

              {/* Badges / Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/80 text-xs font-mono text-zinc-600">{st("Staff ID:")} <strong className="font-semibold text-zinc-900">{code || '---'}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/80 text-xs font-mono text-zinc-600">{st("Account:")} <strong className="font-semibold text-zinc-900">{staffUsername}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200/80 text-xs text-zinc-600">{st("Area:")} <strong className="font-semibold text-zinc-900">{location || st("Unassigned")}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Shift Status & Edit Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <span
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                shiftStatus === 'available'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : shiftStatus === 'busy'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                  : 'bg-stone-100 text-stone-700 border border-stone-200/70'
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
                  ? st("On duty")
                  : shiftStatus === 'busy'
                  ? st("Busy")
                  : st("Off duty")}
              </span>
            </span>

            <button
              type="button"
              onClick={() => {
                if (isEditingProfile) {
                  handleCancelEdit();
                } else {
                  if (currentUser) {
                    setFullName(currentUser.full_name || currentUser.name || '');
                    setRole(currentUser.role || '');
                    setCode(currentUser.code || '');
                    setLocation(currentUser.location || 'Tầng 4 & 5');
                    setAvatarUrl(currentUser.avatar_url || currentUser.avatar || '');
                    setShiftStatus(currentUser.status || 'available');
                  }
                  setIsEditingProfile(true);
                }
              }}
              className={`w-full sm:w-auto h-10 px-4 rounded-xl text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                isEditingProfile
                  ? 'bg-stone-100 hover:bg-stone-200 text-zinc-800 border border-stone-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditingProfile ? st("Close editor") : st("Edit profile")}</span>
            </button>
          </div>
        </div>

        {/* Form: Chỉnh Sửa Thông Tin Cá Nhân (Toggleable) */}
        {isEditingProfile && (
          <div className="bg-white rounded-2xl border border-stone-300 shadow-sm p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-98 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st("Edit personal details")} </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-stone-400 hover:text-zinc-800 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >{st("✕ Close")} </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{st("Full name")}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={st("Enter your full name")}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                    required
                  />
                </div>

                {/* Chức danh / Vai trò */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{st("Job title / role")}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={st("e.g. Room Service Staff, Shift Leader...")}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>

                {/* Mã nhân viên */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{st("Staff ID")}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={st("e.g. RCP-01, MS-01...")}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-mono font-semibold text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>

                {/* Khu vực phân công */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{st("Assigned area / location")}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={st("e.g. Main lobby, Floors 4 & 5...")}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>

                {/* Chọn Ảnh Đại Diện */}
                <div className="sm:col-span-2 space-y-3">
                  <label className="block text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{st("Profile picture (upload or choose a preset)")}</span>
                  </label>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Avatar Live Preview */}
                      <div className="relative group shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Avatar Preview"
                            className="w-16 h-16 rounded-xl object-cover border border-stone-200 shadow-xs"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xl font-bold">
                            {fullName.charAt(0) || 'U'}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/40 text-white rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                          title={st("Change picture")}
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{st("Upload picture")}</span>
                          </button>

                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarUrl('');
                                onNotify(st("Profile picture removed."));
                              }}
                              className="h-9 px-3.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{st("Remove picture")}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500">{st("JPG, PNG, WEBP or GIF, up to 5 MB")} </p>
                      </div>
                    </div>

                    {/* Presets Gallery */}
                    <div className="pt-3 border-t border-stone-200/60">
                      <p className="text-[11px] font-semibold text-zinc-600 mb-2">{st("Or choose a preset:")} </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {AVATAR_PRESETS.map((preset) => {
                          const isSelected = avatarUrl === preset.url;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setAvatarUrl(preset.url);
                                onNotify(st("Selected picture: {0}", st(preset.label)));
                              }}
                              className={`relative w-10 h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-zinc-900 scale-105 shadow-xs ring-2 ring-zinc-300'
                                  : 'border-stone-200 hover:border-stone-400 opacity-75 hover:opacity-100'
                              }`}
                              title={st("Choose {0}", st(preset.label))}
                            >
                              <img
                                src={preset.url}
                                alt={st(preset.label)}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-zinc-900/35 flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trạng thái ca trực */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{st("Current work status")} </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'available', label: st("Available (on duty)") },
                      { id: 'busy', label: st("Busy (working on a task)") },
                      { id: 'off_shift', label: st("Off shift") },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setShiftStatus(s.id)}
                        className={`h-10 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-center ${
                          shiftStatus === s.id
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-stone-50 text-zinc-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="h-10 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-zinc-700 text-sm font-medium transition-all cursor-pointer"
                >{st("Discard")} </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? st("Saving...") : st("Save profile")}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. Hai Card thông số: Lịch Trình & Ca Trực + Quyền Hạn Robot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Shift Schedule */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st("Schedule & shifts")} </h3>
            </div>

            <div className="divide-y divide-stone-100 text-sm">
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Current shift:")}</span>
                <span className="font-semibold text-zinc-900 text-right shrink-0 whitespace-nowrap">{st("Morning shift (06:00 - 14:30)")} </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Assigned area:")}</span>
                <span className="font-semibold text-zinc-900 text-right truncate">
                  {location || st("Main lobby reception")}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Hours worked this week:")}</span>
                <span className="font-semibold text-zinc-900 text-right shrink-0 whitespace-nowrap">{st("38.5 hours")} </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Service rating:")}</span>
                <span className="font-semibold text-emerald-700 text-right shrink-0 whitespace-nowrap">
                  ★★★★★ 4.95 / 5.0
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Robot Clearance */}
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st("Robot & system permissions")} </h3>
            </div>

            <div className="divide-y divide-stone-100 text-sm">
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("HCRobot dispatch:")}</span>
                <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold">{st("Authorized")} </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("LiDAR SLAM map access:")}</span>
                <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/70 text-xs font-semibold">{st("Full viewing access")} </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Emergency commands:")}</span>
                <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-stone-100 text-zinc-700 border border-stone-200/80 text-xs font-semibold">
                  {staffDept === 'Executive' ? st("Can issue commands") : st("Can receive commands")}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 gap-4">
                <span className="text-zinc-500 text-sm min-w-0">{st("Authentication:")}</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-xs sm:text-sm font-semibold text-zinc-800 text-right">
                  JWT Bearer HS256
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Card "Bảo Mật & Đổi Mật Khẩu Đăng Nhập" (Linear / Settings standard) */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-zinc-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900">{st("Security & password")} </h3>
                <p className="text-xs text-zinc-500 mt-0.5">{st("Update your password regularly to protect your account.")} </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(!isChangingPassword);
                if (isChangingPassword) {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
              className={`w-full sm:w-auto h-10 px-4 rounded-xl text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-[0.98] ${
                isChangingPassword
                  ? 'bg-stone-100 hover:bg-stone-200 text-zinc-800 border border-stone-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>{isChangingPassword ? st("Close form") : st("Change password")}</span>
            </button>
          </div>

          {/* Form 3 Fields: CHỈ HIỂN THỊ KHI BẤM NÚT */}
          {isChangingPassword && (
            <div className="border-t border-stone-100 p-5 pt-4 bg-stone-50/50">
              <form
                onSubmit={handlePasswordChange}
                className="space-y-4 animate-in fade-in zoom-in-98 duration-150"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 1. Mật khẩu hiện tại */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{st("Current password")} </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder={st("Enter your current password")}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-white border border-stone-200/90 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-700 p-1 cursor-pointer transition-colors"
                        title={showCurrentPassword ? st("Hide password") : st("Show password")}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 2. Mật khẩu mới */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{st("New password")} </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder={st("At least 6 characters")}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-white border border-stone-200/90 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-700 p-1 cursor-pointer transition-colors"
                        title={showNewPassword ? st("Hide password") : st("Show password")}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3. Xác nhận mật khẩu mới */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{st("Confirm new password")} </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={st("Re-enter your new password")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-white border border-stone-200/90 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-700 p-1 cursor-pointer transition-colors"
                        title={showConfirmPassword ? st("Hide password") : st("Show password")}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="h-10 px-4 rounded-xl bg-white hover:bg-stone-100 text-zinc-700 border border-stone-200 text-sm font-medium transition-all cursor-pointer"
                  >{st("Discard")} </button>
                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingPassword ? st("Saving...") : st("Save password")}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 4. Khối Đăng Xuất (Danger Zone) */}
        <div className="bg-red-50/50 border border-red-200/75 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-red-950">{st("Sign out of this device")} </h3>
            <p className="text-xs sm:text-sm text-red-700/80 mt-0.5">{st("End your current session and disconnect from the HCRobot control station.")} </p>
          </div>

          <button
            type="button"
            onClick={handleLogoutAction}
            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            <span>{st("Sign out")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
