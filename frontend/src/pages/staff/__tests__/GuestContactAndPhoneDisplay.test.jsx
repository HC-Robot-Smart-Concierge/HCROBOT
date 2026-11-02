import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Guest Contact & Room Phone Propagation Across Operational Dashboards', () => {
  const receptionPath = path.resolve(__dirname, '../../dashboard/ReceptionDashboard.jsx');
  const roomServicePath = path.resolve(__dirname, '../../dashboard/RoomServiceDashboard.jsx');
  const kitchenPath = path.resolve(__dirname, '../../dashboard/KitchenDashboard.jsx');
  const requestsPath = path.resolve(__dirname, '../RequestsPage.jsx');
  const myTasksPath = path.resolve(__dirname, '../MyTasksPage.jsx');

  const receptionContent = fs.readFileSync(receptionPath, 'utf8');
  const roomServiceContent = fs.readFileSync(roomServicePath, 'utf8');
  const kitchenContent = fs.readFileSync(kitchenPath, 'utf8');
  const requestsContent = fs.readFileSync(requestsPath, 'utf8');
  const myTasksContent = fs.readFileSync(myTasksPath, 'utf8');

  it('guarantees no emoji characters in modified dashboard source files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(receptionContent)).toBe(false);
    expect(emojiRegex.test(roomServiceContent)).toBe(false);
    expect(emojiRegex.test(kitchenContent)).toBe(false);
    expect(emojiRegex.test(requestsContent)).toBe(false);
    expect(emojiRegex.test(myTasksContent)).toBe(false);
  });

  it('verifies ReceptionDashboard includes guest phone and room phone check-in inputs', () => {
    expect(receptionContent).toContain('guest_phone:');
    expect(receptionContent).toContain('room_phone:');
    expect(receptionContent).toContain('SĐT di động khách');
    expect(receptionContent).toContain('Máy nhánh phòng');
    expect(receptionContent).toContain('room.current_guest_phone || room.guest_phone');
    expect(receptionContent).toContain('room.room_phone');
  });

  it('verifies RoomServiceDashboard normalizes and renders guest and room contact badges', () => {
    expect(roomServiceContent).toContain('guest_name: order.guest_name || order.guestName');
    expect(roomServiceContent).toContain('guest_phone: order.guest_phone || order.guestPhone');
    expect(roomServiceContent).toContain('room_phone: order.room_phone || order.roomPhone');
    expect(roomServiceContent).toContain('order.guest_phone || order.guestPhone');
    expect(roomServiceContent).toContain('order.room_phone || order.roomPhone');
  });

  it('verifies KitchenDashboard normalizes and displays guest phone and room extension', () => {
    expect(kitchenContent).toContain('guestName: order.guest_name || order.guestName');
    expect(kitchenContent).toContain('guestPhone: order.guest_phone || order.guestPhone');
    expect(kitchenContent).toContain('roomPhone: order.room_phone || order.roomPhone');
    expect(kitchenContent).toContain('order.guestPhone || order.guest_phone');
    expect(kitchenContent).toContain('order.roomPhone || order.room_phone');
  });

  it('verifies RequestsPage displays guest phone and room extension in card and detail modal', () => {
    expect(requestsContent).toContain('req.guestPhone || req.guest_phone');
    expect(requestsContent).toContain('req.roomPhone || req.room_phone');
    expect(requestsContent).toContain('selectedDetailReq.guestPhone || selectedDetailReq.guest_phone');
    expect(requestsContent).toContain('selectedDetailReq.roomPhone || selectedDetailReq.room_phone');
  });

  it('verifies MyTasksPage displays guest phone and room extension in card and detail modal', () => {
    expect(myTasksContent).toContain('req.guestPhone || req.guest_phone');
    expect(myTasksContent).toContain('req.roomPhone || req.room_phone');
    expect(myTasksContent).toContain('selectedDetailReq.guestPhone || selectedDetailReq.guest_phone');
    expect(myTasksContent).toContain('selectedDetailReq.roomPhone || selectedDetailReq.room_phone');
  });
});
