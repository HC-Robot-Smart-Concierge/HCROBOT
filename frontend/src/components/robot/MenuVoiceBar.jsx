import React from 'react';
import { Mic, Volume2, X } from 'lucide-react';

/**
 * Compact header mic trigger + floating voice subtitle pill shared by all 4 full-screen service menus.
 */
export const MenuVoiceButton = ({
  isListening = false,
  isSpeaking = false,
  isEn = false,
  onToggle = () => {},
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`h-8 px-3 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 whitespace-nowrap border ${
        isListening
          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse'
          : isSpeaking
            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500'
            : 'bg-white hover:bg-stone-100 text-stone-800 border-[#E3DFD5]'
      }`}
      title={isEn ? 'Talk to Robot on this menu' : 'Nói chuyện với Robot tại menu này'}
    >
      {isSpeaking ? (
        <Volume2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Mic className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="hidden sm:inline">
        {isListening
          ? (isEn ? 'Listening...' : 'Đang nghe...')
          : isSpeaking
            ? (isEn ? 'Speaking...' : 'Đang nói...')
            : (isEn ? 'Voice' : 'Nói với Robot')}
      </span>
    </button>
  );
};

export const MenuVoiceSubtitle = ({
  message = '',
  transcript = '',
  isListening = false,
  isEn = false,
  onClear = () => {},
}) => {
  const display = message || (isListening ? (transcript || (isEn ? 'Listening...' : 'Rora đang nghe quý khách...')) : '');
  if (!display) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 max-w-[90vw] sm:max-w-lg px-4 py-2 rounded-full bg-stone-900/92 text-stone-100 border border-stone-700 shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in duration-150">
      <span className={`w-2 h-2 rounded-full shrink-0 ${isListening ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
      <span className="font-medium leading-snug line-clamp-2">{display}</span>
      {message && (
        <button
          type="button"
          onClick={onClear}
          className="text-stone-400 hover:text-white shrink-0 cursor-pointer"
          aria-label="Close subtitle"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
