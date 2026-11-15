import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminLogsTab } from '../AdminLogsTab';
import { fetchChatSessions, fetchSessionMessages } from '../../../../services/aiApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AdminLogsTab AI Chat History Integration', () => {
  const logsTabContent = [
    '../AdminLogsTab.jsx',
    '../adminLogsUtils.js',
    '../AdminLogsOperationalView.jsx',
    '../AdminLogsAuditAndChatViews.jsx',
    '../AdminLogsModals.jsx',
  ].map((rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')).join('\n');
  const adminPortalPath = path.resolve(__dirname, '../../AdminPortal.jsx');
  const adminPortalContent = fs.readFileSync(adminPortalPath, 'utf8');

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls GET /api/v1/ai/sessions and GET /api/v1/ai/sessions/{id}/messages via aiApi', async () => {
    const mockSessions = [{ id: 'sess-01', room_number: '402', is_active: true }];
    const mockMessages = [
      { id: 1, session_id: 'sess-01', sender: 'user', text: 'Xin chào', language: 'vi-VN' },
      { id: 2, session_id: 'sess-01', sender: 'assistant', text: 'Chào quý khách', language: 'vi-VN' },
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockSessions })
      .mockResolvedValueOnce({ ok: true, json: async () => mockMessages });
    globalThis.fetch = fetchMock;

    const sessions = await fetchChatSessions();
    expect(sessions).toEqual(mockSessions);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/ai/sessions');

    const msgs = await fetchSessionMessages('sess-01');
    expect(msgs).toEqual(mockMessages);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/ai/sessions/sess-01/messages');
  });

  it('wires AI Chat History sub-tab, transcript modal, and AdminPortal navigation', () => {
    expect(typeof AdminLogsTab).toBe('function');
    expect(logsTabContent).toContain('fetchChatSessions');
    expect(logsTabContent).toContain('fetchSessionMessages');
    expect(logsTabContent).toContain("activeView === 'conversations'");
    expect(logsTabContent).toContain('handleOpenChatTranscript');
    expect(logsTabContent).toContain('activeChatSession');

    expect(adminPortalContent).toContain('logsSubTab');
    expect(adminPortalContent).toContain("setLogsSubTab('conversations')");
    expect(adminPortalContent).toContain('subTabProp={logsSubTab}');
  });
});
