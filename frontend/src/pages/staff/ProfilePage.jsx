import { KeyRound, LogOut, Save, Edit3 } from 'lucide-react';
import {
  ProfileEditFormSection,
  ProfileShiftAndRobotCards,
  ProfileChangePasswordForm,
} from './ProfilePageSections';
import { changeStaffPassword, updateStaffProfile } from '../../services/operationsApi';
import { updateStoredUser } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';

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

        <ProfileEditFormSection
          isEditingProfile={isEditingProfile}
          st={st}
          handleCancelEdit={handleCancelEdit}
          handleSaveProfile={handleSaveProfile}
          fullName={fullName}
          setFullName={setFullName}
          role={role}
          setRole={setRole}
          code={code}
          setCode={setCode}
          location={location}
          setLocation={setLocation}
          avatarUrl={avatarUrl}
          setAvatarUrl={setAvatarUrl}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          onNotify={onNotify}
          shiftStatus={shiftStatus}
          setShiftStatus={setShiftStatus}
          isSavingProfile={isSavingProfile}
        />

        <ProfileShiftAndRobotCards st={st} location={location} staffDept={staffDept} />

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

          <ProfileChangePasswordForm
            isChangingPassword={isChangingPassword}
            st={st}
            handlePasswordChange={handlePasswordChange}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            showCurrentPassword={showCurrentPassword}
            setShowCurrentPassword={setShowCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            showNewPassword={showNewPassword}
            setShowNewPassword={setShowNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            onDiscard={() => {
              setIsChangingPassword(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }}
            isSavingPassword={isSavingPassword}
          />
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
