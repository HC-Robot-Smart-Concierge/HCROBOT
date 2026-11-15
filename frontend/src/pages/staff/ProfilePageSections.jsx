import React from 'react';
import {
  User,
  Bot,
  Clock,
  Save,
  Camera,
  Edit3,
  MapPin,
  Briefcase,
  Hash,
  Upload,
  Trash2,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AVATAR_PRESETS = [
  {
    id: 'p1',
    label: 'Woman 1',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p2',
    label: 'Man 1',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p3',
    label: 'Woman 2',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p4',
    label: 'Man 2',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p5',
    label: 'Woman 3',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  },
  {
    id: 'p6',
    label: 'Man 3',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  },
];

export const ProfileEditFormSection = ({
  isEditingProfile,
  st,
  handleCancelEdit,
  handleSaveProfile,
  fullName,
  setFullName,
  role,
  setRole,
  code,
  setCode,
  location,
  setLocation,
  avatarUrl,
  setAvatarUrl,
  fileInputRef,
  handleFileChange,
  onNotify,
  shiftStatus,
  setShiftStatus,
  isSavingProfile,
}) => {
  if (!isEditingProfile) return null;

  return (
    <div className="bg-white rounded-2xl border border-stone-300 shadow-sm p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-98 duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0">
            <Edit3 className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st('Edit personal details')} </h3>
        </div>
        <button
          type="button"
          onClick={handleCancelEdit}
          className="text-stone-400 hover:text-zinc-800 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
        >
          {st('✕ Close')}{' '}
        </button>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Họ và tên */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span>{st('Full name')}</span>
            </label>
            <input
              type="text"
              placeholder={st('Enter your full name')}
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
              <span>{st('Job title / role')}</span>
            </label>
            <input
              type="text"
              placeholder={st('e.g. Room Service Staff, Shift Leader...')}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          {/* Mã nhân viên */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              <span>{st('Staff ID')}</span>
            </label>
            <input
              type="text"
              placeholder={st('e.g. RCP-01, MS-01...')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-mono font-semibold text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          {/* Khu vực phân công */}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              <span>{st('Assigned area / location')}</span>
            </label>
            <input
              type="text"
              placeholder={st('e.g. Main lobby, Floors 4 & 5...')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-stone-50 border border-stone-200/90 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          {/* Chọn Ảnh Đại Diện */}
          <div className="sm:col-span-2 space-y-3">
            <label className="block text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
              <span>{st('Profile picture (upload or choose a preset)')}</span>
            </label>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
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
                    title={st('Change picture')}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

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
                      <span>{st('Upload picture')}</span>
                    </button>

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('');
                          onNotify(st('Profile picture removed.'));
                        }}
                        className="h-9 px-3.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{st('Remove picture')}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">{st('JPG, PNG, WEBP or GIF, up to 5 MB')} </p>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200/60">
                <p className="text-[11px] font-semibold text-zinc-600 mb-2">{st('Or choose a preset:')} </p>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(preset.url);
                          onNotify(st('Selected picture: {0}', st(preset.label)));
                        }}
                        className={`relative w-10 h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-zinc-900 scale-105 shadow-xs ring-2 ring-zinc-300'
                            : 'border-stone-200 hover:border-stone-400 opacity-75 hover:opacity-100'
                        }`}
                        title={st('Choose {0}', st(preset.label))}
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
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{st('Current work status')} </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'available', label: st('Available (on duty)') },
                { id: 'busy', label: st('Busy (working on a task)') },
                { id: 'off_shift', label: st('Off shift') },
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
          >
            {st('Discard')}{' '}
          </button>
          <button
            type="submit"
            disabled={isSavingProfile}
            className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingProfile ? st('Saving...') : st('Save profile')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const ProfileShiftAndRobotCards = ({ st, location, staffDept }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Card 1: Shift Schedule */}
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st('Schedule & shifts')} </h3>
      </div>

      <div className="divide-y divide-stone-100 text-sm">
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Current shift:')}</span>
          <span className="font-semibold text-zinc-900 text-right shrink-0 whitespace-nowrap">{st('Morning shift (06:00 - 14:30)')} </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Assigned area:')}</span>
          <span className="font-semibold text-zinc-900 text-right truncate">
            {location || st('Main lobby reception')}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Hours worked this week:')}</span>
          <span className="font-semibold text-zinc-900 text-right shrink-0 whitespace-nowrap">{st('38.5 hours')} </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Service rating:')}</span>
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
        <h3 className="font-semibold text-zinc-900 text-sm sm:text-base">{st('Robot & system permissions')} </h3>
      </div>

      <div className="divide-y divide-stone-100 text-sm">
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('HCRobot dispatch:')}</span>
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold">{st('Authorized')} </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('LiDAR SLAM map access:')}</span>
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/70 text-xs font-semibold">{st('Full viewing access')} </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Emergency commands:')}</span>
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-stone-100 text-zinc-700 border border-stone-200/80 text-xs font-semibold">
            {staffDept === 'Executive' ? st('Can issue commands') : st('Can receive commands')}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 gap-4">
          <span className="text-zinc-500 text-sm min-w-0">{st('Authentication:')}</span>
          <span className="shrink-0 whitespace-nowrap font-mono text-xs sm:text-sm font-semibold text-zinc-800 text-right">
            JWT Bearer HS256
          </span>
        </div>
      </div>
    </div>
  </div>
);

export const ProfileChangePasswordForm = ({
  isChangingPassword,
  st,
  handlePasswordChange,
  currentPassword,
  setCurrentPassword,
  showCurrentPassword,
  setShowCurrentPassword,
  newPassword,
  setNewPassword,
  showNewPassword,
  setShowNewPassword,
  confirmPassword,
  setConfirmPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  onDiscard,
  isSavingPassword,
}) => {
  if (!isChangingPassword) return null;

  const passwordFields = [
    {
      label: st('Current password'),
      placeholder: st('Enter your current password'),
      value: currentPassword,
      onChange: setCurrentPassword,
      show: showCurrentPassword,
      toggleShow: () => setShowCurrentPassword(!showCurrentPassword),
    },
    {
      label: st('New password'),
      placeholder: st('At least 6 characters'),
      value: newPassword,
      onChange: setNewPassword,
      show: showNewPassword,
      toggleShow: () => setShowNewPassword(!showNewPassword),
    },
    {
      label: st('Confirm new password'),
      placeholder: st('Re-enter your new password'),
      value: confirmPassword,
      onChange: setConfirmPassword,
      show: showConfirmPassword,
      toggleShow: () => setShowConfirmPassword(!showConfirmPassword),
    },
  ];

  return (
    <div className="border-t border-stone-100 p-5 pt-4 bg-stone-50/50">
      <form
        onSubmit={handlePasswordChange}
        className="space-y-4 animate-in fade-in zoom-in-98 duration-150"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {passwordFields.map((field) => (
            <div key={field.label}>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{field.label} </label>
              <div className="relative">
                <input
                  type={field.show ? 'text' : 'password'}
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="w-full h-10 pl-3.5 pr-10 rounded-xl bg-white border border-stone-200/90 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all placeholder:text-zinc-400"
                  required
                />
                <button
                  type="button"
                  onClick={field.toggleShow}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-zinc-700 p-1 cursor-pointer transition-colors"
                  title={field.show ? st('Hide password') : st('Show password')}
                >
                  {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onDiscard}
            className="h-10 px-4 rounded-xl bg-white hover:bg-stone-100 text-zinc-700 border border-stone-200 text-sm font-medium transition-all cursor-pointer"
          >
            {st('Discard')}{' '}
          </button>
          <button
            type="submit"
            disabled={isSavingPassword}
            className="h-10 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingPassword ? st('Saving...') : st('Save password')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
