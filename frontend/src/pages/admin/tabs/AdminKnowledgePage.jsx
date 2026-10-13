import React, { useState, useEffect } from 'react';
import {
  fetchScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  reloadScenariosCache,
} from '../../../services/scenariosApi';
import { getVoiceSettings, updateVoiceSettings } from '../../../services/aiApi';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { Pagination } from '../../../components/common/Pagination';
import {
  Plus,
  RefreshCw,
  Search,
  Zap,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Video,
  Bot,
  Layers,
  X,
  Sparkles,
  Volume2,
  Play,
  Square,
} from 'lucide-react';

const CATEGORY_MAP = {
  facility: { label: 'Tiện ích', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
  faq: { label: 'Hỏi đáp (FAQ)', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  greeting: { label: 'Lời chào', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  service: { label: 'Dịch vụ', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  chitchat: { label: 'Trò chuyện', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

const DEFAULT_FORM_STATE = {
  title: '',
  category: 'faq',
  match_keywords: '',
  match_type: 'keyword',
  response_vi: '',
  response_en: '',
  action_type: 'none',
  destination_key: '',
  is_fast_path: true,
  is_active: true,
  priority: 50,
};

export const AdminKnowledgePage = () => {
  const [scenarios, setScenarios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [fastPathOnly, setFastPathOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Scenario Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Robot Voice Settings State
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    speech_rate: 1.0,
    rate_percentage: '+0%',
    vi_voice: 'vi-VN-HoaiMyNeural',
    en_voice: 'en-US-JennyNeural',
  });
  const [tempRate, setTempRate] = useState(1.0);
  const [tempVoice, setTempVoice] = useState('vi-VN-HoaiMyNeural');
  const [isSavingVoice, setIsSavingVoice] = useState(false);

  const { speak: testSpeak, cancel: stopTestSpeak, isSpeaking: isTestSpeaking } = useSpeechSynthesis();

  // Load Voice Settings on Mount
  useEffect(() => {
    getVoiceSettings()
      .then((data) => {
        if (data) {
          setVoiceSettings(data);
          setTempRate(data.speech_rate || 1.0);
          setTempVoice(data.vi_voice || 'vi-VN-HoaiMyNeural');
        }
      })
      .catch((err) => console.warn('Could not load voice settings:', err));
  }, []);

  const handleOpenVoiceModal = () => {
    setTempRate(voiceSettings.speech_rate || 1.0);
    setTempVoice(voiceSettings.vi_voice || 'vi-VN-HoaiMyNeural');
    setIsVoiceModalOpen(true);
  };

  const handleCloseVoiceModal = () => {
    stopTestSpeak();
    setIsVoiceModalOpen(false);
  };

  const handleTestVoice = () => {
    if (isTestSpeaking) {
      stopTestSpeak();
      return;
    }
    const sampleText = 'Dạ em chào quý khách! Em là robot lễ tân Rora. Chúc quý khách kỳ nghỉ tuyệt vời tại khách sạn Aurora Grand!';
    testSpeak(sampleText, 'vi-VN', null, null, null, tempRate);
  };

  const handleSaveVoiceSettings = async () => {
    setIsSavingVoice(true);
    stopTestSpeak();
    try {
      const updated = await updateVoiceSettings({
        speech_rate: tempRate,
        vi_voice: tempVoice,
      });
      setVoiceSettings(updated);
      setIsVoiceModalOpen(false);
      showNotification(`Đã cập nhật tốc độ nói của Robot: ${tempRate}x (${updated.rate_percentage})`);
    } catch (err) {
      showNotification(`Lỗi cập nhật cấu hình giọng nói: ${err.message}`);
    } finally {
      setIsSavingVoice(false);
    }
  };

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchScenarios({
        category: categoryFilter,
        search: searchQuery,
      });
      setScenarios(res.items || []);
    } catch (err) {
      showNotification(`Lỗi khi tải kịch bản: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, fastPathOnly]);

  const handleReloadCache = async () => {
    setIsLoading(true);
    try {
      const res = await reloadScenariosCache();
      showNotification(res.message || 'Đã đồng bộ lại toàn bộ kịch bản vào RAM Cache!');
      await loadData();
    } catch (err) {
      showNotification(`Lỗi khi reload cache: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingId(item.id);
    const kwString = Array.isArray(item.match_keywords) ? item.match_keywords.join(', ') : '';
    const destKey = item.action_payload?.destination_key || '';

    setFormData({
      title: item.title || '',
      category: item.category || 'faq',
      match_keywords: kwString,
      match_type: item.match_type || 'keyword',
      response_vi: item.response_vi || '',
      response_en: item.response_en || '',
      action_type: item.action_type || 'none',
      destination_key: destKey,
      is_fast_path: item.is_fast_path !== undefined ? item.is_fast_path : true,
      is_active: item.is_active !== undefined ? item.is_active : true,
      priority: item.priority || 50,
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.response_vi.trim()) {
      showNotification('Vui lòng điền đầy đủ Tiêu đề và Câu trả lời tiếng Việt!');
      return;
    }

    setIsSubmitting(true);
    try {
      // Bóc tách danh sách từ khóa
      const kwList = formData.match_keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        match_keywords: kwList,
        match_type: formData.match_type,
        response_vi: formData.response_vi.trim(),
        response_en: formData.response_en.trim() || null,
        action_type: formData.action_type,
        action_payload:
          formData.action_type === 'show_map' && formData.destination_key.trim()
            ? { destination_key: formData.destination_key.trim() }
            : null,
        is_fast_path: formData.is_fast_path,
        is_active: formData.is_active,
        priority: Number(formData.priority) || 0,
      };

      if (editingId) {
        await updateScenario(editingId, payload);
        showNotification(`Đã cập nhật kịch bản "${payload.title}" thành công!`);
      } else {
        await createScenario(payload);
        showNotification(`Đã tạo mới kịch bản "${payload.title}" thành công!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      showNotification(`Lỗi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Xác nhận xóa kịch bản "${title}" khỏi hệ thống?`)) return;
    try {
      await deleteScenario(id);
      showNotification(`Đã xóa kịch bản "${title}"!`);
      await loadData();
    } catch (err) {
      showNotification(`Lỗi khi xóa: ${err.message}`);
    }
  };

  // Lọc theo Fast Path nếu bật
  const displayScenarios = scenarios.filter((scn) => {
    if (fastPathOnly && !scn.is_fast_path) return false;
    return true;
  });

  const paginatedScenarios = displayScenarios.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalFastPath = scenarios.filter((s) => s.is_fast_path).length;
  const totalActive = scenarios.filter((s) => s.is_active).length;

  return (
    <div className="w-full flex flex-col min-h-full pb-6 font-sans select-none" style={{ color: '#262626' }}>
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

      {/* HEADER BAR */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
              Kịch Bản Hội Thoại AI & Fast-Path
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase inline-flex items-center gap-1"
              style={{ backgroundColor: '#DCFCE7', color: '#15803D', borderColor: '#BBF7D0' }}
            >
              <Zap className="w-3 h-3" /> &lt; 1ms In-Memory
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Quản lý các tình huống đối thoại có sẵn, tiện ích khách sạn và nạp động vào RAM Cache cho Robot
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReloadCache}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#262626',
              borderColor: '#BFBFBD',
            }}
            title="Đồng bộ lại toàn bộ kịch bản từ Database vào bộ nhớ RAM tức thì"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Tải Lại RAM Cache</span>
          </button>

          <button
            onClick={handleOpenVoiceModal}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#262626',
              borderColor: '#BFBFBD',
            }}
            title="Cài đặt tốc độ nói và giọng phát âm AI của Robot"
          >
            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tốc Độ Nói: {voiceSettings.speech_rate}x</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: '#262626',
              color: '#F2EFE9',
              borderColor: '#262626',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Thêm Kịch Bản</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        {/* KPI STATS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Tổng kịch bản</div>
              <div className="text-lg font-black mt-0.5" style={{ color: '#262626' }}>{scenarios.length}</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F2EFE9]" style={{ color: '#262626' }}>
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Phản xạ Fast-Path</div>
              <div className="text-lg font-black mt-0.5 text-emerald-600">{totalFastPath}</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Đang hoạt động</div>
              <div className="text-lg font-black mt-0.5 text-blue-600">{totalActive}</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-white flex items-center justify-between" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <div className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>Độ trễ đối soát</div>
              <div className="text-lg font-black mt-0.5 text-indigo-600">&lt; 0.1 ms</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div
          className="p-3 rounded-xl border bg-white flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: '#BFBFBD' }}
        >
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: '#8C8C8C' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm kịch bản, từ khóa, câu trả lời..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-none transition-colors"
              style={{
                borderColor: '#BFBFBD',
                backgroundColor: '#F2EFE9',
                color: '#262626',
              }}
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {['All', 'facility', 'faq', 'greeting', 'service', 'chitchat'].map((cat) => {
              const isSelected = categoryFilter === cat;
              const label = cat === 'All' ? 'Tất cả' : CATEGORY_MAP[cat]?.label || cat;
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
            <span>Chỉ Fast-Path</span>
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
                  <th className="py-2.5 px-4 w-52">Tiêu đề & Danh mục</th>
                  <th className="py-2.5 px-3 w-64">Từ khóa kích hoạt</th>
                  <th className="py-2.5 px-3">Phản hồi thoại (VI / EN)</th>
                  <th className="py-2.5 px-3 w-36 text-center">Hành động</th>
                  <th className="py-2.5 px-3 w-32 text-center">Cơ chế</th>
                  <th className="py-2.5 px-3 w-20 text-center">Ưu tiên</th>
                  <th className="py-2.5 px-4 text-right w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                {displayScenarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                      {isLoading ? 'Đang tải dữ liệu kịch bản...' : 'Chưa có kịch bản nào phù hợp với bộ lọc.'}
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
                        <td className="py-2.5 px-4 align-top">
                          <div className="font-bold text-xs" style={{ color: '#262626' }}>
                            {item.title}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold border inline-block"
                              style={{
                                backgroundColor: catStyle.bg,
                                color: catStyle.text,
                                borderColor: catStyle.border,
                              }}
                            >
                              {catStyle.label}
                            </span>
                            {!item.is_active && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-semibold">
                                Tắt
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Keywords */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {keywords.slice(0, 4).map((kw, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F2EFE9] border border-[#BFBFBD] text-[#262626]"
                              >
                                {kw}
                              </span>
                            ))}
                            {keywords.length > 4 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#8C8C8C]">
                                +{keywords.length - 4} nữa
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#8C8C8C] mt-1 italic">
                            Khớp: {item.match_type}
                          </div>
                        </td>

                        {/* Responses */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="text-xs leading-relaxed font-normal" style={{ color: '#262626' }}>
                            {item.response_vi}
                          </div>
                          {item.response_en && (
                            <div className="text-[11px] text-[#8C8C8C] mt-1 flex items-start gap-1">
                              <span className="font-bold font-mono text-[10px] bg-blue-50 text-blue-700 px-1 rounded border border-blue-200">
                                EN
                              </span>
                              <span className="line-clamp-2">{item.response_en}</span>
                            </div>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center align-top">
                          {item.action_type === 'trigger_video_call' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <Video className="w-3 h-3" /> Live Call
                            </span>
                          )}
                          {item.action_type === 'show_map' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <MapPin className="w-3 h-3" /> POI Map
                            </span>
                          )}
                          {(!item.action_type || item.action_type === 'none') && (
                            <span className="text-[11px] text-[#8C8C8C]">-</span>
                          )}
                        </td>

                        {/* Fast-Path */}
                        <td className="py-2.5 px-3 text-center align-top">
                          {item.is_fast_path ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Zap className="w-3 h-3 text-emerald-600" /> Fast-Path
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              <Bot className="w-3 h-3 text-gray-500" /> LLM Prompt
                            </span>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-2.5 px-3 text-center align-top font-mono font-bold text-xs" style={{ color: '#262626' }}>
                          {item.priority}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1 rounded hover:bg-[#E9E5DC] text-[#262626] transition-colors cursor-pointer"
                              title="Sửa kịch bản"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.title)}
                              className="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                              title="Xóa kịch bản"
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

          {/* Pagination */}
          {displayScenarios.length > pageSize && (
            <div className="p-3 border-t flex justify-end" style={{ borderColor: '#E9E5DC' }}>
              <Pagination
                currentPage={currentPage}
                totalCount={displayScenarios.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL THÊM / CHỈNH SỬA KỊCH BẢN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl border shadow-2xl bg-white flex flex-col max-h-[90vh] overflow-hidden"
            style={{ borderColor: '#BFBFBD' }}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between bg-[#E9E5DC]" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#262626' }}>
                  {editingId ? 'Chỉnh Sửa Kịch Bản Hội Thoại' : 'Tạo Kịch Bản Hội Thoại Mới'}
                </h3>
                <p className="text-[11px] text-[#8C8C8C] mt-0.5">
                  Thiết lập từ khóa và câu trả lời phản xạ tức thì cho Robot
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#BFBFBD]/40 text-[#262626] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitModal} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Tiêu đề & Phân loại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                    Tiêu đề kịch bản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Mật khẩu Wi-Fi, Hồ bơi..."
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                    Danh mục
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                  >
                    <option value="facility">Tiện ích (facility)</option>
                    <option value="faq">Hỏi đáp thường gặp (faq)</option>
                    <option value="greeting">Lời chào (greeting)</option>
                    <option value="service">Dịch vụ (service)</option>
                    <option value="chitchat">Trò chuyện (chitchat)</option>
                  </select>
                </div>
              </div>

              {/* Từ khóa kích hoạt */}
              <div>
                <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                  Từ khóa kích hoạt (cách nhau bằng dấu phẩy) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.match_keywords}
                  onChange={(e) => setFormData({ ...formData, match_keywords: e.target.value })}
                  placeholder="VD: wifi, pass wifi, mật khẩu mạng, internet"
                  className="w-full px-3 py-2 rounded-lg border font-mono text-xs focus:outline-none"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                />
                <p className="text-[10px] text-[#8C8C8C] mt-1">
                  Robot sẽ nhận diện khi câu nói của khách chứa bất kỳ từ khóa nào ở trên.
                </p>
              </div>

              {/* Câu trả lời Tiếng Việt */}
              <div>
                <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                  Câu trả lời Tiếng Việt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.response_vi}
                  onChange={(e) => setFormData({ ...formData, response_vi: e.target.value })}
                  placeholder="Dạ wifi miễn phí tại sảnh là 'Aurora_Guest', mật khẩu là 'aurora2026' ạ."
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none leading-relaxed"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                />
              </div>

              {/* Câu trả lời Tiếng Anh */}
              <div>
                <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                  Câu trả lời Tiếng Anh (Tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={formData.response_en}
                  onChange={(e) => setFormData({ ...formData, response_en: e.target.value })}
                  placeholder="Complimentary Wi-Fi in the lobby is 'Aurora_Guest', password 'aurora2026'."
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none leading-relaxed"
                  style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                />
              </div>

              {/* Hành động & Điểm đến */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                    Hành động đi kèm
                  </label>
                  <select
                    value={formData.action_type}
                    onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border focus:outline-none"
                    style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                  >
                    <option value="none">Không có (Chỉ phát giọng đọc)</option>
                    <option value="show_map">Hiển thị bản đồ chỉ đường (show_map)</option>
                    <option value="trigger_video_call">Kết nối cuộc gọi Video Call (trigger_video_call)</option>
                    <option value="open_menu">Mở menu món ăn (open_menu)</option>
                  </select>
                </div>

                {formData.action_type === 'show_map' ? (
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                      Mã địa điểm bản đồ (destination_key)
                    </label>
                    <input
                      type="text"
                      value={formData.destination_key}
                      onChange={(e) => setFormData({ ...formData, destination_key: e.target.value })}
                      placeholder="VD: restaurant, infinity_pool, spa"
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
                      style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: '#262626' }}>
                      Độ ưu tiên (Số càng cao càng ưu tiên)
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border focus:outline-none font-mono"
                      style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
                    />
                  </div>
                )}
              </div>

              {/* Checkboxes: Fast Path & Active */}
              <div className="p-3 rounded-lg border bg-[#F2EFE9] space-y-2" style={{ borderColor: '#BFBFBD' }}>
                <label className="flex items-center gap-2 cursor-pointer font-semibold" style={{ color: '#262626' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_fast_path}
                    onChange={(e) => setFormData({ ...formData, is_fast_path: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Bật phản xạ Fast-Path (&lt; 1ms, không tốn token LLM)</span>
                </label>
                <p className="text-[10px] text-[#8C8C8C] pl-6">
                  Nếu tắt, câu trả lời sẽ được đưa vào ngữ cảnh System Prompt để Ollama suy luận tự do.
                </p>

                <label className="flex items-center gap-2 cursor-pointer font-semibold pt-1" style={{ color: '#262626' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Kích hoạt kịch bản này ngay bây giờ</span>
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
                  Hủy
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
                  {isSubmitting ? 'Đang lưu...' : editingId ? 'Lưu Thay Đổi' : 'Tạo Kịch Bản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CÀI ĐẶT TỐC ĐỘ NÓI & GIỌNG AI */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
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
                    Cấu Hình Tốc Độ Nói Robot
                  </h3>
                  <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                    EdgeTTS Neural & Kiosk Speech Synthesis
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
                    Tốc độ phát âm ({tempRate}x)
                  </label>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {tempRate === 1.0 ? 'Chuẩn (1.0x)' : tempRate < 1.0 ? `Chậm (${tempRate}x)` : `Nhanh (${tempRate}x)`}
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
                  <div className="text-[11px] font-bold text-stone-700">Giọng đọc Robot (Rora)</div>
                  <div className="text-[10px] text-stone-500">EdgeTTS Hoài My Neural (Chuẩn tự nhiên)</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Hoài My (Nữ)
                </span>
              </div>

              {/* Nút nghe thử trực tiếp */}
              <div className="p-3 bg-stone-100 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: '#E9E5DC' }}>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-800 truncate">Nghe thử câu chào mẫu</div>
                  <div className="text-[10px] text-stone-500 truncate">Kiểm tra tốc độ trước khi áp dụng</div>
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
                      <span>Dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Nghe Thử</span>
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
                Hủy
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
                <span>{isSavingVoice ? 'Đang lưu...' : 'Lưu & Áp Dụng Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
