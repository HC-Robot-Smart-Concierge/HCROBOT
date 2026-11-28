/**
 * Khung hiển thị của trang QR (public/map.html): 1840 x 1174 px, giống ảnh mặt bằng cũ.
 * Dùng chung cho editor (tạo guestView) và màn hình robot (gắn đường chặng 1 vào link QR).
 */
import { roundedPath } from './robotFloorPose.js';

export const GUEST_FRAME = { width: 1840, height: 1174 };
const PAD = 30; // lề trong khung (px)

/** Phép đổi ô map -> px khung 1840x1174 (giữ tỉ lệ, căn giữa). */
export const guestFrameFor = (map) => {
  const s = Math.min((GUEST_FRAME.width - PAD * 2) / map.width, (GUEST_FRAME.height - PAD * 2) / map.height);
  return {
    s,
    ox: (GUEST_FRAME.width - map.width * s) / 2,
    oy: (GUEST_FRAME.height - map.height * s) / 2,
  };
};
export const cellToFrame = (p, f) => ({ x: +(f.ox + p.x * f.s).toFixed(1), y: +(f.oy + p.y * f.s).toFixed(1) });

/** Danh sách điểm (px khung) -> path SVG bo góc, giống màn hình robot. */
export const framePath = (pts, f, map) => roundedPath(pts, Math.max(8, (0.4 / map.resolution) * f.s));

/** Mã hoá gọn danh sách điểm px để gắn vào link QR: "x,y;x,y;..." */
export const encodeFramePoints = (pts) => pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
