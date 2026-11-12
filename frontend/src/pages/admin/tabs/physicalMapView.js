// Khung nhin cua canvas Physical Map: "vua khung" (zoom 1) + zoom/keo map.
// Can vi map doc (vd 5.75 x 7.7 m) bi gioi han boi CHIEU CAO: thu gon sidebar chi them chieu
// ngang nen map khong to ra -> phai zoom (lan chuot / nut +) hoac "vua chieu ngang".
// view = { zoom, panX, panY }: zoom nhan voi ti le "vua khung"; pan = px canvas lech khoi tam.

export const MAP_PAD_PX = 24;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const DEFAULT_VIEW = Object.freeze({ zoom: 1, panX: 0, panY: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Ti le (px/m) + vi tri goc tren-trai cua map tren canvas. config.view (tuy chon) = zoom/keo.
export function mapFrame(canvasWidth, canvasHeight, config) {
  const availWidth = canvasWidth - MAP_PAD_PX * 2;
  const availHeight = canvasHeight - MAP_PAD_PX * 2;
  const fitScale = Math.min(availWidth / config.widthMeters, availHeight / config.heightMeters);
  const view = config.view || DEFAULT_VIEW;
  const scale = fitScale * (view.zoom || 1);
  const roomW = config.widthMeters * scale;
  const roomH = config.heightMeters * scale;
  return {
    scale,
    fitScale,
    roomW,
    roomH,
    offsetX: (canvasWidth - roomW) / 2 + (view.panX || 0),
    offsetY: (canvasHeight - roomH) / 2 + (view.panY || 0),
  };
}

// Zoom trong [1, 8]; o zoom 1 map nam giua. Khi zoom: map nho hon khung thi khong keo ra khoi
// khung, map lon hon khung thi khong de lo mep (luon con map phu kin vung ve).
export function clampView(view, canvasWidth, canvasHeight, config) {
  const zoom = clamp(Number(view?.zoom) || 1, MIN_ZOOM, MAX_ZOOM);
  if (zoom <= MIN_ZOOM + 1e-9) {
    return view && view.zoom === 1 && view.panX === 0 && view.panY === 0 ? view : { ...DEFAULT_VIEW };
  }
  const { roomW, roomH } = mapFrame(canvasWidth, canvasHeight, { ...config, view: { zoom, panX: 0, panY: 0 } });
  const limitX = Math.abs(roomW - (canvasWidth - MAP_PAD_PX * 2)) / 2;
  const limitY = Math.abs(roomH - (canvasHeight - MAP_PAD_PX * 2)) / 2;
  const panX = clamp(Number(view.panX) || 0, -limitX, limitX);
  const panY = clamp(Number(view.panY) || 0, -limitY, limitY);
  if (view.zoom === zoom && view.panX === panX && view.panY === panY) return view;
  return { zoom, panX, panY };
}

// Zoom theo he so factor, giu nguyen diem ban do dang nam duoi con tro (mouseX, mouseY px canvas).
export function zoomViewAt(view, factor, mouseX, mouseY, canvasWidth, canvasHeight, config) {
  const current = clampView(view, canvasWidth, canvasHeight, config);
  const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const before = mapFrame(canvasWidth, canvasHeight, { ...config, view: current });
  const relX = (mouseX - before.offsetX) / before.scale;
  const relY = (mouseY - before.offsetY) / before.scale;
  const scale = before.fitScale * zoom;
  const panX = mouseX - relX * scale - (canvasWidth - config.widthMeters * scale) / 2;
  const panY = mouseY - relY * scale - (canvasHeight - config.heightMeters * scale) / 2;
  return clampView({ zoom, panX, panY }, canvasWidth, canvasHeight, config);
}

export function panView(view, dx, dy, canvasWidth, canvasHeight, config) {
  const current = clampView(view, canvasWidth, canvasHeight, config);
  return clampView(
    { zoom: current.zoom, panX: current.panX + dx, panY: current.panY + dy },
    canvasWidth,
    canvasHeight,
    config
  );
}

// Map doc: zoom de map phu het chieu ngang (keo len/xuong de xem phan con lai).
export function fitWidthView(canvasWidth, canvasHeight, config) {
  const { fitScale } = mapFrame(canvasWidth, canvasHeight, config);
  const zoom = (canvasWidth - MAP_PAD_PX * 2) / config.widthMeters / fitScale;
  if (zoom <= MIN_ZOOM + 1e-9) return { ...DEFAULT_VIEW };
  return clampView({ zoom: Math.min(zoom, MAX_ZOOM), panX: 0, panY: 0 }, canvasWidth, canvasHeight, config);
}

export function isDefaultView(view) {
  return (
    !!view &&
    Math.abs((Number(view.zoom) || 1) - 1) < 1e-6 &&
    Math.abs(Number(view.panX) || 0) < 0.5 &&
    Math.abs(Number(view.panY) || 0) < 0.5
  );
}

// Su kien wheel -> he so zoom. deltaMode 1 = dong (Firefox), 2 = trang. 1 nac chuot ~ 20%.
export function wheelZoomFactor(deltaY, deltaMode = 0) {
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;
  return Math.exp(-clamp(px, -120, 120) * 0.002);
}
