import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi } from 'vitest';
import {
  handleNumericKeyDown,
  handleNumberInputBlockExponent,
  sanitizeDigitsOnly,
  sanitizePhoneNumber,
} from '../../../utils/numberInputHelper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Numeric Input Validation & Character Blocking Tests', () => {
  const receptionPath = path.resolve(__dirname, '../ReceptionDashboard.jsx');
  const receptionContent = fs.readFileSync(receptionPath, 'utf8');

  const conciergePath = path.resolve(__dirname, '../ConciergeDashboard.jsx');
  const conciergeContent = fs.readFileSync(conciergePath, 'utf8');

  const paginationPath = path.resolve(__dirname, '../../../components/common/Pagination.jsx');
  const paginationContent = fs.readFileSync(paginationPath, 'utf8');

  const kitchenMenuPath = path.resolve(__dirname, '../../staff/KitchenMenuManagementPage.jsx');
  const kitchenMenuContent = fs.readFileSync(kitchenMenuPath, 'utf8');

  const roomServiceMenuPath = path.resolve(__dirname, '../../staff/RoomServiceMenuManagementPage.jsx');
  const roomServiceMenuContent = fs.readFileSync(roomServiceMenuPath, 'utf8');

  const securitySettingsPath = path.resolve(__dirname, '../../admin/tabs/settings/SecuritySection.jsx');
  const securitySettingsContent = fs.readFileSync(securitySettingsPath, 'utf8');

  it('guarantees no emoji characters in all modified files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(receptionContent)).toBe(false);
    expect(emojiRegex.test(conciergeContent)).toBe(false);
    expect(emojiRegex.test(paginationContent)).toBe(false);
    expect(emojiRegex.test(kitchenMenuContent)).toBe(false);
    expect(emojiRegex.test(roomServiceMenuContent)).toBe(false);
    expect(emojiRegex.test(securitySettingsContent)).toBe(false);
  });

  it('verifies ReceptionDashboard imports and uses numberInputHelper utilities', () => {
    expect(receptionContent).toContain("from '../../utils/numberInputHelper'");
    expect(receptionContent).toContain('handleNumericKeyDown');
    expect(receptionContent).toContain('sanitizeDigitsOnly');
    expect(receptionContent).toContain('sanitizePhoneNumber');
  });

  it('verifies identity_number input strictly allows only digits in ReceptionDashboard', () => {
    // Check input attribute settings
    expect(receptionContent).toContain('inputMode="numeric"');
    expect(receptionContent).toContain('pattern="[0-9]*"');
    expect(receptionContent).toContain('onKeyDown={handleNumericKeyDown}');
    expect(receptionContent).toContain('sanitizeDigitsOnly(e.target.value, 15)');

    // Functional verification
    const textWithLetters = 'CCCD12345ABC';
    expect(sanitizeDigitsOnly(textWithLetters, 15)).toBe('12345');

    const textWithSymbols = '079-201-019-988';
    expect(sanitizeDigitsOnly(textWithSymbols, 15)).toBe('079201019988');
  });

  it('verifies guest_phone input allows digits and leading plus sign', () => {
    expect(receptionContent).toContain('handleNumericKeyDown(e, { allowPlus: true })');
    expect(receptionContent).toContain('sanitizePhoneNumber(e.target.value, 15)');

    expect(sanitizePhoneNumber('+84901234567')).toBe('+84901234567');
    expect(sanitizePhoneNumber('090abc123def456')).toBe('090123456');
    expect(sanitizePhoneNumber('+84 901 234 567')).toBe('+84901234567');
  });

  it('verifies pin_code input restricts to maximum 4 digits', () => {
    expect(receptionContent).toContain('sanitizeDigitsOnly(e.target.value, 4)');
    expect(sanitizeDigitsOnly('12345678', 4)).toBe('1234');
    expect(sanitizeDigitsOnly('12a3b4', 4)).toBe('1234');
  });

  it('verifies ConciergeDashboard numeric inputs for room number and party size', () => {
    const taxiModalPath = path.resolve(__dirname, '../../../components/dashboard/concierge/ConciergeTaxiBookingModal.jsx');
    const taxiModalContent = fs.existsSync(taxiModalPath) ? fs.readFileSync(taxiModalPath, 'utf8') : '';
    const combinedContent = conciergeContent + taxiModalContent;

    expect(combinedContent).toContain("numberInputHelper");
    expect(combinedContent).toContain('handleNumericKeyDown');
    expect(combinedContent).toContain('sanitizeDigitsOnly(e.target.value, 6)');
    expect(combinedContent).toContain('handleNumberInputBlockExponent');
  });

  it('verifies exponent and sign key blocking on number inputs in menu pages and pagination', () => {
    expect(paginationContent).toContain("from '../../utils/numberInputHelper'");
    expect(paginationContent).toContain('handleNumberInputBlockExponent');

    expect(kitchenMenuContent).toContain("from '../../utils/numberInputHelper'");
    expect(kitchenMenuContent).toContain('handleNumberInputBlockExponent');

    expect(roomServiceMenuContent).toContain("from '../../utils/numberInputHelper'");
    expect(roomServiceMenuContent).toContain('handleNumberInputBlockExponent');

    // Test preventDefault behavior on exponent / symbol keys
    const preventDefault = vi.fn();
    handleNumberInputBlockExponent({ key: 'e', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);

    handleNumberInputBlockExponent({ key: 'E', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);

    handleNumberInputBlockExponent({ key: '-', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(3);

    handleNumberInputBlockExponent({ key: '+', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(4);

    handleNumberInputBlockExponent({ key: '5', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(4);
  });
});
