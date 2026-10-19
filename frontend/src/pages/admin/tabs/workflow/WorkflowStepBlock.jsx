import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Megaphone, Film, Image as ImageIcon, QrCode, Navigation } from 'lucide-react';
import { STEP_SCRATCH_THEMES, WAYFINDING_DESTINATIONS } from './workflowConstants';
import { STANDARD_LOBBY_WAYPOINTS } from './workflowSimulatorUtils';

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

  const effectiveWaypoints =
    Array.isArray(waypoints) && waypoints.length > 0 ? waypoints : STANDARD_LOBBY_WAYPOINTS;

  const handleFieldChange = (key, value) => {
    onParamChange(index, key, value);
  };

  return (
    <div className="relative group select-none transition-all duration-200">
      {/* Main Block Container - Minimalist White Card with Subtle Left Accent */}
      <div
        className="rounded-xl p-3.5 bg-white text-stone-900 shadow-2xs border border-stone-300 hover:border-stone-400 transition-all border-l-4"
        style={{ borderLeftColor: theme.accent || '#334155' }}
      >
        {/* Block Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-stone-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
              {index + 1}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-800 border border-stone-300 flex items-center gap-1 shrink-0">
              <Icon className="w-3 h-3 text-stone-700" />
              <span>{step.type}</span>
            </span>
            <span className="text-xs font-bold text-stone-800 truncate" title={step.title}>
              {step.title}
            </span>
          </div>

          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-20 cursor-pointer transition-colors"
              title="Di chuyển lên"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={index === totalSteps - 1}
              className="p-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-20 cursor-pointer transition-colors"
              title="Di chuyển xuống"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
              title="Xóa bước này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline Parameter Inputs */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-600 leading-relaxed">
          {step.type === 'MOVE' && (
            <>
              <span className="font-semibold text-stone-700">Từ</span>
              <select
                value={params.from_waypoint || 'CURRENT'}
                onChange={(e) => {
                  const id = e.target.value;
                  handleFieldChange('from_waypoint', id);
                  const wp = effectiveWaypoints.find((w) => w.id === id || w.key === id);
                  handleFieldChange(
                    'from_waypoint_name',
                    id === 'CURRENT' ? 'Vị trí hiện tại của Robot' : (wp?.name || id)
                  );
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs min-w-[200px] max-w-[300px]"
              >
                <option value="CURRENT">Vị trí hiện tại của Robot</option>
                {effectiveWaypoints.map((wp) => (
                  <option key={wp.id || wp.key} value={wp.id || wp.key}>
                    {wp.name}
                  </option>
                ))}
              </select>

              <span className="font-semibold text-stone-700">Đến</span>
              <select
                value={params.target_value || params.target_waypoint_id || 'FRONT_DESK'}
                onChange={(e) => {
                  const id = e.target.value;
                  handleFieldChange('target_value', id);
                  handleFieldChange('target_waypoint_id', id);
                  const wp = effectiveWaypoints.find((w) => w.id === id || w.key === id);
                  if (wp) {
                    handleFieldChange('waypoint_name', wp.name);
                    if (wp.x !== undefined) handleFieldChange('target_x', wp.x);
                    if (wp.y !== undefined) handleFieldChange('target_y', wp.y);
                  }
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs min-w-[260px] max-w-[380px]"
              >
                {effectiveWaypoints.map((wp) => (
                  <option key={wp.id || wp.key} value={wp.id || wp.key}>
                    {wp.name}
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1">
                <span>vận tốc</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.5"
                  value={params.speed ?? 0.35}
                  onChange={(e) => handleFieldChange('speed', parseFloat(e.target.value) || 0.35)}
                  className="w-16 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
                />
                <span>m/s</span>
                <span className="text-[10px] text-stone-400 font-mono">
                  (~{Math.min(100, Math.round(((params.speed ?? 0.35) / 0.005)))}%)
                </span>
              </div>

              <div className="inline-flex items-center gap-1">
                <span>timeout</span>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={params.timeout_sec ?? 30}
                  onChange={(e) => handleFieldChange('timeout_sec', parseInt(e.target.value) || 30)}
                  className="w-14 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
                />
                <span>giây</span>
              </div>

              <div className="w-full flex items-center gap-2 pt-1.5 mt-1 border-t border-stone-200">
                <span className="font-semibold text-indigo-700 text-xs shrink-0 flex items-center gap-1">
                  <Megaphone className="w-3.5 h-3.5" />
                  Loa quảng cáo:
                </span>
                <input
                  type="text"
                  placeholder="Nhập nội dung phát loa khi di chuyển (tùy chọn)..."
                  value={params.broadcast_speech || ''}
                  onChange={(e) => handleFieldChange('broadcast_speech', e.target.value)}
                  className="flex-1 bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-indigo-600 focus:bg-white shadow-2xs"
                />
              </div>

              <div className="w-full flex flex-wrap items-center gap-2 pt-1.5 border-t border-stone-200">
                <span className="font-semibold text-rose-700 text-xs shrink-0 flex items-center gap-1">
                  <Film className="w-3.5 h-3.5" />
                  Chiếu màn hình khi đi:
                </span>
                <select
                  value={params.screen_mode || (params.show_media_on_move ? 'PROMO_VIDEO' : 'OFF')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'OFF') {
                      handleFieldChange('show_media_on_move', false);
                      handleFieldChange('screen_mode', '');
                      handleFieldChange('media_type', '');
                    } else {
                      handleFieldChange('show_media_on_move', true);
                      handleFieldChange('screen_mode', val);
                      handleFieldChange('media_type', val === 'PROMO_VIDEO' ? 'VIDEO' : 'IMAGE');
                    }
                  }}
                  className="bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-rose-600 focus:bg-white cursor-pointer shadow-2xs"
                >
                  <option value="OFF">Tắt (Hiện bản đồ di chuyển)</option>
                  <option value="PROMO_VIDEO">Chiếu Video quảng cáo</option>
                  <option value="PROMO_IMAGE">Chiếu Hình ảnh Poster</option>
                  <option value="PROMO_SLIDE">Chiếu Slide Ưu Đãi Mùa Hè</option>
                  <option value="MAP_WAYFINDING">Chiếu Chỉ đường & Mã QR di động</option>
                  <option value="DINING_MENU">Chiếu Menu ẩm thực nhà hàng</option>
                  <option value="SERVICES_GRID">Chiếu Cơ sở vật chất & Dịch vụ</option>
                </select>

                {(params.screen_mode === 'PROMO_VIDEO' || params.screen_mode === 'PROMO_IMAGE' || params.show_media_on_move) && (
                  <input
                    type="text"
                    placeholder="URL video clip mp4 hoặc ảnh poster (để trống sẽ dùng clip mẫu 5 sao)..."
                    value={params.media_url || ''}
                    onChange={(e) => handleFieldChange('media_url', e.target.value)}
                    className="flex-1 min-w-[200px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-rose-600 focus:bg-white shadow-2xs"
                  />
                )}
              </div>
            </>
          )}

          {step.type === 'GREET' && (
            <>
              <span className="font-semibold text-stone-700">Chào câu</span>
              <input
                type="text"
                value={params.greeting_text || ''}
                onChange={(e) => handleFieldChange('greeting_text', e.target.value)}
                placeholder="Câu chào đón..."
                className="flex-1 min-w-[220px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
              <span>biểu cảm</span>
              <select
                value={params.face_expression || 'HAPPY_SMILE'}
                onChange={(e) => handleFieldChange('face_expression', e.target.value)}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="HAPPY_SMILE">Mỉm cười (Happy)</option>
                <option value="WELCOME">Chào đón (Welcome)</option>
                <option value="LISTENING">Lắng nghe (Listening)</option>
              </select>
              <span>LED</span>
              <select
                value={params.led_color || 'CYAN'}
                onChange={(e) => handleFieldChange('led_color', e.target.value)}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="CYAN">Xanh Cyan</option>
                <option value="AMBER">Vàng Hổ Phách</option>
                <option value="EMERALD">Xanh Lục</option>
              </select>
            </>
          )}

          {step.type === 'SPEAK' && (
            <>
              <span className="font-semibold text-stone-700">Phát loa đọc</span>
              <input
                type="text"
                value={params.speech_text || params.text || ''}
                onChange={(e) => {
                  handleFieldChange('speech_text', e.target.value);
                  handleFieldChange('text', e.target.value);
                }}
                placeholder="Nội dung robot sẽ phát âm thanh..."
                className="flex-1 min-w-[260px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
              <span>tốc độ</span>
              <select
                value={params.voice_speed ?? 1.0}
                onChange={(e) => handleFieldChange('voice_speed', parseFloat(e.target.value))}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="0.85">0.85x</option>
                <option value="1.0">1.0x</option>
                <option value="1.15">1.15x</option>
              </select>
            </>
          )}

          {step.type === 'SHOW' && (
            <>
              <span className="font-semibold text-stone-700">Màn hình</span>
              <select
                value={params.screen_mode || params.content_id || params.screen_type || 'SERVICES_GRID'}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFieldChange('screen_mode', val);
                  handleFieldChange('content_id', val);
                  if (val === 'PROMO_VIDEO') handleFieldChange('media_type', 'VIDEO');
                  else if (val === 'PROMO_IMAGE') handleFieldChange('media_type', 'IMAGE');
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="MAP_WAYFINDING">Chỉ đường & Quét mã QR di động</option>
                <option value="DINING_MENU">Menu nhà hàng ẩm thực</option>
                <option value="SERVICES_GRID">Cơ sở vật chất & Tiện ích khách sạn</option>
                <option value="PROMO_VIDEO">Video quảng cáo</option>
                <option value="PROMO_IMAGE">Hình ảnh / Poster quảng cáo</option>
                <option value="PROMO_SUMMER">Chiếu Slide Ưu Đãi Mùa Hè</option>
                <option value="LANGUAGE_SELECTOR">Chọn ngôn ngữ</option>
                <option value="UI_SERVICE_FORM">Biểu mẫu Buồng phòng</option>
                <option value="UI_CONFIRMATION">Xác nhận dịch vụ</option>
                <option value="UI_WAITING_STAFF">Kết nối Lễ tân khẩn cấp</option>
                <option value="FEEDBACK">Đánh giá mức độ hài lòng</option>
              </select>

              {(params.screen_mode === 'MAP_WAYFINDING' || params.content_id === 'MAP_WAYFINDING') && (
                <>
                  <span className="font-semibold text-stone-700 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-stone-600" />
                    Điểm đến:
                  </span>
                  <select
                    value={params.destination_key || 'infinity_pool'}
                    onChange={(e) => handleFieldChange('destination_key', e.target.value)}
                    className="bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
                  >
                    {WAYFINDING_DESTINATIONS.map((dest) => (
                      <option key={dest.key} value={dest.key}>
                        {dest.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <span>banner</span>
              <input
                type="text"
                value={params.display_banner || ''}
                onChange={(e) => handleFieldChange('display_banner', e.target.value)}
                placeholder="Tiêu đề banner..."
                className="flex-1 min-w-[180px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
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
                className="w-14 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
              <span>giây</span>

              {(params.screen_mode === 'PROMO_VIDEO' ||
                params.screen_mode === 'PROMO_IMAGE' ||
                params.media_type === 'VIDEO' ||
                params.media_type === 'IMAGE' ||
                Boolean(params.media_url)) && (
                <div className="w-full flex flex-wrap items-center gap-2 pt-1.5 mt-1 border-t border-stone-200">
                  <span className="font-semibold text-rose-700 text-xs shrink-0 flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    URL Media:
                  </span>
                  <input
                    type="text"
                    placeholder="URL file video .mp4 hoặc ảnh poster (để trống sẽ dùng clip mẫu resort 5 sao)..."
                    value={params.media_url || ''}
                    onChange={(e) => handleFieldChange('media_url', e.target.value)}
                    className="flex-1 min-w-[240px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-rose-600 focus:bg-white shadow-2xs"
                  />
                  <span className="font-semibold text-stone-700 text-xs shrink-0">
                    Thuyết minh:
                  </span>
                  <input
                    type="text"
                    placeholder="Phát giọng nói kèm theo khi chiếu (tùy chọn)..."
                    value={params.speech_text || ''}
                    onChange={(e) => handleFieldChange('speech_text', e.target.value)}
                    className="flex-1 min-w-[180px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
                  />
                </div>
              )}
            </>
          )}

          {step.type === 'LISTEN' && (
            <>
              <span className="font-semibold text-stone-700">Lắng nghe qua</span>
              <select
                value={params.input_mode || params.input_source || 'VOICE_AND_TOUCH'}
                onChange={(e) => {
                  handleFieldChange('input_mode', e.target.value);
                  handleFieldChange('input_source', e.target.value);
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="VOICE_AND_TOUCH">Mic & Cảm ứng</option>
                <option value="TOUCH_ONLY">Chỉ cảm ứng</option>
                <option value="BOTH">Cả hai (Both)</option>
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
                className="w-14 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
              <span>giây</span>
              <span>gợi ý</span>
              <input
                type="text"
                value={params.prompt_hint || ''}
                onChange={(e) => handleFieldChange('prompt_hint', e.target.value)}
                placeholder="Câu nhắc khách hàng..."
                className="flex-1 min-w-[200px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
            </>
          )}

          {step.type === 'RECOMMEND' && (
            <>
              <span className="font-semibold text-stone-700">Gợi ý mục</span>
              <select
                value={params.recommend_category || params.category || 'DINING_AND_SPA'}
                onChange={(e) => {
                  handleFieldChange('recommend_category', e.target.value);
                  handleFieldChange('category', e.target.value);
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="DINING_AND_SPA">Ẩm thực & Spa</option>
                <option value="DINING">Ẩm thực (Dining)</option>
                <option value="CITY_TOUR">Điểm tham quan</option>
              </select>
              <span>món/dịch vụ</span>
              <input
                type="text"
                value={params.highlight_item || ''}
                onChange={(e) => handleFieldChange('highlight_item', e.target.value)}
                placeholder="Tên món hoặc tiện ích..."
                className="flex-1 min-w-[200px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
            </>
          )}

          {step.type === 'CREATE_REQUEST' && (
            <>
              <span className="font-semibold text-stone-700">Bộ phận</span>
              <select
                value={params.target_department || (params.service_type === 'CALL_STAFF' ? 'Front_Desk' : 'Housekeeping')}
                onChange={(e) => handleFieldChange('target_department', e.target.value)}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="Housekeeping">Buồng Phòng</option>
                <option value="Food_and_Beverage">Nhà Hàng & Bếp</option>
                <option value="Front_Desk">Lễ Tân</option>
                <option value="Reception">Tiếp Tân Sảnh</option>
              </select>
              <span>phòng</span>
              <input
                type="text"
                value={params.room_number || '402'}
                onChange={(e) => handleFieldChange('room_number', e.target.value)}
                className="w-16 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
              <span>ưu tiên</span>
              <select
                value={params.urgency || params.ticket_priority || 'Normal'}
                onChange={(e) => {
                  handleFieldChange('ticket_priority', e.target.value);
                  handleFieldChange('urgency', e.target.value);
                }}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
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
                className="flex-1 min-w-[160px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
            </>
          )}

          {step.type === 'FEEDBACK' && (
            <>
              <span className="font-semibold text-stone-700">Khảo sát</span>
              <select
                value={params.survey_type || '5_STAR_RATING'}
                onChange={(e) => handleFieldChange('survey_type', e.target.value)}
                className="bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs"
              >
                <option value="5_STAR_RATING">5 Ngôi Sao (Rating)</option>
                <option value="YES_NO">Hài lòng / Không</option>
              </select>
              <span>câu hỏi</span>
              <input
                type="text"
                value={params.question_text || ''}
                onChange={(e) => handleFieldChange('question_text', e.target.value)}
                placeholder="Câu hỏi đánh giá..."
                className="flex-1 min-w-[220px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
