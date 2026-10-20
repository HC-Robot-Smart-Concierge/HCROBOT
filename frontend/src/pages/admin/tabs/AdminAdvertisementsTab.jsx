import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Play,
  Pause,
  Trash2,
  Edit2,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Clock,
  Sparkles,
  Link as LinkIcon,
  X,
  Sliders,
  AlertCircle,
  Tv,
} from 'lucide-react';
import {
  fetchAdvertisements,
  uploadAdvertisement,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  pushAdvertisementToRobot,
} from '../../../services/advertisementApi';
import { useLanguage } from '../../../context/LanguageContext';

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
      <div className="p-4 sm:p-5 space-y-4">
        {/* Stats counter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border bg-white shadow-2xs" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[11px] font-bold" style={{ color: '#8C8C8C' }}>{t('adsCardTotal')}</div>
            <div className="text-xl font-black mt-1" style={{ color: '#262626' }}>{ads.length}</div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white shadow-2xs" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[11px] font-bold" style={{ color: '#8C8C8C' }}>{t('adsCardActive')}</div>
            <div className="text-xl font-black mt-1 text-emerald-700">{totalActive}</div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white shadow-2xs" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[11px] font-bold" style={{ color: '#8C8C8C' }}>{t('adsCardVideos')}</div>
            <div className="text-xl font-black mt-1" style={{ color: '#262626' }}>{totalVideos}</div>
          </div>

          <div className="p-3.5 rounded-xl border bg-white shadow-2xs" style={{ borderColor: '#BFBFBD' }}>
            <div className="text-[11px] font-bold" style={{ color: '#8C8C8C' }}>{t('adsCardImages')}</div>
            <div className="text-xl font-black mt-1" style={{ color: '#262626' }}>{totalImages}</div>
          </div>
        </div>

        {/* Filter and search toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl border bg-white shadow-2xs" style={{ borderColor: '#BFBFBD' }}>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {['ALL', 'IMAGE', 'VIDEO'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={{
                  backgroundColor: filterType === type ? '#262626' : 'transparent',
                  color: filterType === type ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                {type === 'ALL' ? t('adsFilterAll') : type === 'IMAGE' ? t('adsFilterImages') : t('adsFilterVideos')}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('adsSearchPlaceholder')}
              className="w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-black"
              style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
            />
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="p-16 text-center text-xs" style={{ color: '#8C8C8C' }}>
            <div className="inline-block animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mb-2" />
            <div>{t('adsLoading')}</div>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button onClick={loadData} className="px-3 py-1 rounded bg-red-600 text-white font-bold cursor-pointer">
              {t('adsRetry')}
            </button>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="p-16 text-center rounded-2xl border bg-white space-y-3" style={{ borderColor: '#BFBFBD' }}>
            <Tv className="w-10 h-10 mx-auto stroke-1" style={{ color: '#8C8C8C' }} />
            <div className="text-sm font-bold" style={{ color: '#262626' }}>{t('adsEmptyTitle')}</div>
            <p className="text-xs max-w-sm mx-auto" style={{ color: '#8C8C8C' }}>
              {t('adsEmptySubtitle')}
            </p>
            <button
              onClick={() => {
                resetUploadForm();
                setIsUploadModalOpen(true);
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-90"
              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
            >
              <UploadCloud className="w-4 h-4" />
              <span>{t('adsBtnUploadNow')}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAds.map((ad) => {
              const isVideo = ad.media_type === 'VIDEO';
              return (
                <div
                  key={ad.id}
                  className={`rounded-2xl border bg-white overflow-hidden shadow-2xs flex flex-col justify-between transition-all hover:shadow-md ${
                    !ad.is_active ? 'opacity-65' : ''
                  }`}
                  style={{ borderColor: '#BFBFBD' }}
                >
                  {/* Media Preview Box */}
                  <div className="relative aspect-video bg-neutral-900 overflow-hidden group">
                    {isVideo ? (
                      <video
                        src={ad.media_url}
                        poster={ad.thumbnail_url || undefined}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={ad.media_url}
                        alt={ad.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}

                    {/* Overlays / Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider shadow-sm"
                        style={{
                          backgroundColor: isVideo ? '#4B2585' : '#1A6B54',
                          color: '#FFFFFF',
                        }}
                      >
                        {isVideo ? t('adsBadgeVideo') : t('adsBadgeImage')}
                      </span>

                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-extrabold shadow-sm"
                        style={{
                          backgroundColor: ad.is_active ? '#065F46' : '#525252',
                          color: '#FFFFFF',
                        }}
                      >
                        {ad.is_active ? t('adsBadgeActive') : t('adsBadgeInactive')}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 z-10">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/70 text-white backdrop-blur-xs"
                        title={t('adsLabelDuration')}
                      >
                        {ad.duration_seconds}s
                      </span>
                    </div>

                    {/* Quick Action Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                      <button
                        onClick={() => setPreviewAd(ad)}
                        className="p-2 rounded-full bg-white/90 text-black hover:bg-white hover:scale-110 transition-all cursor-pointer shadow-lg"
                        title={t('adsPreviewTooltip')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handlePushToRobot(ad)}
                        disabled={pushingAdId === ad.id}
                        className="px-3 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500 hover:scale-105 transition-all cursor-pointer shadow-lg"
                        title={t('adsPushTooltip')}
                      >
                        <Send className={`w-3.5 h-3.5 ${pushingAdId === ad.id ? 'animate-bounce' : ''}`} />
                        <span>{pushingAdId === ad.id ? t('adsPushingBtn') : t('adsPushBtn')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Info Content */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold line-clamp-1" title={ad.title} style={{ color: '#262626' }}>
                          {ad.title}
                        </h3>
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0"
                          style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9', color: '#262626' }}
                          title={t('adsPriorityLabel')}
                        >
                          P{ad.priority}
                        </span>
                      </div>

                      {ad.description ? (
                        <p className="text-xs line-clamp-2" style={{ color: '#8C8C8C' }}>
                          {ad.description}
                        </p>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#BFBFBD' }}>
                          {t('adsNoDesc')}
                        </p>
                      )}
                    </div>

                    {/* Metadata and Actions footer */}
                    <div className="pt-3 border-t space-y-2.5" style={{ borderColor: '#E9E5DC' }}>
                      <div className="flex items-center justify-between text-[11px]" style={{ color: '#8C8C8C' }}>
                        <span>
                          {t('adsLocationLabel')}{' '}
                          <strong style={{ color: '#262626' }}>
                            {ad.display_location === 'ALL'
                              ? t('adsLocAll')
                              : ad.display_location === 'IDLE_STANDBY'
                              ? t('adsLocIdle')
                              : t('adsLocWorkflow')}
                          </strong>
                        </span>
                        <span className="font-mono text-[10px] uppercase text-stone-400">
                          {ad.media_type === 'VIDEO' ? '1080P' : 'IMAGE'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {/* Active toggle button */}
                        <button
                          onClick={() => handleToggleActive(ad)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                            ad.is_active
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-neutral-300 bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {ad.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{ad.is_active ? t('adsBtnActive') : t('adsBtnInactive')}</span>
                        </button>

                        {/* Edit & Delete action cluster */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(ad)}
                            className="p-1.5 rounded-md border hover:bg-black/5 transition-all cursor-pointer"
                            style={{ borderColor: '#BFBFBD', color: '#262626' }}
                            title={t('adsEditTooltip')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(ad)}
                            className="p-1.5 rounded-md border hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all cursor-pointer"
                            style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}
                            title={t('adsDeleteTooltip')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Upload to Cloudinary */}
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

      {/* MODAL 3: Fullscreen Preview (Robot Kiosk Simulation) */}
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
    </div>
  );
};
