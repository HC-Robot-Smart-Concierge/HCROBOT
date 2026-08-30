import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  EN: {
    // General / Common
    hotelName: 'Aurora Grand Hotel',
    systemName: 'HCROBOT',
    portalSubtitle: 'Operations Portal',
    frontDeskSubtitle: 'Front Desk Operations',
    all: 'All',
    pending: 'Pending',
    inProgress: 'In Progress',
    completed: 'Completed',
    ready: 'Ready',
    delivering: 'Delivering',
    unassigned: 'Unassigned',
    activeRequests: 'Active Requests',
    incomingRequests: 'Incoming Requests',
    activeOrders: 'Active Orders',
    acceptTask: 'Accept Task',
    startPrep: 'Start Preparation',
    claimTask: 'Accept Task',
    completeTask: 'Complete Task',
    completeOrder: 'Complete Order',
    markCompleted: 'Mark Completed',
    taskCompleted: 'Completed',
    orderCompleted: 'Order Completed',
    reject: 'Reject',
    decline: 'Decline',
    details: 'Details',
    searchPlaceholder: 'Search by room, ticket code, guest...',
    noDataMatch: 'No requests match this filter.',

    // Sidebar
    menuDashboard: 'Dashboard',
    menuRequests: 'Requests',
    menuMyTasks: 'My Tasks',
    menuHistory: 'History',
    menuNotifications: 'Notifications',
    menuProfile: 'Profile',
    menuLogout: 'Log Out',
    staffRoleLabel: 'Hotel Operations Staff',

    // Header
    langSwitched: 'Language switched to English',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications',

    // Room Service
    rsTitle: 'Room Service / F&B',
    rsSubtitle: 'Monitor incoming orders, manage preparation queues, and coordinate with robotic delivery units for timely guest service.',
    kpiPendingOrders: 'Pending Orders',
    kpiInPreparation: 'In Preparation',
    kpiCompletedToday: 'Completed Today',
    rsRobotChannel: 'HCRobot Reception Channel',
    rsRobotOnline: '● Online • Ready to receive orders',
    rsRobotDesc: 'All guest room orders placed via Robot Concierge are routed directly to the kitchen in real time.',
    rsViewMap: 'View Robot Position On Live Map',
    rsLowStockAlerts: 'Low Stock Alerts',

    // Housekeeping
    hkTitle: 'Housekeeping Operations',
    hkSubtitle: 'Coordinate room turnover, monitor priority cleans, and dispatch autonomous units across all active floors.',
    kpiPendingRequests: 'Pending Requests',
    kpiStaffOnDuty: 'Staff on Duty',
    hkFloorStatus: 'Floor Status',
    hkActiveFloor: 'FLOOR 5 - ACTIVE',
    hkTeamAvailability: 'Team Availability',

    // Bell Services
    bsTitle: 'Bell Services',
    bsActiveOps: 'ACTIVE OPERATIONS',
    kpiPending: 'PENDING',
    kpiOnJob: 'ON JOB',
    kpiCompleted: 'COMPLETED',
    kpiActiveFleet: 'ACTIVE FLEET / STAFF',
    bsTeamStatus: 'Team Status',

    // Maintenance
    mnTitle: 'Maintenance Dashboard',
    mnSubtitle: 'Manage and track all facility repair and upkeep requests received from HCRobot.',
    kpiTechsOnDuty: 'TECHNICIANS\nON DUTY',
    mnStaffAvailability: 'Staff Availability',
    mnManageSchedule: 'Manage Schedule',

    // Reception
    recTitle: 'Reception & Front Desk',
    recSubtitle: 'Manage guest check-ins, guest inquiries, and service dispatches.',
    recGuestCall: 'Guest Video Call',
    recTranscript: 'Transcript',
    recActivityLog: 'Activity Log',

    // My Tasks
    myTasksTitle: 'My Tasks',
    myTasksSubtitle: 'Operational Task Management & 5-Star Standard Checklist',
    kpiMyInProgress: 'IN PROGRESS',
    kpiMyCompleted: 'COMPLETED',
    kpiShiftEfficiency: 'SHIFT EFFICIENCY',
    tabAll: 'All',
    tabInProgress: 'In Progress',
    tabCompleted: 'Completed',
    checklistTitle: '5-Star Standard Standard Operating Procedure Checklist',
    checklistCompletedNotice: 'All steps completed. Ready to mark as done!',
    checklistCompletedBadge: 'Task Successfully Completed',
    taskDueLabel: 'Due Time',
    taskClaimedBadge: 'Claimed via HCRobot',

    // Requests Page
    requestsTitle: 'Service Requests',
    requestsSubtitle: 'Real-time queue of guest and robot requests across departments.',
    tabWaiting: 'Waiting for Claim',
    tabDoing: 'In Progress',
    tabDone: 'Completed',

    // History Page
    historyTitle: 'Audit Logs & Request History',
    historySubtitle: 'Detailed historical logs of all completed requests, timestamps, and staff actions.',
  },

  VI: {
    // General / Common
    hotelName: 'Khách Sạn Aurora Grand',
    systemName: 'HCROBOT',
    portalSubtitle: 'Cổng Điều Hành Nghiệp Vụ',
    frontDeskSubtitle: 'Nghiệp Vụ Lễ Tân',
    all: 'Tất Cả',
    pending: 'Chờ Tiếp Nhận',
    inProgress: 'Đang Thực Hiện',
    completed: 'Đã Hoàn Tất',
    ready: 'Sẵn Sàng',
    delivering: 'Đang Giao',
    unassigned: 'Chưa Tiếp Nhận',
    activeRequests: 'Yêu Cầu Hiện Có',
    incomingRequests: 'Yêu Cầu Tiếp Nhận',
    activeOrders: 'Đơn Hàng Đang Xử Lý',
    acceptTask: 'Tiếp Nhận Nhiệm Vụ',
    startPrep: 'Tiếp Nhận & Chế Biến',
    claimTask: 'Tiếp Nhận Xử Lý',
    completeTask: 'Hoàn Thành',
    completeOrder: 'Hoàn Thành Đơn Hàng',
    markCompleted: 'Hoàn Thành',
    taskCompleted: 'Đã Hoàn Tất',
    orderCompleted: 'Đơn Đã Hoàn Tất',
    reject: 'Từ Chối',
    decline: 'Từ Chối',
    details: 'Chi Tiết',
    searchPlaceholder: 'Tìm kiếm theo phòng, mã phiếu, tên khách...',
    noDataMatch: 'Không có yêu cầu nào khớp với bộ lọc này.',

    // Sidebar
    menuDashboard: 'Bảng Điều Khiển',
    menuRequests: 'Yêu Cầu',
    menuMyTasks: 'Nhiệm Vụ Của Tôi',
    menuHistory: 'Lịch Sử',
    menuNotifications: 'Thông Báo',
    menuProfile: 'Hồ Sơ Cá Nhân',
    menuLogout: 'Đăng Xuất',
    staffRoleLabel: 'Nhân Viên Vận Hành Khách Sạn',

    // Header
    langSwitched: 'Đã chuyển ngôn ngữ sang Tiếng Việt',
    markAllRead: 'Đánh dấu tất cả đã đọc',
    noNotifications: 'Không có thông báo mới',

    // Room Service
    rsTitle: 'Phòng Bếp & Ẩm Thực (F&B / Room Service)',
    rsSubtitle: 'Theo dõi đơn gọi món từ khách phòng, quản lý tiến độ chuẩn bị và phối hợp cùng Robot HCRobot phục vụ chu đáo.',
    kpiPendingOrders: 'Đơn Chờ Xử Lý',
    kpiInPreparation: 'Đang Chế Biến',
    kpiCompletedToday: 'Hoàn Thành Hôm Nay',
    rsRobotChannel: 'Kênh Tiếp Nhận HCRobot',
    rsRobotOnline: '● Trực tuyến • Sẵn sàng nhận yêu cầu',
    rsRobotDesc: 'Mọi yêu cầu gọi món từ khách phòng qua Robot Concierge được tự động chuyển về bếp theo thời gian thực.',
    rsViewMap: 'Xem Vị Trí Robot Trên Bản Đồ',
    rsLowStockAlerts: 'Cảnh Báo Sắp Hết Hàng',

    // Housekeeping
    hkTitle: 'Bộ Phận Buồng Phòng (Housekeeping)',
    hkSubtitle: 'Điều phối dọn dẹp buồng phòng, theo dõi yêu cầu ưu tiên và kiểm soát vận hành tự hành trên các tầng.',
    kpiPendingRequests: 'Yêu Cầu Đang Chờ',
    kpiStaffOnDuty: 'Nhân Sự Trực Ca',
    hkFloorStatus: 'Trạng Thái Tầng',
    hkActiveFloor: 'TẦNG 5 - ĐANG HOẠT ĐỘNG',
    hkTeamAvailability: 'Tình Trạng Đội Ngũ',

    // Bell Services
    bsTitle: 'Bộ Phận Hành Lý & Tiền Sảnh (Bell Services)',
    bsActiveOps: 'VẬN HÀNH TRỰC CA',
    kpiPending: 'CHỜ TIẾP NHẬN',
    kpiOnJob: 'ĐANG XỬ LÝ',
    kpiCompleted: 'ĐÃ HOÀN THÀNH',
    kpiActiveFleet: 'NHÂN SỰ / ROBOT TRỰC CA',
    bsTeamStatus: 'Trạng Thái Đội Ngũ',

    // Maintenance
    mnTitle: 'Bộ Phận Kỹ Thuật & Bảo Trì (Maintenance)',
    mnSubtitle: 'Quản lý và xử lý tất cả các sự cố kỹ thuật, sửa chữa trang thiết bị nhận từ Robot HCRobot.',
    kpiTechsOnDuty: 'KỸ THUẬT VIÊN\nTRỰC CA',
    mnStaffAvailability: 'Nhân Sự Trực Ca',
    mnManageSchedule: 'Quản Lý Ca Làm Việc',

    // Reception
    recTitle: 'Bộ Phận Lễ Tân (Reception & Front Desk)',
    recSubtitle: 'Tiếp nhận yêu cầu khách hàng, hỗ trợ trực tuyến và điều phối nghiệp vụ chuyên trách.',
    recGuestCall: 'Cuộc Gọi Hỗ Trợ Khách Phòng',
    recTranscript: 'Nội Dung Hội Thoại',
    recActivityLog: 'Nhật Ký Xử Lý',

    // My Tasks
    myTasksTitle: 'Nhiệm Vụ Của Tôi',
    myTasksSubtitle: 'Quản Lý Công Việc Cá Nhân & Danh Mục Checklist Quy Trình Chuẩn 5 Sao',
    kpiMyInProgress: 'ĐANG THỰC HIỆN',
    kpiMyCompleted: 'ĐÃ HOÀN THÀNH',
    kpiShiftEfficiency: 'HIỆU SUẤT CA',
    tabAll: 'Tất Cả',
    tabInProgress: 'Đang Làm',
    tabCompleted: 'Đã Xong',
    checklistTitle: 'Checklist Quy Trình Chuẩn Nghiệp Vụ 5 Sao',
    checklistCompletedNotice: 'Đã hoàn tất tất cả các bước. Sẵn sàng đóng nhiệm vụ!',
    checklistCompletedBadge: 'Nhiệm Vụ Đã Hoàn Tất Thành Công',
    taskDueLabel: 'Thời Hạn Hoàn Thành',
    taskClaimedBadge: 'Tiếp nhận qua HCRobot',

    // Requests Page
    requestsTitle: 'Yêu Cầu Dịch Vụ',
    requestsSubtitle: 'Hàng đợi yêu cầu thời gian thực từ khách phòng và Robot HCRobot chuyển về.',
    tabWaiting: 'Chờ Tiếp Nhận',
    tabDoing: 'Đang Làm',
    tabDone: 'Đã Xong',

    // History Page
    historyTitle: 'Nhật Ký Hệ Thống & Lịch Sử Yêu Cầu',
    historySubtitle: 'Lịch sử chi tiết toàn bộ các yêu cầu đã thực hiện, mốc thời gian và nhân sự phụ trách.',
  },
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('aurora_language') || 'EN';
  });

  useEffect(() => {
    localStorage.setItem('aurora_language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'EN' ? 'VI' : 'EN'));
  };

  const t = (key) => {
    const langDict = translations[language] || translations.EN;
    return langDict[key] || translations.EN[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
