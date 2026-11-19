import React, { memo } from 'react';
import { getFloorLabelLayout, getFloorSize } from '../../services/wayfindingGeometry';

export const WayfindingFloorLayout = memo(function WayfindingFloorLayout({ floor, onElementPointerDown, rotation = 0, minLabelSize = 1 }) {
  const { width, height } = getFloorSize(floor);
  return (
    <g>
      <rect width={width} height={height} fill={floor.background || '#F4F6FA'} />
      {floor.elements?.map((item) => {
        const isLabel = item.kind === 'label';
        const label = getFloorLabelLayout(item, rotation, minLabelSize);
        return (
          <g
            key={item.id}
            transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation || 0}, ${item.width / 2}, ${item.height / 2})`}
            className={onElementPointerDown ? 'cursor-move' : undefined}
            onPointerDown={onElementPointerDown ? (event) => onElementPointerDown(event, item) : undefined}
          >
            {item.vertices ? (
              <polygon points={item.vertices.map(({ x, y }) => `${x * item.width},${y * item.height}`).join(' ')}
                fill={item.color} stroke={item.kind === 'room' ? '#A5B4C9' : 'none'} strokeWidth={2} strokeLinejoin="round" />
            ) : (
              <rect width={item.width} height={item.height} rx={item.kind === 'room' ? 8 : 0} fill={isLabel ? 'transparent' : item.color}
                stroke={item.kind === 'room' ? '#A5B4C9' : 'none'} strokeWidth={2} />
            )}
            {label && <text textAnchor="middle" dominantBaseline="central" fontSize={label.fontSize}
              transform={`translate(${item.width / 2}, ${item.height / 2}) rotate(${-rotation - (isLabel ? 0 : item.rotation || 0)})`}
              fontWeight="600" fill={isLabel ? item.color : '#16243A'}>
              {label.lines.map((line, index) => <tspan key={index} x="0" y={(index - (label.lines.length - 1) / 2) * label.fontSize * 1.16}>{line}</tspan>)}
            </text>}
          </g>
        );
      })}
    </g>
  );
});
