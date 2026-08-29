import React from 'react';
import {
  Sparkles,
  Bot,
  Map,
  ShieldCheck,
  UtensilsCrossed,
  Luggage,
  Wrench,
  ChevronRight,
  ArrowUpRight,
  Cpu,
  Layers,
  CheckCircle2,
  Lock,
  Compass,
  Radio,
  Sliders,
} from 'lucide-react';

export const LandingHomePage = ({
  currentUser = null,
  onNavigateToLogin = () => {},
  onNavigateToRobotDisplay = () => {},
  onNavigateToLidarMap = () => {},
}) => {
  const departments = [
    {
      id: 'room_service',
      num: '01',
      title: 'Room Service / F&B',
      desc: 'Quản lý hàng đợi nhà bếp, tiếp nhận đơn gọi món VIP, theo dõi tiến độ nấu nướng và điều phối Robot HCRobot giao thức ăn tận phòng.',
      icon: UtensilsCrossed,
      color: 'from-amber-500/10 to-orange-500/10',
      borderColor: 'hover:border-amber-400',
      badge: 'Bếp & Phục vụ Phòng',
    },
    {
      id: 'housekeeping',
      num: '02',
      title: 'Housekeeping Staff',
      desc: 'Tự động tiếp nhận sự cố tràn nước/vết bẩn từ camera AI của Robot, theo dõi tiến độ làm sạch buồng phòng trên mô hình sàn 3D.',
      icon: Sparkles,
      color: 'from-emerald-500/10 to-teal-500/10',
      borderColor: 'hover:border-emerald-400',
      badge: 'Dịch vụ Buồng phòng',
    },
    {
      id: 'bell_services',
      num: '03',
      title: 'Bell Services',
      desc: 'Quản lý hành lý khách VIP khẩn cấp, hỗ trợ chuyển phòng lưu trú, truy vết đồ thất lạc và liên kết xe đẩy tự hành Bot Unit Alpha.',
      icon: Luggage,
      color: 'from-blue-500/10 to-indigo-500/10',
      borderColor: 'hover:border-blue-400',
      badge: 'Đội ngũ Bellman',
    },
    {
      id: 'maintenance',
      num: '04',
      title: 'Maintenance & Facility',
      desc: 'Theo dõi sự cố kỹ thuật điều hòa HVAC, rò rỉ nước, đèn chiếu sáng, phân công kỹ thuật viên theo ca trực và bản đồ sự cố mặt bằng.',
      icon: Wrench,
      color: 'from-rose-500/10 to-red-500/10',
      borderColor: 'hover:border-rose-400',
      badge: 'Bảo trì Cơ sở',
    },
    {
      id: 'manager_hub',
      num: '05',
      title: 'Management Hub',
      desc: 'Trung tâm chỉ huy tổng thể của General Manager, phát lệnh chỉ đạo khẩn cấp, giám sát KPI thời gian phản hồi và bản đồ nhiệt Zone Heatmap.',
      icon: ShieldCheck,
      color: 'from-stone-500/10 to-zinc-500/10',
      borderColor: 'hover:border-stone-600',
      badge: 'Ban Điều hành GM',
    },
  ];

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#FAF8F5] text-[#1A1917] font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E4DB]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Hotel Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#18181B] text-white flex items-center justify-center font-bold text-sm shadow-md">
              <Bot className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-[#1A1917] leading-none">
                AURORA GRAND HOTEL
              </h1>
              <p className="text-[10px] font-bold tracking-widest text-[#78716C] uppercase mt-0.5">
                HC-ROBOT SMART CONCIERGE OS
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToRobotDisplay}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-700 bg-[#EFECE6] border border-[#DDD8CE] hover:bg-[#E5E0D5] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden sm:inline">Màn hình</span> Robot AI
            </button>

            <button
              onClick={onNavigateToLidarMap}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-stone-700 bg-[#EFECE6] border border-[#DDD8CE] hover:bg-[#E5E0D5] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Map className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">LiDAR</span> SLAM Map
            </button>

            <button
              onClick={onNavigateToLogin}
              className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#18181B] hover:bg-black transition-all shadow-md flex items-center gap-2 cursor-pointer ml-1"
            >
              {currentUser ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Vào Dashboard ({currentUser.full_name || currentUser.name})</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Đăng nhập Nhân viên</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-12 pb-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EFECE6] border border-[#DDD8CE] text-xs font-bold text-stone-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Aurora OS 2.0 • Code-First Hospitality System</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1A1917] leading-[1.15]">
              Hệ Thống Quản Trị Khách Sạn & Trợ Lý Robot Tự Hành
            </h2>

            <p className="text-sm sm:text-base text-[#78716C] max-w-xl leading-relaxed">
              Nền tảng tích hợp toàn diện kết nối trực tiếp Robot trợ lý thông minh (HCRobot) với 5 phân hệ vận hành: F&B Room Service, Buồng phòng, Bellman, Bảo trì kỹ thuật và Ban Quản trị.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={onNavigateToLogin}
                className="px-7 py-3.5 rounded-full text-sm font-bold text-white bg-[#18181B] hover:bg-black transition-all shadow-lg hover:shadow-xl flex items-center gap-2.5 cursor-pointer"
              >
                <span>Vào Cổng Đăng Nhập Staff</span>
                <ChevronRight className="w-4 h-4 text-amber-300" />
              </button>

              <button
                onClick={onNavigateToRobotDisplay}
                className="px-6 py-3.5 rounded-full text-sm font-bold text-stone-800 bg-white border border-[#DDD8CE] hover:bg-[#F5F2EB] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4 text-sky-600" />
                <span>Trải Nghiệm Robot AI</span>
              </button>
            </div>

            {/* Live stats summary */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#EAE6DE] max-w-lg">
              <div>
                <p className="text-2xl font-black text-[#1A1917]">5 / 5</p>
                <p className="text-xs text-[#78716C] font-medium mt-0.5">Khối nghiệp vụ</p>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600">100%</p>
                <p className="text-xs text-[#78716C] font-medium mt-0.5">Tự động điều phối</p>
              </div>
              <div>
                <p className="text-2xl font-black text-sky-600">4 Units</p>
                <p className="text-xs text-[#78716C] font-medium mt-0.5">Đội Robot HCRobot</p>
              </div>
            </div>
          </div>

          {/* Hero Right Visual Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 p-6 text-white shadow-2xl border border-stone-700 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono font-bold tracking-wider text-stone-200">
                      LIVE FLEET TELEMETRY
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-stone-800 text-[10px] font-mono text-stone-300 border border-stone-700">
                    SLAM ACTIVE
                  </span>
                </div>

                {/* Simulated telemetry cards */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                        U1
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">HCRobot Unit 01</p>
                        <p className="text-[10px] text-emerald-400">Available • Dock 1</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-stone-300">96% PIN</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                        U2
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">HCRobot Unit 02</p>
                        <p className="text-[10px] text-sky-400">Delivering • Room 412</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-stone-300">74% PIN</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onNavigateToLogin}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Truy Cập Trung Tâm Điều Hành Staff</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Operational Dashboards Showcase Section */}
      <section className="px-6 py-14 max-w-7xl mx-auto border-t border-[#EAE6DE]">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">
            5 PHÂN HỆ VẬN HÀNH CHUYÊN BIỆT
          </p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1A1917] mt-1.5">
            Giao Diện Tương Ứng Với Từng Vị Trí Nhân Sự
          </h3>
          <p className="text-xs text-[#78716C] mt-2">
            Hệ thống tự động nhận diện vai trò khi đăng nhập bằng mã JWT và phân luồng nhân viên vào đúng màn hình tác vụ tương ứng.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <div
                key={dept.id}
                onClick={onNavigateToLogin}
                className={`p-6 rounded-3xl bg-white border border-[#E5E1D8] shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between group ${dept.borderColor}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DE] flex items-center justify-center text-stone-800 group-hover:bg-[#18181B] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-stone-400">{dept.num}</span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-[#EFECE6] text-[#44403C] text-[10px] font-bold uppercase tracking-wider">
                    {dept.badge}
                  </span>

                  <h4 className="text-base font-bold text-[#1A1917] mt-2 group-hover:text-black">
                    {dept.title}
                  </h4>

                  <p className="text-xs text-[#78716C] mt-2 leading-relaxed">{dept.desc}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#F5F2EB] flex items-center justify-between text-xs font-bold text-stone-700 group-hover:text-black">
                  <span>Đăng nhập để vào Dashboard</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF8F5] border-t border-[#E8E4DB] py-8 text-center text-xs text-[#78716C]">
        <p className="font-semibold text-stone-800">
          Aurora Grand Hotel • HCRobot Autonomous Concierge & Operations Platform
        </p>
        <p className="text-[11px] text-stone-500 mt-1">
          SEP490 Capstone Project • Powered by FastAPI, PostgreSQL, Ollama Local LLM & React
        </p>
      </footer>
    </div>
  );
};
