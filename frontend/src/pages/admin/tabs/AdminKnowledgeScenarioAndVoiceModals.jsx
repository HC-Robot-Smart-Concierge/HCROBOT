import React from 'react';
import { CheckCircle2, X, Volume2, Play, Square } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getCategoryLabel } from './adminKnowledgeUtils';

export const AdminKnowledgeScenarioAndVoiceModals = ({
  isModalOpen,
  setIsModalOpen,
  editingId,
  formData,
  setFormData,
  isSubmitting,
  handleSubmitModal,
  isVoiceModalOpen,
  handleCloseVoiceModal,
  tempRate,
  setTempRate,
  isTestSpeaking,
  handleTestVoice,
  isSavingVoice,
  handleSaveVoiceSettings,
}) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';
  return (
    <>
      {/* =================================================================== */}
      {/* MODAL 2: TẠO / SỬA KỊCH BẢN HỘI THOẠI                              */}
      {/* =================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#E9E5DC' }}>
              <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                {editingId ? t('knowledgeModalEditScenarioTitle') : t('knowledgeModalAddScenarioTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelScenarioTitle')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('knowledgePlaceholderScenarioTitle')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelScenarioCategory')}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="facility">{getCategoryLabel('facility', isEN)} (facility)</option>
                    <option value="faq">{getCategoryLabel('faq', isEN)} (faq)</option>
                    <option value="greeting">{getCategoryLabel('greeting', isEN)} (greeting)</option>
                    <option value="service">{getCategoryLabel('service', isEN)} (service)</option>
                    <option value="chitchat">{getCategoryLabel('chitchat', isEN)} (chitchat)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelPriorityRange')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelKeywords')}
                </label>
                <input
                  type="text"
                  value={formData.match_keywords}
                  onChange={(e) => setFormData({ ...formData, match_keywords: e.target.value })}
                  placeholder={t('knowledgePlaceholderKeywords')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-mono text-[11px] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelResponseVi')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.response_vi}
                  onChange={(e) => setFormData({ ...formData, response_vi: e.target.value })}
                  placeholder={t('knowledgePlaceholderResponseVi')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                  {t('knowledgeLabelResponseEn')}
                </label>
                <textarea
                  rows={2}
                  value={formData.response_en}
                  onChange={(e) => setFormData({ ...formData, response_en: e.target.value })}
                  placeholder={t('knowledgePlaceholderResponseEn')}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none leading-relaxed text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelActionType')}
                  </label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="none">{t('knowledgeActionNone')}</option>
                    <option value="show_map">{t('knowledgeActionShowMap')}</option>
                    <option value="call_reception">{t('knowledgeActionCallReception')}</option>
                    <option value="open_food_menu">{t('knowledgeActionFoodMenu')}</option>
                    <option value="open_room_service_menu">{t('knowledgeActionRoomService')}</option>
                    <option value="book_taxi">{t('knowledgeActionBookTaxi')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelEyeExpression')}
                  </label>
                  <select
                    value={formData.eye_expression || 'none'}
                    onChange={(e) => setFormData({ ...formData, eye_expression: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="none">{t('knowledgeEyeNone')}</option>
                    <option value="look_up">{t('knowledgeEyeLookUp')}</option>
                    <option value="look_left">{t('knowledgeEyeLookLeft')}</option>
                    <option value="look_right">{t('knowledgeEyeLookRight')}</option>
                    <option value="look_around">{t('knowledgeEyeLookAround')}</option>
                    <option value="happy">{t('knowledgeEyeHappy')}</option>
                  </select>
                </div>
              </div>

              {formData.action_type === 'show_map' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1">
                    {t('knowledgeLabelDestinationKey')}
                  </label>
                  <input
                    type="text"
                    value={formData.destination_key}
                    onChange={(e) => setFormData({ ...formData, destination_key: e.target.value })}
                    placeholder="restaurant, gym, pool, elevator"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-stone-900 font-mono text-[11px] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_fast_path}
                    onChange={(e) => setFormData({ ...formData, is_fast_path: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">{t('knowledgeLabelFastPathToggle')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-stone-900 accent-stone-900 cursor-pointer"
                  />
                  <span className="font-bold text-stone-800">{t('knowledgeLabelActiveToggle')}</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E9E5DC' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                  style={{ borderColor: '#BFBFBD', color: '#262626' }}
                >
                  {t('knowledgeModalBtnCancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  {isSubmitting ? t('knowledgeBtnSavingScenario') : editingId ? t('knowledgeBtnSaveScenario') : t('knowledgeBtnCreateScenario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: CÀI ĐẶT TỐC ĐỘ NÓI & GIỌNG AI                              */}
      {/* =================================================================== */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                    {t('knowledgeVoiceModalTitle')}
                  </h3>
                  <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    {t('knowledgeVoiceModalSub')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseVoiceModal}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Tốc độ đọc */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                    {t('knowledgeVoiceRateLabel').replace('{rate}', tempRate)}
                  </label>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {tempRate === 1.0 ? t('knowledgeVoiceRateNormal') : tempRate < 1.0 ? t('knowledgeVoiceRateSlow').replace('{rate}', tempRate) : t('knowledgeVoiceRateFast').replace('{rate}', tempRate)}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border space-y-3" style={{ borderColor: '#E9E5DC' }}>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={tempRate}
                    onChange={(e) => setTempRate(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer h-2 bg-stone-200 rounded-lg appearance-none"
                  />

                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[
                      { label: '0.75x', val: 0.75 },
                      { label: '0.85x', val: 0.85 },
                      { label: '1.0x', val: 1.0 },
                      { label: '1.15x', val: 1.15 },
                      { label: '1.25x', val: 1.25 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTempRate(opt.val)}
                        className={`py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          Math.abs(tempRate - opt.val) < 0.01
                            ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Giọng đọc chuẩn của Robot Rora */}
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border" style={{ borderColor: '#E9E5DC' }}>
                <div>
                  <div className="text-[11px] font-bold text-stone-700">{t('knowledgeVoiceSpeakerLabel')}</div>
                  <div className="text-[10px] text-stone-500">{t('knowledgeVoiceSpeakerSub')}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {t('knowledgeVoiceSpeakerName')}
                </span>
              </div>

              {/* Nút nghe thử trực tiếp */}
              <div className="p-3 bg-stone-100 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: '#E9E5DC' }}>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-800 truncate">{t('knowledgeVoiceTestTitle')}</div>
                  <div className="text-[10px] text-stone-500 truncate">{t('knowledgeVoiceTestSub')}</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isTestSpeaking
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-stone-900 text-stone-100 hover:bg-stone-800'
                  }`}
                >
                  {isTestSpeaking ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{t('knowledgeVoiceTestStop')}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('knowledgeVoiceTestPlay')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: '#E9E5DC' }}>
              <button
                type="button"
                onClick={handleCloseVoiceModal}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                style={{ borderColor: '#BFBFBD', color: '#262626' }}
              >
                {t('knowledgeModalBtnCancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveVoiceSettings}
                disabled={isSavingVoice}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSavingVoice ? t('knowledgeVoiceBtnSaving') : t('knowledgeVoiceBtnSave')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
