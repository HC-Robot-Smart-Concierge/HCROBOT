/**
 * Bản phác thảo layout cho các tầng khách sạn, dựng từ ảnh mặt bằng cũ (public/maps/floor_*.png,
 * 1840 x 1174 px). Toạ độ viết theo pixel ảnh cũ cho dễ đối chiếu, đổi sang mét khi nạp.
 * Chỉ là điểm xuất phát để Admin chỉnh tiếp trong editor — không tự lưu lên server.
 */
import { HOTEL_DESTINATIONS } from '../components/robot/FloorMap.jsx';

const IMG_W = 1840;
const IMG_H = 1174;
export const SKETCH_M_PER_PX = 0.02; // 1 px ảnh cũ = 2 cm  => tầng ~36.8 x 23.5 m
const S = SKETCH_M_PER_PX;
const WALL_M = 0.2;

const pt = ([x, y]) => [+(x * S).toFixed(3), +((IMG_H - y) * S).toFixed(3)];
let seq = 0;
const id = (p) => `${p}-sk${(seq += 1)}`;

// ---- helpers (đơn vị: px ảnh cũ) ----
const W = (...points) => ({ id: id('wall'), points: points.map(pt), thickness: WALL_M });
const O = (type, x, y, w, h, extra = {}) => {
  const [mx, my] = pt([x, y]);
  return { id: id('obj'), type, x: mx, y: my, w: +(w * S).toFixed(2), h: +(h * S).toFixed(2), rotation: 0, flip: false, label: null, ...extra };
};
const door = (x, y, vertical = false, size = 110) => O('door', x, y, size, size, { rotation: vertical ? 90 : 0 });
const doubleDoor = (x, y, vertical = false, size = 170) => O('double_door', x, y, size, size / 2, { rotation: vertical ? 90 : 0 });
const label = (text, x, y, w = 320) => O('label', x, y, w, 45, { label: text });
// Điểm đến: lấy đúng mã có sẵn; vị trí mặc định = toạ độ cũ trong HOTEL_DESTINATIONS
const dest = (key, labelText, at) => {
  const d = HOTEL_DESTINATIONS[key];
  if (!d) return null;
  const [x, y] = at || [d.coords.x, d.coords.y];
  return O('destination', x, y, 60, 60, { destKey: key, label: labelText || d.name.replace(/\s*\(.*\)\s*$/, '') });
};
const outer = () => W([8, 8], [1832, 8], [1832, 1166], [8, 1166], [8, 8]);
const elevatorExit = (ey, xy = 640) => [
  O('elevator', 1772, ey, 110, 110, { label: 'Thang máy' }),
  O('exit', 1772, xy, 90, 60),
];

// ---- Tầng 5 / Tầng 6: 2 phòng trên, 1 phòng trái dưới, 1 phòng phải dưới, hành lang chữ L ----
const amenityFloor = ({ topLeft, topRight, leftRoom, rightRoom, rightWallY, icons }) => ({
  walls: [
    outer(),
    W([8, 458], [1405, 458]), // đáy dãy phòng trên
    W([757, 8], [757, 458]), // vách giữa 2 phòng trên
    W([1405, 8], [1405, 458]), // vách phải phòng trên-phải
    W([373, 465], [373, 1166]), // vách phòng trái-dưới
    W([760, 458], [760, 1166]), // vách hành lang trái (có cửa đôi)
    W([1085, 1166], [1085, rightWallY], [1832, rightWallY]), // phòng phải-dưới
  ],
  objects: [
    door(585, 458), door(1085, 458), door(373, 680, true), doubleDoor(760, 745, true), door(1460, rightWallY),
    ...elevatorExit(450, 625),
    O(icons[0], 380, 120, 90, 90), O(icons[1], 1080, 120, 90, 90), O(icons[2], 190, 950, 90, 90), O(icons[3], 1450, 1040, 90, 90),
    topLeft, topRight, leftRoom, rightRoom,
  ].filter(Boolean),
});

// ---- Tầng 3 / Tầng 4: 2 dãy 5 phòng, hành lang giữa ----
const roomsFloor = (prefix) => {
  const top = [[8, 350, `${prefix}05`], [350, 722, `${prefix}04`], [722, 1095, `${prefix}03`], [1095, 1467, `${prefix}02`], [1467, 1832, `${prefix}01`]];
  const bottom = [[8, 325, `${prefix}06`], [325, 700, `${prefix}07`], [700, 1075, `${prefix}08`], [1075, 1450, `${prefix}09`], [1450, 1832, `${prefix}10`]];
  const objects = [...elevatorExit(550, 725)];
  for (const [a, b, no] of top) {
    const cx = (a + b) / 2;
    objects.push(door(no.endsWith('01') ? 1590 : cx, 390), O('bed', cx, 170, 160, 190), dest(`room_${no}`, no, [cx, 300]));
  }
  for (const [a, b, no] of bottom) {
    const cx = (a + b) / 2;
    objects.push(door(no.endsWith('10') ? 1600 : cx, 797), O('bed', cx, 1000, 160, 190), dest(`room_${no}`, no, [cx, 880]));
  }
  return {
    walls: [
      outer(),
      W([8, 390], [1832, 390]),
      W([8, 797], [1700, 797]),
      ...top.slice(0, 4).map(([, b]) => W([b, 8], [b, 390])),
      ...bottom.slice(0, 4).map(([, b]) => W([b, 797], [b, 1166])),
      W([1700, 797], [1832, 797]),
    ],
    objects,
  };
};

// ---- Tầng 2: sơ chế, khu nhận món, bếp, kho, WC ----
const kitchenFloor = () => ({
  walls: [
    outer(),
    W([355, 8], [355, 588]),
    W([8, 588], [1370, 588]),
    W([1370, 8], [1370, 1166]),
    W([1370, 305], [1832, 305]),
    W([1532, 935], [1832, 935]),
    W([1532, 935], [1532, 1166]),
    W([1688, 935], [1688, 1166]),
  ],
  objects: [
    door(265, 588), door(1370, 320, true), door(1370, 850, true), door(1600, 305), door(1610, 935, false, 100), door(1760, 935, false, 100),
    O('table_rect', 630, 72, 430, 70), O('table_rect', 1125, 72, 430, 70), O('table_rect', 630, 518, 430, 70), O('table_rect', 1135, 518, 430, 70),
    O('kitchen', 590, 700, 90, 90), O('warehouse', 1600, 90, 90, 90),
    O('wc_male', 1610, 1080, 80, 80), O('wc_female', 1760, 1080, 80, 80),
    ...elevatorExit(580, 760),
    dest('preparation_area', 'Khu sơ chế'), dest('restaurant', 'Quầy nhận món'), dest('kitchen', 'Bếp chính'),
    dest('warehouse', 'Kho', [1600, 200]), dest('restroom_f2', 'Nhà vệ sinh', [1650, 1000]),
  ],
});

// ---- Hầm B1 / B2: dốc xe bên trái, khu đỗ bên phải ----
const parkingFloor = (kind) => {
  const ramp = [
    W([8, 295], [680, 295], [765, 370], [765, 1166]),
    W([8, 715], [310, 715], [395, 800], [395, 1166]),
  ];
  const objects = [...elevatorExit(450, 640), label('Dốc xe ↑↓', 580, 560, 260)];
  if (kind === 'car') {
    const xs = [877, 1056, 1236, 1412, 1588];
    xs.forEach((x) => objects.push(O('parking', x, 187, 170, 350)));
    xs.forEach((x, i) => objects.push(O(i === 0 ? 'car' : 'parking', x, 995, i === 0 ? 140 : 170, i === 0 ? 330 : 345)));
    objects.push(O('charger', 1640, 600, 70, 70), dest('parking_car', 'Bãi đỗ ô tô', [1200, 600]));
  } else {
    [[1300, 160], [930, 590], [1300, 940]].forEach(([x, y]) => objects.push(O('parking', x, y, 120, 200)));
    [1000, 1100, 1450, 1550].forEach((x) => objects.push(O('motorbike', x, 160, 40, 110), O('motorbike', x, 940, 40, 110)));
    objects.push(dest('parking_bike', 'Bãi xe máy'));
  }
  return {
    walls: [
      outer(), ...ramp,
      ...(kind === 'car' ? [] : [W([770, 8], [770, 308], [1832, 308]), W([770, 712], [1832, 712])]),
    ],
    objects,
  };
};

const BUILDERS = {
  1: () => parkingFloor('car'),
  2: () => parkingFloor('bike'),
  4: kitchenFloor,
  5: () => roomsFloor('3'),
  6: () => roomsFloor('4'),
  7: () => amenityFloor({
    topLeft: dest('infinity_pool', 'Hồ bơi vô cực'), topRight: dest('spa', 'Spa & Massage'),
    leftRoom: dest('locker_room', 'Phòng thay đồ'), rightRoom: dest('gym', 'Phòng Gym'),
    rightWallY: 715, icons: ['pool', 'spa_icon', 'locker', 'gym'],
  }),
  8: () => amenityFloor({
    topLeft: dest('rooftop_coffee', 'Rooftop Coffee'), topRight: dest('bar', 'Sky Lounge Bar'),
    leftRoom: dest('gift_shop', 'Cửa hàng lưu niệm'), rightRoom: dest('karaoke', 'Karaoke VIP'),
    rightWallY: 688, icons: ['coffee', 'bar_icon', 'shop', 'karaoke'],
  }),
};

export const hasFloorSketch = (floorId) => Boolean(BUILDERS[floorId]);

/** Bản phác thảo cho 1 tầng (mét), hoặc null nếu tầng không có ảnh cũ. */
export const buildFloorSketch = (floorId) => {
  const build = BUILDERS[floorId];
  if (!build) return null;
  const { walls, objects } = build();
  return {
    width: +(IMG_W * S).toFixed(1),
    height: +(IMG_H * S).toFixed(1),
    walls,
    // Bỏ điểm đến không còn trong hệ thống (phòng hờ dữ liệu đổi)
    objects: objects.filter((o) => o && (o.type !== 'destination' || HOTEL_DESTINATIONS[o.destKey])),
  };
};
