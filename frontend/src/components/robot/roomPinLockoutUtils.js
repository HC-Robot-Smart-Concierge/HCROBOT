export const PIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_SEC = 60;
export const DEFAULT_WRONG_PIN_ERROR_MSG = 'Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.';

export const getRoomLockoutState = (roomNumber) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return { count: 0, lockedUntil: 0 };
  try {
    const raw = sessionStorage.getItem(`room_pin_lock_${roomNumber}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.lockedUntil === 'number' && data.lockedUntil > Date.now()) {
        return data;
      }
    }
  } catch (e) { }
  return { count: 0, lockedUntil: 0 };
};

export const setRoomLockoutState = (roomNumber, state) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`room_pin_lock_${roomNumber}`, JSON.stringify(state));
  } catch (e) { }
};

export const clearRoomLockoutState = (roomNumber) => {
  if (!roomNumber || typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(`room_pin_lock_${roomNumber}`);
  } catch (e) { }
};

export const OFFICIAL_ROOMS = {

  floor3: ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310'],

  floor4: ['401', '402', '403', '404', '405', '406', '407', '408', '409', '410'],

};
