import React from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { STEP_SCRATCH_THEMES } from './workflowConstants';

export const WorkflowStepBlock = ({
  step,
  index,
  totalSteps,
  waypoints = [],
  onParamChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  const theme = STEP_SCRATCH_THEMES[step.type] || STEP_SCRATCH_THEMES.MOVE;
  const Icon = theme.icon;
  const params = step.params || {};

  const handleFieldChange = (key, value) => {
    onParamChange(index, key, value);
  };

  return (
    <div className="relative group select-none transition-all duration-200">
      {/* Top connector notch */}
      <div className="absolute -top-[4px] left-7 w-6 h-[4px] bg-stone-800/40 rounded-b-md z-10" />

      {/* Main Block Container */}
      <div
        className="rounded-2xl p-3 text-white shadow-md border-b-4 transition-all hover:brightness-105"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        {/* Block Header */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/20">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-black">
              {index + 1}
            </span>
            <Icon className="w-4 h-4 opacity-90" />
            <span className="font-extrabold text-xs tracking-wide uppercase text-white/95">
              {step.type}
            </span>
            <span className="text-[11px] text-white/80 font-medium truncate max-w-xs">
              {step.title}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-30 cursor-pointer"
              title="Lên"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSteps - 1}
              className="p-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-30 cursor-pointer"
              title="Xuống"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 rounded bg-white/20 hover:bg-red-500 cursor-pointer transition-colors"
              title="Xóa bước này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scratch-style Inline Parameter Inputs */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium leading-relaxed">
          {step.type === 'MOVE' && (
            <>
              <span>Đến Waypoint</span>
              <select
                value={params.target_waypoint_id || 'wp-reception'}
                onChange={(e) => {
                  const id = e.target.value;
                  const wp = waypoints.find((w) => w.id === id);
                  handleFieldChange('target_waypoint_id', id);
                  if (wp) handleFieldChange('waypoint_name', wp.name);
                }}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                {waypoints.length > 0 ? (
                  waypoints.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      📍 {wp.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="wp-reception">📍 Quầy Lễ Tân</option>
                    <option value="wp-lounge">📍 Sảnh Lounge & Coffee</option>
                    <option value="wp-vip-table">📍 Bàn VIP 01</option>
                    <option value="wp-elevator">📍 Cụm Thang Máy A</option>
                  </>
                )}
              </select>
              <span>vận tốc</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="1.5"
                value={params.speed ?? 0.5}
                onChange={(e) => handleFieldChange('speed', parseFloat(e.target.value) || 0.5)}
                className="w-16 bg-white text-gray-900 px-2 py-1 rounded-full text-xs font-black text-center shadow-inner border border-black/10 focus:outline-none"
              />
              <span>m/s</span>
              <span>timeout</span>
              <input
                type="number"
                min="5"
                max="120"
                value={params.timeout_sec ?? 30}
                onChange={(e) => handleFieldChange('timeout_sec', parseInt(e.target.value) || 30)}
                className="w-14 bg-white text-gray-900 px-2 py-1 rounded-full text-xs font-bold text-center shadow-inner border border-black/10 focus:outline-none"
              />
              <span>giây</span>
            </>
          )}

          {step.type === 'GREET' && (
            <>
              <span>Chào câu</span>
              <input
                type="text"
                value={params.greeting_text || ''}
                onChange={(e) => handleFieldChange('greeting_text', e.target.value)}
                placeholder="Câu chào đón..."
                className="flex-1 min-w-[220px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
              <span>mặt</span>
              <select
                value={params.face_expression || 'HAPPY_SMILE'}
                onChange={(e) => handleFieldChange('face_expression', e.target.value)}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="HAPPY_SMILE">😊 Mỉm cười</option>
                <option value="WELCOME">✨ Chào đón</option>
                <option value="LISTENING">👂 Lắng nghe</option>
              </select>
              <span>LED</span>
              <select
                value={params.led_color || 'CYAN'}
                onChange={(e) => handleFieldChange('led_color', e.target.value)}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="CYAN">🔵 Xanh Cyan</option>
                <option value="AMBER">🟡 Vàng Hổ Phách</option>
                <option value="EMERALD">🟢 Xanh Lục</option>
              </select>
            </>
          )}

          {step.type === 'SPEAK' && (
            <>
              <span>Phát loa đọc</span>
              <input
                type="text"
                value={params.speech_text || params.text || ''}
                onChange={(e) => {
                  handleFieldChange('speech_text', e.target.value);
                  handleFieldChange('text', e.target.value);
                }}
                placeholder="Nội dung robot sẽ phát âm thanh..."
                className="flex-1 min-w-[260px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
              <span>tốc độ</span>
              <select
                value={params.voice_speed ?? 1.0}
                onChange={(e) => handleFieldChange('voice_speed', parseFloat(e.target.value))}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="0.85">0.85x</option>
                <option value="1.0">1.0x</option>
                <option value="1.15">1.15x</option>
              </select>
            </>
          )}

          {step.type === 'SHOW' && (
            <>
              <span>Màn hình</span>
              <select
                value={params.screen_mode || params.content_id || params.screen_type || 'SERVICES_GRID'}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFieldChange('screen_mode', val);
                  handleFieldChange('content_id', val);
                }}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="SERVICES_GRID">🛎️ Tiện ích khách sạn</option>
                <option value="DINING_MENU">🍽️ Menu nhà hàng</option>
                <option value="LANGUAGE_SELECTOR">🌐 Chọn ngôn ngữ</option>
                <option value="UI_SERVICE_FORM">🛏️ Biểu mẫu Buồng phòng</option>
                <option value="UI_CONFIRMATION">✅ Xác nhận dịch vụ</option>
                <option value="UI_WAITING_STAFF">🚨 Kết nối Lễ tân khẩn cấp</option>
                <option value="PROMO_SUMMER">☀️ Chiếu Poster Khuyến mại</option>
                <option value="MAP_LOBBY_FLOOR1">🗺️ Sơ đồ bản đồ Tầng 1</option>
              </select>
              <span>banner</span>
              <input
                type="text"
                value={params.display_banner || ''}
                onChange={(e) => handleFieldChange('display_banner', e.target.value)}
                placeholder="Tiêu đề banner..."
                className="flex-1 min-w-[180px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
              <span>thời lượng</span>
              <input
                type="number"
                min="3"
                max="60"
                value={params.timeout || params.slide_duration_sec || 10}
                onChange={(e) => {
                  const num = parseInt(e.target.value) || 10;
                  handleFieldChange('slide_duration_sec', num);
                  handleFieldChange('timeout', num);
                }}
                className="w-14 bg-white text-gray-900 px-2 py-1 rounded-full text-xs font-bold text-center shadow-inner border border-black/10 focus:outline-none"
              />
              <span>s</span>
            </>
          )}

          {step.type === 'LISTEN' && (
            <>
              <span>Lắng nghe qua</span>
              <select
                value={params.input_mode || params.input_source || 'VOICE_AND_TOUCH'}
                onChange={(e) => {
                  handleFieldChange('input_mode', e.target.value);
                  handleFieldChange('input_source', e.target.value);
                }}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="VOICE_AND_TOUCH">🎙️ Mic & Cảm ứng</option>
                <option value="TOUCH_ONLY">👆 Chỉ cảm ứng</option>
                <option value="BOTH">🎙️ Cả hai (Both)</option>
              </select>
              <span>chờ</span>
              <input
                type="number"
                min="5"
                max="60"
                value={params.timeout || params.timeout_sec || 15}
                onChange={(e) => {
                  const num = parseInt(e.target.value) || 15;
                  handleFieldChange('timeout_sec', num);
                  handleFieldChange('timeout', num);
                }}
                className="w-14 bg-white text-gray-900 px-2 py-1 rounded-full text-xs font-bold text-center shadow-inner border border-black/10 focus:outline-none"
              />
              <span>s</span>
              <span>gợi ý</span>
              <input
                type="text"
                value={params.prompt_hint || ''}
                onChange={(e) => handleFieldChange('prompt_hint', e.target.value)}
                placeholder="Câu nhắc khách hàng..."
                className="flex-1 min-w-[200px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
            </>
          )}

          {step.type === 'RECOMMEND' && (
            <>
              <span>Gợi ý mục</span>
              <select
                value={params.recommend_category || params.category || 'DINING_AND_SPA'}
                onChange={(e) => {
                  handleFieldChange('recommend_category', e.target.value);
                  handleFieldChange('category', e.target.value);
                }}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="DINING_AND_SPA">🍷 Ẩm thực & Spa</option>
                <option value="DINING">🍽️ Ẩm thực (Dining)</option>
                <option value="CITY_TOUR">🏛️ Điểm tham quan</option>
              </select>
              <span>món/dịch vụ</span>
              <input
                type="text"
                value={params.highlight_item || ''}
                onChange={(e) => handleFieldChange('highlight_item', e.target.value)}
                placeholder="Tên món hoặc tiện ích..."
                className="flex-1 min-w-[200px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
            </>
          )}

          {step.type === 'CREATE_REQUEST' && (
            <>
              <span>Bộ phận</span>
              <select
                value={params.target_department || (params.service_type === 'CALL_STAFF' ? 'Front_Desk' : 'Housekeeping')}
                onChange={(e) => handleFieldChange('target_department', e.target.value)}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="Housekeeping">🧹 Buồng Phòng</option>
                <option value="Food_and_Beverage">🍽️ Nhà Hàng & Bếp</option>
                <option value="Front_Desk">🛎️ Lễ Tân</option>
                <option value="Reception">🛎️ Tiếp Tân Sảnh</option>
              </select>
              <span>phòng</span>
              <input
                type="text"
                value={params.room_number || '402'}
                onChange={(e) => handleFieldChange('room_number', e.target.value)}
                className="w-16 bg-white text-gray-900 px-2 py-1 rounded-full text-xs font-black text-center shadow-inner border border-black/10 focus:outline-none"
              />
              <span>ưu tiên</span>
              <select
                value={params.urgency || params.ticket_priority || 'Normal'}
                onChange={(e) => {
                  handleFieldChange('ticket_priority', e.target.value);
                  handleFieldChange('urgency', e.target.value);
                }}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="Normal">Bình thường</option>
                <option value="NORMAL">Bình thường (NORMAL)</option>
                <option value="High">Khẩn cấp (HIGH)</option>
                <option value="HIGH">Khẩn cấp (HIGH)</option>
              </select>
              <span>ghi chú</span>
              <input
                type="text"
                value={params.note || ''}
                onChange={(e) => handleFieldChange('note', e.target.value)}
                placeholder="Khăn tắm, nước suối, taxi..."
                className="flex-1 min-w-[160px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
            </>
          )}

          {step.type === 'FEEDBACK' && (
            <>
              <span>Khảo sát</span>
              <select
                value={params.survey_type || '5_STAR_RATING'}
                onChange={(e) => handleFieldChange('survey_type', e.target.value)}
                className="bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold shadow-inner border border-black/10 focus:outline-none cursor-pointer"
              >
                <option value="5_STAR_RATING">⭐ 5 Ngôi Sao</option>
                <option value="YES_NO">👍 Hài lòng/Không</option>
              </select>
              <span>câu hỏi</span>
              <input
                type="text"
                value={params.question_text || ''}
                onChange={(e) => handleFieldChange('question_text', e.target.value)}
                placeholder="Câu hỏi đánh giá..."
                className="flex-1 min-w-[220px] bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-semibold shadow-inner border border-black/10 focus:outline-none"
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom connector tab */}
      <div
        className="relative left-7 w-6 h-[4px] rounded-b-md -mt-[1px] z-10"
        style={{ backgroundColor: theme.border }}
      />
    </div>
  );
};
