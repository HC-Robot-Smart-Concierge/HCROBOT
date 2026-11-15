import {
  Luggage,
  SearchCheck,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';

// English labels, translated by useStaffText. Keys match backend BELL_SERVICES.
export const BELL_SERVICE_LABELS = {
  luggage_delivery: 'Bring luggage to room',
  luggage_pickup: 'Take luggage down to lobby',
  luggage_storage: 'Store luggage',
  luggage_retrieval: 'Retrieve stored luggage',
  room_move: 'Room move assistance',
};

export const inferFlowType = (request) => {
  const rawType = (request.request_type || request.type || '').toLowerCase();
  if (['lost_found', 'room_move'].includes(rawType)) {
    return rawType;
  }
  const text = `${request.title || ''} ${request.description || ''}`.toLowerCase();
  if (
    ['thất lạc', 'quên đồ', 'mất đồ', 'rơi đồ', 'lost', 'missing', 'forgot'].some((k) =>
      text.includes(k)
    )
  ) {
    return 'lost_found';
  }
  if (['đổi phòng', 'chuyển phòng', 'room move'].some((k) => text.includes(k))) {
    return 'room_move';
  }
  return 'luggage';
};

export const normalizeRequest = (request) => {
  const flowType = inferFlowType(request);
  return {
    ...request,
    id: request.ticket_code || request.id,
    type: flowType,
    request_type: flowType,
    serviceKey: request.bell_service || null,
    guestName: request.guest_name || request.guestName || 'Hotel Guest',
    assignedTo: request.assigned_to || request.assignedTo || null,
  };
};

export const getStatusLabel = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'in progress' || normalized === 'on job') return 'In Progress';
  if (normalized === 'completed') return 'Completed';
  return 'Pending';
};

const createdTime = (request) => new Date(request.created_at || 0).getTime();

// Open requests first and oldest first (FIFO); completed history newest first.
export const queueOrder = (a, b) => {
  const aDone = getStatusLabel(a.status) === 'Completed';
  const bDone = getStatusLabel(b.status) === 'Completed';
  if (aDone !== bDone) return aDone ? 1 : -1;
  return aDone ? createdTime(b) - createdTime(a) : createdTime(a) - createdTime(b);
};

export const FLOW_TABS = [
  { id: 'all', label: 'Tất cả nghiệp vụ', icon: Sparkles },
  { id: 'luggage', label: 'Hỗ trợ hành lý', icon: Luggage },
  { id: 'lost_found', label: 'Báo cáo đồ thất lạc', icon: SearchCheck },
];

export const getFlowBadge = (type) => {
  if (type === 'lost_found') {
    return {
      label: 'Báo cáo đồ thất lạc',
      className: 'bg-amber-50 text-amber-800 border border-amber-200',
      icon: SearchCheck,
    };
  }
  if (type === 'room_move') {
    return {
      label: 'Hỗ trợ chuyển phòng & hành lý',
      className: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
      icon: ArrowRightLeft,
    };
  }
  return {
    label: 'Hỗ trợ hành lý',
    className: 'bg-sky-50 text-sky-800 border border-sky-200',
    icon: Luggage,
  };
};

export const getAcceptButtonLabel = (type, t) => {
  if (type === 'lost_found') return 'Tiếp nhận & Tìm kiếm đồ';
  return t('acceptTask') || 'Tiếp nhận hỗ trợ hành lý';
};

export const getCompleteButtonLabel = (type, t) => {
  if (type === 'lost_found') return 'Đã tìm thấy & Trao trả khách';
  return t('completeTask') || 'Hoàn tất bàn giao';
};
