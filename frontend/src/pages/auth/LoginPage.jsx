import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Bot,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  CheckCircle,
} from 'lucide-react';
import { loginUser, DEMO_STAFF_ACCOUNTS } from '../../services/authApi';

export const LoginPage = ({ onLoginSuccess = () => {}, onBackToHome = () => {} }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginUser(username, password);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess(result.user, result.targetDashboard);
    } else {
      setErrorMessage(result.error || 'Đăng nhập không thành công. Vui lòng kiểm tra lại.');
    }
  };

  // Quick 1-click login helper
  const handleQuickLogin = async (demoAccount) => {
    setUsername(demoAccount.username);
    setPassword(demoAccount.password || 'password123');
    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginUser(demoAccount.username, demoAccount.password || 'password123');
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess(result.user, result.targetDashboard);
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#F5F2EB] flex flex-col justify-between font-sans select-none overflow-y-auto custom-scrollbar p-6">
      {/* Top Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-[#DDD8CE] text-xs font-bold text-stone-700 hover:bg-white hover:text-black transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Trang Chủ</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#1A1917]">Aurora OS</span>
          <span className="text-[#A8A29E]">|</span>
          <span className="text-xs font-medium text-[#78716C]">Staff Authentication</span>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white rounded-3xl border border-[#E3DFD5] shadow-xl p-8 space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#18181B] text-white mx-auto flex items-center justify-center shadow-md">
              <KeyRound className="w-6 h-6 text-amber-300" />
            </div>
            <h2 className="text-xl font-extrabold text-[#1A1917] tracking-tight">
              Đăng Nhập Nghiệp Vụ
            </h2>
            <p className="text-xs text-[#78716C]">
              Xác thực mã JWT và phân luồng vào màn hình tác vụ tương ứng
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#78716C] uppercase tracking-wider mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. roomservice, housekeeping, manager"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#78716C] uppercase tracking-wider mb-1.5">
                Mật khẩu (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-medium text-stone-900 outline-none focus:border-stone-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 absolute right-2.5 top-2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span>Đang xác thực JWT...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Đăng Nhập Hệ Thống</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo 1-Click Login Section */}
          <div className="pt-4 border-t border-[#EAE6DE] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Chọn Nhanh Tài Khoản Mẫu (1-Click Demo)</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {DEMO_STAFF_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleQuickLogin(acc)}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] hover:border-stone-400 hover:bg-[#F2EFE9] transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{acc.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-[#1A1917] group-hover:text-black">
                        {acc.name}{' '}
                        <span className="text-[10px] text-stone-500 font-medium">({acc.role})</span>
                      </p>
                      <p className="text-[10px] text-stone-500 font-mono">
                        user: <span className="font-semibold text-stone-700">{acc.username}</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-stone-700 group-hover:translate-x-0.5 transition-transform">
                    {acc.badge} →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-stone-500">
        Aurora Grand Hotel • Secure JWT Token Authentication
      </div>
    </div>
  );
};
