import { useEffect } from 'react';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  reloadScenariosCache,
} from '../../../services/scenariosApi';
import { deleteScenario } from '../../../services/scenariosApi';
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
import {
  DEFAULT_FORM_STATE,
  buildStarterKnowledgeTemplate,
} from './adminKnowledgeUtils';

/** Manages RAG vault sync/editing, voice preview/saving, and scenario CRUD handlers. */
export const useAdminKnowledgeHandlers = ({
  t,
  isEN,
  showNotification,
  setStats,
  sources,
  setSources,
  setIsLoadingRAG,
  selectedUploadFile,
  setSelectedUploadFile,
  uploadCategory,
  fileInputRef,
  setIsUploading,
  editingSourceFile,
  setEditingSourceFile,
  sourceMarkdownContent,
  setSourceMarkdownContent,
  newSourceFileName,
  setNewSourceFileName,
  setEditorModeTab,
  setIsSourceModalMaximized,
  setIsSavingSource,
  setScenarios,
  setIsLoadingScenarios,
  categoryFilter,
  searchQuery,
  fastPathOnly,
  setCurrentPage,
  setIsModalOpen,
  editingId,
  setEditingId,
  formData,
  setFormData,
  setIsSubmitting,
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  setIsDeleting,
  setIsTemplateCopied,
  voiceSettings,
  setVoiceSettings,
  setIsVoiceModalOpen,
  tempRate,
  setTempRate,
  tempVoice,
  setTempVoice,
  setIsSavingVoice,
  isTestSpeaking,
  setIsTestSpeaking,
  setIsSyncingBilingual,
  totalFastPath,
}) => {
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
    navigator.clipboard.writeText(buildStarterKnowledgeTemplate(isEN));
    setIsTemplateCopied(true);
    showNotification(t('knowledgeTemplateCopied'));
    setTimeout(() => setIsTemplateCopied(false), 2500);
  };

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


  return {
    handleOpenVoiceModal,
    handleCloseVoiceModal,
    handleTestVoice,
    handleSaveVoiceSettings,
    loadRAGData,
    loadScenariosData,
    handleSyncObsidian,
    handleSyncBilingual,
    handleSelectFile,
    handleUploadFileSubmit,
    handleOpenSourceEditor,
    handleOpenCreateSourceModal,
    handleSaveSourceMarkdown,
    handleDeleteSourceFile,
    handleExecuteConfirmDelete,
    handleCopyStarterTemplate,
    handleReloadCache,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleSubmitModal,
    handleDeleteScenario,
  };
};
