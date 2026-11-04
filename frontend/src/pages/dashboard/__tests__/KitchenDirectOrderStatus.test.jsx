import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { KitchenDashboard } from '../KitchenDashboard';
import { RoomServiceDashboard } from '../RoomServiceDashboard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Kitchen Direct Order Status & Guest Contact Workflow Tests', () => {
  const kitchenPath = path.resolve(__dirname, '../KitchenDashboard.jsx');
  const kitchenContent = fs.readFileSync(kitchenPath, 'utf8');

  const roomServicePath = path.resolve(__dirname, '../RoomServiceDashboard.jsx');
  const roomServiceContent = fs.readFileSync(roomServicePath, 'utf8');

  const robotFoodMenuPath = path.resolve(__dirname, '../../../components/robot/RobotFoodMenuScreen.jsx');
  const robotFoodMenuContent = fs.readFileSync(robotFoodMenuPath, 'utf8');

  const robotServicePath = path.resolve(__dirname, '../../../components/robot/RobotRoomServiceScreen.jsx');
  const robotServiceContent = fs.readFileSync(robotServicePath, 'utf8');

  it('exports KitchenDashboard and RoomServiceDashboard as functional components', () => {
    expect(typeof KitchenDashboard).toBe('function');
    expect(typeof RoomServiceDashboard).toBe('function');
  });

  it('guarantees no emoji characters in KitchenDashboard and RoomServiceDashboard', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(kitchenContent)).toBe(false);
    expect(emojiRegex.test(roomServiceContent)).toBe(false);
  });

  it('verifies Kitchen has full autonomous lifecycle actions without Room Service handoff', () => {
    // 1. Start cooking / processing
    expect(kitchenContent).toContain('handleStartCooking');
    expect(kitchenContent).toMatch(/Tiếp Nhận & Chế Biến|Bắt Đầu Nấu/);

    // 2. Complete order directly
    expect(kitchenContent).toContain('handleCompleteOrder');
    expect(kitchenContent).toMatch(/Hoàn Thành|Xác Nhận Đã Giao/);

    // 3. Reject order
    expect(kitchenContent).toContain('handleReject');
  });

  it('displays guest phone, room, and direct contact elements in KitchenDashboard', () => {
    // Guest Phone with clickable tel: link
    expect(kitchenContent).toContain('href={`tel:${order.guestPhone || order.guest_phone}`}');
    expect(kitchenContent).toContain('SĐT:');

    // Room phone / Ext
    expect(kitchenContent).toContain('Ext ${order.room}');

    // Guest name and Room badge
    expect(kitchenContent).toContain('order.guestName');
    expect(kitchenContent).toContain('Phòng {order.room');

    // Direct staff contact note
    expect(kitchenContent).toContain('Nhân viên liên lạc trực tiếp');
  });

  it('verifies RoomServiceDashboard isolates food orders exclusively to Kitchen', () => {
    // Room Service only manages service requests (isServiceRequest) and does not receive food dishes
    expect(roomServiceContent).toContain('roomServiceScopedOrders');
    expect(roomServiceContent).not.toContain('Bếp Tiếp Nhận Trực Tiếp');
  });

  it('supports full lifecycle tab filtering in KitchenDashboard', () => {
    expect(kitchenContent).toContain("id: 'All'");
    expect(kitchenContent).toContain("id: 'Pending'");
    expect(kitchenContent).toMatch(/id: 'InProgress'|id: 'Cooking'/);
    expect(kitchenContent).toContain("id: 'Completed'");
  });

  it('supports Option A Auto-Merge: displays merged order indicator in Kitchen and Room Service Dashboards', () => {
    // Kitchen dashboard highlights merged orders
    expect(kitchenContent).toContain('Đơn gộp món (Giao 1 chuyến)');

    // Room Service dashboard highlights merged orders
    expect(roomServiceContent).toContain('Đơn gộp');
  });

  it('supports Option A Auto-Merge: notifies customer on Robot Kiosk when order is auto-merged', () => {
    // Robot Food Menu screen handles merged confirmation
    expect(robotFoodMenuContent).toContain('Đã Tự Động Gộp Vào Đơn Hiện Tại');
    expect(robotFoodMenuContent).toContain('Gộp Món Thành Công!');

    // Robot Room Service screen handles merged confirmation
    expect(robotServiceContent).toContain('Đã Tự Động Gộp Vào Yêu Cầu Hiện Tại');
    expect(robotServiceContent).toContain('Gộp Yêu Cầu Thành Công!');
  });

  it('integrates RejectReasonModal in both Kitchen and Room Service Dashboards', () => {
    // Both dashboards import RejectReasonModal
    expect(kitchenContent).toContain('RejectReasonModal');
    expect(roomServiceContent).toContain('RejectReasonModal');

    // Both dashboards manage rejectingOrder state and confirm logic
    expect(kitchenContent).toContain('handleOpenRejectModal');
    expect(kitchenContent).toContain('handleConfirmReject');
    expect(roomServiceContent).toContain('handleOpenRejectModal');
    expect(roomServiceContent).toContain('handleConfirmReject');

    // RejectReasonModal file exists and exports component
    const rejectModalPath = path.resolve(__dirname, '../../../components/dashboard/RejectReasonModal.jsx');
    const rejectModalContent = fs.readFileSync(rejectModalPath, 'utf8');
    expect(rejectModalContent).toContain('export const RejectReasonModal');
    expect(rejectModalContent).toContain('Lý do từ chối cụ thể');
    expect(rejectModalContent).toContain('Hết nguyên liệu chế biến');
    expect(rejectModalContent).toContain('Tạm hết đồ dùng / vật dụng yêu cầu');
  });
});