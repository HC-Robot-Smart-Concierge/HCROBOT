import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Square } from 'lucide-react';
import { useRobotControlText } from '../../context/RobotControlLanguage';

// Shared presentation only. Each mode supplies its existing movement handlers.
export const RobotManualControls = ({
  speed, speedDraft, onSpeedDraftChange, onSpeedChange,
  activeMotion = 'stop', onMove, onStop, stopOnLeave = false,
  turnSpeed, onTurnSpeedChange,
}) => {
  const rc = useRobotControlText();
  // Kéo chuột ra khỏi nút khi vẫn đang nhấn -> không có mouseup trên nút -> phải dừng.
  // Chỉ dừng khi chuột trái còn giữ: lướt chuột qua nút lúc đang lái bằng phím không làm robot dừng.
  const handleMouseLeave = stopOnLeave
    ? (event) => { if (event.buttons & 1) onStop(); }
    : undefined;
  return (
        <div className="robot-manual-controls p-2.5 bg-[#18181B]/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-2 select-none">
          <div className="robot-speed-heading"><span> {rc("Drive speed")} </span><strong>{speedDraft ?? speed}%</strong></div>
          {/* Speed presets */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
            {[
              { val: 30, label: '30%', title: rc("30% speed (slow, for mapping)") },
              { val: 50, label: '50%', title: rc("50% speed (Key: 1)") },
              { val: 75, label: '75%', title: rc("75% speed (Key: 2)") },
              { val: 100, label: '100%', title: rc("100% speed (Key: 3)") },
            ].map((lvl) => (
              <button
                key={lvl.val}
                onClick={() => onSpeedChange(lvl.val)}
                className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold transition-all cursor-pointer ${
                  speed === lvl.val
                    ? 'bg-[#F2EFE9] text-[#262626] shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
                title={lvl.title}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          {/* Thanh trượt tốc độ chi tiết 20-100% (gửi khi thả tay) */}
          <div className="w-full flex items-center gap-2 px-1">
            <input
              type="range"
              aria-label={rc("Drive speed")}
              min={20}
              max={100}
              step={5}
              value={speedDraft ?? speed}
              onChange={(e) => onSpeedDraftChange(Number(e.target.value))}
              onPointerUp={(e) => {
                onSpeedChange(Number(e.currentTarget.value));
                onSpeedDraftChange(null);
              }}
              onKeyUp={(e) => {
                onSpeedChange(Number(e.currentTarget.value));
                onSpeedDraftChange(null);
              }}
              className="flex-1 h-1 accent-[#F2EFE9] cursor-pointer"
              title={rc("Drag to adjust motor speed (20% - 100%)")}
            />
            <span className="w-8 text-right font-mono text-[9px] font-bold text-stone-200">
              {speedDraft ?? speed}%
            </span>
          </div>

          {/* Thanh trượt tốc độ quay tại chỗ (A/D), chỉ hiện khi màn hình truyền onTurnSpeedChange */}
          {onTurnSpeedChange && (
            <div className="w-full flex items-center gap-2 px-1">
              <span className="font-mono text-[9px] font-bold text-cyan-300 shrink-0">{rc("Turn")}</span>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={turnSpeed}
                onChange={(e) => onTurnSpeedChange(Number(e.target.value))}
                aria-label={rc("Turn speed")}
                className="flex-1 h-1 accent-cyan-400 cursor-pointer"
                title={rc("In-place left/right turn speed (20% - 100%)")}
              />
              <span className="w-8 text-right font-mono text-[9px] font-bold text-cyan-300">
                {turnSpeed}%
              </span>
            </div>
          )}

          {/* Cross D-Pad Cluster (W, A, S, D + STOP) */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* W - Tiến */}
            <button
              onMouseDown={() => onMove('w')}
              onMouseUp={onStop}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(event) => { event.preventDefault(); onMove('w'); }}
              onTouchEnd={onStop}
              onTouchCancel={onStop}
              className={`absolute top-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'w' || activeMotion === 'wa' || activeMotion === 'wd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title={rc("Forward (W / Up arrow)")}
            >
              <ChevronUp className="w-4 h-4" />
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">W</span>
            </button>

            {/* A - Xoay Trái */}
            <button
              onMouseDown={() => onMove('a')}
              onMouseUp={onStop}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(event) => { event.preventDefault(); onMove('a'); }}
              onTouchEnd={onStop}
              onTouchCancel={onStop}
              className={`absolute left-0 w-9 h-9 rounded-xl flex items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                activeMotion === 'a' || activeMotion === 'wa' || activeMotion === 'sa'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title={rc("Turn Left (A / Left arrow)")}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">A</span>
            </button>

            {/* STOP - Trung tâm */}
            <button
              onClick={onStop}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border z-10 ${
                activeMotion === 'stop'
                  ? 'bg-[#262626] text-[#F2EFE9] border-white/30 shadow-xs'
                  : 'bg-stone-900/90 text-stone-300 border-white/10 hover:bg-stone-800'
              }`}
              title={rc("Stop (Space / X)")}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-[7px] uppercase">{rc('Stop')}</span>
            </button>

            {/* D - Xoay Phải */}
            <button
              onMouseDown={() => onMove('d')}
              onMouseUp={onStop}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(event) => { event.preventDefault(); onMove('d'); }}
              onTouchEnd={onStop}
              onTouchCancel={onStop}
              className={`absolute right-0 w-9 h-9 rounded-xl flex items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                activeMotion === 'd' || activeMotion === 'wd' || activeMotion === 'sd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title={rc("Turn Right (D / Right arrow)")}
            >
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">D</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* S - Lùi */}
            <button
              onMouseDown={() => onMove('s')}
              onMouseUp={onStop}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(event) => { event.preventDefault(); onMove('s'); }}
              onTouchEnd={onStop}
              onTouchCancel={onStop}
              className={`absolute bottom-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 's' || activeMotion === 'sa' || activeMotion === 'sd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title={rc("Backward (S / Down arrow)")}
            >
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">S</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <p className="robot-control-hint"> {rc("Hold to move · Release to stop")} </p>
        </div>

  );
};
