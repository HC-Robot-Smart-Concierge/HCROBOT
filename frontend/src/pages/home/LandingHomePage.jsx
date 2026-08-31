import React, { useState } from 'react';
import { loginUser } from '../../services/authApi';

export const LandingHomePage = ({
  currentUser = null,
  onNavigateToLogin = () => {},
  onNavigateToRobotDisplay = () => {},
  onNavigateToLidarMap = () => {},
}) => {
  // State cho Modal Đăng Nhập Robot
  const [showRobotModal, setShowRobotModal] = useState(false);
  const [robotUsername, setRobotUsername] = useState('robot_01');
  const [robotPassword, setRobotPassword] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [robotError, setRobotError] = useState(null);

  const scrollToAbout = () => {
    const el = document.getElementById('about');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Xử lý Đăng Nhập Tài Khoản Robot
  const handleRobotLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setRobotError(null);

    const res = await loginUser(robotUsername, robotPassword);
    setIsLoading(false);

    if (res.success) {
      setShowRobotModal(false);
      onNavigateToRobotDisplay();
    } else {
      setRobotError(res.error || 'Mật khẩu Robot không chính xác. Thử lại (Mặc định: 123456)');
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#FAF8F5] text-[#1A1917] font-sans flex flex-col justify-between overflow-y-auto custom-scrollbar select-none relative">
      {/* 1. Header Minimalist */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-[#E8E4DB] sticky top-0 z-30 mobile-safe-header pt-10 md:pt-0">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          {/* Brand Title */}
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-[#1A1917]">
              HC-ROBOT
            </h1>
            <p className="text-[10px] font-medium tracking-widest text-stone-500 uppercase">
              Smart Hotel Concierge System
            </p>
          </div>

          {/* Header Action Links: Chữ thuần túy phân cách bằng | */}
          <div className="flex items-center gap-3 text-xs font-medium text-stone-600">
            <button
              onClick={scrollToAbout}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              About
            </button>

            <span className="text-stone-300 select-none">|</span>

            <button
              onClick={onNavigateToLogin}
              className="hover:text-stone-900 font-semibold transition-colors cursor-pointer"
            >
              {currentUser ? (currentUser.full_name || currentUser.name) : 'Đăng Nhập'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section Minimalist */}
      <main className="max-w-3xl w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center">
        {/* Title & Subtitle */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#1A1917] leading-tight">
          HC-Robot Autonomous Concierge
        </h2>

        <p className="text-xs sm:text-sm text-stone-600 max-w-xl mt-3.5 leading-relaxed font-medium">
          Nền tảng trợ lý Robot tự hành tích hợp AI Voice Conversational, RAG Knowledge Base, Socket.IO Real-time & 2D SLAM LiDAR Navigation.
        </p>

        {/* NÚT ĐĂNG NHẬP VÀO HỆ THỐNG (1 NÚT MÀU XÁM, KHÔNG DÙNG ICON) */}
        <div className="mt-8">
          <button
            onClick={onNavigateToLogin}
            className="px-8 py-3.5 rounded-2xl bg-[#E5E1D8] hover:bg-[#DCD7CB] text-stone-900 text-sm font-bold transition-all border border-[#CFCABF] cursor-pointer shadow-sm"
          >
            Đăng nhập vào hệ thống
          </button>
        </div>

        {/* ĐOẠN VĂN BẢN GIỚI THIỆU SẢN PHẨM HC-ROBOT (ABOUT SECTION) */}
        <div id="about" className="w-full mt-12 pt-8 border-t border-[#E8E4DB] text-center space-y-3 scroll-mt-20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Giới Thiệu Sản Phẩm HC-Robot
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-medium max-w-2xl mx-auto">
            HC-Robot là giải pháp Robot trợ lý thông minh toàn diện phục vụ trong môi trường khách sạn cao cấp. Hệ thống tự động tiếp nhận và điều phối các nghiệp vụ giao thức ăn tận phòng, buồng phòng, vận chuyển hành lý, bảo trì cơ sở hạ tầng và tương tác giọng nói tự nhiên với khách hàng thông qua trí tuệ nhân tạo local LLM.
          </p>
        </div>
      </main>

      {/* 3. Footer Minimalist */}
      <footer className="w-full bg-[#F5F2EB] border-t border-[#E8E4DB] py-6 text-center text-xs text-stone-500">
        <p className="font-bold text-stone-800">
          Aurora Grand Hotel • HC-Robot Autonomous Concierge Platform
        </p>
        <p className="text-[11px] text-stone-500 mt-1">
          Hệ thống Trợ lý Robot Khách sạn Thông minh • Bản quyền © 2026 HC-Robot
        </p>
      </footer>

      {/* MODAL ĐĂNG NHẬP TÀI KHOẢN ROBOT */}
      {showRobotModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E3DFD5] text-[#1A1917] rounded-3xl p-7 max-w-md w-full shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowRobotModal(false)}
              className="absolute top-4 right-4 px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <div className="border-b border-[#EAE6DE] pb-3">
              <h3 className="text-base font-extrabold text-[#1A1917]">Đăng Nhập Tài Khoản Robot</h3>
              <p className="text-[11px] text-stone-500">Khởi chạy phiên làm việc Kiosk trên thân Robot</p>
            </div>

            {robotError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {robotError}
              </div>
            )}

            <form onSubmit={handleRobotLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Chọn Robot Unit (Username)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRobotUsername('robot_01')}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                      robotUsername === 'robot_01'
                        ? 'bg-[#18181B] text-white border-black shadow-md'
                        : 'bg-[#FAF8F5] text-stone-700 border-[#DDD8CE] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    robot_01 (Unit 01)
                  </button>

                  <button
                    type="button"
                    onClick={() => setRobotUsername('robot_02')}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                      robotUsername === 'robot_02'
                        ? 'bg-[#18181B] text-white border-black shadow-md'
                        : 'bg-[#FAF8F5] text-stone-700 border-[#DDD8CE] hover:bg-[#F2EFE9]'
                    }`}
                  >
                    robot_02 (Unit 02)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Mật khẩu Robot (Password)
                </label>
                <input
                  type="password"
                  placeholder="Mật khẩu (Mặc định: 123456)"
                  value={robotPassword}
                  onChange={(e) => setRobotPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E0DCD3] text-xs font-bold text-stone-900 outline-none focus:border-stone-600 transition-colors"
                />
                <p className="text-[11px] text-stone-500 mt-1.5">
                  Mật khẩu khởi tạo tài khoản Robot: <code className="text-stone-800 font-bold bg-stone-100 px-1.5 py-0.5 rounded border border-stone-300">123456</code>
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRobotModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-[#FAF8F5] hover:bg-[#EAE6DE] text-stone-700 font-bold text-xs transition-colors cursor-pointer border border-[#DDD8CE]"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-2xl bg-[#E5E1D8] hover:bg-[#DCD7CB] text-stone-900 border border-[#CFCABF] font-bold text-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? 'Đang đăng nhập...' : 'Xác Nhận Đăng Nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
