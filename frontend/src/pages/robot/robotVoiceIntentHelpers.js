import { extractSpokenRoomNumber, isValidHotelRoom } from '../../utils/roomHelper';

export function createKioskSessionId() {
  return 'session_kiosk_' + Math.random().toString(36).substring(2, 9);
}

export function isDismissDirectionsPhrase(lowerQuery) {
  return [
    'đã nhớ', 'nhớ rồi', 'tôi nhớ', 'ok tôi', 'hiểu rồi', 'tôi hiểu',
    'cảm ơn', 'cảm ơn em', 'cảm ơn robot', 'cảm ơn nhiều', 'thank', 'thanks', 'thank you',
    'xong rồi', 'được rồi', 'biết rồi', 'ok rora', 'ok robot', 'ok em', 'dạ rồi', 'đóng',
    'ok tôi đã nhớ', 'tôi đã nhớ', 'ok đã nhớ', 'ok cảm ơn', 'dạ cảm ơn',
    'đã rõ', 'rõ rồi', 'mình nhớ rồi', 'mình hiểu rồi', 'mình đã nhớ', 'ok rùi',
    'got it', 'i got it', 'i understand', 'i remember',
  ].some((k) => lowerQuery.includes(k));
}

export function isDecliningFurtherHelp(lowerQuery) {
  const isDecliningMoreHelp =
    /^(không|ko|thôi|dạ không|không ạ|thôi ạ|không cần|ko cần|không cần đâu|không cần nữa|dạ thôi|hết rồi|xong rồi|đủ rồi|được rồi|thôi được rồi|thôi cảm ơn|cảm ơn|thanks|thank you)[\s\.\!\?]*$/i.test(lowerQuery.trim()) ||
    /(không cần nữa|không cần đâu|không cần em|không cần rora|không cần robot|ko cần nữa|không cần|ko cần|dạ không cần|thôi không cần|thôi khỏi|khỏi cần|dạ hết rồi|dạ xong rồi|hết rồi ạ|xong rồi ạ|đủ rồi ạ)/i.test(lowerQuery) ||
    /(tạm biệt|hẹn gặp lại|kết thúc phiên|kết thúc|bye|goodbye|that's all|thats all|nothing else|no thanks|no thank you)/i.test(lowerQuery);
  const hasExplicitNewIntent = /(ở đâu|chỉ đường|lối đi|hướng dẫn đường|bể bơi|hồ bơi|nhà hàng|phòng gym|spa|menu|thực đơn|gọi món|đặt món|đặt xe|taxi|dọn phòng|lấy giúp|sửa giúp|hỏng|báo thức)/i.test(lowerQuery);
  return isDecliningMoreHelp && !hasExplicitNewIntent;
}

export function classifyStatusOrOrderIntent(lowerQuery) {
  const hasExplicitOrderVerb = /đặt|gọi|order|xin|muốn đặt|cần đặt|muốn gọi|cần gọi|đặt thêm|thêm dịch vụ|yêu cầu dịch vụ/i.test(lowerQuery);
  const hasRealStatusKeyword = /tiến độ|trạng thái|xong chưa|nấu xong|làm xong|dọn xong|dọn tới|dọn đến|nấu tới|làm tới|khi nào có|bao giờ có|tới đâu|đến đâu|kiểm tra đơn|kiểm tra món|tình trạng món|tình trạng dọn|tiến độ dọn|khăn tắm mang lên|mang lên chưa|giao chưa|tới phòng chưa|đến phòng chưa|lên phòng chưa|đã tới phòng|đã đến phòng|tới chưa|đến chưa|lên chưa|mang tới chưa|giao tới chưa|có chưa|đã có|tình trạng dịch vụ|tiến độ dịch vụ/i.test(lowerQuery);
  const isStatusQueryPrompt =
    hasRealStatusKeyword &&
    (!hasExplicitOrderVerb || /chưa|tới đâu|đến đâu|tiến độ|trạng thái|xong chưa/i.test(lowerQuery));
  const isOrderIntent =
    !isStatusQueryPrompt &&
    /đặt món|gọi món|order|chọn món|thực đơn|menu|muốn ăn|đặt đồ ăn|gọi đồ ăn|đặt dịch vụ|thêm dịch vụ/i.test(lowerQuery);

  return { isStatusQueryPrompt, isOrderIntent };
}

export function detectSpokenValidRoom(query) {
  const rawSpokenRoom = extractSpokenRoomNumber(query);
  return rawSpokenRoom && isValidHotelRoom(rawSpokenRoom) ? rawSpokenRoom : null;
}

export function isEnglishQueryText(language, query) {
  return (
    language === 'English' ||
    /\b(where|what|when|how|who|why|which|is|are|the|room|hotel|breakfast|pool|gym|wifi|can|could|please|help|check|out|in|service)\b/i.test(query)
  );
}

export function resolveStatusQueryTypeFromText(lowerQuery, apiStatusQueryType) {
  if (apiStatusQueryType) return apiStatusQueryType;
  const isHousekeepingQuery = /dọn|don|buồng|buong|khăn|khan|gối|goi|chăn|chan|massage|mát xa|mat xa|spa|giặt|giat|dịch vụ|dich vu|room service|buồng phòng/i.test(lowerQuery);
  const isFoodQuery = /món|mon|món ăn|mon an|bếp|bep|nấu|nau|uống|uong|đồ ăn|do an|cơm|com|phở|pho|pizza/i.test(lowerQuery);
  const isTaxiQuery = /taxi|xe|đưa đón|dua don|chuyến xe|cuốc xe/i.test(lowerQuery);
  const isBellQuery = /hành lý|hành lí|hanh ly|hanh li|vali|luggage|suitcase|\bbags?\b|bellman/i.test(lowerQuery);

  if (isBellQuery) return 'bellman';
  if (isTaxiQuery) return 'taxi';
  if (isHousekeepingQuery && !isFoodQuery) return 'service';
  if (isFoodQuery && !isHousekeepingQuery) return 'food';
  return 'general';
}

export function resolveEyeExpressionForQuery(lowerQuery, apiEyeExpression) {
  if (apiEyeExpression && apiEyeExpression !== 'none') {
    return apiEyeExpression;
  }
  if (['nhìn lên', 'ngước lên', 'đánh mắt lên', 'trên trần', 'đèn trần', 'tầng trên', 'thời tiết hôm nay', 'bầu trời', 'look up'].some((k) => lowerQuery.includes(k))) {
    return 'look_up';
  }
  if (['bên trái', 'phía trái', 'liếc trái', 'rẽ trái', 'quầy bên trái', 'look left'].some((k) => lowerQuery.includes(k))) {
    return 'look_left';
  }
  if (['bên phải', 'phía phải', 'liếc phải', 'rẽ phải', 'quầy bên phải', 'look right'].some((k) => lowerQuery.includes(k))) {
    return 'look_right';
  }
  if (['nhìn quanh', 'đảo mắt', 'xung quanh', 'ngắm nhìn', 'tham quan', 'khách sạn có gì', 'look around'].some((k) => lowerQuery.includes(k))) {
    return 'look_around';
  }
  return null;
}

export function resolveSafeNavigationKey({
  chatRes,
  fastDestKey,
  lowerQuery,
  isStatusAction,
  isStatusQueryPrompt,
  isWaitingRoomForStatus,
  effectiveRoomNumber,
}) {
  const isStatusInquiry = isStatusAction || isStatusQueryPrompt || isWaitingRoomForStatus;
  const isServiceAction =
    [
      'room_service', 'housekeeping', 'laundry', 'maintenance', 'bellman',
      'open_maintenance_menu', 'open_bellman_menu', 'open_food_menu', 'open_room_service_menu',
      'book_taxi', 'taxi', 'taxi_booking', 'query_order_status',
    ].includes(chatRes.action) ||
    ['maintenance', 'bellman', 'food_menu', 'room_service'].includes(chatRes.trigger_menu) ||
    Boolean(chatRes.require_room_pin) ||
    Boolean(chatRes.pending_service_action);

  const isRoomDirectionQuery =
    !isStatusInquiry &&
    !isServiceAction &&
    ['phòng', 'room', 'lên phòng', 'về phòng', 'đến phòng', 'tìm phòng'].some((k) =>
      lowerQuery.includes(k)
    );
  const roomFallbackKey = isRoomDirectionQuery
    ? effectiveRoomNumber && isValidHotelRoom(effectiveRoomNumber)
      ? `room_${String(effectiveRoomNumber).trim()}`
      : null
    : null;

  const effectiveFastDest = isServiceAction ? null : fastDestKey;
  const rawNavKey = chatRes.destination_key || effectiveFastDest || roomFallbackKey;
  let navTargetKey = isStatusInquiry || isServiceAction ? null : rawNavKey;
  if (navTargetKey && navTargetKey.startsWith('room_')) {
    const rNum = navTargetKey.replace('room_', '');
    if (!isValidHotelRoom(rNum)) {
      navTargetKey = null;
    }
  }

  if (
    chatRes.action === 'open_maintenance_menu' ||
    chatRes.trigger_menu === 'maintenance' ||
    chatRes.action === 'open_bellman_menu' ||
    chatRes.trigger_menu === 'bellman' ||
    chatRes.action === 'open_food_menu' ||
    chatRes.trigger_menu === 'food_menu' ||
    chatRes.action === 'open_room_service_menu' ||
    chatRes.trigger_menu === 'room_service'
  ) {
    navTargetKey = null;
  }
  return navTargetKey;
}

/**
 * Handles deterministic local voice shortcuts (dismissing active directions or declining further help)
 * before issuing a backend AI chat request. Returns true when handled.
 */
export function tryHandleQuickVoiceDirectives({
  lowerQuery,
  currentState,
  isAutoQrModalOpen,
  language,
  clearRouteGuidanceTimers,
  setIsAutoQrModalOpen,
  setQrCountdown,
  setNavigationDestinationKey,
  setCurrentState,
  stopSpeaking,
  stopListening,
  resetTranscript,
  isProcessingRef,
  setIsProcessing,
  setAiResponseText,
  speak,
  onRestartTalk,
  onOpenFeedback,
}) {
  if ((currentState === 'RT-05' || isAutoQrModalOpen) && isDismissDirectionsPhrase(lowerQuery)) {
    clearRouteGuidanceTimers();
    setIsAutoQrModalOpen(false);
    setQrCountdown(null);
    setNavigationDestinationKey(null);
    setCurrentState('RT-02');

    const isEn = language === 'English' || /^(thank|thanks|i got it|ok|got it)/i.test(lowerQuery);
    const ackText = isEn
      ? 'You are welcome! How may I assist you further?'
      : 'Dạ vâng, em có thể hỗ trợ gì thêm cho quý khách ạ?';

    stopSpeaking();
    stopListening();
    resetTranscript();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setAiResponseText(ackText);
    speak(
      ackText,
      isEn ? 'en-US' : 'vi-VN',
      () => {
        isProcessingRef.current = false;
        setIsProcessing(false);
        setAiResponseText('');
        setTimeout(() => onRestartTalk(), 100);
      },
      () => setAiResponseText(ackText)
    );
    return true;
  }

  if (isDecliningFurtherHelp(lowerQuery)) {
    clearRouteGuidanceTimers();
    stopSpeaking();
    stopListening();
    resetTranscript();
    isProcessingRef.current = false;
    setIsProcessing(false);
    const isEn = language === 'English' || /^(no|nope|thanks|thank|bye|all good|that)/i.test(lowerQuery);
    const farewellMsg = isEn
      ? 'Rora is delighted to assist you! Please take a quick moment to rate our service.'
      : 'Dạ vâng, Rora rất vui được hỗ trợ quý khách! Quý khách dành chút thời gian đánh giá dịch vụ giúp em nhé ạ.';
    setAiResponseText(farewellMsg);
    speak(
      farewellMsg,
      isEn ? 'en-US' : 'vi-VN',
      () => setTimeout(() => onOpenFeedback(), 300),
      () => setAiResponseText(farewellMsg)
    );
    return true;
  }

  return false;
}
