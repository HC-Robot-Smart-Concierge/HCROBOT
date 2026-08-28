import React from 'react';

export const FloorMap = ({ 
  destination = "SWIMMING POOL", 
  destinationLevel = "LEVEL 4",
  estimatedTime = "4 MIN",
  estimatedDistance = "APPROX. 120 M"
}) => {
  return (
    <div className="w-[670px] h-[558px] relative bg-aurora-surface rounded-2xl overflow-hidden border border-aurora-primary p-6 flex flex-col justify-between shrink-0 shadow-lg">
      {/* Map Header */}
      <div className="flex justify-between items-center text-aurora-primary font-semibold text-xs tracking-wider">
        <div>INDOOR ROUTE • LOBBY → {destinationLevel}</div>
        <div className="text-[10px] font-normal">
          ● Route &nbsp; ■ Elevator &nbsp; ◆ Destination
        </div>
      </div>

      {/* Level 4 Map Box */}
      <div className="w-full h-[182px] bg-aurora-canvas rounded-xl border border-aurora-border relative p-4 overflow-hidden">
        <div className="text-xs font-bold text-aurora-primary mb-2">
          {destinationLevel} • WELLNESS & SPA
        </div>
        <div className="w-[534px] h-[48px] bg-aurora-surface rounded border border-aurora-border absolute left-7 top-[56px]" />
        
        {/* Elevator Core */}
        <div className="w-[78px] h-[72px] bg-aurora-border rounded absolute left-[250px] top-[48px] flex items-center justify-center text-[10px] font-bold">
          ELEVATOR
        </div>

        {/* Pool Zone */}
        <div className="w-[180px] h-[106px] bg-sky-200/60 border border-sky-400 rounded absolute right-6 top-[38px] flex items-center justify-center font-bold text-xs text-sky-900 shadow-inner">
          SWIMMING POOL ZONE
        </div>

        {/* Route Line */}
        <div className="absolute left-[289px] top-[92px] w-[140px] h-[6px] bg-aurora-primary rounded-full" />
        
        {/* Elevator Marker */}
        <div className="w-7 h-7 bg-aurora-primary rounded-full border-4 border-aurora-canvas absolute left-[275px] top-[78px] shadow-sm" />
        
        {/* Destination Marker */}
        <div className="w-7 h-7 bg-emerald-600 rounded-full border-4 border-aurora-canvas absolute right-[100px] top-[60px] animate-bounce shadow-md" />
      </div>

      {/* Vertical Elevator Transition Line */}
      <div className="w-full flex items-center justify-center my-1">
        <div className="px-4 py-1.5 bg-aurora-border text-aurora-primary rounded-full text-xs font-bold shadow-sm flex items-center gap-2">
          <span>ELEVATOR</span>
          <span>↑</span>
          <span>{destinationLevel}</span>
        </div>
      </div>

      {/* Level 1 Lobby Map Box */}
      <div className="w-full h-[190px] bg-aurora-canvas rounded-xl border border-aurora-border relative p-4 overflow-hidden">
        <div className="text-xs font-bold text-aurora-primary mb-2">
          LEVEL 1 • MAIN LOBBY
        </div>
        
        {/* Front Desk & Lounge */}
        <div className="w-[116px] h-[38px] bg-aurora-border rounded absolute left-[54px] top-[63px] flex items-center justify-center text-[10px] font-medium">
          FRONT DESK
        </div>
        <div className="w-[170px] h-[42px] bg-aurora-surface rounded border border-aurora-border absolute left-[54px] top-[112px] flex items-center justify-center text-[10px]">
          LOBBY LOUNGE
        </div>

        {/* Lobby Elevator */}
        <div className="w-[82px] h-[76px] bg-aurora-border rounded absolute left-[338px] top-[53px] flex items-center justify-center text-[10px] font-bold">
          ELEVATOR A
        </div>

        {/* Route Line */}
        <div className="absolute left-[78px] top-[142px] w-[270px] h-[6px] bg-aurora-primary rounded-full" />

        {/* You Are Here Marker */}
        <div className="w-7 h-7 bg-blue-600 rounded-full border-4 border-aurora-canvas absolute left-[64px] top-[128px] shadow-md" />
        <span className="absolute left-[54px] top-[110px] text-[10px] font-bold text-blue-700 bg-white/80 px-1 rounded">
          YOU ARE HERE
        </span>

        {/* L1 Elevator Marker */}
        <div className="w-7 h-7 bg-aurora-primary rounded-full border-4 border-aurora-canvas absolute left-[351px] top-[78px]" />
      </div>

      {/* Route Metrics Footer */}
      <div className="w-full h-[38px] px-6 bg-aurora-inverse text-aurora-textInverse rounded-full flex justify-between items-center text-xs font-semibold">
        <span>{estimatedTime}</span>
        <span>{estimatedDistance}</span>
        <span className="text-emerald-400">ELEVATOR • ACCESSIBLE</span>
      </div>
    </div>
  );
};
