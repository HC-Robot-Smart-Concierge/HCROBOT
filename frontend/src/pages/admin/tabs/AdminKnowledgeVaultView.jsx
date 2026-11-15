import React from 'react';
import {
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  UploadCloud,
  FileText,
  FileCode,
  Folder,
  Check,
  Database,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export const AdminKnowledgeVaultView = ({
  currentTab,
  stats,
  sources,
  fileInputRef,
  selectedUploadFile,
  setSelectedUploadFile,
  uploadCategory,
  setUploadCategory,
  isDragOver,
  setIsDragOver,
  isUploading,
  handleSelectFile,
  handleUploadFileSubmit,
  handleOpenSourceEditor,
  handleDeleteSourceFile,
}) => {
  const { t, language } = useLanguage();
  return (
    <>
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

    </>
  );
};
