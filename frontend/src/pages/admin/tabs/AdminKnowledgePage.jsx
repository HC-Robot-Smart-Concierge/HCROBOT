import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { DEFAULT_FORM_STATE } from './adminKnowledgeUtils';
import { useAdminKnowledgeHandlers } from './useAdminKnowledgeHandlers';
import { AdminKnowledgeHeaderAndNav } from './AdminKnowledgeHeaderAndNav';
import { AdminKnowledgeVaultView } from './AdminKnowledgeVaultView';
import { AdminKnowledgeScenariosView } from './AdminKnowledgeScenariosView';
import { AdminKnowledgeSourceEditorModal } from './AdminKnowledgeSourceEditorModal';
import { AdminKnowledgeScenarioAndVoiceModals } from './AdminKnowledgeScenarioAndVoiceModals';
import { AdminKnowledgeGuideAndDeleteModals } from './AdminKnowledgeGuideAndDeleteModals';

export const AdminKnowledgePage = ({ activeSubView = 'sources', onSelectSubView = () => {} }) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';

  const [currentTab, setCurrentTab] = useState(() => (activeSubView === 'scenarios' ? 'scenarios' : 'sources'));

  useEffect(() => {
    if (activeSubView) {
      setCurrentTab(activeSubView === 'scenarios' ? 'scenarios' : 'sources');
    }
  }, [activeSubView]);

  const handleSwitchTab = (tab) => {
    setCurrentTab(tab);
    onSelectSubView?.(tab);
  };

  const [actionMessage, setActionMessage] = useState(null);
  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

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
  const [isSyncingBilingual, setIsSyncingBilingual] = useState(false);

  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const [editingSourceFile, setEditingSourceFile] = useState(null);
  const [sourceMarkdownContent, setSourceMarkdownContent] = useState('');
  const [newSourceFileName, setNewSourceFileName] = useState('');
  const [editorModeTab, setEditorModeTab] = useState('table');
  const [isSourceModalMaximized, setIsSourceModalMaximized] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);

  const [scenarios, setScenarios] = useState([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [fastPathOnly, setFastPathOnly] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const scenarioPageSize = 10;

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isShowMdGuide, setIsShowMdGuide] = useState(false);
  const [isTemplateCopied, setIsTemplateCopied] = useState(false);

  const [voiceSettings, setVoiceSettings] = useState({
    speech_rate: 1.0,
    vi_voice: 'vi-VN-HoaiMyNeural',
    en_voice: 'en-US-JennyNeural',
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [tempRate, setTempRate] = useState(1.0);
  const [tempVoice, setTempVoice] = useState('vi-VN-HoaiMyNeural');
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [isTestSpeaking, setIsTestSpeaking] = useState(false);

  const displayScenarios = scenarios.filter((scn) => {
    if (fastPathOnly && !scn.is_fast_path) return false;
    return true;
  });

  const paginatedScenarios = displayScenarios.slice(
    (currentPage - 1) * scenarioPageSize,
    currentPage * scenarioPageSize
  );

  const totalFastPath = scenarios.filter((s) => s.is_fast_path).length;

  const {
    handleOpenVoiceModal,
    handleCloseVoiceModal,
    handleTestVoice,
    handleSaveVoiceSettings,
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
  } = useAdminKnowledgeHandlers({
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
  });

  return (
    <div className="w-full flex flex-col min-h-full pb-8 font-sans select-none" style={{ color: '#262626' }}>
      <AdminKnowledgeHeaderAndNav
        actionMessage={actionMessage}
        currentTab={currentTab}
        handleSwitchTab={handleSwitchTab}
        sources={sources}
        scenarios={scenarios}
        isLoadingRAG={isLoadingRAG}
        isLoadingScenarios={isLoadingScenarios}
        isSyncingBilingual={isSyncingBilingual}
        voiceSettings={voiceSettings}
        handleOpenVoiceModal={handleOpenVoiceModal}
        setIsShowMdGuide={setIsShowMdGuide}
        handleSyncObsidian={handleSyncObsidian}
        handleSyncBilingual={handleSyncBilingual}
        handleOpenCreateSourceModal={handleOpenCreateSourceModal}
        handleReloadCache={handleReloadCache}
        handleOpenCreateModal={handleOpenCreateModal}
      />

      <AdminKnowledgeVaultView
        currentTab={currentTab}
        stats={stats}
        sources={sources}
        fileInputRef={fileInputRef}
        selectedUploadFile={selectedUploadFile}
        setSelectedUploadFile={setSelectedUploadFile}
        uploadCategory={uploadCategory}
        setUploadCategory={setUploadCategory}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
        isUploading={isUploading}
        handleSelectFile={handleSelectFile}
        handleUploadFileSubmit={handleUploadFileSubmit}
        handleOpenSourceEditor={handleOpenSourceEditor}
        handleDeleteSourceFile={handleDeleteSourceFile}
      />

      <AdminKnowledgeScenariosView
        currentTab={currentTab}
        scenarios={scenarios}
        displayScenarios={displayScenarios}
        paginatedScenarios={paginatedScenarios}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        fastPathOnly={fastPathOnly}
        setFastPathOnly={setFastPathOnly}
        isLoadingScenarios={isLoadingScenarios}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        scenarioPageSize={scenarioPageSize}
        handleOpenEditModal={handleOpenEditModal}
        handleDeleteScenario={handleDeleteScenario}
      />

      <AdminKnowledgeSourceEditorModal
        editingSourceFile={editingSourceFile}
        setEditingSourceFile={setEditingSourceFile}
        sources={sources}
        handleOpenSourceEditor={handleOpenSourceEditor}
        isSourceModalMaximized={isSourceModalMaximized}
        setIsSourceModalMaximized={setIsSourceModalMaximized}
        newSourceFileName={newSourceFileName}
        setNewSourceFileName={setNewSourceFileName}
        editorModeTab={editorModeTab}
        setEditorModeTab={setEditorModeTab}
        sourceMarkdownContent={sourceMarkdownContent}
        setSourceMarkdownContent={setSourceMarkdownContent}
        isSavingSource={isSavingSource}
        handleSaveSourceMarkdown={handleSaveSourceMarkdown}
      />

      <AdminKnowledgeScenarioAndVoiceModals
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        handleSubmitModal={handleSubmitModal}
        isVoiceModalOpen={isVoiceModalOpen}
        handleCloseVoiceModal={handleCloseVoiceModal}
        tempRate={tempRate}
        setTempRate={setTempRate}
        isTestSpeaking={isTestSpeaking}
        handleTestVoice={handleTestVoice}
        isSavingVoice={isSavingVoice}
        handleSaveVoiceSettings={handleSaveVoiceSettings}
      />

      <AdminKnowledgeGuideAndDeleteModals
        deleteConfirmTarget={deleteConfirmTarget}
        setDeleteConfirmTarget={setDeleteConfirmTarget}
        isDeleting={isDeleting}
        handleExecuteConfirmDelete={handleExecuteConfirmDelete}
        isShowMdGuide={isShowMdGuide}
        setIsShowMdGuide={setIsShowMdGuide}
        isTemplateCopied={isTemplateCopied}
        handleCopyStarterTemplate={handleCopyStarterTemplate}
      />
    </div>
  );
};
