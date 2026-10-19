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
  saveRAGSourceFile,
  uploadRAGFile,
  deleteRAGSource,
} from '../../../services/knowledgeApi';
import { getVoiceSettings, updateVoiceSettings } from '../../../services/aiApi';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { Pagination } from '../../../components/common/Pagination';
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
  AlertCircle,
  Database,
  ArrowRight,
} from 'lucide-react';

const CATEGORY_MAP = {
  facility: { label: 'Tiện ích', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
  faq: { label: 'Hỏi đáp (FAQ)', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  greeting: { label: 'Lời chào', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  service: { label: 'Dịch vụ', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  chitchat: { label: 'Trò chuyện', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
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
  is_fast_path: true,
  is_active: true,
  priority: 50,
};

export const AdminKnowledgePage = ({ activeSubView = 'sources', onSelectSubView = () => {} }) => {
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
  // 1. KNOWLEDGE VAULT & RAG STATE
  // =========================================================================
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState({
    total_documents: 0,
    total_sources: 0,
    rag_health_percent: 100,
    categories: {},
    last_synced: 'Đang tải...',
  });
  const [isLoadingRAG, setIsLoadingRAG] = useState(false);

  // Upload file state
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Markdown Source File Editor Modal State
  const [editingSourceFile, setEditingSourceFile] = useState(null);
  const [sourceMarkdownContent, setSourceMarkdownContent] = useState('');
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [editorModeTab, setEditorModeTab] = useState('edit');
  const [isSavingSource, setIsSavingSource] = useState(false);

  // =========================================================================
  // 2. DIALOGUE SCENARIOS STATE
  // =========================================================================
  const [scenarios, setScenarios] = useState([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [fastPathOnly, setFastPathOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const scenarioPageSize = 8;

  // Scenario Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================================
  // 3. VOICE SETTINGS MODAL STATE
  // =========================================================================
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    speech_rate: 1.0,
    rate_percentage: '+0%',
    vi_voice: 'vi-VN-HoaiMyNeural',
    en_voice: 'en-US-JennyNeural',
  });
  const [tempRate, setTempRate] = useState(1.0);
  const [tempVoice, setTempVoice] = useState('vi-VN-HoaiMyNeural');
  const [isSavingVoice, setIsSavingVoice] = useState(false);

  const { speak: testSpeak, cancel: stopTestSpeak, isSpeaking: isTestSpeaking } = useSpeechSynthesis();

  // Load Voice Settings on Mount
  useEffect(() => {
    getVoiceSettings()
      .then((data) => {
        if (data) {
          setVoiceSettings(data);
          setTempRate(data.speech_rate || 1.0);
          setTempVoice(data.vi_voice || 'vi-VN-HoaiMyNeural');
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
    stopTestSpeak();
    setIsVoiceModalOpen(false);
  };

  const handleTestVoice = () => {
    if (isTestSpeaking) {
      stopTestSpeak();
      return;
    }
    const sampleText = 'Dạ em chào quý khách! Em là robot lễ tân Rora. Chúc quý khách kỳ nghỉ tuyệt vời tại khách sạn Aurora Grand!';
    testSpeak(sampleText, 'vi-VN', null, null, null, tempRate);
  };

  const handleSaveVoiceSettings = async () => {
    setIsSavingVoice(true);
    stopTestSpeak();
    try {
      const updated = await updateVoiceSettings({
        speech_rate: tempRate,
        vi_voice: tempVoice,
      });
      setVoiceSettings(updated);
      setIsVoiceModalOpen(false);
      showNotification(`Đã cập nhật tốc độ nói của Robot: ${tempRate}x (${updated.rate_percentage})`);
    } catch (err) {
      showNotification(`Lỗi cập nhật cấu hình giọng nói: ${err.message}`);
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
      showNotification(`Lỗi khi tải kịch bản: ${err.message}`);
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
      showNotification(res.message || 'Đồng bộ Obsidian Vault thành công!');
      await loadRAGData();
    } catch (err) {
      showNotification(`Lỗi khi đồng bộ Obsidian: ${err.message}`);
    } finally {
      setIsLoadingRAG(false);
    }
  };

  const handleUploadFileSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedUploadFile) {
      showNotification('Vui lòng chọn một file tài liệu từ máy tính!');
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadRAGFile(selectedUploadFile, uploadCategory);
      showNotification(`✅ ${res.message || 'Nạp file tri thức thành công!'}`);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadRAGData();
    } catch (err) {
      showNotification(`❌ Lỗi khi tải file: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSourceEditor = (src) => {
    setEditingSourceFile({ ...src, isNew: false });
    setNewSourceFileName(src.filename);
    setSourceMarkdownContent(src.content || `# ${src.filename}\n\nChưa có nội dung.`);
    setEditorModeTab('edit');
  };

  const handleOpenCreateSourceModal = () => {
    setEditingSourceFile({ isNew: true, filename: '' });
    setNewSourceFileName('');
    setSourceMarkdownContent(
`---
title: Tiêu đề tài liệu
category: facilities
language: vi
---

# Tiêu Đề Tài Liệu Tri Thức Mới

## 1. Thông Tin Tổng Quan
Nhập nội dung quy định, tiện ích hoặc hướng dẫn cho Robot Concierge tại đây...
`
    );
    setEditorModeTab('edit');
  };

  const handleSaveSourceMarkdown = async () => {
    if (!editingSourceFile) return;

    let targetFilename = editingSourceFile.filename;
    if (editingSourceFile.isNew) {
      const cleanName = newSourceFileName.trim();
      if (!cleanName) {
        showNotification('Vui lòng nhập tên file (ví dụ: quy_dinh_khach_san.md)');
        return;
      }
      targetFilename = cleanName.endsWith('.md') || cleanName.endsWith('.txt') ? cleanName : `${cleanName}.md`;
    }

    setIsSavingSource(true);
    try {
      await saveRAGSourceFile(targetFilename, sourceMarkdownContent);
      showNotification(`✅ Đã lưu file "${targetFilename}" và nạp vào bộ nhớ Robot thành công!`);
      setEditingSourceFile(null);
      await loadRAGData();
    } catch (err) {
      showNotification(`❌ Lỗi khi lưu file: ${err.message}`);
    } finally {
      setIsSavingSource(false);
    }
  };

  const handleDeleteSourceFile = async (filename) => {
    if (!window.confirm(`Xác nhận xóa file "${filename}" khỏi kho tri thức Robot?`)) return;
    try {
      await deleteRAGSource(filename);
      showNotification(`Đã xóa file "${filename}" thành công!`);
      await loadRAGData();
    } catch (err) {
      showNotification(`Lỗi khi xóa file: ${err.message}`);
    }
  };

  // =========================================================================
  // SCENARIO HANDLERS
  // =========================================================================
  const handleReloadCache = async () => {
    setIsLoadingScenarios(true);
    try {
      const res = await reloadScenariosCache();
      showNotification(res.message || 'Đã đồng bộ lại toàn bộ kịch bản vào RAM Cache!');
      await loadScenariosData();
    } catch (err) {
      showNotification(`Lỗi khi reload cache: ${err.message}`);
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

    setFormData({
      title: item.title || '',
      category: item.category || 'faq',
      match_keywords: kwString,
      match_type: item.match_type || 'keyword',
      response_vi: item.response_vi || '',
      response_en: item.response_en || '',
      action_type: item.action_type || 'none',
      destination_key: destKey,
      is_fast_path: item.is_fast_path !== undefined ? item.is_fast_path : true,
      is_active: item.is_active !== undefined ? item.is_active : true,
      priority: item.priority || 50,
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.response_vi.trim()) {
      showNotification('Vui lòng điền đầy đủ Tiêu đề và Câu trả lời tiếng Việt!');
      return;
    }

    setIsSubmitting(true);
    try {
      const kwList = formData.match_keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        match_keywords: kwList,
        match_type: formData.match_type,
        response_vi: formData.response_vi.trim(),
        response_en: formData.response_en.trim() || null,
        action_type: formData.action_type,
        action_payload:
          formData.action_type === 'show_map' && formData.destination_key.trim()
            ? { destination_key: formData.destination_key.trim() }
            : null,
        is_fast_path: formData.is_fast_path,
        is_active: formData.is_active,
        priority: Number(formData.priority) || 0,
      };

      if (editingId) {
        await updateScenario(editingId, payload);
        showNotification(`Đã cập nhật kịch bản "${payload.title}" thành công!`);
      } else {
        await createScenario(payload);
        showNotification(`Đã tạo mới kịch bản "${payload.title}" thành công!`);
      }

      setIsModalOpen(false);
      await loadScenariosData();
    } catch (err) {
      showNotification(`Lỗi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScenario = async (id, title) => {
    if (!window.confirm(`Xác nhận xóa kịch bản "${title}" khỏi hệ thống?`)) return;
    try {
      await deleteScenario(id);
      showNotification(`Đã xóa kịch bản "${title}"!`);
      await loadScenariosData();
    } catch (err) {
      showNotification(`Lỗi khi xóa: ${err.message}`);
    }
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
    if (!text) return <p className="text-stone-400 italic">Chưa có nội dung văn bản.</p>;
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
                ? 'Kho Tài Liệu Tri Thức Khách Sạn (Knowledge Base)'
                : 'Kịch Bản Hội Thoại AI & Fast-Path'}
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
                  <Folder className="w-3 h-3" /> Kho Tri Thức
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" /> &lt; 1ms In-Memory
                </>
              )}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {currentTab === 'sources'
              ? 'Quản lý, tải lên tài liệu tri thức (Markdown, PDF, TXT) và sơ đồ khách sạn cho Robot Concierge'
              : 'Quản lý các kịch bản đối thoại FAQ, tiện ích phản xạ tức thì dưới 1ms cho Robot Concierge'}
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
                title="Đồng bộ tự động toàn bộ file trong thư mục Vault vào bộ nhớ Robot"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRAG ? 'animate-spin' : ''}`} />
                <span>Đồng Bộ Tri Thức Vault</span>
              </button>

              <button
                onClick={handleOpenCreateSourceModal}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
                title="Tạo file tài liệu Markdown mới trực tiếp trên hệ thống"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tạo Tài Liệu Mới</span>
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
                title="Đồng bộ lại toàn bộ kịch bản từ Database vào bộ nhớ RAM tức thì"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScenarios ? 'animate-spin' : ''}`} />
                <span>Tải Lại RAM Cache</span>
              </button>

              <button
                onClick={handleOpenCreateModal}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm Kịch Bản</span>
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
            title="Cài đặt tốc độ nói và giọng phát âm AI của Robot"
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tốc Độ Nói: {voiceSettings.speech_rate}x</span>
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
            <span>Kho Tài Liệu Tri Thức</span>
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
            <span>Kịch Bản Fast-Path</span>
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
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TỔNG FILE TRI THỨC</div>
                <div className="text-xl font-black mt-0.5" style={{ color: '#262626' }}>{sources.length}</div>
                <div className="text-[10px] text-stone-500 mt-0.5">tài liệu sẵn sàng phục vụ</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>DUNG LƯỢNG KHO LƯU TRỮ</div>
                <div className="text-xl font-black mt-0.5" style={{ color: '#262626' }}>
                  {sources.reduce((acc, c) => acc + (Number(c.file_size_kb) || 0), 0).toFixed(1)} KB
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">Markdown, PDF, TXT</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-700">
                <Folder className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>ĐỘ SẴN SÀNG AI</div>
                <div className="text-xl font-black mt-0.5 text-emerald-600">{stats.rag_health_percent || 100}%</div>
                <div className="text-[10px] text-stone-500 mt-0.5">truy vấn thời gian thực</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TRẠNG THÁI BỘ NHỚ AI</div>
                <div className="text-xs font-bold mt-1 text-stone-800 truncate max-w-[130px]">{stats.last_synced || 'Hoạt động'}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">● Bộ nhớ AI sẵn sàng</div>
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
                  <span>Tải Lên File Tri Thức Mới Vào Robot (Upload Knowledge File)</span>
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Hệ thống hỗ trợ file <strong>.md, .txt, .pdf, .docx</strong> và ảnh <strong>(.jpg, .png, .webp)</strong>. File Markdown sẽ tự động lưu vào <code>backend/knowledge_vault/</code> và đồng bộ vào bộ nhớ Robot.
                </p>
              </div>

              {selectedUploadFile && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Đã chọn: {selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB)
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
                      setSelectedUploadFile(e.dataTransfer.files[0]);
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
                    accept=".md,.txt,.pdf,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedUploadFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {selectedUploadFile ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB) — Bấm để chọn file khác</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 text-stone-400" />
                      <div className="text-xs font-bold text-stone-800">
                        Kéo thả file tài liệu vào đây hoặc <span className="text-indigo-600 underline">bấm để chọn file</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        Hỗ trợ .MD (Markdown Vault), .TXT, .PDF, .DOCX hoặc Ảnh sơ đồ
                      </div>
                    </>
                  )}
                </div>

                {/* Category & Action Button */}
                <div className="flex flex-col justify-between gap-3 p-3 rounded-xl border bg-stone-50" style={{ borderColor: '#E9E5DC' }}>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Phân loại danh mục
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-none cursor-pointer"
                    >
                      <option value="facilities">Cơ sở vật chất & Tiện ích</option>
                      <option value="dining">Ẩm thực & Nhà hàng</option>
                      <option value="services">Dịch vụ & Tiện nghi phòng</option>
                      <option value="policies">Chính sách & Quy định</option>
                      <option value="general">Thông tin tổng quát khách sạn</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || !selectedUploadFile}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isUploading || !selectedUploadFile
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : 'bg-stone-900 text-white hover:bg-stone-800 shadow-md'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tải & bóc tách...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Tải Lên & Nạp Vào Robot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* SOURCES TABLE (FILES IN KNOWLEDGE VAULT & UPLOADS) */}
          <div
            className="rounded-2xl border overflow-hidden shadow-sm bg-white"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="p-3.5 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-stone-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Danh Sách File Nguồn Đang Hoạt Động ({sources.length} files)
                </span>
              </div>
              <span className="text-[10px] text-stone-600 font-mono">
                Thư mục lưu trữ: backend/knowledge_vault/ & static/uploads/
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#F2EFE9',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2.5 px-4">Tên file nguồn</th>
                    <th className="py-2.5 px-3 w-28 text-center">Định dạng</th>
                    <th className="py-2.5 px-3 w-28">Dung lượng</th>
                    <th className="py-2.5 px-3 w-36 text-center">Nguồn lưu trữ</th>
                    <th className="py-2.5 px-4 w-40">Cập nhật lần cuối</th>
                    <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2.5 px-4 text-right w-44">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-stone-500">
                        {isLoadingRAG ? 'Đang đọc danh sách file tri thức...' : 'Chưa có file nguồn nào trong thư mục Vault.'}
                      </td>
                    </tr>
                  ) : (
                    sources.map((src, idx) => {
                      const isMarkdown = src.file_type === 'MD' || src.file_type === 'TXT';
                      return (
                        <tr
                          key={idx}
                          className="transition-colors hover:bg-[#F2EFE9]/50"
                          style={{ borderBottom: '1px solid #E9E5DC' }}
                        >
                          {/* Filename with icon */}
                          <td className="py-2.5 px-4 font-bold text-xs" style={{ color: '#262626' }}>
                            <div className="flex items-center gap-2">
                              {src.file_type === 'MD' ? (
                                <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                              ) : src.file_type === 'PDF' ? (
                                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : (
                                <File className="w-4 h-4 text-amber-600 shrink-0" />
                              )}
                              <span className="truncate max-w-xs">{src.filename}</span>
                            </div>
                          </td>

                          {/* File Type */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block"
                              style={{
                                backgroundColor: src.file_type === 'MD' ? '#EEF2FF' : '#E9E5DC',
                                borderColor: src.file_type === 'MD' ? '#C7D2FE' : '#BFBFBD',
                                color: src.file_type === 'MD' ? '#4338CA' : '#262626',
                              }}
                            >
                              {src.file_type}
                            </span>
                          </td>

                          {/* File Size */}
                          <td className="py-2.5 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                            {src.file_size_kb} KB
                          </td>

                          {/* Storage Location */}
                          <td className="py-2.5 px-3 text-center font-bold text-[11px]" style={{ color: '#262626' }}>
                            <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                              {src.file_type === 'MD' ? 'Knowledge Vault' : 'Uploads'}
                            </span>
                          </td>

                          {/* Last Modified */}
                          <td className="py-2.5 px-4 text-[11px] font-mono" style={{ color: '#8C8C8C' }}>
                            {src.last_modified}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1"
                              style={{
                                backgroundColor: '#DCFCE7',
                                borderColor: '#BBF7D0',
                                color: '#15803D',
                              }}
                            >
                              <Check className="w-3 h-3" />
                              <span>{src.status || 'Active'}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isMarkdown && (
                                <button
                                  onClick={() => handleOpenSourceEditor(src)}
                                  className="px-2.5 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100 transition-all flex items-center gap-1"
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    borderColor: '#BFBFBD',
                                    color: '#262626',
                                  }}
                                  title="Mở trình soạn thảo Markdown trực tiếp"
                                >
                                  <Edit2 className="w-3 h-3 text-indigo-600" />
                                  <span>Xem & sửa</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteSourceFile(src.filename)}
                                className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#BFBFBD',
                                  color: '#8C8C8C',
                                }}
                                title="Xóa file khỏi kho tri thức"
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
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: KỊCH BẢN HỘI THOẠI & FAST-PATH (SCENARIOS)                 */}
      {/* =================================================================== */}
      {currentTab === 'scenarios' && (
        <div className="p-5 space-y-4">
          {/* KPI STATS BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Tổng kịch bản</div>
                <div className="text-lg font-black mt-0.5" style={{ color: '#262626' }}>{scenarios.length}</div>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F2EFE9]" style={{ color: '#262626' }}>
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Phản xạ Fast-Path</div>
                <div className="text-lg font-black mt-0.5 text-emerald-600">{totalFastPath}</div>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                <Zap className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Đang hoạt động</div>
                <div className="text-lg font-black mt-0.5 text-blue-600">{totalActive}</div>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Độ trễ đối soát</div>
                <div className="text-lg font-black mt-0.5 text-indigo-600">&lt; 0.1 ms</div>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div
            className="p-3 rounded-xl border bg-white flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: '#BFBFBD' }}
          >
            {/* Search box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: '#8C8C8C' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm kịch bản, từ khóa, câu trả lời..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none transition-colors"
                style={{
                  borderColor: '#BFBFBD',
                  backgroundColor: '#F2EFE9',
                  color: '#262626',
                }}
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {['All', 'facility', 'faq', 'greeting', 'service', 'chitchat'].map((cat) => {
                const isSelected = categoryFilter === cat;
                const label = cat === 'All' ? 'Tất cả' : CATEGORY_MAP[cat]?.label || cat;
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
              <span>Chỉ Fast-Path</span>
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
                    <th className="py-2.5 px-4 w-52">Tiêu đề & Danh mục</th>
                    <th className="py-2.5 px-3 w-64">Từ khóa kích hoạt</th>
                    <th className="py-2.5 px-3">Phản hồi thoại (VI / EN)</th>
                    <th className="py-2.5 px-3 w-36 text-center">Hành động</th>
                    <th className="py-2.5 px-3 w-32 text-center">Cơ chế</th>
                    <th className="py-2.5 px-3 w-20 text-center">Ưu tiên</th>
                    <th className="py-2.5 px-4 text-right w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {displayScenarios.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {isLoadingScenarios ? 'Đang tải dữ liệu kịch bản...' : 'Chưa có kịch bản nào phù hợp với bộ lọc.'}
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
                                {catStyle.label}
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
                                  +{keywords.length - 4} từ
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

                          {/* Action */}
                          <td className="py-2.5 px-3 text-center">
                            {item.action_type === 'show_map' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{item.action_payload?.destination_key || 'Sơ đồ'}</span>
                              </span>
                            ) : item.action_type === 'call_reception' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                <span>Video Call</span>
                              </span>
                            ) : (
                              <span className="text-stone-400 text-[11px]">—</span>
                            )}
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
                                {item.is_active ? '● Bật' : '○ Tắt'}
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
                                title="Sửa kịch bản"
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
                                title="Xóa kịch bản"
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
              itemName="kịch bản"
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: SOẠN THẢO & XEM TRƯỚC FILE MARKDOWN SOURCE                   */}
      {/* =================================================================== */}
      {editingSourceFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div
            className="max-w-4xl w-full rounded-2xl border p-5 space-y-3.5 shadow-2xl flex flex-col max-h-[90vh]"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                  <FileCode className="w-4 h-4" />
                </div>
                {editingSourceFile.isNew ? (
                  <div className="flex-1 max-w-sm">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 mb-0.5">
                      Tên file Markdown mới (.md) *
                    </label>
                    <input
                      type="text"
                      value={newSourceFileName}
                      onChange={(e) => setNewSourceFileName(e.target.value)}
                      placeholder="Ví dụ: quy_dinh_khach_san.md"
                      className="w-full px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                      Chỉnh sửa file nguồn: <span className="font-mono text-indigo-700">{editingSourceFile.filename}</span>
                    </h3>
                    <p className="text-[10px] text-stone-500">
                      Nội dung lưu trực tiếp vào <code>backend/knowledge_vault/</code> và tự động nạp vào bộ nhớ Robot
                    </p>
                  </div>
                )}
              </div>

              {/* Mode switch & Close */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-stone-100" style={{ borderColor: '#BFBFBD' }}>
                  <button
                    onClick={() => setEditorModeTab('edit')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      editorModeTab === 'edit'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Soạn thảo
                  </button>
                  <button
                    onClick={() => setEditorModeTab('preview')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      editorModeTab === 'preview'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Xem trước (Preview)
                  </button>
                </div>

                <button
                  onClick={() => setEditingSourceFile(null)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor / Preview Content Area */}
            <div className="flex-1 min-h-[360px] max-h-[55vh] overflow-y-auto custom-scrollbar border rounded-xl p-3 bg-stone-50" style={{ borderColor: '#E9E5DC' }}>
              {editorModeTab === 'edit' ? (
                <textarea
                  value={sourceMarkdownContent}
                  onChange={(e) => setSourceMarkdownContent(e.target.value)}
                  placeholder="Nhập nội dung tài liệu Markdown tại đây..."
                  className="w-full h-full min-h-[340px] font-mono text-xs p-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y leading-relaxed text-stone-900"
                />
              ) : (
                <div className="p-4 bg-white rounded-lg border border-stone-200 min-h-[340px]">
                  {renderMarkdownPreview(sourceMarkdownContent)}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: '#E9E5DC' }}>
              <div className="text-[11px] text-stone-500">
                Độ dài: <strong>{sourceMarkdownContent.length}</strong> ký tự • {sourceMarkdownContent.split('\n').length} dòng
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSourceFile(null)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-stone-100 transition-colors cursor-pointer"
                  style={{ borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Hủy
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
                      <span>Đang lưu & nạp vào Robot...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingSourceFile.isNew ? 'Tạo File & Nạp Vào Robot' : 'Lưu Thay Đổi & Nạp Vào Robot'}</span>
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
                {editingId ? 'Cập Nhật Kịch Bản Hội Thoại' : 'Thêm Kịch Bản Hội Thoại Mới'}
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
                  Tiêu đề kịch bản *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ví dụ: Mật khẩu Wi-Fi sảnh"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="facility">Tiện ích (facility)</option>
                    <option value="faq">Hỏi đáp (faq)</option>
                    <option value="greeting">Lời chào (greeting)</option>
                    <option value="service">Dịch vụ (service)</option>
                    <option value="chitchat">Trò chuyện (chitchat)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Độ ưu tiên (0 - 100)
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
                  Từ khóa kích hoạt (Cách nhau bởi dấu phẩy)
                </label>
                <input
                  type="text"
                  value={formData.match_keywords}
                  onChange={(e) => setFormData({ ...formData, match_keywords: e.target.value })}
                  placeholder="wifi, pass wifi, mật khẩu wifi, kết nối mạng"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-mono text-[11px] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Câu trả lời tiếng Việt *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.response_vi}
                  onChange={(e) => setFormData({ ...formData, response_vi: e.target.value })}
                  placeholder="Dạ wifi miễn phí tại sảnh là Aurora_Guest, mật khẩu là aurora2026 ạ."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Câu trả lời tiếng Anh (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={formData.response_en}
                  onChange={(e) => setFormData({ ...formData, response_en: e.target.value })}
                  placeholder="Complimentary Wi-Fi is Aurora_Guest, password is aurora2026."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Hành động kèm theo
                  </label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="none">Không có (Chỉ trả lời thoại)</option>
                    <option value="show_map">Hiện bản đồ / Điều hướng</option>
                    <option value="call_reception">Gọi Video Call Lễ Tân</option>
                  </select>
                </div>

                {formData.action_type === 'show_map' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                      Mã địa điểm (Destination Key)
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
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_fast_path}
                    onChange={(e) => setFormData({ ...formData, is_fast_path: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">Bật Fast-Path (&lt; 1ms In-Memory)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">Kích hoạt kịch bản</span>
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
                  Hủy
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
                  {isSubmitting ? 'Đang lưu...' : editingId ? 'Lưu Thay Đổi' : 'Tạo Kịch Bản'}
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
                    Cấu Hình Tốc Độ Nói Robot
                  </h3>
                  <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    EdgeTTS Neural & Kiosk Speech Synthesis
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
                    Tốc độ phát âm ({tempRate}x)
                  </label>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {tempRate === 1.0 ? 'Chuẩn (1.0x)' : tempRate < 1.0 ? `Chậm (${tempRate}x)` : `Nhanh (${tempRate}x)`}
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
                  <div className="text-[11px] font-bold text-stone-700">Giọng đọc Robot (Rora)</div>
                  <div className="text-[10px] text-stone-500">EdgeTTS Hoài My Neural (Chuẩn tự nhiên)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Hoài My (Nữ)
                </span>
              </div>

              {/* Nút nghe thử trực tiếp */}
              <div className="p-3 bg-stone-100 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: '#E9E5DC' }}>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-800 truncate">Nghe thử câu chào mẫu</div>
                  <div className="text-[10px] text-stone-500 truncate">Kiểm tra tốc độ trước khi áp dụng</div>
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
                      <span>Dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Nghe Thử</span>
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
                Hủy
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
                <span>{isSavingVoice ? 'Đang lưu...' : 'Lưu & Áp Dụng Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
