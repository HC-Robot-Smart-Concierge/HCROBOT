import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  CheckCircle2,
  Headphones,
  Clock,
  Download,
  Calendar,
  Filter,
  MapPin,
  Sparkles,
  Layers,
  Building2,
  Utensils,
  BedDouble,
  Wifi,
  Waves,
  Dumbbell,
  FileText,
  FileSpreadsheet,
  FileCheck,
  X,
  ChevronDown,
  Zap,
  Luggage,
  Wrench,
  ConciergeBell,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

export const AdminAnalyticsTab = ({ currentUser = {} }) => {
  // 5 Core Departments of Aurora Grand Hotel
  const [selectedDept, setSelectedDept] = useState('All'); // 'All' | 'Reception' | 'Housekeeping' | 'F&B' | 'Bellman' | 'Maintenance'
  const [timeRange, setTimeRange] = useState('30d'); // 'today' | '7d' | '30d' | '90d'
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 5 Core Departments Definition (Matching the user's exact 5 departments)
  const departments = [
    { id: 'All', label: 'Tất cả', count: 19, icon: Layers, color: 'bg-stone-900 text-white' },
    { id: 'Reception', label: 'Lễ tân', count: 1, icon: Building2, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'Housekeeping', label: 'Buồng phòng', count: 5, icon: BedDouble, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'F&B', label: 'Phục vụ phòng (F&B)', count: 3, icon: Utensils, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'Bellman', label: 'Hành lý (Bellman)', count: 3, icon: Luggage, color: 'bg-sky-50 text-sky-700 border-sky-200' },
    { id: 'Maintenance', label: 'Kỹ thuật', count: 3, icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ];

  // 5 Departments Performance Overview Data
  const deptPerformance = [
    {
      id: 'Reception',
      name: 'Lễ tân (Reception)',
      totalInteractions: '1,420',
      aiResolutionRate: '92%',
      humanHandoffs: '114',
      avgTime: '0.9s',
      topTopic: 'Mật khẩu Wi-Fi, Check-out & Giờ dịch vụ',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Building2,
    },
    {
      id: 'Housekeeping',
      name: 'Buồng phòng (Housekeeping)',
      totalInteractions: '1,280',
      aiResolutionRate: '84%',
      humanHandoffs: '205',
      avgTime: '1.2s',
      topTopic: 'Khăn tắm, Dọn phòng & Đồ dùng vệ sinh',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: BedDouble,
    },
    {
      id: 'F&B',
      name: 'Phục vụ phòng (F&B)',
      totalInteractions: '890',
      aiResolutionRate: '88%',
      humanHandoffs: '107',
      avgTime: '1.1s',
      topTopic: 'Giờ mở cửa nhà hàng, Đặt món tận phòng',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Utensils,
    },
    {
      id: 'Bellman',
      name: 'Hành lý (Bellman)',
      totalInteractions: '410',
      aiResolutionRate: '78%',
      humanHandoffs: '90',
      avgTime: '1.4s',
      topTopic: 'Hỗ trợ chuyển hành lý, Gửi đồ sảnh',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Luggage,
    },
    {
      id: 'Maintenance',
      name: 'Kỹ thuật (Maintenance)',
      totalInteractions: '250',
      aiResolutionRate: '72%',
      humanHandoffs: '121',
      avgTime: '1.5s',
      topTopic: 'Điều hòa, Vòi nước & Thiết bị phòng',
      badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
      icon: Wrench,
    },
  ];

  // Data mapped by time range & department
  const dataByRange = {
    today: {
      totalInteractions: selectedDept === 'All' ? '185' : selectedDept === 'Housekeeping' ? '58' : selectedDept === 'F&B' ? '46' : selectedDept === 'Reception' ? '48' : selectedDept === 'Bellman' ? '18' : '15',
      interactionTrend: '+8%',
      resolutionRate: selectedDept === 'All' ? '88%' : selectedDept === 'Reception' ? '94%' : selectedDept === 'Housekeeping' ? '85%' : '82%',
      resolutionTrend: '+3%',
      humanHandoffs: selectedDept === 'All' ? '22' : selectedDept === 'Maintenance' ? '7' : selectedDept === 'Housekeeping' ? '6' : '3',
      handoffTrend: '-4%',
      avgResponseTime: '1.1s',
      chartData: [
        { day: '06:00', label: '06:00 - 09:00', ai: 24, human: 2, total: 26 },
        { day: '09:00', label: '09:00 - 12:00', ai: 42, human: 6, total: 48 },
        { day: '12:00', label: '12:00 - 15:00', ai: 38, human: 4, total: 42 },
        { day: '15:00', label: '15:00 - 18:00', ai: 45, human: 5, total: 50 },
        { day: '18:00', label: '18:00 - 21:00', ai: 52, human: 7, total: 59 },
        { day: '21:00', label: '21:00 - 24:00', ai: 28, human: 3, total: 31 },
        { day: '00:00', label: '00:00 - 06:00', ai: 12, human: 1, total: 13 },
      ],
      topRequests: [
        { rank: 1, title: 'Khăn tắm bổ sung (Extra Towels)', dept: 'Buồng phòng', count: 48, icon: BedDouble },
        { rank: 2, title: 'Giờ mở cửa Buffet & Menu tối', dept: 'Phục vụ phòng (F&B)', count: 42, icon: Utensils },
        { rank: 3, title: 'Mật khẩu Wi-Fi & Đường truyền', dept: 'Lễ tân', count: 35, icon: Wifi },
        { rank: 4, title: 'Đặt Club Sandwich & Nước uống', dept: 'Phục vụ phòng (F&B)', count: 28, icon: Utensils },
        { rank: 5, title: 'Hỗ trợ chuyển vali trả phòng', dept: 'Hành lý (Bellman)', count: 18, icon: Luggage },
      ],
      busiestLocations: [
        { name: 'Quầy Lễ Tân (Main Lobby)', dept: 'Lễ tân / Sảnh chính', count: 78, percent: 92, icon: Building2 },
        { name: 'Khu Hồ Bơi Vô Cực (Level 4 Pool)', dept: 'Tiện ích / Buồng phòng', count: 45, percent: 65, icon: Waves },
        { name: 'Hành Lang Phòng Suite Tầng 12', dept: 'Buồng phòng & Kỹ thuật', count: 34, percent: 48, icon: BedDouble },
        { name: 'Nhà Hàng Grand Gourmet (Tầng 2)', dept: 'Phục vụ phòng (F&B)', count: 28, percent: 40, icon: Utensils },
      ],
    },
    '7d': {
      totalInteractions: selectedDept === 'All' ? '1,120' : selectedDept === 'Housekeeping' ? '360' : selectedDept === 'F&B' ? '280' : selectedDept === 'Reception' ? '320' : selectedDept === 'Bellman' ? '95' : '65',
      interactionTrend: '+6%',
      resolutionRate: selectedDept === 'All' ? '86%' : '88%',
      resolutionTrend: '+2%',
      humanHandoffs: selectedDept === 'All' ? '156' : selectedDept === 'Housekeeping' ? '52' : '26',
      handoffTrend: '+8%',
      avgResponseTime: '1.2s',
      chartData: [
        { day: 'Mon', label: 'Thứ Hai', ai: 145, human: 25, total: 170 },
        { day: 'Tue', label: 'Thứ Ba', ai: 130, human: 28, total: 158 },
        { day: 'Wed', label: 'Thứ Tư', ai: 195, human: 18, total: 213 },
        { day: 'Thu', label: 'Thứ Năm', ai: 190, human: 22, total: 212 },
        { day: 'Fri', label: 'Thứ Sáu', ai: 175, human: 38, total: 213 },
        { day: 'Sat', label: 'Thứ Bảy', ai: 140, human: 20, total: 160 },
        { day: 'Sun', label: 'Chủ Nhật', ai: 120, human: 16, total: 136 },
      ],
      topRequests: [
        { rank: 1, title: 'Khăn tắm & Thảm lau chân', dept: 'Buồng phòng', count: 320, icon: BedDouble },
        { rank: 2, title: 'Giờ mở cửa nhà hàng Grand Gourmet', dept: 'Phục vụ phòng (F&B)', count: 265, icon: Utensils },
        { rank: 3, title: 'Mật khẩu Wi-Fi & Hướng dẫn TV', dept: 'Lễ tân', count: 215, icon: Wifi },
        { rank: 4, title: 'Đặt món Room Service tận phòng', dept: 'Phục vụ phòng (F&B)', count: 180, icon: Utensils },
        { rank: 5, title: 'Kiểm tra máy lạnh phòng 412', dept: 'Kỹ thuật', count: 85, icon: Wrench },
      ],
      busiestLocations: [
        { name: 'Quầy Lễ Tân (Main Lobby)', dept: 'Lễ tân / Sảnh chính', count: 460, percent: 95, icon: Building2 },
        { name: 'Khu Hồ Bơi Vô Cực (Tầng 4)', dept: 'Tiện ích / Buồng phòng', count: 310, percent: 70, icon: Waves },
        { name: 'Hành Lang Phòng Tầng 12', dept: 'Buồng phòng & Kỹ thuật', count: 215, percent: 52, icon: BedDouble },
        { name: 'Nhà Hàng Grand Gourmet (Tầng 2)', dept: 'Phục vụ phòng (F&B)', count: 135, percent: 38, icon: Utensils },
      ],
    },
    '30d': {
      totalInteractions: selectedDept === 'All' ? '4,250' : selectedDept === 'Housekeeping' ? '1,280' : selectedDept === 'F&B' ? '890' : selectedDept === 'Reception' ? '1,420' : selectedDept === 'Bellman' ? '410' : '250',
      interactionTrend: '+5%',
      resolutionRate: selectedDept === 'All' ? '85%' : selectedDept === 'Reception' ? '92%' : selectedDept === 'Housekeeping' ? '84%' : '78%',
      resolutionTrend: '+2%',
      humanHandoffs: selectedDept === 'All' ? '637' : selectedDept === 'Housekeeping' ? '205' : selectedDept === 'Maintenance' ? '121' : '114',
      handoffTrend: '+12%',
      avgResponseTime: '1.2s',
      chartData: [
        { day: 'Mon', label: 'Thứ Hai', ai: 480, human: 110, total: 590 },
        { day: 'Tue', label: 'Thứ Ba', ai: 420, human: 130, total: 550 },
        { day: 'Wed', label: 'Thứ Tư', ai: 620, human: 75, total: 695 },
        { day: 'Thu', label: 'Thứ Năm', ai: 610, human: 85, total: 695 },
        { day: 'Fri', label: 'Thứ Sáu', ai: 530, human: 140, total: 670 },
        { day: 'Sat', label: 'Thứ Bảy', ai: 430, human: 90, total: 520 },
        { day: 'Sun', label: 'Chủ Nhật', ai: 390, human: 70, total: 460 },
      ],
      topRequests: [
        { rank: 1, title: 'Khăn tắm & Tiện nghi phòng (Extra Towels)', dept: 'Buồng phòng', count: '1,204', icon: BedDouble },
        { rank: 2, title: 'Giờ mở cửa nhà hàng & Buffet (Dining Hours)', dept: 'Phục vụ phòng (F&B)', count: '982', icon: Utensils },
        { rank: 3, title: 'Mật khẩu Wi-Fi & Chỉ dẫn phòng (Wi-Fi Password)', dept: 'Lễ tân', count: '845', icon: Wifi },
        { rank: 4, title: 'Đặt đồ ăn & thức uống (Room Service)', dept: 'Phục vụ phòng (F&B)', count: '630', icon: Utensils },
        { rank: 5, title: 'Chuyển hành lý & Hỗ trợ Check-out sớm', dept: 'Hành lý (Bellman)', count: '410', icon: Luggage },
        { rank: 6, title: 'Sửa chữa điều hòa & Vòi nước rò rỉ', dept: 'Kỹ thuật', count: '250', icon: Wrench },
      ],
      busiestLocations: [
        { name: 'Quầy Lễ Tân (Main Lobby)', dept: 'Lễ tân / Sảnh chính', count: '1,640', percent: 95, icon: Building2 },
        { name: 'Hồ Bơi Vô Cực & Spa (Tầng 4)', dept: 'Tiện ích / Buồng phòng', count: '1,180', percent: 70, icon: Waves },
        { name: 'Hành Lang Phòng Suite Tầng 12', dept: 'Buồng phòng & Kỹ thuật', count: '820', percent: 55, icon: BedDouble },
        { name: 'Nhà Hàng Grand Gourmet (Tầng 2)', dept: 'Phục vụ phòng (F&B)', count: '610', percent: 45, icon: Utensils },
      ],
    },
    '90d': {
      totalInteractions: selectedDept === 'All' ? '12,840' : '4,100',
      interactionTrend: '+14%',
      resolutionRate: '87%',
      resolutionTrend: '+4%',
      humanHandoffs: '1,668',
      handoffTrend: '-3%',
      avgResponseTime: '1.2s',
      chartData: [
        { day: 'W1', label: 'Tuần 1 - 3', ai: 2600, human: 420, total: 3020 },
        { day: 'W2', label: 'Tuần 4 - 6', ai: 2850, human: 390, total: 3240 },
        { day: 'W3', label: 'Tuần 7 - 9', ai: 3100, human: 410, total: 3510 },
        { day: 'W4', label: 'Tuần 10 - 12', ai: 2980, human: 360, total: 3340 },
      ],
      topRequests: [
        { rank: 1, title: 'Khăn tắm & Tiện nghi phòng', dept: 'Buồng phòng', count: '3,840', icon: BedDouble },
        { rank: 2, title: 'Giờ mở cửa nhà hàng & Buffet', dept: 'Phục vụ phòng (F&B)', count: '3,120', icon: Utensils },
        { rank: 3, title: 'Mật khẩu Wi-Fi & Chỉ dẫn tiện ích', dept: 'Lễ tân', count: '2,650', icon: Wifi },
        { rank: 4, title: 'Đặt món ăn Room Service', dept: 'Phục vụ phòng (F&B)', count: '1,980', icon: Utensils },
        { rank: 5, title: 'Vận chuyển hành lý trả phòng', dept: 'Hành lý (Bellman)', count: '1,250', icon: Luggage },
      ],
      busiestLocations: [
        { name: 'Quầy Lễ Tân (Main Lobby)', dept: 'Lễ tân / Sảnh chính', count: '5,210', percent: 96, icon: Building2 },
        { name: 'Khu Hồ Bơi & Spa (Tầng 4)', dept: 'Tiện ích / Buồng phòng', count: '3,650', percent: 72, icon: Waves },
        { name: 'Hành Lang Phòng Suite Tầng 12', dept: 'Buồng phòng & Kỹ thuật', count: '2,480', percent: 56, icon: BedDouble },
        { name: 'Nhà Hàng Grand Gourmet (Tầng 2)', dept: 'Phục vụ phòng (F&B)', count: '1,920', percent: 46, icon: Utensils },
      ],
    },
  };

  const currentData = dataByRange[timeRange] || dataByRange['30d'];

  // Filter top requests if specific department is selected
  const filteredRequests = selectedDept === 'All'
    ? currentData.topRequests
    : currentData.topRequests.filter((r) => {
        if (selectedDept === 'Reception') return r.dept.includes('Lễ tân');
        if (selectedDept === 'Housekeeping') return r.dept.includes('Buồng phòng');
        if (selectedDept === 'F&B') return r.dept.includes('Phục vụ phòng');
        if (selectedDept === 'Bellman') return r.dept.includes('Hành lý');
        if (selectedDept === 'Maintenance') return r.dept.includes('Kỹ thuật');
        return true;
      });

  // Calculate max total for proportional bar heights
  const maxBarTotal = Math.max(...currentData.chartData.map((d) => d.total));

  const handleExport = (e) => {
    e.preventDefault();
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setIsExportModalOpen(false);
      showToast(`Đã xuất báo cáo phân tích định dạng ${exportFormat.toUpperCase()} thành công!`);
    }, 1200);
  };

  return (
    <div className="w-full min-h-full flex flex-col p-6 space-y-6 pb-16 font-sans select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>Analytics Overview</span>
          </h2>
          <p className="text-sm text-stone-500 font-medium mt-0.5">
            Track robot fleet performance, guest interactions, and resolution rates across 5 hotel departments.
          </p>
        </div>

        {/* Time Range Filter & Export Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Time Range Filter */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                showToast(`Đã chuyển mốc thời gian: ${e.target.options[e.target.selectedIndex].text}`);
              }}
              className="appearance-none bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-bold rounded-xl px-3.5 py-2 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="today">Today (24 Hours)</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Export Report Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-black tracking-wider uppercase rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-stone-700" />
            <span>EXPORT REPORT</span>
          </button>
        </div>
      </div>

      {/* 2. 5 CORE HOTEL DEPARTMENTS PILLS BAR (Matching the user's 5 exact departments) */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider px-2 shrink-0">
          5 BỘ PHẬN:
        </span>
        {departments.map((dept) => {
          const Icon = dept.icon;
          const isSelected = selectedDept === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => {
                setSelectedDept(dept.id);
                showToast(`Đã lọc phân tích: ${dept.label}`);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-md scale-[1.02]'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-stone-500'}`} />
              <span>{dept.label}</span>
              <span
                className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                  isSelected ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {dept.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Interactions */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Total Interactions</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-black text-stone-900 tracking-tight">
              {currentData.totalInteractions}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>{currentData.interactionTrend}</span>
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-medium leading-tight">
            Voice dialogue, kiosk touch & service requests ({selectedDept === 'All' ? '5 bộ phận' : departments.find((d) => d.id === selectedDept)?.label})
          </p>
        </div>

        {/* Card 2: AI Resolution Rate */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">AI Resolution Rate</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-black text-stone-900 tracking-tight">
              {currentData.resolutionRate}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>{currentData.resolutionTrend}</span>
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-medium leading-tight">
            Completed autonomously without staff escalation
          </p>
        </div>

        {/* Card 3: Human Handoffs */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Human Handoffs</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-black text-stone-900 tracking-tight">
              {currentData.humanHandoffs}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              <span>{currentData.handoffTrend}</span>
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-medium leading-tight">
            Transferred to Front Desk & technical staff
          </p>
        </div>

        {/* Card 4: Avg. Response Time */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Avg. Response Time</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl font-black text-stone-900 tracking-tight">
              {currentData.avgResponseTime}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-400" />
              <span>99.4% SLA</span>
            </span>
          </div>
          <p className="text-[11px] text-stone-400 font-medium leading-tight">
            Local LLM inference & RAG vector search latency
          </p>
        </div>
      </div>

      {/* 4. Middle Section: Interactions vs. Human Handoffs Stacked Chart */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        {/* Chart Header & Legends */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
              Interactions vs. Human Handoffs ({selectedDept === 'All' ? 'Toàn Bộ 5 Bộ Phận' : departments.find((d) => d.id === selectedDept)?.label})
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Daily distribution of AI automated conversations vs. human staff escalations
            </p>
          </div>

          {/* Legends */}
          <div className="flex items-center gap-5 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/30" />
              <span className="text-stone-700">AI Handled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-600 shadow-sm" />
              <span className="text-stone-700">Human Handoff</span>
            </div>
          </div>
        </div>

        {/* Stacked Bar Chart Graphic */}
        <div className="relative pt-6 pb-2">
          {/* Background Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
            <div className="border-b border-dashed border-stone-200 h-0 w-full" />
            <div className="border-b border-dashed border-stone-200 h-0 w-full" />
            <div className="border-b border-dashed border-stone-200 h-0 w-full" />
            <div className="border-b border-dashed border-stone-200 h-0 w-full" />
            <div className="border-b border-stone-200 h-0 w-full" />
          </div>

          {/* Bar Columns Container */}
          <div className="relative flex items-end justify-between h-72 px-4 sm:px-8 z-10">
            {currentData.chartData.map((item, idx) => {
              const totalHeightPct = Math.round((item.total / maxBarTotal) * 100);
              const humanPctOfBar = Math.round((item.human / item.total) * 100);
              const aiPctOfBar = 100 - humanPctOfBar;
              const isHovered = hoveredBarIndex === idx;

              return (
                <div
                  key={item.day}
                  onMouseEnter={() => setHoveredBarIndex(idx)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative max-w-[80px]"
                >
                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div className="absolute -top-24 z-30 bg-stone-900 text-white rounded-2xl p-3 shadow-2xl border border-stone-700 text-left min-w-[170px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                      <div className="font-extrabold text-xs text-amber-300 border-b border-stone-700 pb-1.5 mb-1.5 flex items-center justify-between">
                        <span>{item.label || item.day}</span>
                        <span className="text-[10px] text-stone-400 font-mono">{item.total} reqs</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-stone-300">
                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            <span>AI Handled:</span>
                          </span>
                          <span className="font-bold text-white">
                            {item.ai} ({Math.round((item.ai / item.total) * 100)}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-stone-300">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>Handoffs:</span>
                          </span>
                          <span className="font-bold text-white">
                            {item.human} ({Math.round((item.human / item.total) * 100)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* The Stacked Bar Column */}
                  <div
                    style={{ height: `${totalHeightPct}%` }}
                    className={`w-12 sm:w-16 rounded-xl overflow-hidden flex flex-col justify-end transition-all duration-300 shadow-sm ${
                      isHovered ? 'scale-105 ring-4 ring-indigo-500/20 shadow-lg' : 'hover:scale-[1.02]'
                    }`}
                  >
                    {/* Top Portion: AI Handled (Violet / Indigo Gradient) */}
                    <div
                      style={{ height: `${aiPctOfBar}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-500 transition-all duration-300"
                    />

                    {/* Bottom Portion: Human Handoff (Dark Slate / Stone) */}
                    <div
                      style={{ height: `${humanPctOfBar}%` }}
                      className="w-full bg-[#475569] transition-all duration-300 border-t border-indigo-400/30"
                    />
                  </div>

                  {/* X-Axis Day Label */}
                  <span
                    className={`text-xs font-bold mt-3 transition-colors ${
                      isHovered ? 'text-indigo-600 font-extrabold' : 'text-stone-500'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. 5 DEPARTMENTS PERFORMANCE OVERVIEW CARDS */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
                Hiệu Suất Vận Hành 5 Bộ Phận Khách Sạn
              </h3>
              <p className="text-[11px] text-stone-400">
                Chi tiết khối lượng tương tác và tỷ lệ hỗ trợ tự động của Robot Concierge theo từng phòng ban
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-600">5 Phòng ban chính</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {deptPerformance.map((dept) => {
            const Icon = dept.icon;
            const isSelected = selectedDept === dept.id;
            return (
              <div
                key={dept.id}
                onClick={() => {
                  setSelectedDept(dept.id);
                  showToast(`Đã chọn xem chi tiết bộ phận: ${dept.name}`);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-stone-200 bg-stone-50/70 hover:bg-stone-100 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`p-2 rounded-xl border ${dept.badgeColor}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {dept.aiResolutionRate} AI
                    </span>
                  </div>
                  <h4 className="font-extrabold text-xs text-stone-900 mt-2.5 leading-tight">
                    {dept.name}
                  </h4>
                  <p className="text-[10px] text-stone-500 mt-1 leading-snug">
                    {dept.topTopic}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                  <span className="text-stone-400 text-[11px]">Tổng lượt:</span>
                  <span className="font-mono font-black text-stone-900">{dept.totalInteractions}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Bottom Row: 2 Split Cards (Top Guest Requests & Busiest Locations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Top Guest Requests (Matching Bottom Left Card) */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
                Top Guest Requests
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-400">
              {selectedDept === 'All' ? 'Tất cả 5 bộ phận' : departments.find((d) => d.id === selectedDept)?.label}
            </span>
          </div>

          {/* List of Requests */}
          <div className="space-y-2.5">
            {filteredRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400 font-medium">
                Không có yêu cầu nào trong khoảng thời gian này cho bộ phận được chọn.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const Icon = req.icon || Sparkles;
                return (
                  <div
                    key={req.rank}
                    className="p-3.5 rounded-2xl bg-stone-50 hover:bg-indigo-50/50 border border-stone-100 hover:border-indigo-100 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Rank Badge */}
                      <div className="w-7 h-7 rounded-xl bg-white border border-stone-200 text-indigo-600 font-black text-xs flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {req.rank}
                      </div>

                      <div>
                        <div className="font-bold text-xs text-stone-900 flex items-center gap-2">
                          <span>{req.title}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                          {req.dept}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-extrabold text-xs text-stone-800">
                        {req.count} req
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Card: Busiest Locations (Matching Bottom Right Card) */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-stone-900 tracking-tight">
                Busiest Locations
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-400">Activity index</span>
          </div>

          {/* List of Locations with Animated Progress Bars */}
          <div className="space-y-3.5">
            {currentData.busiestLocations.map((loc, idx) => {
              const Icon = loc.icon || Building2;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-stone-50 hover:bg-stone-100/80 border border-stone-100 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-white border border-stone-200 text-stone-700 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-stone-700" />
                      </div>
                      <div>
                        <span className="text-stone-900">{loc.name}</span>
                        <span className="text-[10px] text-stone-400 font-normal ml-2">
                          ({loc.dept})
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-stone-700 font-bold">
                      {loc.count} reqs
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-stone-200/80 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${loc.percent}%` }}
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500 shadow-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. MODAL: EXPORT ANALYTICS REPORT */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 tracking-tight">
                    Xuất Báo Cáo Phân Tích
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    Báo cáo hiệu suất vận hành 5 bộ phận HC-Robot Concierge
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsExportModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExport} className="space-y-4 text-xs">
              {/* Report Format Selection */}
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-2">
                  ĐỊNH DẠNG TỆP BÁO CÁO:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('pdf')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      exportFormat === 'pdf'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-[11px]">PDF Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('excel')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      exportFormat === 'excel'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-700 shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-[11px]">Excel Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      exportFormat === 'csv'
                        ? 'border-stone-800 bg-stone-100 text-stone-900 shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <FileCheck className="w-5 h-5 text-stone-700" />
                    <span className="font-bold text-[11px]">Raw CSV</span>
                  </button>
                </div>
              </div>

              {/* Time Range & Department Information */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5 text-stone-600">
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Khung thời gian:</span>
                  <span className="font-bold text-stone-900 capitalize">
                    {timeRange === 'today'
                      ? 'Hôm nay (24 Giờ)'
                      : timeRange === '7d'
                      ? '7 Ngày Gần Nhất'
                      : timeRange === '30d'
                      ? '30 Ngày Gần Nhất'
                      : '90 Ngày Gần Nhất'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Phạm vi bộ phận:</span>
                  <span className="font-bold text-stone-900">
                    {selectedDept === 'All'
                      ? 'Toàn bộ 5 bộ phận khách sạn'
                      : departments.find((d) => d.id === selectedDept)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Tổng tương tác:</span>
                  <span className="font-mono font-bold text-indigo-600">
                    {currentData.totalInteractions} lượt
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isExporting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Đang tạo tệp...' : 'Tải Báo Cáo Ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
