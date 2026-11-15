import { GROUND_AND_AMENITY_DESTINATIONS, HOTEL_FLOORS } from './floorMapGroundDestinations';
import { ROOM_DESTINATIONS } from './floorMapRoomDestinations';

export { HOTEL_FLOORS };

export const HOTEL_DESTINATIONS = {
  ...GROUND_AND_AMENITY_DESTINATIONS,
  ...ROOM_DESTINATIONS,
};

// Tuyến đường chuẩn chặng 1: Từ Lobby (Ground) -> Thang máy A (đi vòng tránh bồn cây và quầy lễ tân)
export const ROUTE_GROUND_TO_ELEVATOR = 'M 350 580 L 350 860 Q 350 880, 370 880 L 1330 880 Q 1350 880, 1362 864 L 1568 576 Q 1580 560, 1600 560 L 1715 560';

// Tạo vé chỉ đường dùng 1 lần (Ephemeral One-time Ticket có thời hạn 15 phút)
export const createEphemeralTicket = (destKey) => {
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // Có hiệu lực trong 15 phút
  const payload = {
    d: destKey,
    e: expiresAt,
    n: Math.random().toString(36).substring(2, 8),
  };
  try {
    return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return `${destKey}_${expiresAt}`;
  }
};

// Lấy danh sách IP mạng khả dụng của máy chủ (Tailscale VPN & Wi-Fi LAN) để tránh lỗi localhost trên điện thoại
export const getDetectedNetworkHosts = () => {
  const tailscaleIp =
    typeof __DETECTED_TAILSCALE_IP__ !== 'undefined' && __DETECTED_TAILSCALE_IP__
      ? __DETECTED_TAILSCALE_IP__
      : '100.64.240.42';
  const lanIp =
    typeof __DETECTED_LAN_IP__ !== 'undefined' && __DETECTED_LAN_IP__
      ? __DETECTED_LAN_IP__
      : '192.168.1.149';
  return { tailscaleIp, lanIp };
};

// Cache URL vé QR theo destinationKey + host để mã QR ổn định, không bị render lại giật giật khi đếm ngược
const qrTicketCache = new Map();

// Hàm tạo URL chỉ đường di động siêu nhẹ (Standalone 15KB map.html) tối ưu cho quét QR
// Kèm theo tham số dự phòng &dest= để đảm bảo Alternative Flow luôn đọc được điểm đến
export const getMobileGuestMapUrl = (destKey, preferredHostIp = null) => {
  const safeDestKey = destKey || 'infinity_pool';
  const { tailscaleIp, lanIp } = getDetectedNetworkHosts();

  // Mặc định ưu tiên Wi-Fi LAN (192.168.x.x) để điện thoại bắt Wi-Fi quét vào thẳng ngay lập tức
  let resolvedHostIp = lanIp || tailscaleIp;
  try {
    if (preferredHostIp) {
      resolvedHostIp = preferredHostIp;
    } else if (typeof localStorage !== 'undefined') {
      const savedIp = localStorage.getItem('aurora_qr_network_ip');
      if (savedIp) {
        resolvedHostIp = savedIp;
      } else if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1') {
          resolvedHostIp = h;
        }
      }
    }
  } catch {
    resolvedHostIp = lanIp || tailscaleIp;
  }

  const cacheKey = `${safeDestKey}__${resolvedHostIp}`;
  const now = Date.now();
  const cached = qrTicketCache.get(cacheKey);
  // Nếu đã tạo vé trong vòng 10 phút thì giữ nguyên mã QR để không bị giật/đổi hình
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  const token = createEphemeralTicket(safeDestKey);
  const encodedDest = encodeURIComponent(safeDestKey);
  let url = '';
  try {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isPrivateOrLocalHost =
      !currentHost ||
      currentHost === 'localhost' ||
      currentHost === '127.0.0.1' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);

    if (isPrivateOrLocalHost) {
      // Sử dụng cổng HTTP 8000 (FastAPI Static Guest Map) khi quét qua Wi-Fi / Tailscale nội bộ:
      // 1. Tránh 100% lỗi cảnh báo chứng chỉ SSL tự ký (basicSsl) trên Safari / Chrome điện thoại
      // 2. Tránh 100% Service Worker cũ ở port 3000 chặn request và đẩy về Trang chủ (/)
      url = `http://${resolvedHostIp}:8000/map.html?t=${token}&dest=${encodedDest}`;
    } else {
      // Nếu chạy qua domain công khai / Cloudflare Tunnel / Ngrok thì giữ nguyên origin
      url = `${window.location.origin}/map.html?t=${token}&dest=${encodedDest}`;
    }
  } catch {
    url = `http://${resolvedHostIp}:8000/map.html?t=${token}&dest=${encodedDest}`;
  }

  qrTicketCache.set(cacheKey, { url, expiresAt: now + 15 * 60 * 1000 });
  return url;
};

/**
 * Nhận diện nhanh điểm đến / POI từ câu nói người dùng ngay trên Client (0ms latency)
 * để màn hình robot LẬP TỨC chuyển sang chế độ bản đồ chỉ đường RT-05 mà không cần chờ LLM.
 */
export const detectDestinationPoi = (rawPrompt, activeRoomNumber = null) => {
  if (!rawPrompt || typeof rawPrompt !== 'string') return null;
  const p = rawPrompt.toLowerCase().trim();

  // Tuyệt đối không điều hướng bản đồ khi người dùng đang đặt dịch vụ phòng hoặc hỏi tiến độ
  const serviceOrderPhrases = ['đặt dịch vụ', 'dat dich vu', 'dịch vụ lên phòng', 'dich vu len phong', 'đặt thêm dịch vụ', 'dat them dich vu', 'muốn đặt dịch vụ', 'muon dat dich vu'];
  if (serviceOrderPhrases.some((k) => p.includes(k))) return null;

  // Tuyệt đối không điều hướng bản đồ khi người dùng đang hỏi về tiến độ / trạng thái đơn món & dịch vụ
  const orderStatusPhrases = [
    'tình trạng', 'tinh trang', 'tiến độ', 'tien do', 'làm món', 'lam mon',
    'món ăn', 'mon an', 'đồ ăn', 'do an', 'thức ăn', 'thuc an',
    'làm tới đâu', 'lam toi dau', 'đến đâu rồi', 'den dau roi', 'tới đâu rồi', 'toi dau roi',
    'xong chưa', 'xong chua', 'làm xong chưa', 'lam xong chua', 'nấu xong chưa', 'chế biến',
    'giao chưa', 'giao chua', 'kiểm tra đơn', 'kiem tra don', 'kiểm tra món', 'kiem tra mon',
    'tới phòng chưa', 'toi phong chua', 'đến phòng chưa', 'den phong chua', 'lên phòng chưa', 'len phong chua',
    'tới chưa', 'toi chua', 'đến chưa', 'den chua', 'mang tới chưa', 'mang toi chua', 'giao tới chưa', 'giao toi chua',
    'có chưa', 'co chua',
    'đơn hàng', 'don hang', 'order status', 'food status'
  ];
  if (orderStatusPhrases.some((k) => p.includes(k))) return null;

  // Bỏ qua các địa điểm ngoại vi khách sạn
  const externalPlaces = [
    'sân bay', 'airport', 'nội bài', 'tân sơn nhất', 'ga tàu', 'ga hà nội',
    'bến xe', 'bãi biển', 'ra biển', 'chợ', 'chợ đêm', 'bến thành',
    'phố cổ', 'hồ gươm', 'trung tâm thương mại', 'vincom', 'bệnh viện',
    'bảo tàng', 'ngoài khách sạn', 'địa điểm du lịch', 'tour', 'bắt taxi', 'bắt xe', 'grab'
  ];
  if (externalPlaces.some((k) => p.includes(k))) return null;

  // Ý định hỏi đường / điều hướng / tìm vị trí
  const navIntentKeywords = [
    'ở đâu', 'o dau', 'chỗ nào', 'cho nao', 'nơi nào', 'noi nao',
    'tầng mấy', 'tang may', 'ở tầng', 'o tang', 'tầng 1', 'tầng 2', 'tầng 3', 'tầng 4', 'tầng 5', 'tầng 6', 'lầu 1', 'lầu 2', 'tang 1', 'tang 2', 'floor 1', 'floor 2', 'floor 3', 'floor 4', 'floor 5', 'floor 6', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'hướng nào', 'huong nao',
    'đường đi', 'duong di', 'đường đến', 'duong den', 'đường ra', 'duong ra',
    'chỉ đường', 'chi duong', 'dẫn đường', 'dan duong', 'hướng dẫn đường',
    'lối đi', 'loi di', 'lối lên', 'loi len', 'lối xuống', 'loi xuong',
    'làm sao để đến', 'lam sao de den', 'cách đi', 'cach di', 'cách đến', 'cach den',
    'đi đến', 'di den', 'đi tới', 'di toi', 'đi ra', 'di ra', 'đi lên', 'di len', 'đi xuống', 'di xuong',
    'dẫn tôi', 'dan toi', 'dắt tôi', 'cho tôi đến', 'cho toi den',
    'tôi muốn đến', 'toi muon den', 'tôi muốn đi', 'toi muon di',
    'đưa tôi', 'dua toi', 'tìm đường', 'tim duong', 'vị trí', 'vi tri', 'chỉ tôi', 'chi toi',
    'where is', 'where are', "where's", 'which floor', 'how to get', 'how do i get',
    'way to', 'directions to', 'show me the way', 'take me to', 'lead me to', 'navigate to',
    'giới thiệu', 'gioi thieu', 'thông tin về', 'introduce', 'tell me about',
    'bản đồ', 'sơ đồ', 'map'
  ];

  const directLocPhrases = [
    'đi vệ sinh', 'di ve sinh', 'đi toilet', 'di toilet', 'đi tolet', 'đi toa lét', 'đi to lét', 'đi wc', 'di wc',
    'ra lễ tân', 'ra quầy', 'lên hồ bơi', 'ra hồ bơi', 'xuống bãi xe',
    'vào thang máy', 'lên phòng gym', 'đi massage', 'đi spa'
  ];

  // Cụm từ hỏi đường lên phòng nghỉ chung chung
  const generalRoomPhrases = [
    'phòng của tôi', 'phong cua toi', 'phòng tôi', 'phong toi',
    'đến phòng', 'den phong', 'lên phòng', 'len phong', 'về phòng', 've phong',
    'ra phòng', 'ra phong', 'tìm phòng', 'tim phong', 'hướng dẫn phòng',
    'hướng dẫn lên phòng', 'hướng dẫn về phòng', 'lối lên phòng', 'loi len phong',
    'đường lên phòng', 'duong len phong', 'đường về phòng', 'duong ve phong',
    'chỉ đường phòng', 'chi duong phong', 'chỉ đường đến phòng', 'chỉ đường về phòng',
    'cho tôi lên phòng', 'cho toi len phong', 'cho tôi về phòng', 'dẫn tôi lên phòng',
    'phòng ở đâu', 'phòng nghỉ', 'khu phòng', 'dãy phòng',
    'my room', 'to my room', 'to the room', 'guest room', 'hotel room'
  ];
  const isGeneralRoomQuery = generalRoomPhrases.some((k) => p.includes(k)) || (
    ['phòng', 'phong', 'room'].some((k) => p.includes(k)) && navIntentKeywords.some((k) => p.includes(k))
  );

  // Bỏ qua các câu hỏi tổng quan về dịch vụ / tiện ích của khách sạn (trừ phi đang hỏi đường lên phòng)
  const generalOverviewKeywords = [
    'dịch vụ về khách sạn', 'dịch vụ của khách sạn', 'dịch vụ khách sạn',
    'các dịch vụ', 'tiện ích khách sạn', 'các tiện ích', 'tiện ích của khách sạn',
    'cơ sở vật chất', 'khách sạn có gì', 'khách sạn có những gì', 'khách sạn có những dịch vụ gì',
    'khách sạn có những tiện ích gì', 'giới thiệu khách sạn', 'giới thiệu về khách sạn',
    'thông tin về khách sạn', 'thông tin khách sạn', 'hotel amenities', 'hotel facilities',
    'all services', 'ở đây có gì', 'có những dịch vụ gì', 'có những tiện ích gì'
  ];
  if (generalOverviewKeywords.some((k) => p.includes(k)) && !isGeneralRoomQuery) return null;

  const words = p.split(/\s+/);
  const isShortLocation = words.length <= 6 && [
    'toilet', 'tolet', 'toa lét', 'to lét', 'toilét', 'toalet', 'tô lét', 'toilette', 'vệ sinh', 'wc', 'restroom', 'washroom', 'hồ bơi', 'pool', 'gym', 'spa',
    'nhà hàng', 'buffet', 'lễ tân', 'reception', 'bãi xe', 'bar', 'quầy bar', 'sky bar', 'quán bar', 'quầy ba', 'sky ba', 'rooftop ba', 'quán ba', 'lên ba', 'đi ba', 'ba ở đâu', 'cà phê', 'cafe', 'phòng'
  ].some((k) => p.includes(k));

  const room4xxMatch = p.match(/\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(40[1-9]|410)\b/);
  const room3xxMatch = p.match(/\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(30[1-9]|310)\b/);

  // Phân biệt yêu cầu dịch vụ / buồng phòng / F&B (có kèm số phòng) với câu hỏi đường lên phòng
  const serviceOrderIndicators = [
    'đặt', 'dat', 'gọi', 'goi', 'order', 'mang', 'giao', 'lấy', 'lay',
    'đem', 'gửi', 'gui', 'chuyển', 'chuyen', 'thêm', 'them', 'mượn', 'muon',
    'dọn', 'don', 'sửa', 'sua', 'hỏng', 'hong', 'báo thức', 'cần', 'can',
    'làm phiền', 'phục vụ', 'phuc vu',
    // Danh từ vật phẩm, tiện ích phòng và F&B
    'nước', 'nuoc', 'chai nước', 'nước suối', 'nước khoáng', 'nước lọc',
    'khăn', 'khan', 'khăn tắm', 'khăn mặt', 'gối', 'goi', 'chăn', 'chan', 'mền', 'men',
    'nệm', 'nem', 'ga giường', 'dép', 'dep', 'bàn ủi', 'ban ui', 'bàn là', 'ban la',
    'máy sấy', 'may say', 'bàn chải', 'ban chai', 'kem đánh răng', 'dao cạo', 'dao cao',
    'dầu gội', 'dau goi', 'sữa tắm', 'sua tam', 'áo choàng', 'ao choang',
    'đồ ăn', 'do an', 'thức ăn', 'thuc an', 'món ăn', 'mon an', 'cơm', 'phở', 'pho', 'mì', 'mi',
    'pizza', 'bánh mì', 'cà phê', 'cafe', 'trà', 'tra', 'đá lạnh', 'da lanh',
    'ly', 'cốc', 'coc', 'chén', 'chen', 'bát', 'bat', 'dĩa', 'dia', 'đĩa', 'muỗng', 'muong', 'thìa', 'thia'
  ];

  const explicitNavPhrases = [
    'ở đâu', 'o dau', 'chỗ nào', 'cho nao', 'nơi nào', 'noi nao',
    'hướng nào', 'huong nao', 'lối nào', 'loi nao', 'đường nào', 'duong nao',
    'đi hướng nào', 'đi lối nào', 'đi đường nào',
    'chỉ đường', 'chi duong', 'dẫn đường', 'dan duong', 'hướng dẫn đường',
    'lối đi', 'loi di', 'lối lên', 'loi len', 'lối xuống', 'loi xuong',
    'đường đến', 'duong den', 'đường đi', 'duong di', 'đường lên', 'duong len', 'đường về', 'duong ve',
    'cách đi', 'cach di', 'cách đến', 'cach den', 'làm sao để đến', 'lam sao de den',
    'tìm phòng', 'tim phong', 'tìm đường', 'tim duong',
    'where is', 'where are', "where's", 'which way', 'which floor', 'how do i get', 'how to get', 'show me the way', 'directions to', 'lead me to', 'take me to'
  ];

  const hasItemOrderPattern = /(?:cho|gửi|mang|đem|giao)\s+(?:tôi|toi|em|anh|chị|chi|mình|minh)\s+(?:xin|mượn|muon|\d+|một|hai|ba|bốn|năm|vài|chai|ly|cốc|đĩa|bát|tô|phần|suất|khăn|gối|chăn|mền|bàn|máy|nước|đồ|cơm|phở)/i.test(p);
  const isServiceOrderContext = hasItemOrderPattern || serviceOrderIndicators.some((w) => p.includes(w));
  const hasExplicitNav = explicitNavPhrases.some((w) => p.includes(w));

  // Khi có yêu cầu dịch vụ hoặc mang đồ lên phòng mà không có cụm từ hỏi đường tường minh -> Tuyệt đối không coi là Navigation tới phòng
  if ((room4xxMatch || room3xxMatch || isGeneralRoomQuery) && isServiceOrderContext && !hasExplicitNav) {
    return null;
  }

  const roomNavMatch = Boolean((room4xxMatch || room3xxMatch || isGeneralRoomQuery) && (!isServiceOrderContext || hasExplicitNav));

  const hasNavIntent = roomNavMatch ||
    navIntentKeywords.some((k) => p.includes(k)) ||
    directLocPhrases.some((k) => p.includes(k)) ||
    isShortLocation;

  if (!hasNavIntent) return null;

  // 1. Nhận diện phòng 4xx (401 -> 409) khi có ý định hỏi đường
  if (roomNavMatch && room4xxMatch) return `room_${room4xxMatch[1]}`;

  // 2. Nhận diện phòng 3xx (301 -> 309) khi có ý định hỏi đường
  if (roomNavMatch && room3xxMatch) return `room_${room3xxMatch[1]}`;

  // 3. Nhà vệ sinh (Chỉ kích hoạt khi hỏi nhà vệ sinh / đi vệ sinh, loại trừ đồ vệ sinh cá nhân, băng vệ sinh, dọn dẹp)
  const isToiletQuery = ['nhà vệ sinh', 'nha ve sinh', 'phòng vệ sinh', 'phong ve sinh', 'đi vệ sinh', 'di ve sinh', 'toilet', 'tolet', 'toa lét', 'to lét', 'toilét', 'toalet', 'tô lét', 'toilette', 'wc', 'restroom', 'rest room', 'washroom', 'đi toilet', 'đi tolet', 'đi toa lét', 'chỗ rửa tay', 'nơi rửa tay', 'chỗ đi vệ sinh', 'nơi đi vệ sinh'].some((k) => p.includes(k)) ||
    ((p.includes('vệ sinh') || p.includes('ve sinh')) && ['đi', 'di', 'lối', 'loi', 'hướng', 'huong', 'tầng', 'tang', 'lầu', 'lau', 'ở đâu', 'o dau', 'chỗ', 'cho', 'nơi', 'noi'].some((w) => p.includes(w)) && !['băng', 'bang', 'đồ', 'do', 'dọn', 'don', 'mua', 'bán', 'ban', 'cá nhân', 'ca nhan', 'tạp hóa', 'siêu thị', 'tampon', 'giấy'].some((neg) => p.includes(neg)));

  if (isToiletQuery) {
    if (['tầng 2', 'tang 2', 'lầu 2', 'lau 2', 'f2', 'floor 2', 'nhà hàng', 'bếp', 'kho'].some((k) => p.includes(k))) return 'restroom_f2';
    return 'restroom_ground';
  }

  // 4. Nhà hàng & F&B
  if (['nhà bếp', 'nha bep', 'khu bếp', 'bếp chính', 'kitchen'].some((k) => p.includes(k))) return 'kitchen';
  if (['sơ chế', 'so che', 'chuẩn bị món', 'preparation'].some((k) => p.includes(k))) return 'preparation_area';
  if (['kho hàng', 'kho hang', 'kho nguyên liệu', 'kho thực phẩm', 'warehouse'].some((k) => p.includes(k))) return 'warehouse';
  if (['nhà hàng', 'nha hang', 'buffet', 'ăn sáng', 'quầy nhận món', 'pickup', 'restaurant'].some((k) => p.includes(k))) return 'restaurant';

  // 5. Tầng 5 & 6 tiện ích
  if (['hồ bơi', 'ho boi', 'bể bơi', 'pool', 'bơi'].some((k) => p.includes(k))) return 'infinity_pool';
  if (['rooftop', 'cafe', 'cà phê', 'coffee'].some((k) => p.includes(k))) return 'rooftop_coffee';
  if (['quầy bar', 'quay bar', 'sky bar', 'sky lounge', 'uống rượu', 'bar', 'quầy ba', 'quay ba', 'quán ba', 'quan ba', 'sky ba', 'rooftop ba', 'ba ở đâu', 'ba o dau', 'lên ba', 'len ba', 'đi ba', 'di ba', 'uống ở ba'].some((k) => p.includes(k))) return 'bar';
  if (['karaoke', 'hát karaoke', 'phòng hát'].some((k) => p.includes(k))) return 'karaoke';
  if (['gym', 'thể hình', 'the hinh', 'fitness', 'tập gym'].some((k) => p.includes(k))) return 'gym';
  if (['spa', 'massage', 'xông hơi', 'mát xa'].some((k) => p.includes(k))) return 'spa';
  if (['lưu niệm', 'gift shop', 'cửa hàng quà'].some((k) => p.includes(k))) return 'gift_shop';

  // 6. Tầng trệt & bãi xe
  if (['lễ tân', 'tiếp tân', 'quầy lễ tân', 'bàn lễ tân', 'front desk', 'check-in', 'check in', 'reception'].some((k) => p.includes(k))) return 'front_desk';
  if (['xe máy', 'gửi xe máy', 'bãi xe máy', 'xe đạp', 'hầm b1'].some((k) => p.includes(k))) return 'parking_bike';
  if (['đỗ ô tô', 'bãi ô tô', 'bãi xe ô tô', 'hầm b2', 'xe hơi', 'bãi xe', 'đỗ xe', 'gửi xe', 'parking'].some((k) => p.includes(k))) return 'parking_car';

  // 7. Nếu người dùng hỏi đường về phòng chung chung (không có số phòng cụ thể)
  if (isGeneralRoomQuery) {
    const explicitNavWords = [
      'chỉ đường', 'chi duong', 'đường lên', 'duong len', 'đường về', 'duong ve',
      'dẫn tôi', 'dan toi', 'lối lên', 'loi len', 'hướng dẫn lên', 'về phòng', 'lên phòng'
    ];
    if (explicitNavWords.some((w) => p.includes(w))) {
      if (activeRoomNumber && /^(?:40[1-9]|410|30[1-9]|310)$/.test(String(activeRoomNumber).trim())) {
        return `room_${String(activeRoomNumber).trim()}`;
      }
    }
    return null; // Không hardcode bất kỳ phòng nào, để robot hỏi lại số phòng
  }

  // Nếu người dùng hỏi đường/bản đồ chung chung ("cho tôi xem bản đồ", "chỉ đường cho tôi", "bản đồ khách sạn")
  if (['bản đồ', 'sơ đồ', 'map', 'chỉ đường', 'directions'].some((k) => p.includes(k))) return 'infinity_pool';

  return null;
};

// Danh sách các cơ sở vật chất chính của khách sạn cho bộ chọn nhanh
export const HOTEL_KEY_FACILITIES = [
  { key: 'room_401', name: 'Phòng Nghỉ Cao Cấp (401 - 409)', floor: 'TẦNG 4' },
  { key: 'room_301', name: 'Phòng Nghỉ Tiêu Chuẩn (301 - 309)', floor: 'TẦNG 3' },
  { key: 'infinity_pool', name: 'Hồ Bơi Vô Cực Nước Ấm', floor: 'TẦNG 5' },
  { key: 'spa', name: 'Thảo Mộc Spa & Massage', floor: 'TẦNG 5' },
  { key: 'gym', name: 'Trung Tâm Fitness & Gym', floor: 'TẦNG 5' },
  { key: 'restaurant', name: 'Bếp Trung Tâm & Room Service 24/7', floor: 'TẦNG 2' },
  { key: 'rooftop_coffee', name: 'Rooftop Sky Bar & Cafe', floor: 'TẦNG 6' },
  { key: 'front_desk', name: 'Quầy Lễ Tân & Sảnh', floor: 'TẦNG TRỆT' },
  { key: 'parking_car', name: 'Bãi Đỗ Xe & Sạc EV', floor: 'HẦM B2' },
];
