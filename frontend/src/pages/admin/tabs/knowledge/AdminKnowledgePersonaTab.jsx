import React, { useState, useEffect } from 'react';
import {
  Bot,
  Volume2,
  Sparkles,
  Save,
  RotateCcw,
  Check,
  Eye,
  Sliders,
  Building,
  MessageSquare,
  HeartHandshake,
  ShieldAlert,
} from 'lucide-react';
import {
  getPersonaSettings,
  updatePersonaSettings,
  resetPersonaSettings,
  getVoiceSettings,
  updateVoiceSettings,
} from '../../../../services/aiApi';

export const AdminKnowledgePersonaTab = ({ isEN = false, onShowToast = () => {} }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    bot_name: 'Rora',
    hotel_name: 'Aurora Grand Hotel',
    star_rating: 5,
    tone_style: 'luxury',
    pronoun_bot_vi: 'em hoặc Rora',
    pronoun_guest_vi: 'quý khách hoặc anh/chị',
    qr_cta_vi: 'Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ.',
    qr_cta_en: 'In addition, you can scan the QR code on the screen to save the directions!',
    unhappy_empathy_vi:
      'Khách đang có biểu cảm khó chịu hoặc chưa hài lòng, hãy phản hồi với thái độ xin lỗi chân thành, xoa dịu ân cần và cho biết nhân viên Concierge tại sảnh sẽ hỗ trợ ngay.',
    unhappy_empathy_en:
      'The guest appears annoyed or dissatisfied. Respond with a sincere, caring apology and assure them that Concierge staff will assist right away.',
    out_of_scope_vi:
      'Dạ Rora là trợ lý robot phục vụ tại khách sạn Aurora Grand Hotel và chỉ có thể hỗ trợ các thông tin, dịch vụ liên quan đến kỳ nghỉ của quý khách thôi ạ.',
    out_of_scope_en:
      'I am Rora, your AI Concierge at Aurora Grand Hotel. I can only assist you with hotel amenities, services, and inquiries regarding your stay.',
  });

  // Voice Settings State
  const [voiceSettings, setVoiceSettings] = useState({
    speech_rate: 1.0,
    vi_voice: 'vi-VN-HoaiMyNeural',
    en_voice: 'en-US-JennyNeural',
  });

  // Load initial settings
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [personaRes, voiceRes] = await Promise.all([
          getPersonaSettings(),
          getVoiceSettings(),
        ]);
        if (isMounted) {
          if (personaRes) {
            setFormData((prev) => ({ ...prev, ...personaRes }));
          }
          if (voiceRes) {
            setVoiceSettings({
              speech_rate: voiceRes.speech_rate || 1.0,
              vi_voice: voiceRes.vi_voice || 'vi-VN-HoaiMyNeural',
              en_voice: voiceRes.en_voice || 'en-US-JennyNeural',
            });
          }
        }
      } catch (err) {
        console.error('[AdminKnowledgePersonaTab] Load error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        updatePersonaSettings(formData),
        updateVoiceSettings(voiceSettings),
      ]);
      onShowToast(
        isEN
          ? 'AI Persona & Voice configuration updated successfully!'
          : 'Đã lưu cấu hình Nhân dạng & Giọng điệu AI thành công!'
      );
    } catch (err) {
      console.error('[AdminKnowledgePersonaTab] Save error:', err);
      onShowToast(isEN ? 'Failed to save configuration.' : 'Lỗi khi lưu cấu hình.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        isEN
          ? 'Are you sure you want to restore default AI Persona settings?'
          : 'Ông chủ có chắc chắn muốn khôi phục cấu hình Persona mặc định?'
      )
    ) {
      return;
    }
    setIsResetting(true);
    try {
      const resetRes = await resetPersonaSettings();
      if (resetRes) {
        setFormData(resetRes);
      }
      onShowToast(
        isEN
          ? 'Default AI Persona restored successfully!'
          : 'Đã khôi phục cài đặt Persona chuẩn thành công!'
      );
    } catch (err) {
      console.error('[AdminKnowledgePersonaTab] Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Preview generated system instructions
  const previewVi = `Bạn là ${formData.bot_name} - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn ${formData.star_rating} sao ${formData.hotel_name}.
Xưng là '${formData.pronoun_bot_vi}' và gọi người trò chuyện là '${formData.pronoun_guest_vi}'.
Khi hướng dẫn chỉ đường, kết thúc bằng: '${formData.qr_cta_vi}'`;

  const previewEn = `You are ${formData.bot_name} - a smart, charming AI Concierge Robot at the ${formData.star_rating}-star ${formData.hotel_name}.
When providing directions, end with: '${formData.qr_cta_en}'`;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono" style={{ color: '#8C8C8C' }}>
        {isEN ? 'Loading AI Persona settings...' : 'Đang tải cấu hình nhân dạng AI...'}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 animate-in fade-in duration-150">
      {/* Top Action Header */}
      <div
        className="p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
        style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#262626', color: '#FFFFFF' }}
          >
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
              {isEN ? 'AI Persona & Conversational Tone' : 'Nhân Dạng & Phong Cách Nói Chuyện Của Robot'}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
              {isEN
                ? 'Customize robot name, hotel branding, forms of address, and real-time speech empathy scripts.'
                : 'Tùy biến tên robot, tên khách sạn, đại từ xưng hô, câu mời quét QR và kịch bản thấu cảm phát thanh.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:opacity-80 active:scale-95"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            title={isEN ? 'Restore Defaults' : 'Khôi phục mặc định'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isResetting ? (isEN ? 'Resetting...' : 'Đang đặt lại...') : isEN ? 'Defaults' : 'Mặc định'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLivePreview((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 hover:opacity-80 active:scale-95"
            style={{
              background: showLivePreview ? '#262626' : '#E9E5DC',
              borderColor: '#BFBFBD',
              color: showLivePreview ? '#FFFFFF' : '#262626',
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isEN ? 'Preview Prompt' : 'Xem Prompt'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            style={{ background: '#262626', color: '#FFFFFF' }}
          >
            <Save className="w-3.5 h-3.5 text-white" />
            <span>{isSaving ? (isEN ? 'Saving...' : 'Đang lưu...') : isEN ? 'Save Persona' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>
      </div>

      {/* Live Preview Drawer */}
      {showLivePreview && (
        <div
          className="p-4 rounded-2xl border space-y-3 font-mono text-xs shadow-inner"
          style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <span className="font-bold flex items-center gap-1.5" style={{ color: '#262626' }}>
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {isEN ? 'Real-Time Generated System Prompt Preview' : 'Xem Trước Prompt Chỉ Thị Hệ Thống Sinh Ra'}
            </span>
            <span className="text-[10px]" style={{ color: '#555555' }}>
              {isEN ? 'Dynamic In-Memory Hot-Reload' : 'Nạp tức thì vào RAM'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
            <div className="p-3 bg-white/70 rounded-xl border" style={{ borderColor: '#BFBFBD' }}>
              <strong className="block mb-1 text-emerald-800">Tiếng Việt (vi-VN):</strong>
              <pre className="whitespace-pre-wrap font-mono text-[10.5px]" style={{ color: '#262626' }}>
                {previewVi}
              </pre>
            </div>
            <div className="p-3 bg-white/70 rounded-xl border" style={{ borderColor: '#BFBFBD' }}>
              <strong className="block mb-1 text-blue-800">English (en-US):</strong>
              <pre className="whitespace-pre-wrap font-mono text-[10.5px]" style={{ color: '#262626' }}>
                {previewEn}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD 1: BRANDING & IDENTITY */}
        <div
          className="p-4 rounded-2xl border space-y-3 shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <Building className="w-4 h-4" style={{ color: '#262626' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: '#262626' }}>
              {isEN ? '1. Branding & Identity' : '1. Định Danh & Thương Hiệu Khách Sạn'}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Robot Name' : 'Tên Robot'}
              </label>
              <input
                type="text"
                value={formData.bot_name}
                onChange={(e) => handleChange('bot_name', e.target.value)}
                placeholder="Rora"
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-stone-400"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Hotel / Facility Name' : 'Tên Khách Sạn / Cơ Sở'}
              </label>
              <input
                type="text"
                value={formData.hotel_name}
                onChange={(e) => handleChange('hotel_name', e.target.value)}
                placeholder="Aurora Grand Hotel"
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-stone-400"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Star Rating' : 'Hạng Sao'}
              </label>
              <select
                value={formData.star_rating}
                onChange={(e) => handleChange('star_rating', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none cursor-pointer"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {[3, 4, 5, 6, 7].map((stars) => (
                  <option key={stars} value={stars}>
                    {stars} {isEN ? 'Stars' : 'sao'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Tone Style' : 'Phong Cách Giao Tiếp'}
              </label>
              <select
                value={formData.tone_style}
                onChange={(e) => handleChange('tone_style', e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none cursor-pointer"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                <option value="luxury">{isEN ? 'Luxury 5-Star (Warm & Polite)' : 'Trang trọng 5 sao (Lễ phép, ấm áp)'}</option>
                <option value="warm">{isEN ? 'Friendly & Cheerful' : 'Thân thiện, vui vẻ (Cởi mở)'}</option>
                <option value="concise">{isEN ? 'Concise & Direct' : 'Ngắn gọn, trực diện'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* CARD 2: PRONOUNS & ADDRESSING */}
        <div
          className="p-4 rounded-2xl border space-y-3 shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <MessageSquare className="w-4 h-4" style={{ color: '#262626' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: '#262626' }}>
              {isEN ? '2. Form of Address (Vietnamese)' : '2. Đại Từ Xưng Hô (Tiếng Việt)'}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Robot Pronoun (Self)' : 'Cách Robot tự xưng'}
              </label>
              <input
                type="text"
                value={formData.pronoun_bot_vi}
                onChange={(e) => handleChange('pronoun_bot_vi', e.target.value)}
                placeholder="em hoặc Rora"
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-stone-400"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Guest Pronoun' : 'Cách Robot gọi khách'}
              </label>
              <input
                type="text"
                value={formData.pronoun_guest_vi}
                onChange={(e) => handleChange('pronoun_guest_vi', e.target.value)}
                placeholder="quý khách hoặc anh/chị"
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-1 focus:ring-stone-400"
                style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>
          </div>

          <div className="pt-1">
            <span className="text-[11px] block leading-relaxed" style={{ color: '#555555' }}>
              {isEN
                ? 'These pronouns are automatically applied to the system instructions to maintain natural, polite Vietnamese speech.'
                : 'Các đại từ này được tự động chèn vào chỉ thị hội thoại tiếng Việt để duy trì lối giao tiếp tự nhiên và lễ phép.'}
            </span>
          </div>
        </div>

        {/* CARD 3: BEHAVIORAL CALLS TO ACTION */}
        <div
          className="p-4 rounded-2xl border space-y-3 shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <Sparkles className="w-4 h-4" style={{ color: '#262626' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: '#262626' }}>
              {isEN ? '3. Wayfinding QR Call-to-Action' : '3. Câu Mời Quét Mã QR Khi Chỉ Đường'}
            </h4>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
              {isEN ? 'QR Invitation (Vietnamese)' : 'Câu mời quét mã QR (Tiếng Việt)'}
            </label>
            <textarea
              rows={2}
              value={formData.qr_cta_vi}
              onChange={(e) => handleChange('qr_cta_vi', e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs outline-none leading-relaxed"
              style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
              {isEN ? 'QR Invitation (English)' : 'Câu mời quét mã QR (Tiếng Anh)'}
            </label>
            <textarea
              rows={2}
              value={formData.qr_cta_en}
              onChange={(e) => handleChange('qr_cta_en', e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs outline-none leading-relaxed"
              style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>
        </div>

        {/* CARD 4: EMPATHY & OUT OF SCOPE SCRIPTS */}
        <div
          className="p-4 rounded-2xl border space-y-3 shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <HeartHandshake className="w-4 h-4" style={{ color: '#262626' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: '#262626' }}>
              {isEN ? '4. Emotional Empathy & Refusal Script' : '4. Kịch Bản Thấu Cảm & Câu Từ Chối'}
            </h4>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
              {isEN ? 'Unhappy Customer Empathy Directive (VI)' : 'Chỉ thị xoa dịu khi khách khó chịu (Tiếng Việt)'}
            </label>
            <textarea
              rows={2}
              value={formData.unhappy_empathy_vi}
              onChange={(e) => handleChange('unhappy_empathy_vi', e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs outline-none leading-relaxed"
              style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
              {isEN ? 'Out-of-Scope Rejection Template (VI)' : 'Câu từ chối khi hỏi ngoài phạm vi (Tiếng Việt)'}
            </label>
            <textarea
              rows={2}
              value={formData.out_of_scope_vi}
              onChange={(e) => handleChange('out_of_scope_vi', e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs outline-none leading-relaxed"
              style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>
        </div>

        {/* CARD 5: TTS VOICE & AUDIO SETTINGS (Unified under Persona) */}
        <div
          className="lg:col-span-2 p-4 rounded-2xl border space-y-3 shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
            <Volume2 className="w-4 h-4" style={{ color: '#262626' }} />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: '#262626' }}>
              {isEN ? '5. Robot Speech Synthesis & Voices' : '5. Cấu Hình Tốc Độ Đọc & Giọng Nói Của Robot'}
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold" style={{ color: '#262626' }}>
                  {isEN ? 'Speech Rate' : 'Tốc độ phát giọng nói'}
                </label>
                <span className="text-xs font-mono font-bold" style={{ color: '#262626' }}>
                  {voiceSettings.speech_rate}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={voiceSettings.speech_rate}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    speech_rate: parseFloat(e.target.value),
                  }))
                }
                className="w-full cursor-pointer accent-stone-900"
              />
              <div className="flex justify-between text-[10px] font-mono mt-1" style={{ color: '#8C8C8C' }}>
                <span>{isEN ? '0.5x (Slow)' : '0.5x (Chậm)'}</span>
                <span>{isEN ? '1.0x (Normal)' : '1.0x (Chuẩn)'}</span>
                <span>{isEN ? '2.0x (Fast)' : '2.0x (Nhanh)'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'Vietnamese Voice (TTS)' : 'Giọng đọc Tiếng Việt'}
              </label>
              <div className="w-full px-3 py-2 border rounded-xl text-xs bg-white" style={{ borderColor: '#BFBFBD' }}>
                {isEN ? 'Hoài My · Female · Fixed' : 'Hoài My · Nữ · Cố định'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#262626' }}>
                {isEN ? 'English Voice (TTS)' : 'Giọng đọc Tiếng Anh'}
              </label>
              <div className="w-full px-3 py-2 border rounded-xl text-xs bg-white" style={{ borderColor: '#BFBFBD' }}>
                {isEN ? 'Jenny · Female · Fixed' : 'Jenny · Nữ · Cố định'}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
