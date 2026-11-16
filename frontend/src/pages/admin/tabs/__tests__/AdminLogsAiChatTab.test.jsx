import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('AdminLogsTab AI Chat Conversation Logs', () => {
  it('wires conversations sub-tab, fetchChatSessions, fetchSessionMessages, and transcript modal', () => {
    const logsTabPath = path.resolve(process.cwd(), 'src/pages/admin/tabs/AdminLogsTab.jsx');
    const viewsPath = path.resolve(process.cwd(), 'src/pages/admin/tabs/AdminLogsAuditAndChatViews.jsx');
    const portalPath = path.resolve(process.cwd(), 'src/pages/admin/AdminPortal.jsx');
    const langPath = path.resolve(process.cwd(), 'src/context/LanguageContext.jsx');

    const logsTabContent = fs.readFileSync(logsTabPath, 'utf-8');
    const viewsContent = fs.readFileSync(viewsPath, 'utf-8');
    const portalContent = fs.readFileSync(portalPath, 'utf-8');
    const langContent = fs.readFileSync(langPath, 'utf-8');

    expect(logsTabContent).toContain('fetchChatSessions');
    expect(logsTabContent).toContain('fetchSessionMessages');
    expect(logsTabContent).toContain("'conversations'");
    expect(logsTabContent).toContain('logsTabAiChat');
    expect(logsTabContent).toContain('AdminLogsAuditAndChatViews');
    expect(logsTabContent).toContain('AdminChatTranscriptModal');
    expect(logsTabContent).toContain('handleOpenChatTranscript');

    // Guard against missing useLanguage() / undefined t inside extracted views & modal
    expect(viewsContent).toContain('useLanguage');
    expect(viewsContent).toContain("activeView === 'conversations'");
    expect(viewsContent).toContain('<Pagination');
    expect(viewsContent).toContain('logsChatSearchPlaceholder');
    expect(viewsContent).toContain('logsChatActionTranscript');
    expect(viewsContent).toContain('AdminChatTranscriptModal');

    // Verify AdminPortal exposes Logs sidebar sub-tabs and passes props
    expect(portalContent).toContain('logsSubTab');
    expect(portalContent).toContain('setLogsSubTab');
    expect(portalContent).toContain("setLogsSubTab('conversations')");
    expect(portalContent).toContain('subTabProp={logsSubTab}');

    // Verify EN + VI localization keys exist
    expect(langContent).toContain("logsTabAiChat: 'AI Chat History'");
    expect(langContent).toContain("logsTabAiChat: 'Lịch Sử Hội Thoại AI'");
    expect(langContent).toContain('logsChatModalTitle');
    expect(langContent).toContain('logsChatRoleGuest');
  });
});
