import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Realtime WebSocket Status Workflows Contract Tests', () => {
  const wsHookPath = path.resolve(__dirname, '../../../hooks/useNotificationWebSocket.js');
  const wsHookContent = fs.readFileSync(wsHookPath, 'utf8');

  const requestsPagePath = path.resolve(__dirname, '../RequestsPage.jsx');
  const requestsPageContent = fs.readFileSync(requestsPagePath, 'utf8');

  const myTasksPagePath = path.resolve(__dirname, '../MyTasksPage.jsx');
  const myTasksPageContent = fs.readFileSync(myTasksPagePath, 'utf8');

  const kitchenDashboardPath = path.resolve(__dirname, '../../dashboard/KitchenDashboard.jsx');
  const kitchenDashboardContent = fs.readFileSync(kitchenDashboardPath, 'utf8');

  const roomServiceDashboardPath = path.resolve(__dirname, '../../dashboard/RoomServiceDashboard.jsx');
  const roomServiceDashboardContent = fs.readFileSync(roomServiceDashboardPath, 'utf8');

  it('guarantees no emoji characters across all real-time status workflow files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(wsHookContent)).toBe(false);
    expect(emojiRegex.test(requestsPageContent)).toBe(false);
    expect(emojiRegex.test(myTasksPageContent)).toBe(false);
    expect(emojiRegex.test(kitchenDashboardContent)).toBe(false);
    expect(emojiRegex.test(roomServiceDashboardContent)).toBe(false);
  });

  it('verifies useNotificationWebSocket handles TASK_STATUS_UPDATED and dispatches custom events', () => {
    expect(wsHookContent).toContain('TASK_STATUS_UPDATED');
    expect(wsHookContent).toContain("app:task_status_updated");
    expect(wsHookContent).toContain('NEW_ORDER_CREATED');
    expect(wsHookContent).toContain("app:order_created");
    expect(wsHookContent).toContain('ORDERS_CLEARED');
    expect(wsHookContent).toContain("app:orders_cleared");
  });

  it('verifies RequestsPage listens to real-time status updates via WebSocket events', () => {
    expect(requestsPageContent).toContain("app:task_status_updated");
    expect(requestsPageContent).toContain("app:order_created");
    expect(requestsPageContent).toContain("app:orders_cleared");
  });

  it('verifies MyTasksPage listens to real-time status updates via WebSocket events', () => {
    expect(myTasksPageContent).toContain("app:task_status_updated");
    expect(myTasksPageContent).toContain("app:order_created");
    expect(myTasksPageContent).toContain("app:orders_cleared");
  });

  it('verifies KitchenDashboard integrates real-time WebSocket events for instant KDS updates', () => {
    expect(kitchenDashboardContent).toContain("app:task_status_updated");
    expect(kitchenDashboardContent).toContain("app:order_created");
  });

  it('verifies RoomServiceDashboard integrates real-time WebSocket events for instant updates', () => {
    expect(roomServiceDashboardContent).toContain("app:task_status_updated");
    expect(roomServiceDashboardContent).toContain("app:order_created");
  });
});

