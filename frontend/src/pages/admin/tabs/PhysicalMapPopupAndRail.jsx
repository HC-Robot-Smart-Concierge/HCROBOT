import React from 'react';
import {
  RotateCcw,
  Plus,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { PANEL_SECTIONS } from './physicalMapPanel';
import PhysicalMapPopup from './PhysicalMapPopup';
import { PANEL_ICONS } from './physicalMapConstants';

export function PhysicalMapPopupAndRail({
  popupContent,
  closePopup, endpoints, handlePanelRail, mapActions, panel, popupTitle, trail, zones,
}) {
  return (
    <>
      {panel.open && (
        <PhysicalMapPopup key={panel.section} title={popupTitle} onClose={closePopup}>
          {popupContent}
        </PhysicalMapPopup>
      )}
        {/* Thanh icon: luon hien; bam icon mo dung phan, bam lai icon dang mo de thu gon */}
        <nav
          data-physical-map-sidebar
          aria-label="Bảng điều khiển bản đồ"
          className="w-12 shrink-0 bg-[#E9E5DC] border-l border-[#BFBFBD] flex flex-col items-center gap-1 py-2 overflow-y-auto [&>button]:shrink-0 [&>div]:shrink-0"
        >
          <button
            type="button"
            onClick={() => handlePanelRail(null)}
            title={panel.open ? 'Đóng popup' : 'Mở popup điều khiển'}
            aria-label={panel.open ? 'Đóng popup điều khiển' : 'Mở popup điều khiển'}
            aria-haspopup="dialog"
            aria-expanded={panel.open}
            aria-controls="physical-map-panel"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8C8C8C] hover:text-[#262626] hover:bg-[#BFBFBD] cursor-pointer transition-colors"
          >
            {panel.open ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
          <div className="w-7 h-px bg-[#BFBFBD] my-1" />
          {PANEL_SECTIONS.map(({ key, label }) => {
            const Icon = PANEL_ICONS[key];
            const active = panel.open && panel.section === key;
            const count = key === 'WAYPOINTS' ? endpoints.length : key === 'ZONES' ? zones.length : null;
            const title = count == null ? label : `${label} (${count})`;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePanelRail(key)}
                title={title}
                aria-label={title}
                aria-haspopup="dialog"
                aria-expanded={active}
                aria-controls="physical-map-panel"
                className={`w-9 h-9 rounded-lg flex items-center justify-center border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#262626] text-white border-[#262626]'
                    : 'bg-transparent text-[#8C8C8C] border-[#BFBFBD] hover:bg-[#BFBFBD] hover:text-[#262626]'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </button>
            );
          })}
          <div className="w-7 h-px bg-[#BFBFBD] my-1" />
          <button
            type="button"
            onClick={() => handlePanelRail('ADD')}
            title="Thêm vùng hoặc điểm mốc"
            aria-label="Thêm vùng hoặc điểm mốc"
            aria-haspopup="dialog"
            aria-expanded={panel.open && panel.section === 'ADD'}
            aria-controls="physical-map-panel"
            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
              panel.open && panel.section === 'ADD' ? 'bg-[#262626] text-white border-[#262626]' : 'bg-transparent text-[#8C8C8C] border-[#BFBFBD] hover:text-[#262626] hover:bg-[#BFBFBD]'
            }`}
          >
            <Plus className="w-[18px] h-[18px]" />
          </button>
          {mapActions.map(({ key, Icon, label, active }) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePanelRail(key)}
              title={label}
              aria-label={label}
              aria-haspopup="dialog"
              aria-expanded={panel.open && panel.section === key}
              aria-controls="physical-map-panel"
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
                active ? 'bg-[#262626] text-white border-[#262626]' : 'bg-transparent text-[#8C8C8C] border-[#BFBFBD] hover:text-[#262626] hover:bg-[#BFBFBD]'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => handlePanelRail('trail')}
            title="Xóa vệt di chuyển"
            aria-label="Xóa vệt di chuyển"
            aria-haspopup="dialog"
            aria-expanded={panel.open && panel.section === 'trail'}
            aria-controls="physical-map-panel"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8C8C8C] border border-[#BFBFBD] bg-transparent hover:text-[#262626] hover:bg-[#BFBFBD] cursor-pointer transition-colors"
          >
            <RotateCcw className="w-[18px] h-[18px]" />
          </button>
        </nav>
    </>
  );
}
