const SCREENS = {
  LANGUAGE: ['Choose language', 'Chọn ngôn ngữ', '#0891B2'],
  MENU: ['Service menu', 'Menu dịch vụ', '#0891B2'],
  DINING: ['Dining menu', 'Menu ẩm thực', '#0891B2'],
  RECOMMENDATIONS: ['Recommendations', 'Danh sách gợi ý', '#D97706'],
  REQUEST: ['Service request form', 'Biểu mẫu dịch vụ', '#0891B2'],
  WAKEUP: ['Wake-up request form', 'Biểu mẫu báo thức', '#0891B2'],
  CONFIRMATION: ['Request confirmation', 'Xác nhận yêu cầu', '#059669'],
  STAFF: ['Waiting for staff', 'Chờ nhân viên hỗ trợ', '#D97706'],
  FEEDBACK: ['Service feedback', 'Đánh giá dịch vụ', '#059669'],
  MAP: ['Wayfinding map', 'Bản đồ chỉ đường', '#0891B2'],
  QR: ['QR code', 'Mã QR', '#0891B2'],
  PROMOTION_VIDEO: ['Promotional video', 'Video quảng cáo', '#E11D48'],
  PROMOTION_IMAGE: ['Promotional poster', 'Poster quảng cáo', '#E11D48'],
  PROMOTION: ['Promotion', 'Nội dung quảng cáo', '#E11D48'],
  VIDEO: ['Playing video', 'Đang chiếu video', '#6366F1'],
  IMAGE: ['Displaying image', 'Đang hiển thị hình ảnh', '#6366F1'],
  SLIDES: ['Slideshow', 'Trình chiếu slide', '#6366F1'],
  SCREEN: ['Displaying screen', 'Đang hiển thị màn hình', '#0891B2'],
};

const SCREEN_KEYS = {
  LANGUAGE_SELECT: 'LANGUAGE', LANGUAGE_SELECTOR: 'LANGUAGE', UI_LANG: 'LANGUAGE',
  MENU: 'MENU', UI_MAIN_MENU: 'MENU', UI_CATEGORIES: 'MENU', SERVICES_GRID: 'MENU',
  DINING_MENU: 'DINING', UI_RECOMMEND_LIST: 'RECOMMENDATIONS',
  UI_SERVICE_FORM: 'REQUEST', UI_WAKEUP_FORM: 'WAKEUP', UI_CONFIRMATION: 'CONFIRMATION',
  UI_WAITING_STAFF: 'STAFF', FEEDBACK: 'FEEDBACK', UI_RATING: 'FEEDBACK',
  MAP: 'MAP', MAP_WAYFINDING: 'MAP', MAP_LOBBY: 'MAP', MAP_LOBBY_GROUND: 'MAP', QR_CODE: 'QR',
  PROMO_VIDEO: 'PROMOTION_VIDEO', PROMO_IMAGE: 'PROMOTION_IMAGE', PROMO_SUMMER: 'PROMOTION',
  VIDEO: 'VIDEO', IMAGE: 'IMAGE', SLIDE: 'SLIDES',
};

export function simulatorScreenKind(params = {}) {
  params = params || {};
  // Explicit screen mode wins over legacy content/type and any leftover media fields.
  for (const value of [params.screen_mode, params.content_id, params.screen_type]) {
    const key = String(value || '').toUpperCase();
    if (SCREEN_KEYS[key]) return SCREEN_KEYS[key];
    if (key.startsWith('PROMO_')) return 'PROMOTION';
  }
  const mediaType = String(params.media_type || '').toUpperCase();
  if (mediaType === 'VIDEO' || /\.(mp4|webm|mov)(?:[?#]|$)/i.test(params.media_url || '')) return 'VIDEO';
  if (mediaType === 'IMAGE') return 'IMAGE';
  return 'SCREEN';
}

function status(code, en, vi, language, dotColor = '#059669', isMoving = false) {
  return { code, label: language === 'VI' ? vi : en, dotColor, isMoving };
}

export function simulatorShowStatus(params, language = 'EN') {
  const kind = simulatorScreenKind(params);
  const [en, vi, color] = SCREENS[kind];
  return status(`SHOW_${kind}`, en, vi, language, color);
}

export function simulatorRobotStatus({ step, language = 'EN', isMoving, manualNavLabel, isPaused, promotionInterrupted }) {
  if (isPaused) return status('PAUSED', 'Paused', 'Tạm dừng', language, '#D97706');
  if (promotionInterrupted) return status('GUEST', 'Serving guest', 'Đang tiếp khách', language, '#0D9488');
  const params = step?.params || {};
  if (isMoving || step?.type === 'MOVE' || manualNavLabel?.startsWith('Toi:')) {
    if (step?.type === 'MOVE' && (params.show_media_on_move || params.media_url || /^PROMO_/.test(params.screen_mode || ''))) {
      return status('MOVE_MEDIA', 'Moving · displaying media', 'Di chuyển · trình chiếu', language, '#6366F1', true);
    }
    if (step?.type === 'MOVE' && params.broadcast_speech) {
      return status('MOVE_SPEAK', 'Moving · speaking', 'Di chuyển · phát lời thoại', language, '#6366F1', true);
    }
    return status('NAV', 'Navigating', 'Đang di chuyển', language, '#262626', true);
  }
  if (step?.type === 'SHOW') return simulatorShowStatus(params, language);
  const actions = {
    GREET: ['Greeting guest', 'Đang chào khách'],
    SPEAK: ['Speaking', 'Đang phát lời thoại'],
    LISTEN: ['Listening', 'Đang lắng nghe'],
    COMMUNICATE: ['Talking with guest', 'Đang trò chuyện với khách'],
    RECOMMEND: ['Recommending services', 'Đang gợi ý dịch vụ'],
    CREATE_REQUEST: ['Service request', 'Yêu cầu dịch vụ'],
    CHOICE: ['Waiting for a choice', 'Chờ khách lựa chọn'],
    FEEDBACK: ['Collecting feedback', 'Đang nhận đánh giá'],
    WAIT: ['Waiting', 'Đang chờ'],
  };
  if (step) {
    const [en, vi] = actions[step.type] || ['Processing step', 'Đang thực hiện bước'];
    return status(step.type, en, vi, language);
  }
  return manualNavLabel?.startsWith('Da den')
    ? status('ARRIVED', 'Arrived', 'Đã đến nơi', language)
    : status('READY', 'Ready', 'Sẵn sàng', language);
}
