import React from 'react';
import { PLACE_ICONS } from '../../services/wayfindingGeometry';

export function PlacePin({ place, onSelect, rotation = 0, onDragStart, selected = false }) {
  const activate = (event) => {
    event.stopPropagation();
    onSelect(place);
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={place.name}
      transform={`translate(${place.coords.x}, ${place.coords.y}) rotate(${rotation}) scale(${place.iconScale ?? 1})`}
      className={`pointer-events-auto ${onDragStart ? 'cursor-move' : 'cursor-pointer'}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        onDragStart?.(event);
      }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(event);
        }
      }}
    >
      <circle r="28" fill={selected ? '#E0F2FE' : 'white'} stroke="#0369A1" strokeWidth={selected ? 6 : 4} />
      {place.iconImage ? (
        <image href={place.iconImage} x="-18" y="-18" width="36" height="36" />
      ) : (
        <text y="1" fontSize="29" textAnchor="middle" dominantBaseline="central">
          {(PLACE_ICONS[place.icon] || PLACE_ICONS.pin)[0]}
        </text>
      )}
    </g>
  );
}

export function PlaceCard({ place, floor, onClose, onDirections }) {
  return (
    <aside className="absolute left-3 bottom-3 z-40 w-56 max-w-[85%] rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden" aria-label={place.name}>
      {place.photo && <img src={place.photo} alt={place.name} className="w-full h-24 object-cover" />}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <strong className="min-w-0 text-sm [overflow-wrap:anywhere]">{place.name}</strong>
          <button type="button" aria-label="Đóng thông tin địa điểm" className="px-1" onClick={onClose}>×</button>
        </div>
        <p className="text-xs text-stone-600 mt-1">{floor?.name}</p>
        {onDirections && place.enabled && (
          <button type="button" onClick={onDirections} className="mt-2 rounded-lg bg-sky-700 px-3 py-1.5 text-xs text-white font-semibold">
            Chỉ đường từ sảnh
          </button>
        )}
        {!place.enabled && <p className="text-xs text-stone-600 mt-2">Địa điểm chưa mở chỉ đường.</p>}
      </div>
    </aside>
  );
}
