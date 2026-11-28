/**
 * Bộ ký hiệu mặt bằng (nhìn từ trên xuống) cho layout chỉ đường trên map Nav2.
 * Tự vẽ bằng SVG (không phụ thuộc thư viện icon ngoài), nét mảnh kiểu bản vẽ kiến trúc.
 *
 * Toạ độ layout lưu theo MÉT (frame map Nav2). Khi vẽ, đổi sang "ô" của ảnh map
 * (1 ô = resolution mét, trục y hướng xuống) bằng worldToCell.
 */
import React from 'react';

export const NAV_THEME = {
  floor: '#FBFAF7',
  wall: '#1C1917',
  roomFill: '#FFFFFF',
  roomStroke: '#D6D3D1',
  furniture: '#EFE8DC',
  furnitureStroke: '#78716C',
  text: '#292524',
  blue: '#0369A1',
  blueSoft: '#E0F2FE',
  pink: '#BE185D',
  green: '#15803D',
  greenSoft: '#DCFCE7',
};

/** Thư viện cho editor. w/h mặc định theo mét. */
export const NAV_SYMBOLS = [
  { group: 'Khu vực', type: 'room', name: 'Phòng / khu vực', w: 1.2, h: 0.9, label: 'Khu vực' },
  { group: 'Khu vực', type: 'label', name: 'Nhãn chữ', w: 0.8, h: 0.2, label: 'Nhãn' },
  { group: 'Khu vực', type: 'destination', name: 'Điểm đến', w: 0.4, h: 0.4 },
  { group: 'Di chuyển', type: 'elevator', name: 'Thang máy', w: 0.4, h: 0.4, label: 'Thang máy' },
  { group: 'Di chuyển', type: 'stairs', name: 'Cầu thang', w: 0.4, h: 0.6 },
  { group: 'Di chuyển', type: 'escalator', name: 'Thang cuốn', w: 0.3, h: 0.7 },
  { group: 'Di chuyển', type: 'door', name: 'Cửa', w: 0.3, h: 0.3 },
  { group: 'Di chuyển', type: 'exit', name: 'Lối thoát hiểm', w: 0.3, h: 0.2 },
  { group: 'Tiện ích', type: 'wc', name: 'WC chung', w: 0.3, h: 0.3 },
  { group: 'Tiện ích', type: 'wc_male', name: 'WC nam', w: 0.25, h: 0.25 },
  { group: 'Tiện ích', type: 'wc_female', name: 'WC nữ', w: 0.25, h: 0.25 },
  { group: 'Tiện ích', type: 'reception', name: 'Quầy lễ tân', w: 0.6, h: 0.3, label: 'Lễ tân' },
  { group: 'Tiện ích', type: 'charger', name: 'Trạm sạc robot', w: 0.25, h: 0.25 },
  { group: 'Nội thất', type: 'table_rect', name: 'Bàn chữ nhật', w: 0.4, h: 0.25 },
  { group: 'Nội thất', type: 'table_round', name: 'Bàn tròn', w: 0.3, h: 0.3 },
  { group: 'Nội thất', type: 'chair', name: 'Ghế', w: 0.15, h: 0.15 },
  { group: 'Nội thất', type: 'sofa_l', name: 'Sofa chữ L', w: 0.6, h: 0.45 },
  { group: 'Nội thất', type: 'counter_l', name: 'Quầy chữ L', w: 0.7, h: 0.5 },
  { group: 'Nội thất', type: 'plant', name: 'Cây xanh', w: 0.15, h: 0.15 },
  { group: 'Nội thất', type: 'bed', name: 'Giường', w: 0.5, h: 0.6 },
  { group: 'Nội thất', type: 'locker', name: 'Tủ đồ (locker)', w: 0.6, h: 0.2 },
  { group: 'Di chuyển', type: 'double_door', name: 'Cửa đôi', w: 0.5, h: 0.25 },
  { group: 'Dịch vụ', type: 'pool', name: 'Hồ bơi', w: 0.8, h: 0.5 },
  { group: 'Dịch vụ', type: 'gym', name: 'Gym', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'spa_icon', name: 'Spa', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'bar_icon', name: 'Bar', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'coffee', name: 'Cà phê', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'karaoke', name: 'Karaoke', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'shop', name: 'Cửa hàng', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'kitchen', name: 'Bếp', w: 0.3, h: 0.3 },
  { group: 'Dịch vụ', type: 'warehouse', name: 'Kho', w: 0.3, h: 0.3 },
  { group: 'Bãi xe', type: 'parking', name: 'Ô đỗ xe (P)', w: 0.3, h: 0.55 },
  { group: 'Bãi xe', type: 'car', name: 'Ô tô', w: 0.25, h: 0.5 },
  { group: 'Bãi xe', type: 'motorbike', name: 'Xe máy', w: 0.12, h: 0.3 },
];

export const symbolName = (type) => NAV_SYMBOLS.find((s) => s.type === type)?.name || type;

// ---------- Hình vẽ từng ký hiệu trong hộp cục bộ (0..w, 0..h), đơn vị "ô" ----------
const Person = ({ cx, cy, s, color, skirt }) => (
  <g fill={color}>
    <circle cx={cx} cy={cy - s * 0.32} r={s * 0.12} />
    {skirt ? (
      <path d={`M${cx - s * 0.1} ${cy - s * 0.16} H${cx + s * 0.1} L${cx + s * 0.2} ${cy + s * 0.2} H${cx - s * 0.2} Z`} />
    ) : (
      <rect x={cx - s * 0.12} y={cy - s * 0.16} width={s * 0.24} height={s * 0.36} rx={s * 0.04} />
    )}
    <rect x={cx - s * 0.08} y={cy + s * 0.18} width={s * 0.06} height={s * 0.22} />
    <rect x={cx + s * 0.02} y={cy + s * 0.18} width={s * 0.06} height={s * 0.22} />
  </g>
);

const LPath = (w, h) => {
  const t = Math.min(w, h) * 0.38;
  return `M0 0 H${w} V${t} H${t} V${h} H0 Z`;
};

export const NavSymbolShape = ({ type, w, h, u = 1 }) => {
  const T = NAV_THEME;
  const sw = 0.5 * u; // nét mảnh
  const m = Math.min(w, h);
  switch (type) {
    case 'room':
      return <rect width={w} height={h} rx={0.6 * u} fill={T.roomFill} stroke={T.roomStroke} strokeWidth={sw * 1.4} />;
    case 'elevator':
      return (
        <g>
          <rect width={w} height={h} rx={0.4 * u} fill={T.blueSoft} stroke={T.blue} strokeWidth={sw * 1.4} />
          <line x1={w / 2} y1={h * 0.12} x2={w / 2} y2={h * 0.88} stroke={T.blue} strokeWidth={sw} />
          <path d={`M${w * 0.22} ${h * 0.42} L${w * 0.34} ${h * 0.24} L${w * 0.46} ${h * 0.42} Z`} fill={T.blue} />
          <path d={`M${w * 0.54} ${h * 0.58} L${w * 0.66} ${h * 0.76} L${w * 0.78} ${h * 0.58} Z`} fill={T.blue} />
        </g>
      );
    case 'stairs': {
      const n = Math.max(4, Math.round(h / (1.6 * u)));
      return (
        <g>
          <rect width={w} height={h} fill="#FFFFFF" stroke={T.wall} strokeWidth={sw} />
          {Array.from({ length: n - 1 }, (_, i) => (
            <line key={i} x1={0} x2={w} y1={((i + 1) * h) / n} y2={((i + 1) * h) / n} stroke={T.furnitureStroke} strokeWidth={sw * 0.7} />
          ))}
          <path d={`M${w / 2} ${h * 0.85} V${h * 0.15} M${w / 2 - w * 0.15} ${h * 0.28} L${w / 2} ${h * 0.15} L${w / 2 + w * 0.15} ${h * 0.28}`}
            fill="none" stroke={T.blue} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    }
    case 'escalator': {
      const n = Math.max(4, Math.round(h / (1.4 * u)));
      return (
        <g>
          <rect width={w} height={h} rx={0.3 * u} fill="#F5F5F4" stroke={T.wall} strokeWidth={sw} />
          {Array.from({ length: n - 1 }, (_, i) => (
            <line key={i} x1={w * 0.15} x2={w * 0.85} y1={((i + 1) * h) / n} y2={((i + 1) * h) / n} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
          ))}
        </g>
      );
    }
    case 'door':
      return (
        <g fill="none">
          {/* Xoá đoạn tường ở khe cửa */}
          <rect x={-0.2 * u} y={h - 1.4 * u} width={w + 0.4 * u} height={2.8 * u} fill={NAV_THEME.floor} stroke="none" />
          <path d={`M0 ${h} A${w} ${h} 0 0 1 ${w} 0`} stroke={T.furnitureStroke} strokeWidth={sw * 0.7} strokeDasharray={`${u} ${u * 0.7}`} />
          <line x1={0} y1={h} x2={0} y2={0} stroke={T.wall} strokeWidth={sw * 1.2} />
          <line x1={0} y1={h} x2={w} y2={h} stroke={T.wall} strokeWidth={sw * 0.8} />
        </g>
      );
    case 'exit':
      return (
        <g>
          <rect width={w} height={h} rx={0.3 * u} fill={T.green} />
          <path d={`M${w * 0.2} ${h / 2} H${w * 0.75} M${w * 0.58} ${h * 0.28} L${w * 0.8} ${h / 2} L${w * 0.58} ${h * 0.72}`}
            fill="none" stroke="#FFFFFF" strokeWidth={sw * 1.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'wc':
      return (
        <g>
          <rect width={w} height={h} rx={0.4 * u} fill="#FFFFFF" stroke={T.furnitureStroke} strokeWidth={sw} />
          <Person cx={w * 0.3} cy={h * 0.52} s={m * 0.75} color={T.blue} />
          <line x1={w / 2} y1={h * 0.18} x2={w / 2} y2={h * 0.86} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
          <Person cx={w * 0.7} cy={h * 0.52} s={m * 0.75} color={T.pink} skirt />
        </g>
      );
    case 'wc_male':
    case 'wc_female': {
      const female = type === 'wc_female';
      return (
        <g>
          <rect width={w} height={h} rx={0.4 * u} fill="#FFFFFF" stroke={female ? T.pink : T.blue} strokeWidth={sw} />
          <Person cx={w / 2} cy={h * 0.52} s={m * 0.9} color={female ? T.pink : T.blue} skirt={female} />
        </g>
      );
    }
    case 'charger':
      return (
        <g>
          <rect width={w} height={h} rx={0.4 * u} fill={T.greenSoft} stroke={T.green} strokeWidth={sw} />
          <path d={`M${w * 0.56} ${h * 0.14} L${w * 0.3} ${h * 0.56} H${w * 0.5} L${w * 0.44} ${h * 0.86} L${w * 0.72} ${h * 0.42} H${w * 0.52} Z`} fill={T.green} />
        </g>
      );
    case 'reception':
      return (
        <g>
          <rect width={w} height={h} rx={0.5 * u} fill={T.furniture} stroke={T.furnitureStroke} strokeWidth={sw} />
          <circle cx={w / 2} cy={h * 0.55} r={m * 0.18} fill="none" stroke={T.furnitureStroke} strokeWidth={sw * 0.8} />
          <line x1={w / 2 - m * 0.25} y1={h * 0.55 + m * 0.18} x2={w / 2 + m * 0.25} y2={h * 0.55 + m * 0.18} stroke={T.furnitureStroke} strokeWidth={sw * 0.8} />
        </g>
      );
    case 'table_rect':
      return <rect width={w} height={h} rx={0.4 * u} fill={T.furniture} stroke={T.furnitureStroke} strokeWidth={sw} />;
    case 'table_round':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={T.furniture} stroke={T.furnitureStroke} strokeWidth={sw} />;
    case 'chair':
      return (
        <g>
          <rect width={w} height={h} rx={m * 0.25} fill="#FFFFFF" stroke={T.furnitureStroke} strokeWidth={sw} />
          <rect width={w} height={h * 0.25} rx={m * 0.12} fill={T.furnitureStroke} />
        </g>
      );
    case 'sofa_l':
    case 'counter_l':
      return <path d={LPath(w, h)} fill={type === 'sofa_l' ? '#E7E0F0' : T.furniture} stroke={T.furnitureStroke} strokeWidth={sw} strokeLinejoin="round" />;
    case 'plant':
      return (
        <g>
          <circle cx={w / 2} cy={h / 2} r={m / 2} fill="#BBF7D0" stroke={T.green} strokeWidth={sw * 0.8} />
          <circle cx={w / 2} cy={h / 2} r={m / 5} fill={T.green} />
        </g>
      );
    case 'destination':
      return (
        <g>
          <circle cx={w / 2} cy={h / 2} r={m / 2} fill="#FEF3C7" stroke="#B45309" strokeWidth={sw} />
          <path d={`M${w / 2} ${h * 0.8} C${w * 0.3} ${h * 0.55} ${w * 0.3} ${h * 0.22} ${w / 2} ${h * 0.22} C${w * 0.7} ${h * 0.22} ${w * 0.7} ${h * 0.55} ${w / 2} ${h * 0.8} Z`} fill="#B45309" />
          <circle cx={w / 2} cy={h * 0.42} r={m * 0.09} fill="#FFFFFF" />
        </g>
      );
    case 'pool':
      return (
        <g>
          <rect width={w} height={h} rx={m * 0.12} fill="#BAE6FD" stroke="#0284C7" strokeWidth={sw} />
          {[0.35, 0.6].map((t) => (
            <path key={t} d={`M${w * 0.12} ${h * t} q${w * 0.095} ${-h * 0.12} ${w * 0.19} 0 t${w * 0.19} 0 t${w * 0.19} 0 t${w * 0.19} 0`}
              fill="none" stroke="#0284C7" strokeWidth={sw * 0.8} strokeLinecap="round" />
          ))}
        </g>
      );
    case 'gym':
    case 'spa_icon':
    case 'bar_icon':
    case 'coffee':
    case 'karaoke':
    case 'shop':
    case 'kitchen':
    case 'warehouse': {
      // Icon dịch vụ: nền tròn màu nhạt + hình vẽ đơn giản
      const palette = {
        gym: ['#FEE2E2', '#B91C1C'], spa_icon: ['#DCFCE7', '#15803D'], bar_icon: ['#EDE9FE', '#6D28D9'],
        coffee: ['#FEF3C7', '#92400E'], karaoke: ['#FCE7F3', '#BE185D'], shop: ['#FFEDD5', '#C2410C'],
        kitchen: ['#F5F5F4', '#44403C'], warehouse: ['#E7E5E4', '#57534E'],
      }[type];
      const [bg, fg] = palette;
      const cx = w / 2;
      const cy = h / 2;
      const r = m / 2;
      const s = m; // khung vẽ hình
      const L = { fill: 'none', stroke: fg, strokeWidth: sw * 1.1, strokeLinecap: 'round', strokeLinejoin: 'round' };
      const glyph = {
        gym: (
          <g {...L}>
            <line x1={cx - s * 0.25} y1={cy} x2={cx + s * 0.25} y2={cy} />
            <rect x={cx - s * 0.32} y={cy - s * 0.14} width={s * 0.08} height={s * 0.28} fill={fg} />
            <rect x={cx + s * 0.24} y={cy - s * 0.14} width={s * 0.08} height={s * 0.28} fill={fg} />
          </g>
        ),
        spa_icon: (
          <g {...L}>
            <path d={`M${cx} ${cy + s * 0.2} C${cx - s * 0.25} ${cy} ${cx - s * 0.12} ${cy - s * 0.22} ${cx} ${cy - s * 0.26} C${cx + s * 0.12} ${cy - s * 0.22} ${cx + s * 0.25} ${cy} ${cx} ${cy + s * 0.2} Z`} />
            <path d={`M${cx - s * 0.28} ${cy + s * 0.2} H${cx + s * 0.28}`} />
          </g>
        ),
        bar_icon: (
          <g {...L}>
            <path d={`M${cx - s * 0.22} ${cy - s * 0.22} H${cx + s * 0.22} L${cx} ${cy + s * 0.02} Z`} />
            <path d={`M${cx} ${cy + s * 0.02} V${cy + s * 0.22} M${cx - s * 0.12} ${cy + s * 0.22} H${cx + s * 0.12}`} />
          </g>
        ),
        coffee: (
          <g {...L}>
            <path d={`M${cx - s * 0.2} ${cy - s * 0.1} H${cx + s * 0.14} V${cy + s * 0.12} Q${cx + s * 0.14} ${cy + s * 0.22} ${cx + s * 0.04} ${cy + s * 0.22} H${cx - s * 0.1} Q${cx - s * 0.2} ${cy + s * 0.22} ${cx - s * 0.2} ${cy + s * 0.12} Z`} />
            <path d={`M${cx + s * 0.14} ${cy - s * 0.04} Q${cx + s * 0.28} ${cy - s * 0.04} ${cx + s * 0.28} ${cy + s * 0.05} Q${cx + s * 0.28} ${cy + s * 0.12} ${cx + s * 0.14} ${cy + s * 0.12}`} />
            <path d={`M${cx - s * 0.08} ${cy - s * 0.18} v${-s * 0.06} M${cx + s * 0.02} ${cy - s * 0.18} v${-s * 0.06}`} />
          </g>
        ),
        karaoke: (
          <g {...L}>
            <rect x={cx - s * 0.08} y={cy - s * 0.26} width={s * 0.16} height={s * 0.26} rx={s * 0.08} fill={fg} />
            <path d={`M${cx - s * 0.16} ${cy - s * 0.04} Q${cx - s * 0.16} ${cy + s * 0.12} ${cx} ${cy + s * 0.12} Q${cx + s * 0.16} ${cy + s * 0.12} ${cx + s * 0.16} ${cy - s * 0.04} M${cx} ${cy + s * 0.12} V${cy + s * 0.24}`} />
          </g>
        ),
        shop: (
          <g {...L}>
            <path d={`M${cx - s * 0.2} ${cy - s * 0.08} H${cx + s * 0.2} L${cx + s * 0.16} ${cy + s * 0.24} H${cx - s * 0.16} Z`} />
            <path d={`M${cx - s * 0.09} ${cy - s * 0.08} V${cy - s * 0.14} Q${cx - s * 0.09} ${cy - s * 0.24} ${cx} ${cy - s * 0.24} Q${cx + s * 0.09} ${cy - s * 0.24} ${cx + s * 0.09} ${cy - s * 0.14} V${cy - s * 0.08}`} />
          </g>
        ),
        kitchen: (
          <g {...L}>
            <rect x={cx - s * 0.24} y={cy - s * 0.24} width={s * 0.48} height={s * 0.48} rx={s * 0.05} />
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
              <circle key={`${a}${b}`} cx={cx + a * s * 0.11} cy={cy + b * s * 0.11} r={s * 0.065} />
            ))}
          </g>
        ),
        warehouse: (
          <g {...L}>
            <rect x={cx - s * 0.22} y={cy - s * 0.02} width={s * 0.2} height={s * 0.2} />
            <rect x={cx + s * 0.02} y={cy - s * 0.02} width={s * 0.2} height={s * 0.2} />
            <rect x={cx - s * 0.1} y={cy - s * 0.24} width={s * 0.2} height={s * 0.2} />
          </g>
        ),
      }[type];
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill={bg} stroke={fg} strokeWidth={sw * 0.7} />
          {glyph}
        </g>
      );
    }
    case 'locker': {
      const n = Math.max(3, Math.round(w / Math.max(h, 0.001) * 1.6));
      return (
        <g>
          <rect width={w} height={h} fill="#F5F5F4" stroke={T.furnitureStroke} strokeWidth={sw} />
          {Array.from({ length: n - 1 }, (_, i) => (
            <line key={i} x1={((i + 1) * w) / n} x2={((i + 1) * w) / n} y1={0} y2={h} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
          ))}
        </g>
      );
    }
    case 'bed':
      return (
        <g>
          <rect width={w} height={h} rx={m * 0.06} fill="#FFFFFF" stroke={T.furnitureStroke} strokeWidth={sw} />
          <rect x={w * 0.1} y={h * 0.06} width={w * 0.35} height={h * 0.16} rx={m * 0.04} fill={T.furniture} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
          <rect x={w * 0.55} y={h * 0.06} width={w * 0.35} height={h * 0.16} rx={m * 0.04} fill={T.furniture} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
          <line x1={0} y1={h * 0.36} x2={w} y2={h * 0.36} stroke={T.furnitureStroke} strokeWidth={sw * 0.6} />
        </g>
      );
    case 'parking':
      return (
        <g>
          <rect width={w} height={h} fill="#FFFFFF" stroke={T.wall} strokeWidth={sw} />
          <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(w, h) * 0.55} fontWeight="800" fill="#1D4ED8">P</text>
        </g>
      );
    case 'car':
      return (
        <g fill="none" stroke={T.furnitureStroke} strokeWidth={sw}>
          <rect x={w * 0.08} y={0} width={w * 0.84} height={h} rx={w * 0.35} fill="#F5F5F4" />
          <rect x={w * 0.18} y={h * 0.2} width={w * 0.64} height={h * 0.18} rx={w * 0.1} />
          <rect x={w * 0.18} y={h * 0.66} width={w * 0.64} height={h * 0.12} rx={w * 0.08} />
        </g>
      );
    case 'motorbike':
      return (
        <g stroke={T.furnitureStroke} strokeWidth={sw} fill="#F5F5F4">
          <ellipse cx={w / 2} cy={h * 0.15} rx={w * 0.3} ry={h * 0.12} />
          <ellipse cx={w / 2} cy={h * 0.85} rx={w * 0.3} ry={h * 0.12} />
          <rect x={w * 0.25} y={h * 0.25} width={w * 0.5} height={h * 0.5} rx={w * 0.2} />
          <line x1={0} y1={h * 0.3} x2={w} y2={h * 0.3} />
        </g>
      );
    case 'double_door':
      return (
        <g fill="none">
          <rect x={-0.2 * u} y={h - 1.4 * u} width={w + 0.4 * u} height={2.8 * u} fill={NAV_THEME.floor} stroke="none" />
          <path d={`M0 ${h} A${w / 2} ${h} 0 0 1 ${w / 2} 0 M${w} ${h} A${w / 2} ${h} 0 0 0 ${w / 2} 0`} stroke={T.furnitureStroke} strokeWidth={sw * 0.7} strokeDasharray={`${u} ${u * 0.7}`} />
          <line x1={0} y1={h} x2={w} y2={h} stroke={T.wall} strokeWidth={sw * 0.8} />
        </g>
      );
    case 'label':
      return null;
    default:
      return <rect width={w} height={h} fill="#E7E5E4" />;
  }
};

/** Toạ độ mét -> ô ảnh map (y xuống). */
export const metersToCell = (x, y, map) => ({
  x: (x - map.originX) / map.resolution,
  y: map.height - (y - map.originY) / map.resolution,
});
export const cellToMeters = (cx, cy, map) => ({
  x: map.originX + cx * map.resolution,
  y: map.originY + (map.height - cy) * map.resolution,
});

/** Hộp (ô) của 1 vật thể: tâm + kích thước + góc theo hướng màn hình. */
export const objectBox = (obj, map) => {
  const c = metersToCell(obj.x, obj.y, map);
  return { cx: c.x, cy: c.y, w: obj.w / map.resolution, h: obj.h / map.resolution, rot: -(obj.rotation || 0) };
};

const textSize = (box, type, k = 1) => (type === 'label'
  ? Math.max(2.4 * k, box.h * 0.75)
  : Math.max(2.2 * k, Math.min(4 * k, Math.min(box.w, box.h) / 3)));

export const NavObject = ({ obj, map, selected = false, ...handlers }) => {
  const b = objectBox(obj, map);
  const flip = obj.flip ? ` translate(${b.w} 0) scale(-1 1)` : '';
  const showLabel = obj.label && ['room', 'label', 'reception', 'elevator', 'destination'].includes(obj.type);
  // Nhãn trong phòng nằm giữa; với icon nhỏ thì đặt ngay dưới icon
  const below = ['elevator', 'reception', 'destination'].includes(obj.type);
  const k = Math.max(map.width, map.height) / 80;
  const fs = textSize(b, obj.type, k);
  return (
    <g {...handlers}>
      <g transform={`translate(${b.cx} ${b.cy}) rotate(${b.rot}) translate(${-b.w / 2} ${-b.h / 2})${flip}`}>
        <NavSymbolShape type={obj.type} w={b.w} h={b.h} />
        {selected && (() => {
          const k = Math.max(map.width, map.height) / 80;
          return <rect x={-k} y={-k} width={b.w + 2 * k} height={b.h + 2 * k} fill="none" stroke="#2563EB" strokeWidth={0.5 * k} strokeDasharray={`${1.5 * k} ${k}`} />;
        })()}
        {obj.type === 'label' && <rect width={b.w} height={b.h} fill="transparent" />}
      </g>
      {showLabel && (
        <text
          x={b.cx}
          y={below ? b.cy + Math.max(b.w, b.h) / 2 + fs * 1.1 : b.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          fontWeight={obj.type === 'label' ? 700 : 600}
          fill={NAV_THEME.text}
          stroke="#FFFFFF"
          strokeWidth={fs * 0.28}
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
        >
          {obj.label}
        </text>
      )}
    </g>
  );
};

/** Lớp layout hoàn chỉnh (sàn, tường, vật thể) theo đơn vị ô ảnh map. */
export const NavLayoutLayer = ({ layout, map }) => {
  if (!layout) return null;
  const order = (t) => (t === 'room' ? 0 : t === 'label' ? 3 : 1);
  const objects = [...(layout.objects || [])].sort((a, b) => order(a.type) - order(b.type));
  return (
    <g>
      {objects.filter((o) => o.type === 'room').map((o) => <NavObject key={o.id} obj={o} map={map} />)}
      {(layout.walls || []).map((wall) => (
        <polyline
          key={wall.id}
          points={wall.points.map(([x, y]) => {
            const c = metersToCell(x, y, map);
            return `${c.x},${c.y}`;
          }).join(' ')}
          fill="none"
          stroke={NAV_THEME.wall}
          strokeWidth={(wall.thickness || 0.08) / map.resolution}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
      {objects.filter((o) => o.type !== 'room').map((o) => <NavObject key={o.id} obj={o} map={map} />)}
    </g>
  );
};

/** Vị trí thang máy trong layout (mét) — dùng làm đích chặng 1. */
export const findLayoutElevator = (layout) => {
  const e = (layout?.objects || []).find((o) => o.type === 'elevator');
  return e ? { name: e.label || 'Thang máy', x: e.x, y: e.y } : null;
};
