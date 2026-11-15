import React from 'react';
import { Send, X, Sliders } from 'lucide-react';

export const AdminAdvertisementPreviewModals = ({
  language, previewAd, setPreviewAd, handlePushToRobot, editingAd, setEditingAd, handleSaveEdit, isSavingEdit,
}) => (
  <>
      {previewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-4xl rounded-3xl border border-neutral-700 bg-black overflow-hidden shadow-2xl flex flex-col">
            {/* Header bar */}
            <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 text-white">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                <span className="text-xs font-mono font-bold text-neutral-300 ml-2">
                  {t('adsSimModalBar').replace('{type}', previewAd.media_type).replace('{title}', previewAd.title)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePushToRobot(previewAd)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('adsSimBtnPushReal')}</span>
                </button>
                <button
                  onClick={() => setPreviewAd(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Simulated Robot Display Screen */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {previewAd.media_type === 'VIDEO' ? (
                <video
                  src={previewAd.media_url}
                  autoPlay
                  controls
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewAd.media_url}
                  alt={previewAd.title}
                  className="w-full h-full object-contain"
                />
              )}

              {/* Watermark Bottom Info */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 text-white flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold">{previewAd.title}</div>
                  <div className="text-[11px] text-neutral-300 line-clamp-1">{previewAd.description}</div>
                </div>
                <div className="text-right text-[10px] font-mono text-neutral-400">
                  {t('adsSimWatermark').replace('{duration}', previewAd.duration_seconds).replace('{priority}', previewAd.priority)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Settings Modal */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5" style={{ color: '#262626' }} />
                <h3 className="text-sm font-black" style={{ color: '#262626' }}>
                  {t('adsEditModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => setEditingAd(null)}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelTitle')}
                </label>
                <input
                  type="text"
                  required
                  value={editingAd.title}
                  onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelDesc')}
                </label>
                <textarea
                  rows={2}
                  value={editingAd.description || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelDuration')}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={editingAd.duration_seconds}
                    onChange={(e) => setEditingAd({ ...editingAd, duration_seconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelPriority')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editingAd.priority}
                    onChange={(e) => setEditingAd({ ...editingAd, priority: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelLocation')}
                </label>
                <select
                  value={editingAd.display_location}
                  onChange={(e) => setEditingAd({ ...editingAd, display_location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                >
                  <option value="ALL">{t('adsOptLocAll')}</option>
                  <option value="IDLE_STANDBY">{t('adsOptLocIdle')}</option>
                  <option value="WORKFLOW">{t('adsOptLocWorkflow')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editingAd.is_active}
                  onChange={(e) => setEditingAd({ ...editingAd, is_active: e.target.checked })}
                  className="w-4 h-4 cursor-pointer accent-black"
                />
                <label htmlFor="editIsActive" className="text-xs font-bold cursor-pointer" style={{ color: '#262626' }}>
                  {t('adsLabelActivateEdit')}
                </label>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingAd(null)}
                  className="px-4 py-2 rounded-lg border text-xs font-bold cursor-pointer hover:bg-black/5"
                  style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
                >
                  {t('adsBtnCancel')}
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {isSavingEdit ? t('adsBtnSavingEdit') : t('adsBtnSaveEdit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>
);
