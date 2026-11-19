import React from 'react';
import { BatteryCharging, Navigation, RotateCw, UserRound } from 'lucide-react';
import { phaseLabel } from '../../utils/robotRunSync';

const ICONS = { MOVING: Navigation, RETRYING: RotateCw, GUEST_HOLD: UserRound, CHARGING: BatteryCharging };

/** Small banner on the robot screen while the real vehicle runs a workflow. */
export function RobotRunStatusBar({ run }) {
  const label = phaseLabel(run);
  if (!label) return null;
  const Icon = ICONS[run.phase] || Navigation;
  return <div role="status" aria-live="polite"
    className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur pointer-events-none">
    <Icon className="w-4 h-4" />
    <span>{label}</span>
    {run.workflow_name && <span className="text-white/60">· {run.workflow_name}</span>}
  </div>;
}
