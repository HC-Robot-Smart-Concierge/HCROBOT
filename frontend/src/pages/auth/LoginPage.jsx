import React, { useState } from 'react';
import { Eye, EyeOff, UserCheck } from 'lucide-react';
import { loginUser } from '../../services/authApi';

export const LoginPage = ({ onLoginSuccess = () => {}, onBackToHome = () => {} }) => {
  const [username, setUsername] = useState('reception');
  const [password, setPassword] = useState('123456');
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

  return (
    <div className="w-full h-full min-h-screen bg-[#FAF8F5] flex flex-col justify-between font-sans select-none overflow-y-auto custom-scrollbar px-4 md:px-6 mobile-safe-header pt-10 pb-6 text-[#1A1917]">
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <button
          onClick={onBackToHome}
          className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#E5E1D8] border border-[#DDD8CE] text-xs font-bold text-stone-800 transition-all cursor-pointer shadow-sm"
        >
          ← Trang Chủ
        </button>

        <div className="text-xs text-stone-500 font-bold tracking-tight">
          Aurora OS Staff
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full mx-auto my-auto py-4">
        <div className="bg-white rounded-3xl border border-[#E3DFD5] shadow-xl p-5 md:p-8 space-y-5">
          {/* Brand Header */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-[#1A1917] tracking-tight">
              Đăng Nhập Hệ Thống
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Cổng làm việc dành cho Nhân viên & Trợ lý HCRobot
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: reception, housekeeping, admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                Mật khẩu (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu (Mặc định: 123456)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-11 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 cursor-pointer transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-60 mt-2"
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng Nhập Hệ Thống'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-stone-500 font-medium py-2">
        Aurora Grand Hotel • Secure JWT Authentication
      </div>
    </div>
  );
};
