import React from 'react';
import { UploadCloud, Plus, Link as LinkIcon, X } from 'lucide-react';

export const AdminAdvertisementUploadModals = ({
  language, isUploadModalOpen, setIsUploadModalOpen, handleUploadSubmit, fileInputRef, handleFileChange, uploadPreviewUrl, formMediaType, uploadFile, formTitle, setFormTitle, formDescription, setFormDescription, formDuration, setFormDuration, formPriority, setFormPriority, formDisplayLocation, setFormDisplayLocation, formIsActive, setFormIsActive, isUploading, isUrlModalOpen, setIsUrlModalOpen, handleCreateByUrlSubmit, formMediaUrl, setFormMediaUrl, setFormMediaType,
}) => (
  <>
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5" style={{ color: '#262626' }} />
                <h3 className="text-sm font-black" style={{ color: '#262626' }}>
                  {t('adsUploadModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }
                }}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* File drop area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-black hover:bg-black/2 relative"
                style={{ borderColor: '#BFBFBD' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadPreviewUrl ? (
                  <div className="space-y-2">
                    <div className="relative aspect-video max-h-44 mx-auto rounded-lg overflow-hidden bg-black">
                      {formMediaType === 'VIDEO' ? (
                        <video src={uploadPreviewUrl} className="w-full h-full object-contain" controls />
                      ) : (
                        <img src={uploadPreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">
                      {t('adsDropzoneSelected')
                        .replace('{name}', uploadFile?.name || '')
                        .replace('{size}', ((uploadFile?.size || 0) / 1024 / 1024).toFixed(2))}
                    </div>
                    <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                      {t('adsDropzoneReselect')}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <UploadCloud className="w-10 h-10 mx-auto" style={{ color: '#8C8C8C' }} />
                    <div className="text-xs font-bold" style={{ color: '#262626' }}>
                      {t('adsDropzonePrompt')}
                    </div>
                    <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                      {t('adsDropzoneHint')}
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelTitle')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('adsPlaceholderTitle')}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelDesc')}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('adsPlaceholderDesc')}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              {/* Duration and Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelDuration')}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
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
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  />
                </div>
              </div>

              {/* Display Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelLocation')}
                </label>
                <select
                  value={formDisplayLocation}
                  onChange={(e) => setFormDisplayLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                >
                  <option value="ALL">{t('adsOptLocAll')}</option>
                  <option value="IDLE_STANDBY">{t('adsOptLocIdle')}</option>
                  <option value="WORKFLOW">{t('adsOptLocWorkflow')}</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-black"
                />
                <label htmlFor="formIsActive" className="text-xs font-bold cursor-pointer" style={{ color: '#262626' }}>
                  {t('adsLabelActivateUpload')}
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-4 py-2 rounded-lg border text-xs font-bold cursor-pointer hover:bg-black/5"
                  style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
                >
                  {t('adsBtnCancel')}
                </button>

                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('adsBtnUploading')}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>{t('adsBtnStartUpload')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add by External URL */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
            style={{ borderColor: '#BFBFBD' }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" style={{ color: '#262626' }} />
                <h3 className="text-sm font-black" style={{ color: '#262626' }}>
                  {t('adsUrlModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setIsUrlModalOpen(false);
                    resetUploadForm();
                  }
                }}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateByUrlSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Media URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelMediaUrl')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formMediaUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setFormMediaUrl(url);
                    if (/\.(mp4|webm|mov)$/i.test(url)) {
                      setFormMediaType('VIDEO');
                    } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(url)) {
                      setFormMediaType('IMAGE');
                    }
                  }}
                  placeholder={t('adsPlaceholderMediaUrl')}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black font-mono"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              {/* Media Type Select */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelMediaType')}
                  </label>
                  <select
                    value={formMediaType}
                    onChange={(e) => setFormMediaType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  >
                    <option value="IMAGE">{t('adsOptTypeImage')}</option>
                    <option value="VIDEO">{t('adsOptTypeVideo')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelDuration')}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelTitle')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('adsPlaceholderTitle')}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold" style={{ color: '#262626' }}>
                  {t('adsLabelDesc')}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('adsPlaceholderDesc')}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                />
              </div>

              {/* Priority & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelPriority')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold" style={{ color: '#262626' }}>
                    {t('adsLabelLocation')}
                  </label>
                  <select
                    value={formDisplayLocation}
                    onChange={(e) => setFormDisplayLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                  >
                    <option value="ALL">{t('adsLocAll')}</option>
                    <option value="IDLE_STANDBY">{t('adsLocIdle')}</option>
                    <option value="WORKFLOW">{t('adsLocWorkflow')}</option>
                  </select>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formUrlIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-black"
                />
                <label htmlFor="formUrlIsActive" className="text-xs font-bold cursor-pointer" style={{ color: '#262626' }}>
                  {t('adsLabelActivateUrl')}
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setIsUrlModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-4 py-2 rounded-lg border text-xs font-bold cursor-pointer hover:bg-black/5"
                  style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
                >
                  {t('adsBtnCancel')}
                </button>

                <button
                  type="submit"
                  disabled={isUploading || !formMediaUrl}
                  className="px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('adsBtnSaveAd')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

  </>
);
