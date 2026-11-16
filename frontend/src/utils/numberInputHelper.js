/**
 * AURORA OS - NUMERIC INPUT VALIDATION & SANITIZATION HELPERS
 * Đảm bảo các trường nhập số chỉ cho phép chữ số (0-9), chặn gõ ký tự chữ hoặc ký tự đặc biệt.
 */

/**
 * Chặn gõ các ký tự không phải chữ số (0-9) trên sự kiện onKeyDown.
 * Cho phép các phím điều hướng và chỉnh sửa chuẩn: Backspace, Delete, Tab, Arrow keys, Enter, Ctrl/Cmd shortcuts.
 *
 * @param {React.KeyboardEvent} e - Sự kiện bàn phím
 * @param {Object} options - Tùy chọn mở rộng
 * @param {boolean} options.allowPlus - Cho phép dấu '+' ở đầu (vd: số điện thoại quốc tế)
 * @param {boolean} options.allowDecimal - Cho phép dấu '.' cho số thập phân
 */
export function handleNumericKeyDown(e, options = {}) {
  const allowPlus = Boolean(options.allowPlus);
  const allowDecimal = Boolean(options.allowDecimal);

  // Cho phép các tổ hợp phím tắt điều khiển Ctrl/Cmd (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z...)
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  // Cho phép phím điều hướng và chỉnh sửa văn bản tiêu chuẩn
  const allowedControlKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'Enter',
  ];
  if (allowedControlKeys.includes(e.key)) {
    return;
  }

  // Cho phép dấu '+' ở vị trí đầu tiên nếu được cấu hình
  if (allowPlus && e.key === '+') {
    const target = e.currentTarget;
    if (target && !target.value.includes('+') && target.selectionStart === 0) {
      return;
    }
  }

  // Cho phép dấu thập phân '.' nếu được cấu hình
  if (allowDecimal && (e.key === '.' || e.key === ',')) {
    const target = e.currentTarget;
    if (target && !target.value.includes('.')) {
      return;
    }
  }

  // Chặn tất cả các ký tự không phải số 0-9
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Chặn các ký tự khoa học hoặc dấu âm ('e', 'E', '+', '-') trên input type="number"
 *
 * @param {React.KeyboardEvent} e - Sự kiện bàn phím
 * @param {Object} options - Tùy chọn mở rộng
 * @param {boolean} options.allowDecimal - Nếu false sẽ chặn cả dấu '.' và ','
 */
export function handleNumberInputBlockExponent(e, options = {}) {
  const allowDecimal = options.allowDecimal !== false;
  const blockedKeys = ['e', 'E', '+', '-'];
  if (!allowDecimal) {
    blockedKeys.push('.', ',');
  }
  if (blockedKeys.includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Lọc chuỗi chỉ giữ lại các chữ số (0-9) và cắt theo maxLength nếu có.
 *
 * @param {string|number} val - Giá trị đầu vào
 * @param {number|null} maxLength - Độ dài tối đa cho phép
 * @returns {string} Chuỗi chỉ gồm chữ số
 */
export function sanitizeDigitsOnly(val, maxLength = null) {
  if (val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/**
 * Lọc chuỗi số điện thoại, giữ lại chữ số và dấu '+' ở đầu nếu có.
 *
 * @param {string|number} val - Giá trị đầu vào
 * @param {number} maxLength - Độ dài tối đa (mặc định 15)
 * @returns {string} Chuỗi số điện thoại hợp lệ
 */
export function sanitizePhoneNumber(val, maxLength = 15) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/\D/g, '');
  const result = hasPlus ? `+${digits}` : digits;
  return maxLength ? result.slice(0, maxLength) : result;
}

