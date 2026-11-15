import React from 'react';
import {
  Search,
  Zap,
  Edit2,
  Trash2,
  MapPin,
  Video,
  Utensils,
  ConciergeBell,
  Car,
  Eye,
} from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';
import { useLanguage } from '../../../context/LanguageContext';
import { CATEGORY_MAP, getCategoryLabel } from './adminKnowledgeUtils';

export const AdminKnowledgeScenariosView = ({
  currentTab,
  scenarios,
  displayScenarios,
  paginatedScenarios,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  fastPathOnly,
  setFastPathOnly,
  isLoadingScenarios,
  currentPage,
  setCurrentPage,
  scenarioPageSize,
  handleOpenEditModal,
  handleDeleteScenario,
}) => {
  const { t, language } = useLanguage();
  const isEN = language === 'EN';
  return (
    <>
      {/* =================================================================== */}
      {/* VIEW 2: KỊCH BẢN FAST-PATH (SCENARIOS TABLE)                        */}
      {/* =================================================================== */}
      {currentTab === 'scenarios' && (
        <div className="p-5 space-y-3.5">
          {/* SEARCH & CATEGORY FILTERS TOOLBAR */}
          <div
            className="p-2.5 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('knowledgeSearchScenarioPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {['All', 'facility', 'faq', 'greeting', 'service', 'chitchat'].map((cat) => {
                const isSelected = categoryFilter === cat;
                const label = cat === 'All' ? t('all') : getCategoryLabel(cat, isEN);
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      backgroundColor: isSelected ? '#262626' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#8C8C8C',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Fast-Path Toggle */}
            <button
              onClick={() => setFastPathOnly(!fastPathOnly)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                fastPathOnly ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-[#BFBFBD] text-[#8C8C8C]'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>{t('knowledgeFastPathOnly')}</span>
            </button>
          </div>

          {/* SCENARIOS TABLE */}
          <div
            className="rounded-xl border overflow-hidden shadow-none bg-white"
            style={{ borderColor: '#BFBFBD' }}
          >
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
                    <th className="py-2.5 px-4 w-52">{t('knowledgeColTitleCat')}</th>
                    <th className="py-2.5 px-3 w-64">{t('knowledgeColKeywords')}</th>
                    <th className="py-2.5 px-3">{t('knowledgeColResponses')}</th>
                    <th className="py-2.5 px-3 w-36 text-center">{t('knowledgeColAction')}</th>
                    <th className="py-2.5 px-3 w-32 text-center">{t('knowledgeColMechanism')}</th>
                    <th className="py-2.5 px-3 w-20 text-center">{t('knowledgeColPriority')}</th>
                    <th className="py-2.5 px-4 text-right w-28">{t('knowledgeColActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {displayScenarios.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {isLoadingScenarios ? t('knowledgeLoadingScenarios') : t('knowledgeEmptyScenarios')}
                      </td>
                    </tr>
                  ) : (
                    paginatedScenarios.map((item) => {
                      const catStyle = CATEGORY_MAP[item.category] || CATEGORY_MAP.faq;
                      const keywords = Array.isArray(item.match_keywords) ? item.match_keywords : [];
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-[#F2EFE9]/40"
                          style={{ borderBottom: '1px solid #E9E5DC' }}
                        >
                          {/* Title & Category */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-xs" style={{ color: '#262626' }}>
                              {item.title}
                            </div>
                            <div className="mt-1">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold border inline-block"
                                style={{
                                  backgroundColor: catStyle.bg,
                                  color: catStyle.text,
                                  borderColor: catStyle.border,
                                }}
                              >
                                {getCategoryLabel(item.category, isEN)}
                              </span>
                            </div>
                          </td>

                          {/* Match Keywords */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {keywords.slice(0, 4).map((kw, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                                  style={{
                                    backgroundColor: '#F2EFE9',
                                    color: '#262626',
                                    borderColor: '#BFBFBD',
                                  }}
                                >
                                  {kw}
                                </span>
                              ))}
                              {keywords.length > 4 && (
                                <span className="text-[10px] font-semibold text-stone-500">
                                  {t('knowledgeMoreKeywords').replace('{count}', keywords.length - 4)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Responses */}
                          <td className="py-2.5 px-3">
                            <p className="line-clamp-2 text-stone-800 font-medium">
                              {item.response_vi}
                            </p>
                            {item.response_en && (
                              <p className="line-clamp-1 text-stone-400 text-[11px] italic mt-0.5">
                                EN: {item.response_en}
                              </p>
                            )}
                          </td>

                          {/* Action & Eye Expression */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {item.action_type === 'show_map' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{item.action_payload?.destination_key || t('knowledgeActionMap')}</span>
                                </span>
                              ) : item.action_type === 'call_reception' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                  <Video className="w-3 h-3" />
                                  <span>{t('knowledgeActionVideoCall')}</span>
                                </span>
                              ) : item.action_type === 'open_food_menu' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200 inline-flex items-center gap-1">
                                  <Utensils className="w-3 h-3" />
                                  <span>{t('knowledgeBadgeFoodMenu')}</span>
                                </span>
                              ) : item.action_type === 'open_room_service_menu' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                  <ConciergeBell className="w-3 h-3" />
                                  <span>{t('knowledgeBadgeRoomService')}</span>
                                </span>
                              ) : item.action_type === 'book_taxi' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  <span>{t('knowledgeBadgeTaxi')}</span>
                                </span>
                              ) : null}

                              {/* Eye Expression Badge */}
                              {item.action_payload?.eye_expression && item.action_payload.eye_expression !== 'none' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-700 border border-stone-300 inline-flex items-center gap-1">
                                  <span>{t('knowledgeEyesPrefix')}</span>
                                  <span>
                                    {item.action_payload.eye_expression === 'look_up' && t('knowledgeEyeLookUp')}
                                    {item.action_payload.eye_expression === 'look_left' && t('knowledgeEyeLookLeft')}
                                    {item.action_payload.eye_expression === 'look_right' && t('knowledgeEyeLookRight')}
                                    {item.action_payload.eye_expression === 'look_around' && t('knowledgeEyeLookAround')}
                                    {item.action_payload.eye_expression === 'happy' && t('knowledgeEyeHappy')}
                                  </span>
                                </span>
                              ) : !item.action_type || item.action_type === 'none' ? (
                                <span className="text-stone-400 text-[11px]">—</span>
                              ) : null}
                            </div>
                          </td>

                          {/* Fast-Path & Active */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {item.is_fast_path ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-0.5">
                                  <Zap className="w-3 h-3" /> Fast &lt;1ms
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                  Standard RAG
                                </span>
                              )}
                              <span className={`text-[10px] font-bold ${item.is_active ? 'text-emerald-600' : 'text-stone-400'}`}>
                                {item.is_active ? t('knowledgeStatusActive') : t('knowledgeStatusInactive')}
                              </span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-stone-700">
                            {item.priority}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-stone-100 transition-all"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#BFBFBD',
                                  color: '#262626',
                                }}
                                title={t('knowledgeEditScenarioTooltip')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteScenario(item.id, item.title)}
                                className="p-1 rounded text-xs font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all"
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderColor: '#BFBFBD',
                                  color: '#8C8C8C',
                                }}
                                title={t('knowledgeDeleteScenarioTooltip')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={displayScenarios.length}
              pageSize={scenarioPageSize}
              onPageChange={setCurrentPage}
              itemName={t('knowledgeScenarioItemName')}
            />
          </div>
        </div>
      )}

    </>
  );
};
