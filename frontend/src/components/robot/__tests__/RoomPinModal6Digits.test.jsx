import { describe, it, expect, vi } from 'vitest';
import { RobotFace } from '../RobotFace';
import { verifyRoomPin } from '../../../services/operationsApi';

describe('RobotFace iOS SVG Eyes Rendering Test', () => {
  it('renders welcome eyes with dedicated left and right blink classes for iOS WebKit', () => {
    const faceEl = RobotFace({ mode: 'welcome', size: 'mobile' });
    expect(faceEl).toBeDefined();
    expect(faceEl.props['data-testid']).toBe('robot-face-welcome');

    // Tìm children svg
    const svgEl = faceEl.props.children[1];
    expect(svgEl.type).toBe('svg');

    // Nhóm mắt
    const eyesGroup = svgEl.props.children[0];
    const [leftEyeGroup, rightEyeGroup] = eyesGroup.props.children;

    expect(leftEyeGroup.props.className).toContain('robot-blink-left');
    expect(leftEyeGroup.props.style.transformOrigin).toBe('261px 500px');

    expect(rightEyeGroup.props.className).toContain('robot-blink-right');
    expect(rightEyeGroup.props.style.transformOrigin).toBe('739px 500px');
  });
});

describe('Operations API verifyRoomPin 6-Digits & Check-in Logic', () => {
  it('parses not_checked_in structured error from backend correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: {
          message: 'Dạ phòng 304 hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ.',
          not_checked_in: true,
          room_number: '304',
          destination_key: 'front_desk',
        },
      }),
    });
    global.fetch = mockFetch;

    await expect(verifyRoomPin('304', '123456')).rejects.toMatchObject({
      not_checked_in: true,
      destination_key: 'front_desk',
      room_number: '304',
      message: expect.stringContaining('Lễ tân để check-in'),
    });
  });

  it('sends 6-digit pin payload cleanly when invoked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        room_number: '304',
        message: 'Xác thực thành công!',
      }),
    });
    global.fetch = mockFetch;

    const res = await verifyRoomPin('304', '654321', 'room_service', 'Phở bò');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/verify-pin'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          room_number: '304',
          pin: '654321',
          tag_code: null,
          tagCode: null,
          nfc_card_uid: null,
          action: 'room_service',
          items: 'Phở bò',
          note: null,
          skip_ticket_creation: false,
          create_ticket: true,
          session_id: null,
        }),
      })
    );
    expect(res.success).toBe(true);
  });

  it('provides official 20 rooms in OFFICIAL_ROOMS constant', async () => {
    const { OFFICIAL_ROOMS, RoomPinModal } = await import('../RoomPinModal');
    expect(typeof RoomPinModal).toBe('function');
    expect(OFFICIAL_ROOMS.floor3).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor4).toHaveLength(10);
    expect(OFFICIAL_ROOMS.floor3).toContain('301');
    expect(OFFICIAL_ROOMS.floor3).toContain('310');
    expect(OFFICIAL_ROOMS.floor4).toContain('401');
    expect(OFFICIAL_ROOMS.floor4).toContain('410');
  });
});
