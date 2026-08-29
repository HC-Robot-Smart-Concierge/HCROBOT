import React, { useState } from 'react';
import { loginUser } from '../../services/authApi';

export const LoginPage = ({ onLoginSuccess = () => {}, onBackToHome = () => {} }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="w-full h-full min-h-screen bg-[#FAF8F5] flex flex-col justify-between font-sans select-none overflow-y-auto custom-scrollbar p-6 text-[#1A1917]">
      {/* Top Header */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="px-4 py-2 rounded-full bg-[#E5E1D8] hover:bg-[#DCD7CB] border border-[#CFCABF] text-xs font-bold text-stone-900 transition-all cursor-pointer shadow-sm"
        >
          Quay lại Trang Chủ
        </button>

        <div className="flex items-center gap-2 text-xs text-stone-500 font-semibold">
          <span>Aurora Grand Hotel</span>
          <span>|</span>
          <span>System Authentication</span>
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white rounded-3xl border border-[#E3DFD5] shadow-xl p-8 space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-black text-[#1A1917] tracking-tight">
              Đăng Nhập Hệ Thống
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Xác thực mã JWT và phân luồng vào màn hình tương ứng
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Form mà không có icon, nút màu xám */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: roomservice, housekeeping, manager, robot_01"
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
              <input
                type="password"
                placeholder="Nhập mật khẩu (Mặc định: 123456)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-[#E5E1D8] hover:bg-[#DCD7CB] text-stone-900 border border-[#CFCABF] text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
            </button>
          </form>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-stone-500">
        Aurora Grand Hotel • Secure JWT Token Authentication
      </div>
    </div>
  );
};
