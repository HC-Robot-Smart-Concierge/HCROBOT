import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, RefreshCw, Link as LinkIcon, Tv } from 'lucide-react';
import {
  fetchAdvertisements,
  uploadAdvertisement,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  pushAdvertisementToRobot,
} from '../../../services/advertisementApi';
import { useLanguage } from '../../../context/LanguageContext';
import { AdminAdvertisementsGrid } from './AdminAdvertisementsGrid';
import { AdminAdvertisementUploadModals } from './AdminAdvertisementUploadModals';
import { AdminAdvertisementPreviewModals } from './AdminAdvertisementPreviewModals';

export const AdminAdvertisementsTab = ({ currentUser, onNotify = () => {} }) => {
  const { t, language } = useLanguage();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'IMAGE' | 'VIDEO'
  const [searchQuery, setSearchQuery] = useState('');

  // Upload / Add Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State for Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMediaType, setFormMediaType] = useState('IMAGE');
  const [formDuration, setFormDuration] = useState(10);
  const [formPriority, setFormPriority] = useState(5);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDisplayLocation, setFormDisplayLocation] = useState('ALL');
  const [formMediaUrl, setFormMediaUrl] = useState('');

  // Preview Modal State
  const [previewAd, setPreviewAd] = useState(null);

  // Edit Modal State
  const [editingAd, setEditingAd] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Push state
  const [pushingAdId, setPushingAdId] = useState(null);

  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdvertisements();
      if (Array.isArray(data)) {
        setAds(data);
      }
    } catch (err) {
      setError(err.message || t('adsNotifyLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetUploadForm = () => {
    setUploadFile(null);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    setFormTitle('');
    setFormDescription('');
    setFormMediaType('IMAGE');
    setFormDuration(10);
    setFormPriority(5);
    setFormIsActive(true);
    setFormDisplayLocation('ALL');
    setFormMediaUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);

    // Auto-detect type
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
    const detectedType = isVideo ? 'VIDEO' : 'IMAGE';
    setFormMediaType(detectedType);
    if (isVideo && formDuration === 10) {
      setFormDuration(15);
    }

    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFormTitle(cleanName);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert(t('adsDropzonePrompt'));
      return;
    }
    if (!formTitle.trim()) {
      alert(t('adsLabelTitle'));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', formTitle.trim());
      if (formDescription) formData.append('description', formDescription.trim());
      formData.append('media_type', formMediaType);
      formData.append('duration_seconds', String(formDuration));
      formData.append('priority', String(formPriority));
      formData.append('is_active', String(formIsActive));
      formData.append('display_location', formDisplayLocation);

      const created = await uploadAdvertisement(formData);
      setAds((prev) => [created, ...prev]);
      setIsUploadModalOpen(false);
      resetUploadForm();
      onNotify(t('adsNotifyUploadSuccess').replace('{title}', created.title));
    } catch (err) {
      alert(err.message || t('adsNotifyUploadError').replace('{msg}', err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateByUrlSubmit = async (e) => {
    e.preventDefault();
    if (!formMediaUrl.trim()) {
      alert(t('adsLabelMediaUrl'));
      return;
    }
    if (!formTitle.trim()) {
      alert(t('adsLabelTitle'));
      return;
    }

    setIsUploading(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        media_type: formMediaType,
        media_url: formMediaUrl.trim(),
        thumbnail_url: formMediaType === 'IMAGE' ? formMediaUrl.trim() : null,
        duration_seconds: Number(formDuration),
        priority: Number(formPriority),
        is_active: formIsActive,
        display_location: formDisplayLocation,
      };

      const created = await createAdvertisement(payload);
      setAds((prev) => [created, ...prev]);
      setIsUrlModalOpen(false);
      resetUploadForm();
      onNotify(t('adsNotifyUploadSuccess').replace('{title}', created.title));
    } catch (err) {
      alert(err.message || t('adsNotifyUploadError').replace('{msg}', err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (ad) => {
    try {
      const updated = await updateAdvertisement(ad.id, { is_active: !ad.is_active });
      setAds((prev) => prev.map((item) => (item.id === ad.id ? updated : item)));
      onNotify(
        t('adsNotifyToggleActive')
          .replace('{title}', ad.title)
          .replace('{status}', updated.is_active ? t('adsNotifyActiveText') : t('adsNotifyInactiveText'))
      );
    } catch (err) {
      alert(err.message || t('adsNotifyUpdateError').replace('{msg}', err.message));
    }
  };

  const handleDelete = async (ad) => {
    const confirmMsg = t('adsNotifyConfirmDelete').replace('{title}', ad.title);
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      await deleteAdvertisement(ad.id);
      setAds((prev) => prev.filter((item) => item.id !== ad.id));
      onNotify(t('adsNotifyDeleted').replace('{title}', ad.title));
    } catch (err) {
      alert(err.message || t('adsNotifyDeleteError').replace('{msg}', err.message));
    }
  };

  const handlePushToRobot = async (ad) => {
    setPushingAdId(ad.id);
    try {
      await pushAdvertisementToRobot(ad.id);
      onNotify(t('adsNotifyPushSuccess').replace('{title}', ad.title));
    } catch (err) {
      alert(err.message || t('adsNotifyPushError').replace('{msg}', err.message));
    } finally {
      setPushingAdId(null);
    }
  };

  const handleOpenEdit = (ad) => {
    setEditingAd({ ...ad });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingAd) return;

    setIsSavingEdit(true);
    try {
      const payload = {
        title: editingAd.title,
        description: editingAd.description,
        media_type: editingAd.media_type,
        duration_seconds: Number(editingAd.duration_seconds),
        priority: Number(editingAd.priority),
        is_active: editingAd.is_active,
        display_location: editingAd.display_location,
      };
      const updated = await updateAdvertisement(editingAd.id, payload);
      setAds((prev) => prev.map((item) => (item.id === editingAd.id ? updated : item)));
      setEditingAd(null);
      onNotify(t('adsNotifyUpdateSuccess').replace('{title}', updated.title));
    } catch (err) {
      alert(err.message || t('adsNotifyUpdateError').replace('{msg}', err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtered ads
  const filteredAds = ads.filter((ad) => {
    if (filterType !== 'ALL' && ad.media_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ad.title?.toLowerCase().includes(q);
      const matchDesc = ad.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const totalActive = ads.filter((a) => a.is_active).length;
  const totalVideos = ads.filter((a) => a.media_type === 'VIDEO').length;
  const totalImages = ads.filter((a) => a.media_type === 'IMAGE').length;

  return (
    <div className="w-full flex flex-col min-h-full pb-6 select-none font-sans" style={{ color: '#262626' }}>
      {/* Header Bar - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 shrink-0" style={{ color: '#262626' }} />
            <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
              {t('adsTabTitle')}
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            {t('adsTabSubtitle')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            title={t('adsRefreshTooltip')}
            className="p-1.5 rounded-lg border hover:bg-black/5 transition-all cursor-pointer"
            style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF', color: '#262626' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              resetUploadForm();
              setIsUrlModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:bg-black/5 whitespace-nowrap"
            style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF', color: '#262626' }}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{t('adsBtnAddUrl')}</span>
          </button>

          <button
            onClick={() => {
              resetUploadForm();
              setIsUploadModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:bg-[#262626]/90 whitespace-nowrap"
            style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{t('adsBtnUploadMedia')}</span>
          </button>
        </div>
      </div>

      {/* Content Body */}

      <AdminAdvertisementsGrid
        t={t}
        language={language}
        totalActive={totalActive}
        totalVideos={totalVideos}
        totalImages={totalImages}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        error={error}
        loadData={loadData}
        loading={loading}
        filteredAds={filteredAds}
        ads={ads}
        resetUploadForm={resetUploadForm}
        setIsUploadModalOpen={setIsUploadModalOpen}
        setPreviewAd={setPreviewAd}
        handlePushToRobot={handlePushToRobot}
        pushingAdId={pushingAdId}
        handleToggleActive={handleToggleActive}
        handleOpenEdit={handleOpenEdit}
        handleDelete={handleDelete}
      />

      <AdminAdvertisementUploadModals
        language={language}
        isUploadModalOpen={isUploadModalOpen}
        setIsUploadModalOpen={setIsUploadModalOpen}
        handleUploadSubmit={handleUploadSubmit}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        uploadPreviewUrl={uploadPreviewUrl}
        formMediaType={formMediaType}
        uploadFile={uploadFile}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formDuration={formDuration}
        setFormDuration={setFormDuration}
        formPriority={formPriority}
        setFormPriority={setFormPriority}
        formDisplayLocation={formDisplayLocation}
        setFormDisplayLocation={setFormDisplayLocation}
        formIsActive={formIsActive}
        setFormIsActive={setFormIsActive}
        isUploading={isUploading}
        isUrlModalOpen={isUrlModalOpen}
        setIsUrlModalOpen={setIsUrlModalOpen}
        handleCreateByUrlSubmit={handleCreateByUrlSubmit}
        formMediaUrl={formMediaUrl}
        setFormMediaUrl={setFormMediaUrl}
        setFormMediaType={setFormMediaType}
      />

      <AdminAdvertisementPreviewModals
        language={language}
        previewAd={previewAd}
        setPreviewAd={setPreviewAd}
        handlePushToRobot={handlePushToRobot}
        editingAd={editingAd}
        setEditingAd={setEditingAd}
        handleSaveEdit={handleSaveEdit}
        isSavingEdit={isSavingEdit}
      />
    </div>
  );
};
