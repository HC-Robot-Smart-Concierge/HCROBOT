import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { RobotFoodMenuScreen } from '../RobotFoodMenuScreen';
import { RobotRoomServiceScreen } from '../RobotRoomServiceScreen';
import { RoomPinModal } from '../RoomPinModal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Room PIN Session Authentication Flow Tests', () => {
  it('exports RobotFoodMenuScreen and RobotRoomServiceScreen as functional components', () => {
    expect(typeof RobotFoodMenuScreen).toBe('function');
    expect(typeof RobotRoomServiceScreen).toBe('function');
    expect(typeof RoomPinModal).toBe('function');
  });

  it('verifies RobotFoodMenuScreen accepts session authentication props and handles PIN check', () => {
    const filePath = path.resolve(__dirname, '../RobotFoodMenuScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Accepts authenticatedRoom, onPinVerifiedSuccess, and sessionId props
    expect(content).toContain('authenticatedRoom = null');
    expect(content).toContain('onPinVerifiedSuccess = () => {}');
    expect(content).toContain('sessionId = null');

    // Computes isRoomAuth and isLocalPinVerified
    expect(content).toContain('const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);');
    expect(content).toContain('authenticatedRoom && deliveryRoom');

    // Confirmation logic checks session authentication before placing order
    expect(content).toContain('isCurrentlyAuth');
    expect(content).toContain('setIsPinModalOpen(true)');
    expect(content).toContain('executePlaceOrder(roomToUse)');

    // RoomPinModal is provided with sessionId and success callback
    expect(content).toContain('sessionId={sessionId}');
    expect(content).toContain('setIsLocalPinVerified(true)');
    expect(content).toContain('onPinVerifiedSuccess(finalRoom)');
  });

  it('verifies RobotRoomServiceScreen accepts session authentication props and handles PIN check', () => {
    const filePath = path.resolve(__dirname, '../RobotRoomServiceScreen.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // Accepts authenticatedRoom, onPinVerifiedSuccess, and sessionId props
    expect(content).toContain('authenticatedRoom = null');
    expect(content).toContain('onPinVerifiedSuccess = () => {}');
    expect(content).toContain('sessionId = null');

    // Computes isRoomAuth and isLocalPinVerified
    expect(content).toContain('const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);');
    expect(content).toContain('authenticatedRoom && targetRoom');

    // Confirmation logic checks session authentication
    expect(content).toContain('isCurrentlyAuth');
    expect(content).toContain('setIsPinModalOpen(true)');
    expect(content).toContain('executeSubmitRequest(roomToUse)');

    // RoomPinModal is provided with sessionId and success callback
    expect(content).toContain('sessionId={sessionId}');
    expect(content).toContain('setIsLocalPinVerified(true)');
    expect(content).toContain('onPinVerifiedSuccess(finalRoom)');
  });

  it('verifies RoomPinModal forwards sessionId to verify APIs', () => {
    const filePath = path.resolve(__dirname, '../RoomPinModal.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('sessionId = null');
    expect(content).toContain('sessionId');
    expect(content).toContain('verifyRoomPin');
    expect(content).toContain('verifyRoomNfc');
  });

  it('verifies RobotScreenPage passes session state to modals and resets on session flush', () => {
    const filePath = path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // State declaration
    expect(content).toContain('const [authenticatedRoom, setAuthenticatedRoom] = useState(null);');

    // Passed to RobotFoodMenuScreen
    expect(content).toContain('authenticatedRoom={authenticatedRoom}');
    expect(content).toContain('onPinVerifiedSuccess={(room) => setAuthenticatedRoom(room)}');
    expect(content).toContain('sessionId={sessionId}');

    // Cleared on manual reset / timeout / feedback close
    expect(content).toContain('setAuthenticatedRoom(null);');
  });

  it('ensures no emojis exist in modified files', () => {
    const files = [
      path.resolve(__dirname, '../RobotFoodMenuScreen.jsx'),
      path.resolve(__dirname, '../RobotRoomServiceScreen.jsx'),
      path.resolve(__dirname, '../RoomPinModal.jsx'),
      path.resolve(__dirname, '../../../pages/robot/RobotScreenPage.jsx'),
    ];

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      expect(emojiRegex.test(content)).toBe(false);
    });
  });
});
