export const isTaxiAction = (action) => ['taxi', 'book_taxi', 'taxi_booking'].includes(action);

export function canOpenVoiceVideoCall(response, taxiInProgress = false) {
  return Boolean(response?.trigger_video_call)
    && !taxiInProgress
    && !isTaxiAction(response?.action)
    && !isTaxiAction(response?.pending_service_action);
}

// A room number or a sentence merely containing "có / gọi / help" is not consent.
// This is used only for the answer to the optional emotion-assistance question.
export function assistanceReplyIntent(text) {
  const reply = String(text || '').normalize('NFC').trim().toLowerCase().replace(/[.!?,]+$/g, '');
  if (/^(?:không(?: cần)?(?: gọi)?(?: nữa)?(?: ạ)?|thôi|hủy|tự làm|tự xử lý|no(?: thanks)?|cancel|dismiss)$/.test(reply)) return 'dismiss';
  if (/^(?:có(?: ạ)?|vâng(?: ạ)?|dạ(?: vâng)?|đồng ý|yes(?: please)?|please do|gọi (?:giúp|giùm)(?: tôi| mình| em)?|gọi (?:cho )?nhân viên(?: giúp tôi)?|call (?:the )?staff(?: please)?)$/.test(reply)) return 'confirm';
  return null;
}
