// =======================================================================
// AURORA OS - HCROBOT CONCIERGE & OPERATIONS CODE-FIRST SCHEMA & MOCK DATA
// =======================================================================

export const INITIAL_RECEPTION_DATA = {
  id: 'REC-DEMO',
  ticketCode: 'REQ-8942A',
  title: 'Leaking Faucet in Master Bathroom',
  createdLabel: 'Created 14 mins ago',
  location: 'Suite 402',
  locationDetails: { floor: 'West Wing', category: 'Premium Ocean View' },
  guestName: 'Mr. A. Sterling',
  guestTier: 'VIP',
  guestStayDetails: 'Check-out: Tomorrow, 11:00 AM',
  priority: 'High',
  status: 'Pending Action',
  description:
    'Guest reported a persistent dripping sound coming from the master bathroom dual sink vanity. The left faucet is leaking approximately one drop every two seconds, causing noise disruption and minor water pooling on the marble counter. Guest requested immediate maintenance while they are out for lunch (expected return: 2:30 PM).',
  attachedMedia: [
    {
      url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=80',
      alt: 'Close-up of bathroom faucet',
    },
    {
      url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=500&auto=format&fit=crop&q=80',
      alt: 'Guest bathroom interior',
    },
  ],
  transcript: [
    {
      speaker: 'guest',
      time: '11:42 AM',
      message: "Aurora, the sink in the bathroom is dripping. It's driving me crazy. Can you send someone to fix it?",
    },
    {
      speaker: 'assistant',
      time: '11:42 AM',
      message: 'I apologize for the inconvenience, Mr. Sterling. I have logged a maintenance request for the dripping sink. Is it the master bathroom or the powder room?',
    },
    {
      speaker: 'guest',
      time: '11:43 AM',
      message: "Master bathroom. The left one. We're heading out to lunch now, so they can fix it while we're gone.",
    },
    {
      speaker: 'assistant',
      time: '11:43 AM',
      message: 'Understood. I will dispatch maintenance immediately and note that the room is vacant until your return. Enjoy your lunch.',
    },
  ],
  assistanceStatus: 'Connected',
  assignedTo: 'Javier Morales',
  assignedRole: 'Maintenance Tech II',
  notes: [],
  escalated: false,
  activityLog: [
    { title: 'Video Call Ended', detail: 'Staff: Elena Rossi (Duration: 03:42)', time: '11:46 AM' },
    { title: 'Video call started', detail: '', time: '11:42 AM' },
    {
      title: 'Human assistance requested',
      detail: 'Reason: Guest requires clarification on bathroom maintenance.',
      time: '11:41 AM',
    },
    { title: 'Task Assigned', detail: 'System assigned to J. Morales', time: '11:45 AM' },
    { title: 'Request Created', detail: 'Via In-Room HCRobot', time: '11:43 AM' },
  ],
};

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
