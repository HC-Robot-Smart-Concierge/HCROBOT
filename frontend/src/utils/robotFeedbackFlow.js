/**
 * Pure helpers for the robot follow-up prompt and feedback completion flow.
 */

const DECLINING_EXACT_RE =
  /^(không|ko|thôi|dạ không|không ạ|thôi ạ|dạ thôi|không đâu|hết rồi|xong rồi|đủ rồi|được rồi|thôi được rồi|ok rồi|ok ạ|no|nope|no more|nothing|that's all|thats all|all good|done)[\s.,!?]*$/i;

const DECLINING_PHRASE_RE =
  /(không còn(?: gì)?(?: cần)? hỗ trợ|khong con(?: gi)?(?: can)? ho tro|không còn gì(?: nữa)?|khong con gi(?: nua)?|không cần hỗ trợ|khong can ho tro|không cần gì(?: thêm| nữa)?|khong can gi(?: them| nua)?|không cần nữa|khong can nua|không cần đâu|khong can dau|không cần em|không cần rora|không cần robot|ko cần(?: nữa)?|dạ không cần|thôi không cần|thôi khỏi|khỏi cần|không có yêu cầu gì thêm|không có gì nữa|hiện tại không cần|tạm thời chưa cần|chưa cần gì thêm|dạ hết rồi|dạ xong rồi|hết rồi ạ|xong rồi ạ|đủ rồi ạ|hết yêu cầu|xong hết rồi)/i;

const THANKS_OR_FAREWELL_RE =
  /(cảm ơn|cám ơn|cam on|tạm biệt|tam biet|hẹn gặp lại|kết thúc phiên|kết thúc|no thanks|no thank you|nothing else|no more help|no further assistance|nothing more|do not need anything|don't need anything|i'm good|im good|that's all|thats all|that is all|thank you|thanks|\bbye\b|\bgoodbye\b)/i;

const EXPLICIT_NEW_INTENT_RE =
  /(ở đâu|o dau|mấy giờ|may gio|chỉ đường|chi duong|lối đi|loi di|hướng dẫn đường|bể bơi|hồ bơi|nhà hàng|phòng gym|\bspa\b|wifi|mật khẩu|mở menu|mở thực đơn|xem menu|xem thực đơn|\bmenu\b|gọi món|cho tôi đặt|muốn đặt|đặt món lên|đặt thêm|gọi đồ ăn|đặt xe|gọi xe|gọi taxi|đặt taxi|dọn phòng|khăn tắm|lấy giúp|lấy thêm|mang thêm|mang lên|sửa giúp|bị hỏng|bị hư|báo thức|giặt ủi|kiểm tra|tiến độ|trạng thái|gặp nhân viên|gọi nhân viên|video call|đặt bàn|(?:tôi|mình|anh|chị|em)\s*(?:cần|muốn)\s*(?:em\s*)?hỗ trợ\s*thêm|where is|what time|check status|order food|book taxi|call staff)/i;

const FOLLOW_UP_ALREADY_PRESENT_RE =
  /(hỗ trợ\s+(?:gì\s+thêm|thêm\s+gì)|(?:muốn|cần)\s+(?:em\s+|rora\s+)?hỗ\s+trợ|cần\s+(?:rora|em)\s+hỗ\s+trợ|giúp\s+gì\s+(?:cho\s+)?quý\s+khách|giúp\s+gì\s+thêm|further\s+assistance|assist\s+you\s+(?:further|today)|help\s+you\s+(?:further|today)|anything\s+else\s+(?:i|we)\s+can\s+(?:help|assist)|how\s+may\s+i\s+(?:help|assist)|how\s+can\s+i\s+help)/i;

const COMPLETED_SERVICE_ACTIONS = new Set([
  'maintenance',
  'bellman',
  'lost_found',
  'room_service',
  'housekeeping',
  'laundry',
  'restaurant',
  'wake_up',
  'cancel_service',
  'query_order_status',
]);

const NON_COMPLETED_ACTIONS = new Set([
  'taxi',
  'book_taxi',
  'taxi_booking',
  'concierge',
  'provide_room_number',
  'invalid_room',
  'open_food_menu',
  'open_room_service_menu',
  'open_maintenance_menu',
  'open_bellman_menu',
  'show_facilities',
]);

/**
 * Returns true when guest speech declines further assistance or expresses thanks/farewell
 * without requesting a new hotel action.
 */
export function isNoFurtherHelpOrThankYou(query) {
  const clean = String(query || '').normalize('NFC').trim();
  if (!clean) return false;

  if (EXPLICIT_NEW_INTENT_RE.test(clean)) {
    return false;
  }

  return (
    DECLINING_EXACT_RE.test(clean) ||
    DECLINING_PHRASE_RE.test(clean) ||
    THANKS_OR_FAREWELL_RE.test(clean)
  );
}

/**
 * Returns true if the robot's reply already invites the guest to ask for anything else.
 */
export function hasFollowUpPromptText(text) {
  if (!text) return false;
  return FOLLOW_UP_ALREADY_PRESENT_RE.test(String(text));
}

/**
 * Ensures a completed request reply politely asks whether the guest needs further assistance.
 */
export function appendFollowUpQuestion(text, isEn = false) {
  const base = String(text || '').trim();
  const suffix = isEn
    ? 'Would you like any further assistance?'
    : 'Quý khách có muốn em hỗ trợ gì thêm không ạ?';

  if (!base) return suffix;
  if (hasFollowUpPromptText(base)) return base;

  const endsWithPunct = /[.!?…]$/.test(base);
  return `${base}${endsWithPunct ? '' : '.'} ${suffix}`;
}

/**
 * Determines whether a chat response completes a service ticket/status action
 * that should trigger the silent auto-feedback timer when idle.
 */
export function isServiceCompletionAction(chatRes, { isRouteGuidance = false, willOpenModal = false } = {}) {
  if (!isCompletedRequestResponse(chatRes, { isRouteGuidance, willOpenModal })) return false;
  return COMPLETED_SERVICE_ACTIONS.has(chatRes?.action || '');
}

/**
 * Determines whether a chat response represents a completed request
 * (not waiting for PIN, room number, menu/modal interaction, video call, or route map).
 */
export function isCompletedRequestResponse(chatRes, { isRouteGuidance = false, willOpenModal = false } = {}) {
  if (!chatRes || isRouteGuidance || willOpenModal) return false;
  if (
    chatRes.require_room_pin ||
    chatRes.missing_room_number ||
    chatRes.waiting_for_wakeup_time ||
    chatRes.trigger_menu ||
    chatRes.trigger_video_call
  ) {
    return false;
  }

  const action = chatRes.action || '';
  if (NON_COMPLETED_ACTIONS.has(action)) {
    return false;
  }

  // Do not append follow-up question to invalid-room / check-in errors, wake-up time prompts, or closing/farewell prompts.
  const replyLower = String(chatRes.response || '').toLowerCase();
  if (
    /không có phòng|does not have room|không tồn tại|chưa làm thủ tục nhận phòng|chưa check-in|xin số phòng|nhập mã pin|4-digit room pin|enter your pin|đặt báo thức lúc mấy giờ|schedule your wake-up call|đánh giá dịch vụ|rate our service|tạm biệt|goodbye|hẹn gặp lại/.test(
      replyLower
    )
  ) {
    return false;
  }

  return true;
}
