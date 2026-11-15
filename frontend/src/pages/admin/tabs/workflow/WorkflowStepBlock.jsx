import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, CornerDownRight } from 'lucide-react';
import { STEP_SCRATCH_THEMES } from './workflowConstants';
import { STANDARD_LOBBY_WAYPOINTS } from './workflowSimulatorUtils';
import { fetchActiveAdvertisements } from '../../../../services/advertisementApi';
import { FLOW_END, getChoiceOptions } from '../../../../utils/workflowFlow';
import { WorkflowStepParamEditors } from './WorkflowStepParamEditors';

const FLOW_SELECT_CLASS =
  'bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white cursor-pointer shadow-2xs max-w-[260px]';
const FLOW_INPUT_CLASS =
  'bg-stone-50 hover:bg-white text-stone-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-stone-300 focus:outline-none focus:border-stone-700 focus:bg-white shadow-2xs';

// Chon buoc dich cho lien ket re nhanh: '' = buoc ke tiep theo thu tu, FLOW_END = ket thuc phien
const FlowTargetSelect = ({ value, onChange, targets, sequentialLabel = null }) => {
  const isDangling = Boolean(value) && value !== FLOW_END && !targets.some((t) => t.value === value);
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={FLOW_SELECT_CLASS}>
      {sequentialLabel && <option value="">{sequentialLabel}</option>}
      {targets.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      <option value={FLOW_END}>Kết thúc phiên phục vụ</option>
      {isDangling && <option value={value}>Bước đã bị xóa, cần chọn lại</option>}
    </select>
  );
};

export const WorkflowStepBlock = ({
  step,
  index,
  totalSteps,
  allSteps = [],
  waypoints = [],
  onParamChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  const theme = STEP_SCRATCH_THEMES[step.type] || STEP_SCRATCH_THEMES.MOVE;
  const Icon = theme.icon;
  const params = step.params || {};

  const [availableAds, setAvailableAds] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetchActiveAdvertisements()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setAvailableAds(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveWaypoints =
    Array.isArray(waypoints) && waypoints.length > 0 ? waypoints : STANDARD_LOBBY_WAYPOINTS;

  const handleFieldChange = (key, value) => {
    onParamChange(index, key, value);
  };

  const flowTargets = allSteps
    .map((s, i) => ({ value: s.step_id, label: `Bước ${i + 1}: ${(s.title || s.type || '').replace(/^\d+\.\s*/, '')}` }))
    .filter((t) => t.value && t.value !== step.step_id);

  const choiceOptions = step.type === 'CHOICE' ? getChoiceOptions(step) : [];
  const setChoiceOptions = (next) => handleFieldChange('options', next);
  const updateChoiceOption = (i, patch) =>
    setChoiceOptions(choiceOptions.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

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
          <WorkflowStepParamEditors
            step={step}
            index={index}
            params={params}
            effectiveWaypoints={effectiveWaypoints}
            availableAds={availableAds}
            handleFieldChange={handleFieldChange}
          />

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

          {step.type === 'CHOICE' && (
            <div className="w-full space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-stone-700">Câu hỏi</span>
                <input
                  type="text"
                  value={params.prompt || ''}
                  onChange={(e) => handleFieldChange('prompt', e.target.value)}
                  placeholder="Quý khách muốn xem bản đồ hay để em dẫn đường ạ?"
                  className={`flex-1 min-w-[260px] ${FLOW_INPUT_CLASS}`}
                />
              </div>

              {choiceOptions.map((option, i) => (
                <div key={option.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="font-mono font-bold text-[10px] text-stone-500">#{i + 1}</span>
                  <input
                    type="text"
                    value={option.label || ''}
                    onChange={(e) => updateChoiceOption(i, { label: e.target.value })}
                    placeholder="Nhãn nút"
                    className={`w-[150px] ${FLOW_INPUT_CLASS}`}
                  />
                  <input
                    type="text"
                    defaultValue={(option.keywords || []).join(', ')}
                    onBlur={(e) =>
                      updateChoiceOption(i, {
                        keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Từ khóa giọng nói, cách nhau bởi dấu phẩy"
                    title="Khách nói một trong các từ này thì robot chọn nút tương ứng"
                    className={`flex-1 min-w-[180px] ${FLOW_INPUT_CLASS}`}
                  />
                  <span>chuyển tới</span>
                  <FlowTargetSelect
                    value={option.next_step_id}
                    onChange={(v) => updateChoiceOption(i, { next_step_id: v })}
                    targets={flowTargets}
                    sequentialLabel="Bước kế tiếp theo thứ tự"
                  />
                  <button
                    type="button"
                    onClick={() => setChoiceOptions(choiceOptions.filter((_, idx) => idx !== i))}
                    disabled={choiceOptions.length <= 1}
                    className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 cursor-pointer"
                    title="Xóa lựa chọn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setChoiceOptions([
                    ...choiceOptions,
                    { id: `option-${Date.now().toString(36)}`, label: `Lựa chọn ${choiceOptions.length + 1}`, keywords: [], next_step_id: '' },
                  ])
                }
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm lựa chọn
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <span>Chờ</span>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={params.timeout_sec ?? 30}
                  onChange={(e) => handleFieldChange('timeout_sec', Number(e.target.value) || 30)}
                  className={`w-16 ${FLOW_INPUT_CLASS}`}
                />
                <span>giây, hết giờ chuyển tới</span>
                <FlowTargetSelect
                  value={params.timeout_next_step_id ?? FLOW_END}
                  onChange={(v) => handleFieldChange('timeout_next_step_id', v)}
                  targets={flowTargets}
                  sequentialLabel="Bước kế tiếp theo thứ tự"
                />
                <span>khách hủy chuyển tới</span>
                <FlowTargetSelect
                  value={params.cancel_next_step_id ?? FLOW_END}
                  onChange={(v) => handleFieldChange('cancel_next_step_id', v)}
                  targets={flowTargets}
                  sequentialLabel="Bước kế tiếp theo thứ tự"
                />
              </div>
            </div>
          )}
        </div>

        {step.type !== 'CHOICE' && flowTargets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-dashed border-stone-200 text-xs text-stone-600">
            <CornerDownRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-semibold text-stone-700">Sau bước này</span>
            <FlowTargetSelect
              value={params.next_step_id}
              onChange={(v) => handleFieldChange('next_step_id', v)}
              targets={flowTargets}
              sequentialLabel="Bước kế tiếp theo thứ tự"
            />
          </div>
        )}
      </div>
    </div>
  );
};
