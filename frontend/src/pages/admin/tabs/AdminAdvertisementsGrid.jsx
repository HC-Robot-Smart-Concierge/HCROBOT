import React from 'react';
import { UploadCloud, Trash2, Edit2, Send, Eye, CheckCircle2, XCircle, AlertCircle, Tv } from 'lucide-react';

export const AdminAdvertisementsGrid = ({
  t, language, totalActive, totalVideos, totalImages, searchQuery, setSearchQuery, filterType, setFilterType, error, loadData, loading, filteredAds, ads, resetUploadForm, setIsUploadModalOpen, setPreviewAd, handlePushToRobot, pushingAdId, handleToggleActive, handleOpenEdit, handleDelete,
}) => (
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
);
