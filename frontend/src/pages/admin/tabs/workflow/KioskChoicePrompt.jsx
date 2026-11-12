import React from 'react';
import { Clock, GitBranch, X } from 'lucide-react';
import { getChoiceOptions } from '../../../../utils/workflowFlow';

/**
 * Touch prompt for a CHOICE step. The robot screen and the Studio simulator
 * both render it, and both route the result through resolveNextStepIndex.
 */
export const KioskChoicePrompt = ({
  step,
  remainingSec = null,
  disabled = false,
  transcript = '',
  onChoose = () => {},
  onCancel = () => {},
}) => {
  const params = step?.params || {};
  const options = getChoiceOptions(step);
  const prompt = params.prompt || step?.title || 'Quý khách muốn chọn gì ạ?';

  return (
    <div className="space-y-3 py-2 animate-in fade-in duration-300" data-testid="kiosk-choice">
      <div className="text-center space-y-1">
        <span className="inline-flex p-2 rounded-xl bg-amber-100/70 text-amber-700 text-xs mb-1">
          <GitBranch className="w-4 h-4" />
        </span>
        <h4 className="text-sm font-extrabold text-stone-800 px-2">{prompt}</h4>
        {params.prompt_en && <p className="text-xs text-stone-500 font-medium">{params.prompt_en}</p>}
      </div>

      <div className={`grid gap-3 pt-1 ${options.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(option.id)}
            className="p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-sm bg-white border-stone-200 hover:border-amber-400 hover:bg-amber-50/60 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="block text-xs font-black text-stone-900 text-center">{option.label}</span>
            {option.label_en && <span className="text-[10px] text-stone-500 font-medium">{option.label_en}</span>}
          </button>
        ))}
      </div>

      {transcript && (
        <p className="text-center text-[11px] text-stone-600">
          Đã nghe: <em className="font-semibold text-stone-800">"{transcript}"</em>
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1.5 text-[11px] text-stone-500 bg-white/80 px-3 py-1.5 rounded-full border border-stone-200">
          <Clock className="w-3.5 h-3.5 text-stone-600" />
          {remainingSec === null ? 'Chạm hoặc nói lựa chọn của quý khách' : `Tự chuyển tiếp sau ${Math.max(0, remainingSec)} giây`}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="px-3 py-1.5 rounded-full border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          {params.cancel_label || 'Hủy'}
        </button>
      </div>
    </div>
  );
};
