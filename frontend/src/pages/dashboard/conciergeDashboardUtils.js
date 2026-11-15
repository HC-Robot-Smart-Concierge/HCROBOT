/** Pure defaults, status normalizers, and pagination helpers for ConciergeDashboard. */

export const CONCIERGE_PAGE_SIZE = 10;

export const INITIAL_TEST_FORM = {
  room_number: 'Lobby Kiosk Unit 01',
  guest_name: 'Mr. Tanaka Kenji',
  transcript: 'Khách muốn tìm hiểu thông tin về tour du lịch Bà Nà Hills trong ngày.',
};

export const INITIAL_TAXI_KPIS = {
  totalRequests: 0,
  pendingRequests: 0,
  activeTrips: 0,
  completedTrips: 0,
};

export const INITIAL_TAXI_FORM = {
  guest_name: '',
  room_number: '',
  pickup_location: 'Main Lobby & Front Entrance',
  destination: 'Da Nang International Airport (DAD)',
  pickup_time: 'Ngay bây giờ (Immediate)',
  party_size: 2,
  vehicle_type: '4-Seater Sedan',
  notes: '',
};

export const INITIAL_EMOTION_FORM = {
  location: 'Main Lobby Kiosk',
  guestName: '',
  emotionType: 'Khó chịu (Unhappy)',
  description: '',
};

export const normalizeEmotionStatus = (statusStr) => {
  const lower = (statusStr || 'Pending').toLowerCase();
  if (lower === 'completed' || lower === 'closed' || lower === 'done') return 'Completed';
  if (lower === 'in progress' || lower === 'in_progress') return 'In Progress';
  return 'Pending';
};

export const filterConciergeFeedbacks = (feedbacks, feedbackRatingFilter) => {
  let list = feedbacks;
  if (feedbackRatingFilter === 'recovery') {
    list = list.filter((f) => (f.rating || 5) <= 3);
  } else if (feedbackRatingFilter === 'satisfied') {
    list = list.filter((f) => (f.rating || 5) >= 4);
  }
  return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
};

export const paginateConciergeItems = (items, page, pageSize = CONCIERGE_PAGE_SIZE) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};
