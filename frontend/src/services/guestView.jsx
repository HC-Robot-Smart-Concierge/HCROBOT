/**
 * "Bản hiển thị cho khách" của 1 layout, dùng cho trang QR trên điện thoại (public/map.html).
 *
 * map.html giữ nguyên cơ chế cũ (xoay/camera/zoom trong khung 1840 x 1174 px), nên ở đây ta
 * quy layout về đúng khung đó: hình vẽ (SVG markup) + đường đi tính sẵn tới từng điểm đến.
 * Tạo lúc Admin bấm Lưu, lưu kèm layout (trường guestView) => điện thoại không cần tính đường.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NavLayoutLayer, NAV_THEME, metersToCell } from '../components/robot/guestNavSymbols.jsx';
import { rasterizeLayout, routeOnGrid, isFloorLayoutKey } from './layoutRouting.js';
import { guestFrameFor, cellToFrame, framePath, GUEST_FRAME } from './guestFrame.js';

/**
 * Tạo guestView cho layout.
 *  - Tầng khách sạn (floor-*): kèm đường từ thang máy tới mọi điểm đến.
 *  - Tầng Trệt (map Nav2): chỉ hình vẽ; đường chặng 1 do kiosk gắn vào link QR (phụ thuộc vị trí robot).
 */
export const buildGuestView = (layout, map, key) => {
  const f = guestFrameFor(map);
  const markup = renderToStaticMarkup(
    <g transform={`translate(${f.ox.toFixed(2)} ${f.oy.toFixed(2)}) scale(${f.s.toFixed(5)})`}>
      <rect width={map.width} height={map.height} fill={NAV_THEME.floor} />
      <NavLayoutLayer layout={layout} map={map} />
    </g>,
  );
  const view = { version: 1, frame: GUEST_FRAME, svg: markup, routes: {} };
  const elevator = (layout.objects || []).find((o) => o.type === 'elevator');
  if (elevator) view.elevator = cellToFrame(metersToCell(elevator.x, elevator.y, map), f);
  if (isFloorLayoutKey(key) && elevator) {
    const grid = rasterizeLayout(layout, map);
    for (const d of layout.objects || []) {
      if (d.type !== 'destination' || !d.destKey) continue;
      const r = routeOnGrid(grid, map, elevator, d);
      if (!r) continue;
      const pts = r.points.map((p) => cellToFrame(p, f));
      view.routes[d.destKey] = {
        d: framePath(pts, f, map),
        start: pts[0],
        end: pts[pts.length - 1],
        lengthM: +r.lengthM.toFixed(1),
      };
    }
  }
  return view;
};
