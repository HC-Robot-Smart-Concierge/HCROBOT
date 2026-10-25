import React, { useState, useEffect, useRef } from 'react';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  reloadScenariosCache,
} from '../../../services/scenariosApi';
import {
  fetchRAGStats,
  fetchRAGSources,
  syncObsidianVault,
  syncBilingualKnowledge,
  saveRAGSourceFile,
  uploadRAGFile,
  deleteRAGSource,
} from '../../../services/knowledgeApi';
import { getVoiceSettings, updateVoiceSettings } from '../../../services/aiApi';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import {
  Plus,
  RefreshCw,
  Search,
  Zap,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Video,
  Bot,
  Layers,
  X,
  Sparkles,
  Volume2,
  Play,
  Square,
  UploadCloud,
  FileText,
  FileCode,
  Folder,
  Eye,
  Save,
  File,
  Check,
  Database,
  ArrowRight,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  Languages,
  BookOpen,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { KnowledgeTableEditor } from '../../../components/admin/KnowledgeTableEditor';

const CATEGORY_MAP = {
  facility: { labelVI: 'Tiện ích', labelEN: 'Amenities', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
  faq: { labelVI: 'Hỏi đáp (FAQ)', labelEN: 'FAQ', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  greeting: { labelVI: 'Lời chào', labelEN: 'Greetings', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  service: { labelVI: 'Dịch vụ', labelEN: 'Services', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  chitchat: { labelVI: 'Trò chuyện', labelEN: 'Small Talk', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

const getCategoryLabel = (cat, isEN) => {
  const item = CATEGORY_MAP[cat];
  if (!item) return cat;
  return isEN ? item.labelEN : item.labelVI;
};

const DEFAULT_FORM_STATE = {
  title: '',
  category: 'faq',
  match_keywords: '',
  match_type: 'keyword',
  response_vi: '',
  response_en: '',
  action_type: 'none',
  destination_key: '',
  eye_expression: 'none',
  is_fast_path: true,
  is_active: true,
  priority: 50,
};

export const AdminKnowledgePage = ({ activeSubView = 'sources', onSelectSubView = () => {} }) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';

  // Navigation View State ('sources' | 'scenarios')
  const [currentTab, setCurrentTab] = useState(() => {
    if (activeSubView === 'scenarios') return 'scenarios';
    return 'sources';
  });

  useEffect(() => {
    if (activeSubView) {
      setCurrentTab(activeSubView === 'scenarios' ? 'scenarios' : 'sources');
    }
  }, [activeSubView]);

  const handleSwitchTab = (tab) => {
    setCurrentTab(tab);
    onSelectSubView?.(tab);
  };

  // Toast message
  const [actionMessage, setActionMessage] = useState(null);
  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // =========================================================================
  // VIEW 1: RAG KNOWLEDGE VAULT & SOURCES STATE
  // =========================================================================
  const [stats, setStats] = useState({
    total_docs: 0,
    total_chunks: 0,
    total_kb: 0,
    vault_files: 0,
    rag_health_percent: 100,
    last_synced: isEN ? 'Active' : 'Hoạt động',
  });
  const [sources, setSources] = useState([]);
  const [isLoadingRAG, setIsLoadingRAG] = useState(false);

  // Upload file state
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Markdown Editor / Preview Modal State
  const [editingSourceFile, setEditingSourceFile] = useState(null); // { filename, content, isNew }
  const [sourceMarkdownContent, setSourceMarkdownContent] = useState('');
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [editorModeTab, setEditorModeTab] = useState('table'); // 'table' | 'edit' | 'preview'
  const [isSourceModalMaximized, setIsSourceModalMaximized] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);

  // =========================================================================
  // VIEW 2: FAST-PATH SCENARIOS STATE
  // =========================================================================
  const [scenarios, setScenarios] = useState([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fastPathOnly, setFastPathOnly] = useState(false);

  // Modal State (Create/Edit Scenario)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination State for Scenarios Table
  const [currentPage, setCurrentPage] = useState(1);
  const scenarioPageSize = 10;

  // Custom Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Markdown Authoring Guide State
  const [isShowMdGuide, setIsShowMdGuide] = useState(false);
  const [isTemplateCopied, setIsTemplateCopied] = useState(false);

  // =========================================================================
  // VOICE & SPEED SETTINGS STATE (ROBOT TTS NEURAL)
  // =========================================================================
  const [voiceSettings, setVoiceSettings] = useState({
    speech_rate: 1.0,
    rate_percentage: '+0%',
    vi_voice: 'vi-VN-HoaiMyNeural',
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [tempRate, setTempRate] = useState(1.0);
  const [tempVoice, setTempVoice] = useState('vi-VN-HoaiMyNeural');
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [isTestSpeaking, setIsTestSpeaking] = useState(false);

  // Local Web Speech Synthesis for quick test preview
  const { speak, stop } = useSpeechSynthesis();

  // Load Voice Settings from backend
  useEffect(() => {
    getVoiceSettings()
      .then((cfg) => {
        if (cfg) {
          setVoiceSettings(cfg);
          setTempRate(cfg.speech_rate || 1.0);
          setTempVoice(cfg.vi_voice || 'vi-VN-HoaiMyNeural');
        }
      })
      .catch((err) => console.warn('Could not load voice settings:', err));
  }, []);

  const handleOpenVoiceModal = () => {
    setTempRate(voiceSettings.speech_rate || 1.0);
    setTempVoice(voiceSettings.vi_voice || 'vi-VN-HoaiMyNeural');
    setIsVoiceModalOpen(true);
  };

  const handleCloseVoiceModal = () => {
    stop();
    setIsTestSpeaking(false);
    setIsVoiceModalOpen(false);
  };

  const handleTestVoice = () => {
    if (isTestSpeaking) {
      stop();
      setIsTestSpeaking(false);
      return;
    }
    const sampleText = isEN
      ? 'Welcome to Aurora Grand Hotel. I am Robot Concierge, ready to assist you.'
      : 'Xin kính chào quý khách đến với khách sạn Aurora Grand. Em là Robot Lễ Tân, rất vui được hỗ trợ quý khách ạ.';
    setIsTestSpeaking(true);
    speak(sampleText, {
      rate: tempRate,
      lang: isEN ? 'en-US' : 'vi-VN',
      onEnd: () => setIsTestSpeaking(false),
      onError: () => setIsTestSpeaking(false),
    });
  };

  const handleSaveVoiceSettings = async () => {
    setIsSavingVoice(true);
    try {
      const updated = await updateVoiceSettings({
        speech_rate: tempRate,
        vi_voice: tempVoice,
      });
      setVoiceSettings(updated);
      setIsVoiceModalOpen(false);
      showNotification(t('knowledgeNotifyVoiceSaved').replace('{rate}', tempRate));
    } catch (err) {
      showNotification(t('knowledgeNotifyVoiceSaveError').replace('{msg}', err.message));
    } finally {
      setIsSavingVoice(false);
    }
  };

  // =========================================================================
  // DATA LOADERS
  // =========================================================================
  const loadRAGData = async () => {
    setIsLoadingRAG(true);
    try {
      const [st, src] = await Promise.all([
        fetchRAGStats(),
        fetchRAGSources(),
      ]);
      setStats(st || {});
      setSources(src?.sources || []);
    } catch (err) {
      console.warn('Failed to load RAG data:', err);
    } finally {
      setIsLoadingRAG(false);
    }
  };

  const loadScenariosData = async () => {
    setIsLoadingScenarios(true);
    try {
      const res = await fetchScenarios({
        category: categoryFilter,
        search: searchQuery,
      });
      setScenarios(res.items || []);
    } catch (err) {
      console.warn('Error loading scenarios:', err);
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  useEffect(() => {
    loadRAGData();
    loadScenariosData();
  }, []);

  useEffect(() => {
    loadScenariosData();
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, fastPathOnly]);

  // =========================================================================
  // RAG VAULT HANDLERS
  // =========================================================================
  const handleSyncObsidian = async () => {
    setIsLoadingRAG(true);
    try {
      const res = await syncObsidianVault();
      showNotification(t('knowledgeNotifyVaultSyncSuccess').replace('{count}', sources.length));
      await loadRAGData();
    } catch (err) {
      showNotification(t('knowledgeNotifyVaultSyncError').replace('{msg}', err.message));
    } finally {
      setIsLoadingRAG(false);
    }
  };

  const [isSyncingBilingual, setIsSyncingBilingual] = useState(false);
  const handleSyncBilingual = async () => {
    setIsSyncingBilingual(true);
    try {
      const res = await syncBilingualKnowledge();
      showNotification(res?.message || t('knowledgeNotifyBilingualSynced'));
      await loadRAGData();
    } catch (err) {
      showNotification(err.message);
    } finally {
      setIsSyncingBilingual(false);
    }
  };

  const handleSelectFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.md')) {
      showNotification(isEN ? 'Only Markdown (.md) files are supported for Knowledge Vault' : 'Hệ thống chỉ hỗ trợ upload file định dạng Markdown (.md)');
      return;
    }
    setSelectedUploadFile(file);
  };

  const handleUploadFileSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedUploadFile) {
      showNotification(t('knowledgeDropzonePrompt'));
      return;
    }

    if (!selectedUploadFile.name.toLowerCase().endsWith('.md')) {
      showNotification(isEN ? 'Only Markdown (.md) files are supported for Knowledge Vault' : 'Hệ thống chỉ hỗ trợ upload file định dạng Markdown (.md)');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadRAGFile(selectedUploadFile, uploadCategory);
      showNotification(`✅ ${t('knowledgeNotifySourceUploaded').replace('{name}', selectedUploadFile.name)}`);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadRAGData();
    } catch (err) {
      showNotification(t('knowledgeNotifySourceUploadError').replace('{msg}', err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSourceEditor = (src) => {
    setEditingSourceFile({ ...src, isNew: false });
    setNewSourceFileName(src.filename);
    setSourceMarkdownContent(src.content || `# ${src.filename}\n\nChưa có nội dung.`);
    setEditorModeTab('table');
    setIsSourceModalMaximized(false);
  };

  const handleOpenCreateSourceModal = () => {
    setEditingSourceFile({ isNew: true, filename: '' });
    setNewSourceFileName('');
    setSourceMarkdownContent(
`---
title: ${isEN ? 'Document Title' : 'Tiêu đề tài liệu'}
category: facilities
language: ${isEN ? 'en' : 'vi'}
---

# ${isEN ? 'New Knowledge Document' : 'Tiêu Đề Tài Liệu Tri Thức Mới'}

## 1. ${isEN ? 'Overview' : 'Thông Tin Tổng Quan'}
${isEN ? 'Enter hotel policies, amenities or directions for Robot Concierge here...' : 'Nhập nội dung quy định, tiện ích hoặc hướng dẫn cho Robot Concierge tại đây...'}
`
    );
    setEditorModeTab('table');
    setIsSourceModalMaximized(false);
  };

  const handleSaveSourceMarkdown = async () => {
    if (!editingSourceFile) return;

    let targetFilename = editingSourceFile.filename;
    if (editingSourceFile.isNew) {
      const cleanName = newSourceFileName.trim();
      if (!cleanName) {
        showNotification(t('knowledgeModalNewFilePlaceholder'));
        return;
      }
      targetFilename = cleanName.endsWith('.md') || cleanName.endsWith('.txt') ? cleanName : `${cleanName}.md`;
    }

    setIsSavingSource(true);
    try {
      await saveRAGSourceFile(targetFilename, sourceMarkdownContent);
      showNotification(t('knowledgeNotifySourceSaved').replace('{name}', targetFilename));
      setEditingSourceFile(null);
      await loadRAGData();
    } catch (err) {
      showNotification(t('knowledgeNotifySourceSaveError').replace('{msg}', err.message));
    } finally {
      setIsSavingSource(false);
    }
  };

  const handleDeleteSourceFile = (filename) => {
    setDeleteConfirmTarget({ type: 'file', filename, title: filename });
  };

  const handleExecuteConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmTarget.type === 'file') {
        await deleteRAGSource(deleteConfirmTarget.filename);
        showNotification(t('knowledgeNotifySourceDeleted').replace('{name}', deleteConfirmTarget.filename));
        await loadRAGData();
      } else if (deleteConfirmTarget.type === 'scenario') {
        await deleteScenario(deleteConfirmTarget.id);
        showNotification(t('knowledgeNotifyScenarioDeleted').replace('{title}', deleteConfirmTarget.title));
        await loadScenariosData();
      }
      setDeleteConfirmTarget(null);
    } catch (err) {
      showNotification(err.message || 'Lỗi khi xóa!');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyStarterTemplate = () => {
    const templateText = `---
title: Tiêu Đề Tài Liệu Tri Thức Mới
category: hotel_facilities
hotel: Aurora Grand Hotel
language: ${isEN ? 'en' : 'vi'}
tags: [tien_nghi, dich_vu, huong_dan]
---

# TIÊU ĐỀ TÀI LIỆU CHÍNH

Mô tả ngắn gọn về phạm vi và nội dung của tài liệu tại đây.

---

## 1. TÊN KHU VỰC HOẶC DỊCH VỤ — TẦNG X

### Vị trí và Giờ hoạt động
- **Vị trí:** Tầng X, mô tả lối đi chi tiết.
- **Giờ mở cửa:** Phục vụ từ **06:00 đến 22:00**.
- **Đối tượng & Chi phí:** Hoàn toàn MIỄN PHÍ cho khách lưu trú.

### Danh mục trang thiết bị & Tiện ích
- Liệt kê trang thiết bị chính thứ nhất.
- Liệt kê trang thiết bị chính thứ hai.
- Tiện ích miễn phí kèm theo (khăn, nước uống, hướng dẫn viên).

---

## 2. BẢNG TỔNG HỢP TRA CỨU NHANH

| Hạng Mục | Vị Trí | Giờ Phục Vụ | Ghi Chú |
|---|---|---|---|
| Dịch vụ 1 | Tầng X | 24/7 | Miễn phí |
| Dịch vụ 2 | Tầng Y | 06:00 - 22:00 | Đặt trước 30 phút |

---

## 3. KỊCH BẢN HỎI ĐÁP MẪU CHO ROBOT

1. **Khách hỏi:** "Câu hỏi thường gặp của khách lưu trú?"
   - **Robot trả lời:** "Dạ câu trả lời lễ phép, chu đáo và chính xác theo phong cách 5 sao của Robot Concierge tại đây ạ!"
`;
    navigator.clipboard.writeText(templateText);
    setIsTemplateCopied(true);
    showNotification(t('knowledgeTemplateCopied'));
    setTimeout(() => setIsTemplateCopied(false), 2500);
  };

  // =========================================================================
  // SCENARIO HANDLERS
  // =========================================================================
  const handleReloadCache = async () => {
    setIsLoadingScenarios(true);
    try {
      const res = await reloadScenariosCache();
      showNotification(t('knowledgeNotifyScenarioCacheReloaded').replace('{count}', totalFastPath));
      await loadScenariosData();
    } catch (err) {
      showNotification(t('knowledgeNotifyScenarioCacheError').replace('{msg}', err.message));
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingId(item.id);
    const kwString = Array.isArray(item.match_keywords) ? item.match_keywords.join(', ') : '';
    const destKey = item.action_payload?.destination_key || '';
    const eyeExpr = item.action_payload?.eye_expression || 'none';

    setFormData({
      title: item.title || '',
      category: item.category || 'faq',
      match_keywords: kwString,
      match_type: item.match_type || 'keyword',
      response_vi: item.response_vi || '',
      response_en: item.response_en || '',
      action_type: item.action_type || 'none',
      destination_key: destKey,
      eye_expression: eyeExpr,
      is_fast_path: item.is_fast_path !== undefined ? item.is_fast_path : true,
      is_active: item.is_active !== undefined ? item.is_active : true,
      priority: item.priority || 50,
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.response_vi.trim()) {
      showNotification(t('knowledgePlaceholderScenarioTitle'));
      return;
    }

    setIsSubmitting(true);
    try {
      const kwList = formData.match_keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const actionPayload = {};
      if (formData.action_type === 'show_map' && formData.destination_key.trim()) {
        actionPayload.destination_key = formData.destination_key.trim();
      }
      if (formData.eye_expression && formData.eye_expression !== 'none') {
        actionPayload.eye_expression = formData.eye_expression;
      }
      const finalPayload = Object.keys(actionPayload).length > 0 ? actionPayload : null;

      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        match_keywords: kwList,
        match_type: formData.match_type,
        response_vi: formData.response_vi.trim(),
        response_en: formData.response_en.trim() || null,
        action_type: formData.action_type,
        action_payload: finalPayload,
        is_fast_path: formData.is_fast_path,
        is_active: formData.is_active,
        priority: Number(formData.priority) || 0,
      };

      if (editingId) {
        await updateScenario(editingId, payload);
        showNotification(t('knowledgeNotifyScenarioUpdated').replace('{title}', payload.title));
      } else {
        await createScenario(payload);
        showNotification(t('knowledgeNotifyScenarioCreated').replace('{title}', payload.title));
      }

      setIsModalOpen(false);
      await loadScenariosData();
    } catch (err) {
      showNotification(t('knowledgeNotifyScenarioSaveError').replace('{msg}', err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScenario = (id, title) => {
    setDeleteConfirmTarget({ type: 'scenario', id, title });
  };

  const displayScenarios = scenarios.filter((scn) => {
    if (fastPathOnly && !scn.is_fast_path) return false;
    return true;
  });

  const paginatedScenarios = displayScenarios.slice(
    (currentPage - 1) * scenarioPageSize,
    currentPage * scenarioPageSize
  );

  const totalFastPath = scenarios.filter((s) => s.is_fast_path).length;
  const totalActive = scenarios.filter((s) => s.is_active).length;

  // Simple Markdown renderer for preview
  const renderMarkdownPreview = (text) => {
    if (!text) return <p className="text-stone-400 italic">{isEN ? 'No document content.' : 'Chưa có nội dung văn bản.'}</p>;
    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-xs leading-relaxed text-stone-800">
        {lines.map((l, i) => {
          const t = l.trim();
          if (t.startsWith('# ')) {
            return <h1 key={i} className="text-base font-black text-stone-900 border-b pb-1 pt-2">{t.slice(2)}</h1>;
          }
          if (t.startsWith('## ')) {
            return <h2 key={i} className="text-sm font-bold text-stone-900 border-b pb-1 pt-2">{t.slice(3)}</h2>;
          }
          if (t.startsWith('### ')) {
            return <h3 key={i} className="text-xs font-bold text-stone-900 pt-1">{t.slice(4)}</h3>;
          }
          if (t.startsWith('- ') || t.startsWith('* ')) {
            return <li key={i} className="ml-4 list-disc text-stone-700">{t.slice(2)}</li>;
          }
          if (t.startsWith('|')) {
            return <div key={i} className="font-mono text-[11px] bg-stone-100 px-2 py-0.5 rounded overflow-x-auto">{t}</div>;
          }
          if (!t) return <div key={i} className="h-1.5" />;
          return <p key={i} className="text-stone-700">{t}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col min-h-full pb-8 font-sans select-none" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        {/* Title and Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
              {currentTab === 'sources'
                ? t('knowledgeSourcesTitle')
                : t('knowledgeScenariosTitle')}
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase inline-flex items-center gap-1"
              style={{
                backgroundColor: currentTab === 'sources' ? '#EFF6FF' : '#DCFCE7',
                color: currentTab === 'sources' ? '#1D4ED8' : '#15803D',
                borderColor: currentTab === 'sources' ? '#BFDBFE' : '#BBF7D0',
              }}
            >
              {currentTab === 'sources' ? (
                <>
                  <Folder className="w-3 h-3" /> {t('knowledgeVaultBadge')}
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" /> {isEN ? '< 1ms In-Memory' : '< 1ms Trong Bộ Nhớ'}
                </>
              )}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {currentTab === 'sources' ? t('knowledgeSourcesSubtitle') : t('knowledgeScenariosSubtitle')}
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {currentTab === 'sources' && (
            <>
              <button
                onClick={handleSyncObsidian}
                disabled={isLoadingRAG}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-stone-50"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#262626',
                  borderColor: '#BFBFBD',
                }}
                title={t('knowledgeBtnSyncVaultTooltip')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRAG ? 'animate-spin' : ''}`} />
                <span>{t('knowledgeBtnSyncVault')}</span>
              </button>

              <button
                onClick={handleSyncBilingual}
                disabled={isSyncingBilingual}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-stone-50"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#262626',
                  borderColor: '#BFBFBD',
                }}
                title={t('knowledgeBtnSyncBilingualTooltip')}
              >
                <Languages className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingBilingual ? 'animate-spin' : ''}`} />
                <span>{t('knowledgeBtnSyncBilingual')}</span>
              </button>

              <button
                onClick={() => setIsShowMdGuide(true)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-stone-50"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#262626',
                  borderColor: '#BFBFBD',
                }}
                title={t('knowledgeBtnMdGuideTooltip')}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('knowledgeBtnMdGuide')}</span>
              </button>

              <button
                onClick={handleOpenCreateSourceModal}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-[#262626]/90"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
                title={t('knowledgeBtnNewDocTooltip')}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('knowledgeBtnNewDoc')}</span>
              </button>
            </>
          )}

          {currentTab === 'scenarios' && (
            <>
              <button
                onClick={handleReloadCache}
                disabled={isLoadingScenarios}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-stone-50"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#262626',
                  borderColor: '#BFBFBD',
                }}
                title={t('knowledgeBtnReloadCacheTooltip')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScenarios ? 'animate-spin' : ''}`} />
                <span>{t('knowledgeBtnReloadCache')}</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-[#262626]/90"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('knowledgeBtnAddScenario')}</span>
              </button>
            </>
          )}

          {/* Nút Voice Settings (hiển thị trên mọi tab) */}
          <button
            onClick={handleOpenVoiceModal}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:bg-stone-50"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#262626',
              borderColor: '#BFBFBD',
            }}
            title={t('knowledgeBtnSpeechRateTooltip')}
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('knowledgeBtnSpeechRate').replace('{rate}', voiceSettings.speech_rate)}</span>
          </button>
        </div>
      </div>

      {/* SUB-NAVIGATION PILL TABS */}
      <div className="px-5 pt-3">
        <div
          className="p-1 rounded-xl border flex items-center gap-1 w-fit bg-white/60"
          style={{ borderColor: '#BFBFBD' }}
        >
          <button
            onClick={() => handleSwitchTab('sources')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            style={{
              backgroundColor: currentTab === 'sources' ? '#262626' : 'transparent',
              color: currentTab === 'sources' ? '#FFFFFF' : '#8C8C8C',
            }}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t('knowledgeTabSources')}</span>
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold"
              style={{
                backgroundColor: currentTab === 'sources' ? '#404040' : '#E9E5DC',
                color: currentTab === 'sources' ? '#FFFFFF' : '#262626',
              }}
            >
              {sources.length}
            </span>
          </button>

          <button
            onClick={() => handleSwitchTab('scenarios')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            style={{
              backgroundColor: currentTab === 'scenarios' ? '#262626' : 'transparent',
              color: currentTab === 'scenarios' ? '#FFFFFF' : '#8C8C8C',
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t('knowledgeTabScenarios')}</span>
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold"
              style={{
                backgroundColor: currentTab === 'scenarios' ? '#404040' : '#E9E5DC',
                color: currentTab === 'scenarios' ? '#FFFFFF' : '#262626',
              }}
            >
              {scenarios.length}
            </span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: KHO TRI THỨC RAG & TẢI FILE NGUỒN (SOURCES / VAULT)          */}
      {/* =================================================================== */}
      {currentTab === 'sources' && (
        <div className="p-5 space-y-4">
          {/* 4 KPI METRICS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('knowledgeCardTotalFiles')}</div>
                <div className="text-xl font-black mt-0.5" style={{ color: '#262626' }}>{sources.length}</div>
                <div className="text-[10px] text-stone-500 mt-0.5">{t('knowledgeCardTotalFilesSub')}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('knowledgeCardStorageSize')}</div>
                <div className="text-xl font-black mt-0.5" style={{ color: '#262626' }}>
                  {sources.reduce((acc, c) => acc + (Number(c.file_size_kb) || 0), 0).toFixed(1)} KB
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">{t('knowledgeCardStorageSizeSub')}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700">
                <Folder className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('knowledgeCardAiHealth')}</div>
                <div className="text-xl font-black mt-0.5 text-emerald-600">{stats.rag_health_percent || 100}%</div>
                <div className="text-[10px] text-stone-500 mt-0.5">{t('knowledgeCardAiHealthSub')}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>{t('knowledgeCardAiMemory')}</div>
                <div className="text-xs font-bold mt-1 text-stone-800 truncate max-w-[130px]">
                  {stats.last_synced === 'Vừa đồng bộ'
                    ? (isEN ? 'Just synced' : 'Vừa đồng bộ')
                    : stats.last_synced === 'Just now'
                    ? (isEN ? 'Just now' : 'Vừa xong')
                    : stats.last_synced || t('knowledgeCardActive')}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">{t('knowledgeCardAiMemorySub')}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-stone-100 text-stone-700">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* UPLOAD NEW KNOWLEDGE FILE CARD */}
          <div
            className="p-5 rounded-2xl border bg-white shadow-sm space-y-4"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#262626' }}>
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span>{t('knowledgeUploadCardTitle')}</span>
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {t('knowledgeUploadCardSub')}
                </p>
              </div>

              {selectedUploadFile && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {t('knowledgeDropzoneSelected')
                    .replace('{name}', selectedUploadFile.name)
                    .replace('{size}', (selectedUploadFile.size / 1024).toFixed(1))}
                </span>
              )}
            </div>

            <form onSubmit={handleUploadFileSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* File Dropzone Input */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleSelectFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`md:col-span-2 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : selectedUploadFile
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-stone-300 hover:border-stone-400 bg-stone-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleSelectFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedUploadFile ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>
                        {selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB) {t('knowledgeDropzoneReselect')}
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-stone-400" />
                      <div className="text-xs font-bold text-stone-800">
                        {t('knowledgeDropzonePrompt')}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {t('knowledgeDropzoneHint')}
                      </div>
                    </>
                  )}
                </div>

                {/* Category & Action Button */}
                <div className="flex flex-col justify-between gap-3 p-3 rounded-xl border bg-stone-50" style={{ borderColor: '#E9E5DC' }}>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      {t('knowledgeLabelCategory')}
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-none cursor-pointer"
                    >
                      <option value="facilities">{t('knowledgeOptFacilities')}</option>
                      <option value="dining">{t('knowledgeOptDining')}</option>
                      <option value="services">{t('knowledgeOptServices')}</option>
                      <option value="policies">{t('knowledgeOptPolicies')}</option>
                      <option value="general">{t('knowledgeOptGeneral')}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || !selectedUploadFile}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-800"
                    style={{
                      backgroundColor: '#262626',
                      color: '#F2EFE9',
                    }}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('knowledgeBtnUploadingIngest')}</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>{t('knowledgeBtnUploadIngest')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ACTIVE SOURCE FILES TABLE */}
          <div
            className="rounded-xl border overflow-hidden shadow-none bg-white"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="p-3 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" style={{ color: '#262626' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#262626' }}>
                  {t('knowledgeActiveFilesTitle').replace('{count}', sources.length)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-500">
                {t('knowledgeStoragePathHint')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2.5 px-4">{t('knowledgeColFilename')}</th>
                    <th className="py-2.5 px-3 text-center w-24">{t('knowledgeColFormat')}</th>
                    <th className="py-2.5 px-3 text-center w-28">{t('knowledgeColSize')}</th>
                    <th className="py-2.5 px-3 text-center w-36">{t('knowledgeColStorage')}</th>
                    <th className="py-2.5 px-3 text-center w-40">{t('knowledgeColUpdated')}</th>
                    <th className="py-2.5 px-3 text-center w-28">{t('knowledgeColStatus')}</th>
                    <th className="py-2.5 px-4 text-right w-28">{t('knowledgeColActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {t('knowledgeEmptySources')}
                      </td>
                    </tr>
                  ) : (
                    sources.map((src) => (
                      <tr
                        key={src.filename}
                        className="transition-colors hover:bg-[#F2EFE9]/40"
                        style={{ borderBottom: '1px solid #E9E5DC' }}
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-xs" style={{ color: '#262626' }}>
                          <div className="flex items-center gap-2">
                            <FileCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate max-w-md">{src.filename}</span>
                            {(src.language === 'vi' || src.filename.includes('_vi')) ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {t('knowledgeBadgeVI')}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {t('knowledgeBadgeEN')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-700 uppercase">
                            {src.file_type || src.format || 'MD'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-stone-600">
                          {src.file_size_kb || 0} KB
                        </td>
                        <td className="py-2.5 px-3 text-center text-[11px] font-semibold text-stone-600">
                          {src.source_type || 'Knowledge Vault'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[10px] text-stone-500">
                          {src.last_modified || '2026-10-20 07:11'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Synced
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenSourceEditor(src)}
                              className="px-2 py-1 rounded text-xs font-medium border cursor-pointer hover:bg-stone-100 transition-all flex items-center gap-1"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#BFBFBD',
                                color: '#262626',
                              }}
                            >
                              <Edit2 className="w-3 h-3 text-indigo-600" />
                              <span>{t('knowledgeBtnViewEdit')}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSourceFile(src.filename)}
                              className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all"
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#BFBFBD',
                                color: '#8C8C8C',
                              }}
                              title={t('knowledgeDeleteFileTooltip')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: KỊCH BẢN FAST-PATH (SCENARIOS TABLE)                        */}
      {/* =================================================================== */}
      {currentTab === 'scenarios' && (
        <div className="p-5 space-y-3.5">
          {/* SEARCH & CATEGORY FILTERS TOOLBAR */}
          <div
            className="p-2.5 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('knowledgeSearchScenarioPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {['All', 'facility', 'faq', 'greeting', 'service', 'chitchat'].map((cat) => {
                const isSelected = categoryFilter === cat;
                const label = cat === 'All' ? t('all') : getCategoryLabel(cat, isEN);
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: isSelected ? '#262626' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#8C8C8C',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Fast-Path Toggle */}
            <button
              onClick={() => setFastPathOnly(!fastPathOnly)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                fastPathOnly ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-[#BFBFBD] text-[#8C8C8C]'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>{t('knowledgeFastPathOnly')}</span>
            </button>
          </div>

          {/* SCENARIOS TABLE */}
          <div
            className="rounded-xl border overflow-hidden shadow-none bg-white"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2.5 px-4 w-52">{t('knowledgeColTitleCat')}</th>
                    <th className="py-2.5 px-3 w-64">{t('knowledgeColKeywords')}</th>
                    <th className="py-2.5 px-3">{t('knowledgeColResponses')}</th>
                    <th className="py-2.5 px-3 w-36 text-center">{t('knowledgeColAction')}</th>
                    <th className="py-2.5 px-3 w-32 text-center">{t('knowledgeColMechanism')}</th>
                    <th className="py-2.5 px-3 w-20 text-center">{t('knowledgeColPriority')}</th>
                    <th className="py-2.5 px-4 text-right w-28">{t('knowledgeColActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {displayScenarios.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {isLoadingScenarios ? t('knowledgeLoadingScenarios') : t('knowledgeEmptyScenarios')}
                      </td>
                    </tr>
                  ) : (
                    paginatedScenarios.map((item) => {
                      const catStyle = CATEGORY_MAP[item.category] || CATEGORY_MAP.faq;
                      const keywords = Array.isArray(item.match_keywords) ? item.match_keywords : [];
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-[#F2EFE9]/40"
                          style={{ borderBottom: '1px solid #E9E5DC' }}
                        >
                          {/* Title & Category */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-xs" style={{ color: '#262626' }}>
                              {item.title}
                            </div>
                            <div className="mt-1">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold border inline-block"
                                style={{
                                  backgroundColor: catStyle.bg,
                                  color: catStyle.text,
                                  borderColor: catStyle.border,
                                }}
                              >
                                {getCategoryLabel(item.category, isEN)}
                              </span>
                            </div>
                          </td>

                          {/* Match Keywords */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {keywords.slice(0, 4).map((kw, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                                  style={{
                                    backgroundColor: '#F2EFE9',
                                    color: '#262626',
                                    borderColor: '#BFBFBD',
                                  }}
                                >
                                  {kw}
                                </span>
                              ))}
                              {keywords.length > 4 && (
                                <span className="text-[10px] font-semibold text-stone-500">
                                  {t('knowledgeMoreKeywords').replace('{count}', keywords.length - 4)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Responses */}
                          <td className="py-2.5 px-3">
                            <p className="line-clamp-2 text-stone-800 font-medium">
                              {item.response_vi}
                            </p>
                            {item.response_en && (
                              <p className="line-clamp-1 text-stone-400 text-[11px] italic mt-0.5">
                                EN: {item.response_en}
                              </p>
                            )}
                          </td>

                          {/* Action & Eye Expression */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {item.action_type === 'show_map' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{item.action_payload?.destination_key || t('knowledgeActionMap')}</span>
                                </span>
                              ) : item.action_type === 'call_reception' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  <span>{t('knowledgeActionVideoCall')}</span>
                                </span>
                              ) : null}

                              {/* Eye Expression Badge */}
                              {item.action_payload?.eye_expression && item.action_payload.eye_expression !== 'none' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-700 border border-stone-300 inline-flex items-center gap-1">
                                  <span>{t('knowledgeEyesPrefix')}</span>
                                  <span>
                                    {item.action_payload.eye_expression === 'look_up' && t('knowledgeEyeLookUp')}
                                    {item.action_payload.eye_expression === 'look_left' && t('knowledgeEyeLookLeft')}
                                    {item.action_payload.eye_expression === 'look_right' && t('knowledgeEyeLookRight')}
                                    {item.action_payload.eye_expression === 'look_around' && t('knowledgeEyeLookAround')}
                                    {item.action_payload.eye_expression === 'happy' && t('knowledgeEyeHappy')}
                                  </span>
                                </span>
                              ) : !item.action_type || item.action_type === 'none' ? (
                                <span className="text-stone-400 text-[11px]">—</span>
                              ) : null}
                            </div>
                          </td>

                          {/* Fast-Path & Active */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {item.is_fast_path ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-0.5">
                                  <Zap className="w-3 h-3" /> Fast &lt;1ms
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                  Standard RAG
                                </span>
                              )}
                              <span className={`text-[10px] font-bold ${item.is_active ? 'text-emerald-600' : 'text-stone-400'}`}>
                                {item.is_active ? t('knowledgeStatusActive') : t('knowledgeStatusInactive')}
                              </span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-stone-700">
                            {item.priority}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-stone-100 transition-all"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#BFBFBD',
                                  color: '#262626',
                                }}
                                title={t('knowledgeEditScenarioTooltip')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteScenario(item.id, item.title)}
                                className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#BFBFBD',
                                  color: '#8C8C8C',
                                }}
                                title={t('knowledgeDeleteScenarioTooltip')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={displayScenarios.length}
              pageSize={scenarioPageSize}
              onPageChange={setCurrentPage}
              itemName={t('knowledgeScenarioItemName')}
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: SOẠN THẢO & XEM TRƯỚC FILE MARKDOWN SOURCE                   */}
      {/* =================================================================== */}
      {editingSourceFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div
            className={`w-full rounded-2xl border p-5 space-y-3.5 shadow-2xl flex flex-col transition-all duration-200 ${
              isSourceModalMaximized
                ? 'fixed inset-3 z-50 h-[calc(100vh-24px)] max-h-none'
                : 'max-w-6xl max-h-[92vh]'
            }`}
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 gap-3" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                  <FileCode className="w-4 h-4" />
                </div>
                {editingSourceFile.isNew ? (
                  <div className="flex-1 max-w-sm">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-0.5">
                      {t('knowledgeModalNewFileLabel')}
                    </label>
                    <input
                      type="text"
                      value={newSourceFileName}
                      onChange={(e) => setNewSourceFileName(e.target.value)}
                      placeholder={t('knowledgeModalNewFilePlaceholder')}
                      className="w-full px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold truncate" style={{ color: '#262626' }}>
                        {t('knowledgeModalEditFileTitle').replace('{filename}', editingSourceFile.filename)}
                      </h3>
                      {(editingSourceFile.language === 'vi' || editingSourceFile.filename?.includes('_vi')) ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {t('knowledgeBadgeVI')}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {t('knowledgeBadgeEN')}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">
                      {t('knowledgeModalEditFileSub')}
                    </p>
                  </div>
                )}
              </div>

              {/* Mode switch, Maximize & Close */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Quick Switch to Bilingual Counterpart */}
                {!editingSourceFile.isNew && (
                  (() => {
                    const fname = editingSourceFile.filename;
                    const isVI = fname.includes('_vi');
                    let targetName = '';
                    if (isVI) {
                      targetName = fname.replace('_vi.md', '_en.md');
                      if (!sources.some(s => s.filename === targetName)) {
                        targetName = fname.replace('_vi.md', '_rag.md');
                      }
                    } else if (fname.includes('_en')) {
                      targetName = fname.replace('_en.md', '_vi.md');
                    } else if (fname.includes('_rag')) {
                      targetName = fname.replace('_rag.md', '_vi.md');
                    }
                    const targetFile = sources.find(s => s.filename === targetName);
                    if (!targetFile) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => handleOpenSourceEditor(targetFile)}
                        className="px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-stone-100 flex items-center gap-1.5 transition-colors bg-stone-50 text-stone-700 shadow-2xs"
                        title={isVI ? t('knowledgeSwitchToPairEN') : t('knowledgeSwitchToPairVI')}
                      >
                        <Languages className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="hidden sm:inline">
                          {isVI ? t('knowledgeSwitchToPairEN') : t('knowledgeSwitchToPairVI')}
                        </span>
                      </button>
                    );
                  })()
                )}

                <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-stone-100" style={{ borderColor: '#BFBFBD' }}>
                  <button
                    type="button"
                    onClick={() => setEditorModeTab('table')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      editorModeTab === 'table'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('knowledgeModalTabTable')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorModeTab('edit')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      editorModeTab === 'edit'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('knowledgeModalTabEdit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorModeTab('preview')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      editorModeTab === 'preview'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('knowledgeModalTabPreview')}</span>
                  </button>
                </div>

                {/* Maximize Toggle */}
                <button
                  type="button"
                  onClick={() => setIsSourceModalMaximized(!isSourceModalMaximized)}
                  title={isSourceModalMaximized ? (isEN ? 'Restore size' : 'Thu nhỏ') : (isEN ? 'Maximize' : 'Phóng to toàn màn hình')}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900 cursor-pointer transition-colors"
                >
                  {isSourceModalMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingSourceFile(null);
                    setIsSourceModalMaximized(false);
                  }}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor / Table / Preview Content Area */}
            <div className="flex-1 min-h-[380px] overflow-hidden flex flex-col border rounded-xl p-3 bg-stone-50" style={{ borderColor: '#E9E5DC' }}>
              {editorModeTab === 'table' ? (
                <KnowledgeTableEditor
                  markdown={sourceMarkdownContent}
                  onChange={setSourceMarkdownContent}
                  isEN={isEN}
                  filename={editingSourceFile.filename}
                />
              ) : editorModeTab === 'edit' ? (
                <textarea
                  value={sourceMarkdownContent}
                  onChange={(e) => setSourceMarkdownContent(e.target.value)}
                  placeholder={t('knowledgeModalPlaceholderMarkdown')}
                  className="w-full h-full min-h-[360px] font-mono text-xs p-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y leading-relaxed text-stone-900"
                />
              ) : (
                <div className="flex-1 overflow-y-auto p-4 bg-white rounded-lg border border-stone-200 min-h-[360px] custom-scrollbar">
                  {renderMarkdownPreview(sourceMarkdownContent)}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: '#E9E5DC' }}>
              <div className="text-[11px] text-stone-500">
                {t('knowledgeModalLengthCount')
                  .replace('{chars}', sourceMarkdownContent.length)
                  .replace('{lines}', sourceMarkdownContent.split('\n').length)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSourceFile(null)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-stone-100 transition-colors cursor-pointer"
                  style={{ borderColor: '#BFBFBD', color: '#262626' }}
                >
                  {t('knowledgeModalBtnCancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSourceMarkdown}
                  disabled={isSavingSource}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  {isSavingSource ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('knowledgeModalBtnSaving')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingSourceFile.isNew ? t('knowledgeModalBtnSaveNew') : t('knowledgeModalBtnSaveEdit')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: TẠO / SỬA KỊCH BẢN HỘI THOẠI                              */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#E9E5DC' }}>
              <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                {editingId ? t('knowledgeModalEditScenarioTitle') : t('knowledgeModalAddScenarioTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelScenarioTitle')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('knowledgePlaceholderScenarioTitle')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelScenarioCategory')}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="facility">{getCategoryLabel('facility', isEN)} (facility)</option>
                    <option value="faq">{getCategoryLabel('faq', isEN)} (faq)</option>
                    <option value="greeting">{getCategoryLabel('greeting', isEN)} (greeting)</option>
                    <option value="service">{getCategoryLabel('service', isEN)} (service)</option>
                    <option value="chitchat">{getCategoryLabel('chitchat', isEN)} (chitchat)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelPriorityRange')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelKeywords')}
                </label>
                <input
                  type="text"
                  value={formData.match_keywords}
                  onChange={(e) => setFormData({ ...formData, match_keywords: e.target.value })}
                  placeholder={t('knowledgePlaceholderKeywords')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-mono text-[11px] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelResponseVi')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.response_vi}
                  onChange={(e) => setFormData({ ...formData, response_vi: e.target.value })}
                  placeholder={t('knowledgePlaceholderResponseVi')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelResponseEn')}
                </label>
                <textarea
                  rows={2}
                  value={formData.response_en}
                  onChange={(e) => setFormData({ ...formData, response_en: e.target.value })}
                  placeholder={t('knowledgePlaceholderResponseEn')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelActionType')}
                  </label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="none">{t('knowledgeActionNone')}</option>
                    <option value="show_map">{t('knowledgeActionShowMap')}</option>
                    <option value="call_reception">{t('knowledgeActionCallReception')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelEyeExpression')}
                  </label>
                  <select
                    value={formData.eye_expression || 'none'}
                    onChange={(e) => setFormData({ ...formData, eye_expression: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="none">{t('knowledgeEyeNone')}</option>
                    <option value="look_up">{t('knowledgeEyeLookUp')}</option>
                    <option value="look_left">{t('knowledgeEyeLookLeft')}</option>
                    <option value="look_right">{t('knowledgeEyeLookRight')}</option>
                    <option value="look_around">{t('knowledgeEyeLookAround')}</option>
                    <option value="happy">{t('knowledgeEyeHappy')}</option>
                  </select>
                </div>
              </div>

              {formData.action_type === 'show_map' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelDestinationKey')}
                  </label>
                  <input
                    type="text"
                    value={formData.destination_key}
                    onChange={(e) => setFormData({ ...formData, destination_key: e.target.value })}
                    placeholder="restaurant, gym, pool, elevator"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-mono text-[11px] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_fast_path}
                    onChange={(e) => setFormData({ ...formData, is_fast_path: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">{t('knowledgeLabelFastPathToggle')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">{t('knowledgeLabelActiveToggle')}</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E9E5DC' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                  style={{ borderColor: '#BFBFBD', color: '#262626' }}
                >
                  {t('knowledgeModalBtnCancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  {isSubmitting ? t('knowledgeBtnSavingScenario') : editingId ? t('knowledgeBtnSaveScenario') : t('knowledgeBtnCreateScenario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: CÀI ĐẶT TỐC ĐỘ NÓI & GIỌNG AI                              */}
      {/* =================================================================== */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                    {t('knowledgeVoiceModalTitle')}
                  </h3>
                  <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    {t('knowledgeVoiceModalSub')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseVoiceModal}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Tốc độ đọc */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    {t('knowledgeVoiceRateLabel').replace('{rate}', tempRate)}
                  </label>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {tempRate === 1.0 ? t('knowledgeVoiceRateNormal') : tempRate < 1.0 ? t('knowledgeVoiceRateSlow').replace('{rate}', tempRate) : t('knowledgeVoiceRateFast').replace('{rate}', tempRate)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border space-y-3" style={{ borderColor: '#E9E5DC' }}>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={tempRate}
                    onChange={(e) => setTempRate(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                  />

                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[
                      { label: '0.75x', val: 0.75 },
                      { label: '0.85x', val: 0.85 },
                      { label: '1.0x', val: 1.0 },
                      { label: '1.15x', val: 1.15 },
                      { label: '1.25x', val: 1.25 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTempRate(opt.val)}
                        className={`py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          Math.abs(tempRate - opt.val) < 0.01
                            ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Giọng đọc chuẩn của Robot Rora */}
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border" style={{ borderColor: '#E9E5DC' }}>
                <div>
                  <div className="text-[11px] font-bold text-stone-700">{t('knowledgeVoiceSpeakerLabel')}</div>
                  <div className="text-[10px] text-stone-500">{t('knowledgeVoiceSpeakerSub')}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {t('knowledgeVoiceSpeakerName')}
                </span>
              </div>

              {/* Nút nghe thử trực tiếp */}
              <div className="p-3 bg-stone-100 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: '#E9E5DC' }}>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-800 truncate">{t('knowledgeVoiceTestTitle')}</div>
                  <div className="text-[10px] text-stone-500 truncate">{t('knowledgeVoiceTestSub')}</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isTestSpeaking
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-stone-900 text-stone-100 hover:bg-stone-800'
                  }`}
                >
                  {isTestSpeaking ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{t('knowledgeVoiceTestStop')}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('knowledgeVoiceTestPlay')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E9E5DC' }}>
              <button
                type="button"
                onClick={handleCloseVoiceModal}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                style={{ borderColor: '#BFBFBD', color: '#262626' }}
              >
                {t('knowledgeModalBtnCancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveVoiceSettings}
                disabled={isSavingVoice}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSavingVoice ? t('knowledgeVoiceBtnSaving') : t('knowledgeVoiceBtnSave')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOM IN-APP DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-stone-900 truncate">
                  {deleteConfirmTarget.type === 'file'
                    ? t('knowledgeConfirmDeleteFileTitle')
                    : t('knowledgeConfirmDeleteScenarioTitle')}
                </h3>
                <p className="text-xs text-stone-500 font-mono truncate">
                  {deleteConfirmTarget.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {deleteConfirmTarget.type === 'file'
                ? t('knowledgeConfirmDeleteFileDesc').replace('{name}', deleteConfirmTarget.filename)
                : t('knowledgeConfirmDeleteScenarioDesc').replace('{title}', deleteConfirmTarget.title)}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
              >
                {t('knowledgeBtnCancelDelete')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <span>{isEN ? 'Deleting...' : 'Đang xóa...'}</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('knowledgeBtnConfirmDelete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MARKDOWN AUTHORING GUIDE FOR ROBOT AI MODAL */}
      {/* ========================================================================= */}
      {isShowMdGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-stone-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-stone-50 shrink-0" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-wide">
                    {t('knowledgeModalMdGuideTitle')}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isEN
                      ? 'Standards, Chunking Architecture & Best Practices for RAG & ChromaDB'
                      : 'Quy chuẩn cấu trúc phân đoạn, bóc tách RAG và mẫu văn phong chuẩn cho Robot'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShowMdGuide(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700 leading-relaxed">
              {/* 1. Principle Card */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide">
                    {isEN ? '1. Why Markdown (.md) is the fastest format for Robot AI (< 5ms)?' : '1. Vì sao AI đọc Markdown (.md) nhanh nhất (< 5ms)?'}
                  </h4>
                  <p className="text-blue-800 text-[11px]">
                    {isEN
                      ? 'The backend chunker splits text by markdown header regex \\n(?=#+ ). Each section becomes a clean, independent semantic vector chunk in ChromaDB without parsing noise, OCR errors, or text corruption.'
                      : 'Hệ thống Backend cắt đoạn (chunking) theo biểu thức chính quy \\n(?=#+ ). Mỗi tiêu đề # hoặc ## biến thành một mẩu tri thức độc lập có ngữ cảnh hoàn chỉnh trong ChromaDB, không bị lẫn rác hay vỡ chữ như file PDF/DOCX.'}
                  </p>
                </div>
              </div>

              {/* 2. Five Essential Parts Grid */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>{isEN ? '2. The 5 Core Components of an Ideal Knowledge File' : '2. Năm Thành Phần Cốt Lõi Của Một File Tri Thức Chuẩn'}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">1</span>
                      <span>YAML Frontmatter (Metadata)</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Placed at line 1. Contains title, category, tags, and language: en/vi to trigger automatic language badges.'
                        : 'Đặt ở đầu file giữa 2 dòng ---. Chứa title, category, tags, và quan trọng nhất là language: vi hoặc en để hệ thống tự động gán badge.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">2</span>
                      <span>{isEN ? 'Header Hierarchy (#, ##, ###)' : 'Phân Cấp Tiêu Đề (#, ##, ###)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? '1 H1 per file. Use ## for each facility/section. Aim for 50 - 300 words per section for optimal embedding retrieval.'
                        : 'Chỉ 1 tiêu đề # H1 cho toàn file. Dùng ## cho từng dịch vụ/khu vực. Mỗi mục nên chứa từ 50 - 300 từ đủ thông tin độc lập.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">3</span>
                      <span>{isEN ? 'Markdown Tables (| Col 1 | Col 2 |)' : 'Bảng Biểu Markdown (Tables)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Best for numerical data, operating hours, prices, and fast reference. Edit effortlessly with our Excel Table mode.'
                        : 'Tối ưu tuyệt đối cho AI tra cứu giờ mở cửa, chi phí, tầng và chỉ dẫn. Chỉnh sửa cực nhanh với chế độ Bảng Excel.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">4</span>
                      <span>{isEN ? 'Bilingual Suffixes (_vi.md & _en.md)' : 'Đuôi File Song Ngữ (_vi.md & _en.md)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Name files with _vi.md and _en.md to enable instant 1-click bilingual switching in the editor modal.'
                        : 'Đặt tên có đuôi _vi.md và _en.md để hệ thống tự động ghép cặp song ngữ và kích hoạt nút chuyển đổi nhanh trong Editor.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Starter Template Code Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    <span>{isEN ? '3. Standard Starter Markdown Template' : '3. Mẫu Khung Template Chuẩn Để Sao Chép'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyStarterTemplate}
                    className="px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                  >
                    {isTemplateCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('knowledgeTemplateCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('knowledgeBtnCopyTemplate')}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-stone-900 text-stone-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-stone-800">
{`---
title: Cẩm Nang Dịch Vụ & Tiện Nghi Khách Sạn
category: hotel_facilities
hotel: Aurora Grand Hotel
language: vi
tags: [gym, spa, ho_boi, nha_hang, bai_xe]
---

# CẨM NANG DỊCH VỤ & TIỆN NGHI KHÁCH SẠN

Tài liệu cung cấp thông tin tra cứu cho Robot Concierge và khách lưu trú.

---

## 1. HỒ BƠI VÔ CỰC (INFINITY POOL) — TẦNG 5

### Vị trí và Giờ hoạt động
- **Vị trí:** Sân thượng ngoài trời Tầng 5.
- **Giờ mở cửa:** Phục vụ hàng ngày từ **06:00 đến 22:00**.
- **Chi phí:** Hoàn toàn **MIỄN PHÍ** cho khách lưu trú.

### Các tiện ích miễn phí kèm theo
- Nước uống detox thảo mộc ướp lạnh tự do.
- Khăn tắm lớn và áo phao bơi đa kích cỡ.

---

## 2. BẢNG TRA CỨU TIỆN ÍCH TỔNG HỢP

| Tên Dịch Vụ | Vị Trí | Giờ Phục Vụ | Chi Phí |
|---|---|---|---|
| Hồ Bơi Vô Cực | Tầng 5 | 06:00 - 22:00 | Miễn phí |
| Phòng Tập Gym | Tầng 5 | Mở cửa 24/7 | Miễn phí |
| Nhà Hàng Buffet | Tầng 2 | 06:30 - 22:00 | Đã gồm trong phòng / 350.000đ |

---

## 3. KỊCH BẢN ĐỐI THOẠI HỎI ĐÁP MẪU CHO ROBOT

1. **Khách hỏi:** "Hồ bơi khách sạn ở đâu và có nước uống không?"
   - **Robot trả lời:** "Dạ hồ bơi vô cực nằm tại Tầng 5, mở cửa từ 6 giờ sáng đến 22 giờ tối. Khách sạn có chuẩn bị sẵn nước uống detox thảo mộc và khăn tắm miễn phí cho quý khách ạ!"
`}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-stone-50 flex items-center justify-between shrink-0" style={{ borderColor: '#E9E5DC' }}>
              <div className="text-[11px] text-stone-500 font-mono">
                {isEN ? 'Saved in backend/knowledge_vault/' : 'Tài liệu được lưu tại backend/knowledge_vault/'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyStarterTemplate}
                  className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-stone-100 flex items-center gap-1.5 bg-white text-stone-700 border-stone-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('knowledgeBtnCopyTemplate')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsShowMdGuide(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  {isEN ? 'Close Guide' : 'Đóng Hướng Dẫn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
