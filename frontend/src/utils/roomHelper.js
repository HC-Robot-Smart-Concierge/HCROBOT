const WORD_TO_DIGIT = {
  'không': '0', 'khong': '0', 'linh': '0', 'lẻ': '0', 'le': '0',
  'một': '1', 'mot': '1', 'mốt': '1', '1': '1',
  'hai': '2', '2': '2',
  'ba': '3', '3': '3',
  'bốn': '4', 'bon': '4', 'tư': '4', 'tu': '4', '4': '4',
  'năm': '5', 'nam': '5', 'lăm': '5', 'lam': '5', '5': '5',
  'sáu': '6', 'sau': '6', '6': '6',
  'bảy': '7', 'bay': '7', 'bẩy': '7', '7': '7',
  'tám': '8', 'tam': '8', '8': '8',
  'chín': '9', 'chin': '9', '9': '9',
};

/**
 * Trích xuất số phòng từ câu nói thoại của khách (hỗ trợ cả chữ số và số nói tiếng Việt)
 * @param {string} text - Câu nói của khách
 * @returns {string|null} - Số phòng chuẩn hóa (vd: "301", "402") hoặc null
 */
export function extractSpokenRoomNumber(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();

  // 1. Cụm từ có tiền tố phòng: phòng 301, room 301, vô phòng 301, vào phòng 301, lên phòng 301, cho phòng 301
  const explicitMatch = clean.match(
    /(?:phòng|phong|room|p\.|p|số\s+phòng|vô\s+phòng|vào\s+phòng|lên\s+phòng|cho\s+phòng|về\s+phòng|tới\s+phòng|đến\s+phòng)\s*(?:(?:của\s+)?(?:tôi|em|anh|chị|mình|khách)\s*)?(?:là|la|số|so)?\s*([1-9][0-9]{2,3})\b/i
  );
  if (explicitMatch) return explicitMatch[1];

  // 2. Mẫu cư trú: tôi ở phòng 301, mình ở 305, staying in 402
  const stayMatch = clean.match(
    /(?:tôi ở|anh ở|chị ở|em ở|mình ở|toi o|anh o|chi o|em o|minh o|i am in|staying in)\s*(?:phòng|phong|room)?\s*([1-9][0-9]{2,3})\b/i
  );
  if (stayMatch) return stayMatch[1];

  // 3. Số phòng bằng chữ nói tiếng Việt có "lẻ" / "linh" / "không": ba lẻ một, ba lẻ 1, 3 lẻ 1, bốn lẻ hai, ba trăm lẻ một
  const patSpoken1 = clean.match(
    /(?:phòng|phong|room|p\.|p)?\s*(?:số|so)?\s*\b(một|hai|ba|bốn|tư|năm|sáu|bảy|bẩy|tám|chín|[1-9])\s+(?:trăm\s+)?(?:lẻ|linh|không|khong|le)\s+(một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín|[0-9])\b/i
  );
  if (patSpoken1) {
    const d1 = WORD_TO_DIGIT[patSpoken1[1].toLowerCase()];
    const d2 = WORD_TO_DIGIT[patSpoken1[2].toLowerCase()];
    if (d1 && d2) return `${d1}0${d2}`;
  }

  // 4. Ba chữ số nói liên tiếp: ba không một, ba một hai
  const patSpoken2 = clean.match(
    /(?:phòng|phong|room|p\.|p)\s*(?:số|so)?\s*\b(một|hai|ba|bốn|tư|năm|sáu|bảy|bẩy|tám|chín|[1-9])\s+(không|khong|linh|một|hai|ba|bốn|tư|năm|sáu|bảy|bẩy|tám|chín|[0-9])\s+(một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín|[0-9])\b/i
  );
  if (patSpoken2) {
    const d1 = WORD_TO_DIGIT[patSpoken2[1].toLowerCase()];
    const d2 = WORD_TO_DIGIT[patSpoken2[2].toLowerCase()];
    const d3 = WORD_TO_DIGIT[patSpoken2[3].toLowerCase()];
    if (d1 && d2 && d3) return `${d1}${d2}${d3}`;
  }

  // 5. Số 3-4 chữ số độc lập trong câu (loại trừ các năm dương lịch 2020-2035)
  const standaloneMatch = clean.match(/\b([1-9][0-9]{2,3})\b/);
  if (standaloneMatch) {
    const val = parseInt(standaloneMatch[1], 10);
    if (val < 2020 || val > 2035) {
      return standaloneMatch[1];
    }
  }

  return null;
}

