import React from 'react';
import { Megaphone, Film, QrCode } from 'lucide-react';
import { WAYFINDING_DESTINATIONS } from './workflowConstants';

export const WorkflowStepParamEditors = ({
  step,
  index,
  params,
  effectiveWaypoints,
  availableAds,
  handleFieldChange,
}) => (
  <>
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
            <>
              <input
                type="text"
                list={`ad-media-list-${index}`}
                placeholder="URL video clip mp4 hoặc ảnh poster (chọn từ danh sách)..."
                value={params.media_url || ''}
                onChange={(e) => handleFieldChange('media_url', e.target.value)}
                className="flex-1 min-w-[200px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-rose-600 focus:bg-white shadow-2xs"
              />
              <datalist id={`ad-media-list-${index}`}>
                {availableAds.map((ad) => (
                  <option key={ad.id} value={ad.media_url}>
                    [{ad.media_type}] {ad.title}
                  </option>
                ))}
              </datalist>
            </>
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
          <option value="LOOK_UP">Đánh mắt lên (Look Up)</option>
          <option value="LOOK_LEFT">Liếc sang trái (Look Left)</option>
          <option value="LOOK_RIGHT">Liếc sang phải (Look Right)</option>
          <option value="LOOK_AROUND">Đảo mắt sinh động (Look Around)</option>
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

    {step.type === 'COMMUNICATE' && (
      <>
        <span className="font-semibold text-stone-700">Câu mở đầu AI</span>
        <input
          type="text"
          value={params.initial_prompt || params.speech_text || params.text || ''}
          onChange={(e) => {
            handleFieldChange('initial_prompt', e.target.value);
            handleFieldChange('speech_text', e.target.value);
          }}
          placeholder="Dạ em chào quý khách, em có thể hỗ trợ gì ạ?..."
          className="flex-1 min-w-[260px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
        />
        <span className="font-semibold text-stone-700">Kênh nhận</span>
        <select
          value={params.input_source || 'BOTH'}
          onChange={(e) => handleFieldChange('input_source', e.target.value)}
          className="bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 cursor-pointer shadow-2xs"
        >
          <option value="BOTH">Mic & Cảm ứng</option>
          <option value="VOICE">Chỉ Mic giọng nói</option>
          <option value="TOUCH">Chỉ Cảm ứng</option>
        </select>
        <span>ngắt sau</span>
        <input
          type="number"
          min="5"
          max="120"
          value={params.silence_timeout_sec || params.timeout || 30}
          onChange={(e) => {
            const num = parseInt(e.target.value) || 30;
            handleFieldChange('silence_timeout_sec', num);
            handleFieldChange('timeout', num);
          }}
          className="w-14 bg-stone-50 hover:bg-white text-stone-900 px-2 py-1 rounded-lg text-xs font-bold text-center border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs"
        />
        <span>giây im lặng</span>
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
              list={`ad-media-list-show-${index}`}
              placeholder="URL file video .mp4 hoặc ảnh poster (chọn từ danh sách)..."
              value={params.media_url || ''}
              onChange={(e) => handleFieldChange('media_url', e.target.value)}
              className="flex-1 min-w-[240px] bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-medium border border-stone-300 focus:outline-none focus:border-rose-600 focus:bg-white shadow-2xs"
            />
            <datalist id={`ad-media-list-show-${index}`}>
              {availableAds.map((ad) => (
                <option key={ad.id} value={ad.media_url}>
                  [{ad.media_type}] {ad.title}
                </option>
              ))}
            </datalist>
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
  </>
);
