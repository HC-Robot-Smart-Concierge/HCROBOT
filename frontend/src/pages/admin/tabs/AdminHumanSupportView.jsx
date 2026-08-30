import React, { useState, useEffect } from 'react';
import {
  Phone,
  MoreVertical,
  Bot,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Languages,
  Sparkles,
  Paperclip,
  Send,
  Eye,
  RefreshCw,
  HelpCircle,
  CornerDownRight,
} from 'lucide-react';
import { fetchAdminConversations } from '../../../services/operationsApi';

export const AdminHumanSupportView = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('SES-302');
  const [isLoading, setIsLoading] = useState(false);
  const [showTranslations, setShowTranslations] = useState(true); // Toggle Translate

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminConversations();
      if (Array.isArray(data) && data.length > 0) {
        setSessions(data);
        if (!selectedSessionId || !data.some((s) => s.session_code === selectedSessionId)) {
          setSelectedSessionId(data[0].session_code);
        }
      }
    } catch (e) {
      console.warn('Error loading support sessions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const activeSession =
    sessions.find((s) => s.session_code === selectedSessionId || s.id === selectedSessionId) ||
    sessions[0] ||
    null;

  return (
    <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden bg-[#F8F9FA] text-[#1A1917]">
      {/* 1. LEFT COLUMN: Active Queue */}
      <div className="w-full lg:w-80 h-72 lg:h-full bg-white border-r border-stone-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-stone-900 tracking-tight">Active Queue</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
              {sessions.length}
            </span>
          </div>
          <button
            onClick={loadSessions}
            title="Làm mới hàng chờ"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-stone-100">
          {sessions.map((item) => {
            const isSelected = item.session_code === selectedSessionId;
            return (
              <div
                key={item.session_code}
                onClick={() => setSelectedSessionId(item.session_code)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/60 border-l-4 border-indigo-600 shadow-inner'
                    : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-stone-900">{item.room_number}</span>
                  <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.wait_time_label}
                  </span>
                </div>

                <div className="text-xs font-medium text-stone-600 truncate mb-2">
                  {item.guest_name}
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {item.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MIDDLE COLUMN: Conversation Chat Transcript (View-Only) */}
      <div className="flex-1 h-full flex flex-col bg-white border-r border-stone-200 overflow-hidden">
        {activeSession ? (
          <>
            {/* Chat Top Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-stone-900 tracking-tight">
                      {activeSession.guest_name}
                    </h3>
                  </div>
                  <div className="text-xs text-stone-500 font-medium">
                    {activeSession.room_number} • {activeSession.category}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                  <span>Admin View-Only</span>
                </span>
                <button
                  title="Gọi thoại trực tiếp"
                  className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  title="Tùy chọn khác"
                  className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4 bg-stone-50/50">
              {/* Timeline Indicator */}
              <div className="text-center">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-stone-200/80 text-stone-600 shadow-sm">
                  Today, 10:42 AM
                </span>
              </div>

              {/* Message List */}
              {activeSession.messages.map((msg) => {
                if (msg.speaker === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-stone-400"
                    >
                      <div className="h-px bg-stone-200 flex-1" />
                      <span>→ {msg.raw_transcript}</span>
                      <div className="h-px bg-stone-200 flex-1" />
                    </div>
                  );
                }

                const isGuest = msg.speaker === 'guest';
                const isRobot = msg.speaker === 'robot';
                const isStaff = msg.speaker === 'staff';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isStaff ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Guest or Robot Avatar */}
                    {!isStaff && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isGuest
                            ? 'bg-stone-200 text-stone-700'
                            : 'bg-indigo-600 text-white shadow-sm'
                        }`}
                      >
                        {isGuest ? 'AC' : <Bot className="w-4 h-4" />}
                      </div>
                    )}

                    {/* Bubble Content */}
                    <div className={`max-w-md space-y-1 ${isStaff ? 'items-end' : 'items-start'}`}>
                      {/* Name & Time */}
                      <div
                        className={`flex items-center gap-2 text-[11px] text-stone-400 font-semibold ${
                          isStaff ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <span className="text-stone-800 font-bold">{msg.speaker_name}</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      {/* Message Box */}
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isStaff
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-500/20'
                            : isRobot
                            ? 'bg-white border border-stone-200 text-stone-900 rounded-tl-none shadow-sm'
                            : 'bg-stone-200/90 text-stone-900 rounded-tl-none'
                        }`}
                      >
                        {/* Raw Audio Transcript */}
                        <div className="font-medium">{msg.raw_transcript}</div>

                        {/* Polyglot Code-Switching Badge & Vietnamese Translation */}
                        {showTranslations && msg.translations?.vi && msg.translations.vi !== msg.raw_transcript && (
                          <div
                            className={`mt-2 pt-2 border-t text-[11px] space-y-1 ${
                              isStaff
                                ? 'border-indigo-400/50 text-indigo-100'
                                : 'border-stone-100 text-stone-600'
                            }`}
                          >
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                              <Languages className="w-3 h-3" />
                              <span>Bản dịch Tiếng Việt:</span>
                              {msg.languages_detected && (
                                <span className="text-stone-400 font-normal normal-case">
                                  ({msg.languages_detected.join(' • ').toUpperCase()})
                                </span>
                              )}
                            </div>
                            <p className="italic">"{msg.translations.vi}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Staff Avatar */}
                    {isStaff && (
                      <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-black shrink-0">
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom View-Only Control Bar */}
            <div className="p-4 border-t border-stone-200 bg-white space-y-3 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  disabled
                  placeholder="Chế độ xem nhật ký (Admin View-Only). Nhân viên xử lý đàm thoại qua PWA..."
                  className="w-full pl-4 pr-10 py-3 bg-stone-100/70 border border-stone-200 rounded-2xl text-xs text-stone-400 cursor-not-allowed"
                />
                <Paperclip className="w-4 h-4 text-stone-300 absolute right-4 top-1/2 -translate-y-1/2 cursor-not-allowed" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-400 bg-stone-50 flex items-center gap-1 cursor-not-allowed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Create Request</span>
                  </button>

                  {/* Toggle Translation Button (Interactive!) */}
                  <button
                    onClick={() => setShowTranslations(!showTranslations)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      showTranslations
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <Languages className="w-3.5 h-3.5" />
                    <span>{showTranslations ? 'Ẩn Dịch Tiếng Việt' : 'Hiện Dịch Tiếng Việt'}</span>
                  </button>
                </div>

                <button
                  disabled
                  className="px-4 py-2 rounded-xl bg-stone-300 text-white text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                >
                  <span>Send Message</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
            <HelpCircle className="w-8 h-8 mb-2 text-stone-300" />
            <p className="text-xs font-bold">Không có phiên đàm thoại nào đang chọn</p>
          </div>
        )}
      </div>

      {/* 3. RIGHT COLUMN: Context Details */}
      <div className="w-full lg:w-72 h-auto lg:h-full bg-white p-6 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar border-t lg:border-t-0">
        {activeSession ? (
          <div className="space-y-6">
            {/* Top Guest Card */}
            <div className="text-center space-y-2 pb-4 border-b border-stone-100">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 text-xl font-black mx-auto flex items-center justify-center border border-indigo-100 shadow-sm">
                AC
              </div>
              <h4 className="text-base font-black text-stone-900">{activeSession.guest_name}</h4>
              <p className="text-xs text-stone-500 font-medium">
                {activeSession.room_number} • Check-out: Tomorrow
              </p>
            </div>

            {/* Context Details Fields */}
            <div className="space-y-4">
              <h5 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                CONTEXT DETAILS
              </h5>

              {/* Origin Robot */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-stone-400">Origin:</span>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-800">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{activeSession.origin_robot_code}</span>
                </div>
              </div>

              {/* Linked Requests */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-stone-400">Linked Requests:</span>
                <div className="flex items-center justify-between p-2 rounded-xl bg-stone-100 border border-stone-200 text-xs">
                  <span className="font-mono font-bold text-stone-800">
                    {activeSession.linked_request_id || 'REQ-1042'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Processing
                  </span>
                </div>
              </div>

              {/* Sentiment Estimate */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-stone-400">Sentiment Estimate:</span>
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>{activeSession.sentiment}</span>
                </div>
              </div>

              {/* Multilingual Speech Detection */}
              <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Dual-Track Voice Analysis</span>
                </div>
                <p className="text-[10px] text-stone-600 leading-relaxed">
                  Lưu trữ song song văn bản gốc STT đa ngữ và bản dịch quy chuẩn Tiếng Việt / Tiếng Anh.
                </p>
              </div>
            </div>

            {/* Resolve Conversation Button */}
            <div className="pt-4 border-t border-stone-100">
              <button
                disabled
                className="w-full py-2.5 rounded-xl border border-stone-300 text-stone-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-50 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Resolve Conversation</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
