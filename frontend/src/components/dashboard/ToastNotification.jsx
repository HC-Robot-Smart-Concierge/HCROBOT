import React from 'react';
import { Sparkles, CheckCircle, Info, X } from 'lucide-react';

export const ToastNotification = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-short font-sans">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#18181B] text-white shadow-2xl border border-stone-700/80 backdrop-blur-md">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs font-semibold text-stone-100 pr-2">{message}</p>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
