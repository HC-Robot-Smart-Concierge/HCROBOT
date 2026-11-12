import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// A non-modal popup keeps the map available for placing points and drawing zones.
export default function PhysicalMapPopup({ title, onClose, children }) {
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const trigger = document.activeElement;
    triggerRef.current = trigger;
    popupRef.current?.focus();
    const handlePointerDown = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[data-physical-map-sidebar]')) return;
      onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      trigger?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <section
      ref={popupRef}
      id="physical-map-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="physical-map-popup-title"
      tabIndex={-1}
      className="absolute top-3 right-14 z-40 flex max-h-[calc(100%-1.5rem)] w-96 max-w-[calc(100%-4.25rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-xl outline-none"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <h2 id="physical-map-popup-title" className="text-sm font-bold">{title}</h2>
        <button
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          title="Đóng popup (Esc)"
          aria-label="Đóng popup"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto p-3">{children}</div>
    </section>
  );
}
