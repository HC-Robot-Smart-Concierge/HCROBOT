import React from 'react';
import { Plus, RefreshCw, Zap, Volume2, Folder, Languages, BookOpen } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export const AdminKnowledgeHeaderAndNav = ({
  actionMessage,
  currentTab,
  handleSwitchTab,
  sources,
  scenarios,
  isLoadingRAG,
  isLoadingScenarios,
  isSyncingBilingual,
  voiceSettings,
  handleOpenVoiceModal,
  setIsShowMdGuide,
  handleSyncObsidian,
  handleSyncBilingual,
  handleOpenCreateSourceModal,
  handleReloadCache,
  handleOpenCreateModal,
}) => {
  const { t } = useLanguage();
  return (
    <>
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

    </>
  );
};
