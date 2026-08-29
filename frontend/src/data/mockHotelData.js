// =======================================================================
// AURORA OS - HCROBOT CONCIERGE & OPERATIONS CODE-FIRST SCHEMA & MOCK DATA
// =======================================================================

export const INITIAL_ROOM_SERVICE_DATA = {
  kpis: {
    pendingOrders: { value: 8, delta: '+2', status: 'increase' },
    inPreparation: { value: 4, avgTime: '12m' },
    completedToday: { value: 42 },
    highPriority: { count: 2, label: 'VIP Guests' },
  },
  orders: [
    {
      id: '1042',
      room: 'ROOM 412',
      isVip: true,
      status: 'Pending', // 'Pending' | 'Cooking' | 'Ready' | 'Delivering' | 'Completed' | 'Rejected'
      orderedAt: '4 mins ago',
      items: [
        { name: 'Club Sandwich & Truffle Fries', qty: 2 },
        { name: 'Artisan Cola (Ice)', qty: 2 },
      ],
      note: 'No mayo on one sandwich, please.',
      imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80',
      priority: 'high',
    },
    {
      id: '1041',
      room: 'ROOM 208',
      isVip: false,
      status: 'Cooking',
      orderedAt: '15 mins ago',
      items: [
        { name: 'Grand Breakfast Set for Two', qty: 1 },
      ],
      estCompletion: '4 mins',
      progress: 60,
      imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop&q=80',
      priority: 'normal',
    },
    {
      id: '1040',
      room: 'ROOM 512',
      isVip: false,
      status: 'Pending',
      orderedAt: '1 min ago',
      items: [
        { name: 'Extra Tableware & Wine Glasses', qty: 'Set of 4' },
      ],
      note: 'Service Request - No food prep required',
      isServiceRequest: true,
      priority: 'normal',
    },
  ],
  deliveryFleet: [
    { id: 'U1', name: 'Unit 01', status: 'Available', location: 'F&B Dock', statusColor: 'emerald', battery: 96 },
    { id: 'U2', name: 'Unit 02', status: 'Delivering', location: 'En route Fl 4', statusColor: 'sky', battery: 74 },
    { id: 'U3', name: 'Unit 03', status: 'Charging', location: '84%', statusColor: 'amber', battery: 84 },
  ],
  lowStockAlerts: [
    { id: 's1', name: 'Artisan Cola', count: '6 left', level: 'danger' },
    { id: 's2', name: 'Sparkling Water (L)', count: '2 left', level: 'danger' },
    { id: 's3', name: 'Truffle Oil', count: '1 btl', level: 'warning' },
  ],
};

export const INITIAL_HOUSEKEEPING_DATA = {
  kpis: {
    pendingRequests: 12,
    inProgress: 5,
    completedToday: 28,
    highPriority: 3,
  },
  requests: [
    {
      id: 'HK-1042',
      source: 'From HCRobot',
      priority: 'HIGH PRIORITY',
      time: '10:15 AM',
      title: 'Spill cleanup required',
      room: '502',
      description: 'Wine spill on carpet. Guest requested immediate attention.',
      guestName: 'Mr. John Smith',
      status: 'Unassigned', // 'Unassigned' | 'In Progress' | 'Completed'
      assignedStaff: null,
    },
    {
      id: 'HK-1043',
      source: 'From HCRobot',
      priority: 'NORMAL',
      time: '10:22 AM',
      title: 'Extra Towels',
      room: '314',
      description: 'Guest requested 4 extra bath towels.',
      guestName: 'Mrs. Alena Croft',
      status: 'Unassigned',
      assignedStaff: null,
    },
    {
      id: 'HK-1040',
      source: 'Front Desk',
      priority: 'NORMAL',
      time: '09:50 AM',
      title: 'Full Room Turnover',
      room: '408',
      description: 'Checkout completed. Ready for deep clean before 2 PM check-in.',
      guestName: 'Departed Guest',
      status: 'In Progress',
      assignedStaff: 'Maria Santos',
    },
  ],
  floorStatus: {
    activeFloor: 'FLOOR 5 - ACTIVE',
    roomsCleaned: 45,
    totalRooms: 120,
  },
  availableStaff: [
    { id: 'MS', name: 'Maria Santos', location: 'Floor 3', status: 'online' },
    { id: 'JD', name: 'James Doe', location: 'Floor 5', status: 'online' },
    { id: 'AL', name: 'Anna Lu', location: 'Floor 2', status: 'online' },
  ],
};

export const INITIAL_BELL_SERVICES_DATA = {
  kpis: {
    pending: 6,
    onJob: 3,
    completed: 24,
    urgent: 1,
  },
  requests: [
    {
      id: 'BS-501',
      title: 'Luggage Pickup (Urgent)',
      priority: 'HIGH PRIORITY',
      location: 'Suite 402',
      guestName: 'Mr. Aris Thorne',
      description: 'Guest is departing early for an international flight. Requires immediate assistance with 4 large suitcases and 2 garment bags. VIP status.',
      status: 'Pending',
      type: 'luggage',
      urgentBadge: true,
    },
    {
      id: 'BS-502',
      title: 'Room Move Assistance',
      priority: 'Pending',
      location: 'Room 215 to 510',
      guestName: 'Mrs. Elena Rostova',
      description: 'Guest requested an upgrade. Need to move luggage from current room to the new suite. Coordinate with housekeeping for final check of Room 215.',
      status: 'Pending',
      type: 'room_move',
    },
    {
      id: 'BS-503',
      title: 'Lost & Found Retrieval',
      priority: 'In Progress',
      location: 'Lobby Lounge',
      reporter: 'Staff (J. Doe)',
      description: 'A leather briefcase was left near the grand piano. Retrieve, log into system, and secure in the main Lost & Found locker.',
      status: 'In Progress',
      type: 'lost_found',
    },
  ],
  teamStatus: [
    { id: 'b1', name: 'Marcus T.', role: 'Bell Captain', status: 'available', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
    { id: 'b2', name: 'Sarah J.', role: 'Attendant', status: 'busy', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80' },
    { id: 'b3', name: 'Bot Unit Alpha', role: 'Automated Cart', status: 'available', isRobot: true },
  ],
  announcement: {
    title: 'Peak Hours Approaching',
    subtitle: 'Expect high volume of check-outs between 10:00 AM and 12:00 PM.',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&auto=format&fit=crop&q=80',
  }
};

export const INITIAL_MAINTENANCE_DATA = {
  kpis: {
    highPriority: { count: 1, delta: '-2 from yesterday', status: 'good' },
    pendingRequests: 4,
    inProgress: 2,
    completedToday: { count: 15, delta: '+3 from yesterday', status: 'good' },
  },
  requests: [
    {
      id: 'MN-401',
      title: 'Plumbing Leak',
      priority: 'HIGH PRIORITY',
      reportedTime: '10 mins ago',
      status: 'Pending',
      location: 'Room 412',
      description: 'Guest reported water pooling near bathroom sink.',
      source: 'RECEIVED FROM HCROBOT',
      category: 'plumbing',
    },
    {
      id: 'MN-402',
      title: 'Air Conditioner Issue',
      priority: 'In Progress',
      reportedTime: '45 mins ago',
      status: 'In Progress',
      location: 'Room 305',
      description: 'Unit making loud rattling noise when fan is on high.',
      assignedTo: 'James D.',
      source: 'RECEIVED FROM HCROBOT',
      category: 'hvac',
    },
    {
      id: 'MN-403',
      title: 'Light Bulb Replacement',
      priority: 'Completed',
      reportedTime: '2 hrs ago',
      status: 'Completed',
      location: 'Corridor 2B',
      description: 'Fading overhead light near elevator bay.',
      source: 'RECEIVED FROM HCROBOT',
      category: 'electrical',
    },
  ],
  staffAvailability: [
    { id: 'ER', name: 'Elena Rossi', role: 'Shift Leader', status: 'Available', statusClass: 'text-emerald-600' },
    { id: 'JD', name: 'James D.', role: 'HVAC Tech', status: 'Busy (R305)', statusClass: 'text-amber-600' },
    { id: 'MK', name: 'Michael K.', role: 'General', status: 'Off Shift', statusClass: 'text-stone-400' },
  ],
  facilityMap: {
    zone: 'Zone Status',
    description: 'View active requests and technician locations on the floor plan.',
    thumbnail: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&auto=format&fit=crop&q=80',
  }
};

export const INITIAL_MANAGER_DATA = {
  department: 'Housekeeping',
  kpis: {
    activeRequests: { current: 12, total: 45 },
    roomsCleaned: { current: 78, total: 120 },
    staffActive: { current: 8, total: 10 },
    responseTime: { avg: '14m', trend: [18, 16, 15, 17, 14, 13, 14] },
  },
  liveRequests: [
    {
      id: 'M-101',
      title: 'Spill in Lobby',
      priority: 'URGENT',
      location: 'Main Entrance',
      reportedTime: 'Reported 2m ago',
      status: 'Unassigned',
      type: 'spill',
    },
    {
      id: 'M-102',
      title: 'Room Make-up',
      priority: 'PENDING',
      location: 'Suite 402',
      reportedTime: 'Guest Requested',
      status: 'Unassigned',
      type: 'room_service',
    },
    {
      id: 'M-103',
      title: 'Extra Towels',
      priority: 'IN PROGRESS',
      location: 'Room 214',
      reportedTime: 'Scheduled',
      status: 'In Progress',
      assignedTo: {
        name: 'Maria S.',
        eta: '5m',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'
      },
      type: 'towels',
    },
  ],
  staffRoster: [
    { id: 'st1', name: 'Maria S.', location: 'Floor 2', tasks: '0 Tasks', status: 'available', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80' },
    { id: 'st2', name: 'David C.', location: 'Floor 4', tasks: '2 Tasks', status: 'Busy (15m)', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80' },
    { id: 'st3', name: 'Sarah J.', location: 'Lobby', tasks: '1 Task', status: 'active', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
    { id: 'st4', name: 'Elena R.', location: 'Off Shift', tasks: '0 Tasks', status: 'off_shift', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
  ],
  zoneHeatmap: {
    activeZone: 'Floor 4 High Activity',
  }
};
