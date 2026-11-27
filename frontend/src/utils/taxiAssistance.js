export function normalizeTaxiSpeech(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

const NUMBER_WORDS = {
  mot: 1, one: 1, hai: 2, two: 2, ba: 3, three: 3, bon: 4, tu: 4, four: 4,
  nam: 5, five: 5, sau: 6, six: 6, bay: 7, seven: 7, tam: 8, eight: 8,
  chin: 9, nine: 9, muoi: 10, ten: 10, 'muoi mot': 11, eleven: 11,
  'muoi hai': 12, twelve: 12, 'muoi ba': 13, thirteen: 13, 'muoi bon': 14, fourteen: 14,
  'muoi lam': 15, fifteen: 15, 'muoi sau': 16, sixteen: 16, 'muoi bay': 17, seventeen: 17,
  'muoi tam': 18, eighteen: 18, 'muoi chin': 19, nineteen: 19, 'hai muoi': 20, twenty: 20,
};
const NUMBER = `(?:\\d{1,3}|${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')})`;
const asNumber = (value) => NUMBER_WORDS[value] || Number(value);

export function taxiVehicleLabel(vehicle, isEn = false) {
  if (!vehicle) return isEn ? 'Staff will arrange a suitable car' : 'Nhân viên chọn xe phù hợp';
  const seats = String(vehicle).match(/^(\d+)-Seater/);
  if (seats) return isEn ? `${seats[1]}-seater car` : `Xe ${seats[1]} chỗ`;
  const labels = {
    'Spacious car': ['Xe rộng, chở được nhiều hành lý', 'Spacious car'],
    Sedan: ['Xe sedan', 'Sedan'], SUV: ['Xe gầm cao', 'SUV'],
  };
  return labels[vehicle]?.[isEn ? 1 : 0] || vehicle;
}

// Extract only explicit passenger/seat counts. A room, option, suitcase or time is not a passenger count.
export function extractTaxiRequirements(text, { allowBareCount = false } = {}) {
  const clean = normalizeTaxiSpeech(text);
  const seat = [...clean.matchAll(new RegExp(`(?<![\\w-])(${NUMBER})[ -]*(?:cho\\b|seat(?:er|s)?\\b)`, 'gi'))].at(-1);
  const people = [...clean.matchAll(new RegExp(`(?<![\\w-])(${NUMBER})\\s*(nguoi lon|tre em|em be|tre nho|adults?|children|kids?|babies|baby|infants?|nguoi|khach|people|persons?|passengers?|guests?|pax)\\b`, 'gi'))];
  let partySize = null;
  const isSubgroup = (match) => /^(nguoi lon|tre em|em be|tre nho|adults?|children|kids?|babies|baby|infants?)$/.test(match[2]);
  const total = people.filter(match => !isSubgroup(match)).at(-1);
  if (total) {
    partySize = asNumber(total[1]);
    // "Four people including two children" is four; "four people plus two children" is six.
    let previousEnd = total.index + total[0].length;
    let includedInTotal = false;
    for (const subgroup of people.filter(match => isSubgroup(match) && match.index > total.index)) {
      const between = clean.slice(previousEnd, subgroup.index);
      if (/\b(including|includes?|gom|trong do|bao gom)\b/.test(between)) includedInTotal = true;
      if (!includedInTotal && /^\s*(?:va|them|and|plus)\s*$/.test(between)) partySize += asNumber(subgroup[1]);
      previousEnd = subgroup.index + subgroup[0].length;
    }
  } else if (people.length) {
    partySize = people.reduce((sum, match) => sum + asNumber(match[1]), 0);
  }
  if (!partySize) {
    const group = clean.match(new RegExp(`(?:there are|we are|for)\\s+(${NUMBER})\\s+(?:of us|in our group)\\b`, 'i'));
    if (group) partySize = asNumber(group[1]);
  }
  if (!partySize && /\b(just me|by myself|minh toi|mot minh)\b/.test(clean)) partySize = 1;
  if (!partySize && !seat && allowBareCount) {
    const bare = clean.match(new RegExp(`^(?:da\\s+)?(${NUMBER})(?:\\s+(?:a|please))?[.!?]?$`));
    if (bare) partySize = asNumber(bare[1]);
  }
  if (!(partySize >= 1 && partySize <= 100)) partySize = null;
  const seats = seat ? asNumber(seat[1]) : null;
  let vehicleType = seats >= 2 && seats <= 60
    ? ({ 4: '4-Seater Sedan', 7: '7-Seater SUV', 16: '16-Seater Van' }[seats] || `${seats}-Seater`)
    : null;
  if (!vehicleType && /\b(xe (?:rong|lon|to)|spacious car|large car|big car|minivan)\b/.test(clean)) vehicleType = 'Spacious car';
  if (!vehicleType && /\bsuv\b/.test(clean)) vehicleType = 'SUV';
  if (!vehicleType && /\bsedan\b/.test(clean)) vehicleType = 'Sedan';
  return { partySize, vehicleType };
}

export function taxiAssistanceReplyKind(text) {
  const clean = normalizeTaxiSpeech(text).replace(/[.!?,]+$/g, '');
  if (/\b(huy yeu cau|huy dat xe|khong dat nua|cancel(?: the)? (?:request|booking)|do not book|don't book)\b/.test(clean)
    || /^(huy|thoi|cancel|close|dong|quay lai)$/.test(clean)) return 'cancel';
  if (/\b(dung gui|chua gui|khong gui|khong xac nhan|dung xac nhan|chua xac nhan|do not send|don't send|do not confirm|don't confirm|not yet|wait)\b/.test(clean)) return 'hold';
  if (/\b(khong dung|sai roi|sua lai|thay doi|chinh sua|not correct|wrong|change|edit)\b/.test(clean)) return 'edit';
  if (/^(?:da\s+)?(?:khong(?: co| can| them| gi| nua| a| yeu cau| ghi chu)*|no(?: thanks| notes| extra requests| more requests| additional requests)?|nothing else|that['’]?s all|cam on|thank you|thanks)$/.test(clean)) return 'send';
  if (/\b(gui yeu cau|gui di|gui luon|dat luon|send (?:it|the request)|submit|book it)\b/.test(clean)) return 'send';
  if (/^(co|co a|yes|yes please|da co)$/.test(clean)) return 'more_notes';
  if (/\b(khong biet|chua ro|nhan vien tu van|not sure|staff can decide)\b/.test(clean)) return 'unsure';
  return 'details';
}

export function buildTaxiBookingPayload({ activeRoomNumber, vehicleType = null, partySize = null, note = '' }) {
  return {
    booking_mode: 'assistance',
    room_number: String(activeRoomNumber || '').trim(),
    party_size: partySize || null,
    vehicle_type: vehicleType || null,
    description: note.trim() || null,
  };
}
