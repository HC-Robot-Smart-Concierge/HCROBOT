export const POPULAR_DESTINATIONS = [
  { id: 'dad', name: 'Sân bay Quốc tế Đà Nẵng (DAD)', desc: '15 phút di chuyển' },
  { id: 'hoian', name: 'Phố cổ Hội An', desc: '40 phút di chuyển' },
  { id: 'banahills', name: 'Bà Nà Hills & Cầu Vàng', desc: '45 phút di chuyển' },
  { id: 'sontra', name: 'Bán đảo Sơn Trà & Chùa Linh Ứng', desc: '20 phút di chuyển' },
  { id: 'mykhe', name: 'Bãi biển Mỹ Khê', desc: '5 phút di chuyển' },
  { id: 'custom', name: 'Điểm đến khác...', desc: 'Nhập địa chỉ tùy chọn' },
];

export const TAXI_PARTNERS = [
  {
    id: 'mailinh',
    name: 'Taxi Mai Linh Đà Nẵng',
    hotline: '0236 3 56 56 56',
    shortCode: '1055',
    color: 'emerald',
    desc: 'Hãng taxi phổ biến nhất, xe có mặt sau 3 đến 5 phút.',
  },
  {
    id: 'vinasun',
    name: 'Taxi Vinasun Đà Nẵng',
    hotline: '0236 3 68 68 68',
    shortCode: null,
    color: 'red',
    desc: 'Đội xe sedan 4 chỗ và SUV 7 chỗ đời mới, phục vụ chuyên nghiệp.',
  },
  {
    id: 'tiensa',
    name: 'Taxi Tiên Sa Đà Nẵng',
    hotline: '0236 3 79 79 79',
    shortCode: null,
    color: 'amber',
    desc: 'Hãng taxi địa phương uy tín, nhận diện xe vàng, phục vụ 24/7.',
  },
  {
    id: 'airport_taxi',
    name: 'Taxi Sân Bay Đà Nẵng',
    hotline: '0236 3 82 82 82',
    shortCode: null,
    color: 'blue',
    desc: 'Chuyên tuyến đưa đón Sân bay Quốc tế Đà Nẵng và tour tham quan.',
  },
];

export const AUTO_CLOSE_SECONDS = 45;
export const CONFIRMED_AUTO_CLOSE_SECONDS = 5;

export function isDismissVoiceIntent(transcript) {
  return /cảm ơn|cám ơn|cam on|thank you|thanks|tắt|tat|đóng|dong|xong rồi|xong roi|được rồi|duoc roi|ok rồi|thôi|thoát|quay lại|close|dismiss/i.test(transcript || '');
}

export function isSelfBookingVoiceIntent(transcript) {
  return /tự đặt|tu dat|tự gọi|tu goi|tự liên hệ|tự book|cho tôi số|cho số|số điện thoại|hotline|option 1|option một|lựa chọn 1|lua chon 1|lựa chọn một|phương án 1|phuong an 1|phương án một|số 1|so 1|số một|thứ nhất|thu nhat|đầu tiên|chọn 1|chon 1|^\s*1\s*$|(?:\b|^)một(?:\b|$)/i.test(transcript || '');
}

export function isConciergeVoiceIntent(transcript) {
  return /nhờ đặt|nho dat|đặt giùm|dat gium|đặt giúp|dat giup|đặt hộ|dat ho|concierge|nhân viên đặt|lễ tân đặt|hỗ trợ đặt|option 2|option hai|lựa chọn 2|lua chon 2|lựa chọn hai|phương án 2|phuong an 2|phương án hai|số 2|so 2|số hai|thứ hai|thu hai|thứ 2|chọn 2|chon 2|^\s*2\s*$|(?:\b|^)hai(?:\b|$)/i.test(transcript || '');
}

export function isConfirmVoiceIntent(transcript) {
  return /đúng rồi|dung roi|chính xác|chinh xac|xác nhận|xac nhan|chuẩn rồi|chuan roi|gửi đi|gui di|gửi yêu cầu|gui yeu cau|đồng ý|dong y|được rồi|duoc roi|ok|okay|yes|correct|confirm/i.test(transcript || '');
}

export function isEditVoiceIntent(transcript) {
  return /chưa đúng|chua dung|không đúng|khong dung|sai rồi|sai roi|sửa lại|sua lai|chỉnh sửa|thay đổi|thay doi|chọn lại|chon lai|sửa|sua|no|edit|change/i.test(transcript || '');
}

export function extractDestinationFromVoice(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;
  const clean = transcript.trim().toLowerCase();
  if (!clean) return null;

  // 1. Phù hợp các địa danh du lịch nổi tiếng Đà Nẵng
  if (/sân bay|airport|dad\b/i.test(clean)) return 'Sân bay Quốc tế Đà Nẵng (DAD)';
  if (/hội an|hoi an|phố cổ|pho co/i.test(clean)) return 'Phố cổ Hội An';
  if (/bà nà|ba na|cầu vàng|cau vang/i.test(clean)) return 'Bà Nà Hills & Cầu Vàng';
  if (/sơn trà|son tra|chùa linh ứng|linh ung/i.test(clean)) return 'Bán đảo Sơn Trà & Chùa Linh Ứng';
  if (/mỹ khê|my khe|bãi biển|bai bien/i.test(clean)) return 'Bãi biển Mỹ Khê';
  if (/cầu rồng|cau rong/i.test(clean)) return 'Cầu Rồng Đà Nẵng';
  if (/chợ hàn|cho han/i.test(clean)) return 'Chợ Hàn Đà Nẵng';
  if (/chợ đêm|cho dem|helio/i.test(clean)) return 'Chợ đêm Helio';
  if (/ngũ hành sơn|ngu hanh son/i.test(clean)) return 'Danh thắng Ngũ Hành Sơn';

  // 2. Nhận diện các cấu trúc câu: "đi [X]", "đến [X]", "tới [X]", "qua [X]", "ra [X]"
  // Giữ nguyên casing gốc từ transcript
  const match = transcript.match(/(?:tôi muốn đi|cho tôi đi|muốn đi|đi đến|đi tới|đi ra|đi|đến|tới|qua|ra)\s+(.+)/i);
  if (match && match[1]) {
    const rawDest = match[1].replace(/[.,?!]+$/, '').trim();
    if (rawDest.length >= 2) {
      return rawDest.charAt(0).toUpperCase() + rawDest.slice(1);
    }
  }

  // 3. Fallback: Nếu không rơi vào các từ phủ định hoặc lệnh hệ thống
  if (!/^(hủy|thôi|không|chào|alo|hello|hi|ok|đúng|sai|option|lựa chọn)/i.test(clean) && clean.length >= 3) {
    return transcript.trim().charAt(0).toUpperCase() + transcript.trim().slice(1);
  }

  return null;
}

export function extractVehicleAndPartyFromVoice(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;
  const clean = transcript.trim().toLowerCase();
  let vehicleType = null;
  let partySize = null;

  // 1. Nhận diện loại xe
  if (/7 chỗ|bảy chỗ|suv|7 cho|bay cho|xe to|xe lớn/i.test(clean)) {
    vehicleType = '7-Seater SUV';
  } else if (/4 chỗ|bốn chỗ|sedan|4 cho|bon cho|xe nhỏ/i.test(clean)) {
    vehicleType = '4-Seater Sedan';
  }

  // 2. Nhận diện số lượng khách (ưu tiên số đi kèm người/khách/pax/vé)
  const partyMatch = clean.match(/(\d+)\s*(?:người|khách|ve|vé|pax|bạn|thành viên|nguoi|khach)/i);
  if (partyMatch && partyMatch[1]) {
    const count = parseInt(partyMatch[1], 10);
    if (count >= 1 && count <= 16) {
      partySize = count;
    }
  } else if (/một người|mình tôi|1 mình|đơn|mot nguoi/i.test(clean)) {
    partySize = 1;
  } else if (/hai người|hai khách|2 người|hai nguoi/i.test(clean)) {
    partySize = 2;
  } else if (/ba người|ba khách|ba nguoi/i.test(clean)) {
    partySize = 3;
  } else if (/bốn người|bốn khách|bon nguoi/i.test(clean)) {
    partySize = 4;
  } else if (/năm người|năm khách|nam nguoi/i.test(clean)) {
    partySize = 5;
  } else if (/sáu người|sáu khách|sau nguoi/i.test(clean)) {
    partySize = 6;
  } else if (/bảy người|bảy khách|bay nguoi/i.test(clean)) {
    partySize = 7;
  } else {
    // Nếu chỉ có số đứng sau "đi X" hoặc "cho X" mà không phải "chỗ"
    const standaloneMatch = clean.match(/(?:đi|cho|đón)\s+(\d+)(?!\s*chỗ|\s*cho)/i);
    if (standaloneMatch && standaloneMatch[1]) {
      const count = parseInt(standaloneMatch[1], 10);
      if (count >= 1 && count <= 16) {
        partySize = count;
      }
    }
  }

  // Nếu khách đi từ 4 người trở lên mà chưa chọn loại xe, gợi ý 7 chỗ
  if (partySize && partySize >= 4 && !vehicleType) {
    vehicleType = '7-Seater SUV';
  } else if (partySize && partySize <= 3 && !vehicleType) {
    vehicleType = '4-Seater Sedan';
  }

  if (!vehicleType && !partySize) return null;
  return { vehicleType, partySize };
}

export function buildTaxiBookingPayload({
  activeRoomNumber,
  destination,
  vehicleType = '4-Seater Sedan',
  partySize = 2,
  note = '',
}) {
  const pickupLocation = activeRoomNumber
    ? `Sảnh chính (Khách Phòng ${activeRoomNumber})`
    : 'Sảnh chính & Cổng trước (Main Lobby)';
  const guestName = activeRoomNumber
    ? `Khách Phòng ${activeRoomNumber}`
    : 'Khách tại Sảnh';

  return {
    room_number: activeRoomNumber,
    guest_name: guestName,
    pickup_location: pickupLocation,
    destination: (destination || '').trim(),
    pickup_time: 'Immediate',
    party_size: Number(partySize) || 2,
    vehicle_type: vehicleType,
    description: (note || '').trim()
      ? `Ghi chú: ${(note || '').trim()} | Phiên phòng: ${activeRoomNumber || 'Lobby'}`
      : `Phiên phòng: ${activeRoomNumber || 'Lobby'} | Xe đón tại sảnh`,
  };
}
