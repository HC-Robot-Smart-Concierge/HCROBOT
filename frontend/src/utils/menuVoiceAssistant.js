/**
 * Shared voice command & catalog matching utilities for all Robot Kiosk service menus
 * (Food Menu, Room Service, Bellman, Maintenance).
 */

import { extractSpokenRoomNumber, isValidHotelRoom } from './roomHelper';

// Diacritic-preserved number words prevent "tắm" (bath) -> "tám" (8) or "nấm" (mushroom) -> "năm" (5).
const ACCENTED_NUMBER_WORDS = {
  'một': 1, mot: 1, one: 1,
  hai: 2, two: 2,
  ba: 3, three: 3,
  'bốn': 4, 'tư': 4, four: 4,
  'năm': 5, five: 5,
  'sáu': 6, six: 6,
  'bảy': 7, 'bẩy': 7, seven: 7,
  'tám': 8, eight: 8,
  'chín': 9, nine: 9,
  'mười': 10, muoi: 10, ten: 10,
};

// Keep conversational fillers diacritic-safe so words like "tắm", "bò", "đá", "nấm", "phòng" stay intact.
const ACCENTED_FILLERS = new Set([
  'cho', 'tôi', 'toi', 'mình', 'minh', 'em', 'anh', 'chị', 'chi', 'quý', 'quy', 'khách', 'khach',
  'xin', 'lấy', 'lay', 'thêm', 'them', 'đặt', 'dat', 'gọi', 'goi', 'mang', 'đem', 'dem', 'gửi', 'gui',
  'muốn', 'muon', 'cần', 'can', 'order', 'bring', 'send', 'give', 'me', 'please', 'lên', 'len',
  'giúp', 'giup', 'với', 'voi', 'nhé', 'nhe', 'nha', 'ạ', 'a', 'dạ', 'da', 'vâng', 'vang',
  'phần', 'phan', 'suất', 'suat', 'tô', 'to', 'bát', 'bat', 'đĩa', 'dia', 'ly', 'cốc', 'coc',
  'chai', 'cái', 'cai', 'chiếc', 'chiec', 'lượt', 'luot', 'bộ', 'báo', 'bao', 'sửa', 'sua',
  'hỗ', 'ho', 'trợ', 'tro', 'hỏng', 'hong', 'bị', 'bi', 'gấp', 'gap', 'ngay', 'luôn', 'luon',
  'và', 'va', 'cùng', 'cung', 'một', 'mot', 'hai', 'ba', 'bốn', 'bon', 'năm', 'sáu', 'bảy',
  'tám', 'chín', 'chin', 'xác', 'xac', 'nhận', 'nhan', 'đồng', 'dong', 'ý', 'y',
  'for', 'of', 'in', 'with', 'the',
]);

export function normalizeVoiceText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractRoomIfValid(text) {
  const candidate = extractSpokenRoomNumber(text);
  return candidate && isValidHotelRoom(candidate) ? String(candidate).trim() : null;
}

export function isMenuDismissVoice(text) {
  const norm = normalizeVoiceText(text);
  if (!norm) return false;
  return /^(?:da\s+|ok\s+|vang\s+)?(?:dong|thoat|quay lai|tro ve|close|back|exit|cancel|huy|khong can nua|thoi|cam on|thanks|thank you)(?:\s+(?:menu|man hinh|robot|di|nhe|nha|a|em|rora|nhieu|ban|giup))*$/.test(norm);
}

export function isMenuConfirmVoice(text) {
  const norm = normalizeVoiceText(text);
  if (!norm) return false;
  return /(?:^|\b)(?:xac nhan|chot don|dat ngay|dat luon|gui don|gui yeu cau|gui ngay|gui luon|bao ngay|bao luon|dong y|ok dat|ok gui|confirm|submit|place order|send request)(?:\b|$)/.test(norm);
}

export function isMenuStatusVoice(text) {
  const norm = normalizeVoiceText(text);
  if (!norm) return false;
  return /(?:kiem tra|trang thai|tien do|xong chua|toi dau|status|check progress)/.test(norm);
}

export function extractVoiceQuantity(clause) {
  const rawLower = String(clause || '')
    .toLowerCase()
    .replace(/\b(?:phòng|phong|room|p)\s*\d{3,4}\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const digitMatch = rawLower.match(/\b(\d{1,2})\b/);
  if (digitMatch) {
    const val = parseInt(digitMatch[1], 10);
    if (val >= 1 && val <= 20) return val;
  }
  for (const tok of rawLower.split(' ')) {
    if (ACCENTED_NUMBER_WORDS[tok]) return ACCENTED_NUMBER_WORDS[tok];
  }
  return 1;
}

function stripFillersForMatch(clause) {
  const rawCleaned = String(clause || '')
    .toLowerCase()
    .replace(/\b(?:phòng|phong|room|p)\s*\d{3,4}\b/gi, ' ')
    .replace(/(?:^|\s)(?:xác nhận|xac nhan|chốt đơn|chot don|đặt ngay|dat ngay|đặt luôn|dat luon|gửi đơn|gui don|gửi yêu cầu|gui yeu cau|gửi ngay|gui ngay|gửi luôn|gui luon)(?:\s|$)/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keptTokens = rawCleaned
    .split(' ')
    .filter((w) => w && !ACCENTED_FILLERS.has(w) && !/^\d+$/.test(w));

  return normalizeVoiceText(keptTokens.join(' '));
}

/**
 * Matches spoken text against catalog items (menu món ăn or dịch vụ phòng).
 * Supports multi-item clauses split by "và", "với", "cùng", "," and accent-insensitive token scoring.
 */
export function matchCatalogItemsByVoice(transcript, catalog = []) {
  if (!transcript || !Array.isArray(catalog) || catalog.length === 0) return [];
  const rawClauses = String(transcript)
    .split(/(?:,|;|\s+(?:và|với|cùng|va|voi|cung|and|plus)\s+)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const clauses = rawClauses.length > 0 ? rawClauses : [String(transcript)];
  const matchedMap = new Map();

  const indexedCatalog = catalog.map((item) => {
    const rawName = item.name || item.name_vi || '';
    const normName = normalizeVoiceText(rawName);
    const nameTokens = normName.split(' ').filter((w) => w.length >= 2);
    const descNorm = normalizeVoiceText(item.description || item.description_vi || '');
    return { item, normName, nameTokens, descNorm };
  });

  for (const clause of clauses) {
    const cleanClause = stripFillersForMatch(clause);
    if (!cleanClause || cleanClause.length < 2) continue;
    const clauseTokens = cleanClause.split(' ').filter((w) => w.length >= 2);
    if (clauseTokens.length === 0) continue;

    let best = null;
    let bestScore = 0;

    for (const entry of indexedCatalog) {
      let score = 0;
      if (entry.normName === cleanClause) {
        score = 100;
      } else if (entry.normName.includes(cleanClause) && cleanClause.length >= 4) {
        score = 60 + cleanClause.length;
      } else if (cleanClause.includes(entry.normName) && entry.normName.length >= 4) {
        score = 55 + entry.normName.length;
      } else {
        const nameOverlap = clauseTokens.filter((t) => entry.nameTokens.includes(t)).length;
        if (nameOverlap >= 2 || (nameOverlap === 1 && clauseTokens.length === 1 && entry.nameTokens.length <= 3)) {
          score = nameOverlap * 15 - Math.abs(entry.nameTokens.length - nameOverlap);
          if (nameOverlap === clauseTokens.length) score += 10;
        } else {
          const descOverlap = clauseTokens.filter((t) => t.length >= 3 && entry.descNorm.includes(t)).length;
          if (descOverlap >= 2) score = descOverlap * 6;
        }
      }

      if (score > bestScore && score >= 14) {
        bestScore = score;
        best = entry.item;
      }
    }

    if (best) {
      const qty = extractVoiceQuantity(clause);
      const prev = matchedMap.get(best.id);
      matchedMap.set(best.id, {
        item: best,
        qty: prev ? prev.qty + qty : qty,
      });
    }
  }

  return Array.from(matchedMap.values());
}

const BELL_VOICE_RULES = [
  { key: 'room_move', patterns: ['chuyen phong', 'doi phong', 'sang phong', 'room move', 'move room'] },
  { key: 'luggage_retrieval', patterns: ['nhan lai hanh ly', 'lay lai hanh ly', 'lay hanh ly', 'tra hanh ly', 'retrieve', 'pick up stored'] },
  { key: 'luggage_storage', patterns: ['gui hanh ly', 'giu hanh ly', 'gui giu', 'cat hanh ly', 'store luggage', 'storage'] },
  { key: 'luggage_pickup', patterns: ['xuong sanh', 'mang xuong', 'chuyen xuong', 'check out', 'pickup from room'] },
  { key: 'luggage_delivery', patterns: ['len phong', 'mang hanh ly', 'xach hanh ly', 'ho tro hanh ly', 'deliver luggage', 'bellman'] },
];

export function matchBellmanVoiceCommand(transcript, serviceOptions = []) {
  const norm = normalizeVoiceText(transcript);
  if (!norm) return null;

  const isLostFound = /(?:that lac|bi mat|mat do|mat vi|mat tui|mat dien thoai|mat the|mat chia|quen do|de quen|bo quen|roi do|lam roi|tim do|lost|missing|forgot)/.test(norm);
  if (isLostFound) {
    return {
      isLostFound: true,
      service: null,
      bagCount: '1',
      roomNumber: extractRoomIfValid(transcript),
      rawText: transcript.trim(),
    };
  }

  let matchedKey = null;
  for (const rule of BELL_VOICE_RULES) {
    if (rule.patterns.some((p) => norm.includes(p))) {
      matchedKey = rule.key;
      break;
    }
  }

  const service = matchedKey
    ? serviceOptions.find((opt) => opt.key === matchedKey) || null
    : null;

  if (!service && norm.length < 4) return null;

  const qty = extractVoiceQuantity(transcript);
  const bagCount = qty >= 4 ? '4+' : String(Math.max(1, qty));

  return {
    isLostFound: false,
    service,
    bagCount,
    roomNumber: extractRoomIfValid(transcript),
    rawText: transcript.trim(),
  };
}

const MAINTENANCE_KEYWORD_MAP = [
  { cat: 'hvac', tokens: ['dieu hoa', 'may lanh', 'ac', 'air con', 'nong qua', 'khong lanh', 'chay nuoc'] },
  { cat: 'plumbing', tokens: ['nuoc nong', 'voi sen', 'bon cau', 'tac', 'nghet', 'ro ri', 'ong nuoc', 'bon rua', 'drain', 'leak', 'shower'] },
  { cat: 'electrical', tokens: ['mat dien', 'den', 'bong den', 'nhap nhay', 'o cam', 'power', 'light', 'outlet'] },
  { cat: 'door_lock', tokens: ['khoa tu', 'khoa cua', 'the tu', 'cua ban cong', 'tay nam cua', 'door lock', 'keycard'] },
  { cat: 'media_network', tokens: ['wifi', 'mang', 'internet', 'tivi', 'tv', 'dieu khien', 'remote'] },
  { cat: 'other', tokens: ['ket sat', 'tu lanh', 'minibar', 'safe', 'fridge'] },
];

export function matchMaintenanceVoiceIssue(transcript, catalog = []) {
  const norm = normalizeVoiceText(transcript);
  const cleanedClause = stripFillersForMatch(transcript);
  if (!norm || cleanedClause.length < 2) return null;

  const matched = matchCatalogItemsByVoice(transcript, catalog.map((c) => ({
    ...c,
    name: `${c.name_vi || ''} ${c.name_en || ''}`,
    description: `${c.description_vi || ''} ${c.description_en || ''}`,
  })));
  if (matched.length > 0) {
    return matched[0].item;
  }

  let matchedCat = null;
  for (const rule of MAINTENANCE_KEYWORD_MAP) {
    if (rule.tokens.some((tok) => norm.includes(tok))) {
      matchedCat = rule.cat;
      break;
    }
  }
  if (!matchedCat) return null;

  const catMatch = catalog.find((item) => item.category === matchedCat);
  if (catMatch) return catMatch;

  return {
    id: `MNT-VOICE-${Date.now()}`,
    category: matchedCat,
    name_vi: transcript.trim(),
    name_en: transcript.trim(),
    description_vi: transcript.trim(),
    description_en: transcript.trim(),
    priority: 'NORMAL',
    estimated_fix_time: 20,
  };
}
