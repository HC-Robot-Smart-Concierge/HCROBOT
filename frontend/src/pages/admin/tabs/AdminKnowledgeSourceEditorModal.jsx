import React from 'react';
import {
  RefreshCw,
  X,
  FileCode,
  Eye,
  Save,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  Languages,
} from 'lucide-react';
import { KnowledgeTableEditor } from '../../../components/admin/KnowledgeTableEditor';
import { useLanguage } from '../../../context/LanguageContext';
import { renderMarkdownPreview } from './adminKnowledgeUtils';

export const AdminKnowledgeSourceEditorModal = ({
  editingSourceFile,
  setEditingSourceFile,
  sources,
  handleOpenSourceEditor,
  isSourceModalMaximized,
  setIsSourceModalMaximized,
  newSourceFileName,
  setNewSourceFileName,
  editorModeTab,
  setEditorModeTab,
  sourceMarkdownContent,
  setSourceMarkdownContent,
  isSavingSource,
  handleSaveSourceMarkdown,
}) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';
  return (
    <>
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
                  {renderMarkdownPreview(sourceMarkdownContent, isEN)}
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

    </>
  );
};
