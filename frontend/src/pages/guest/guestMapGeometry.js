import { HOTEL_DESTINATIONS } from '../../components/robot/FloorMap';

const DESTINATION_ALIASES = {
  luxury_spa: 'spa',
  sky_bar: 'bar',
  pool: 'infinity_pool',
  wc: 'restroom_ground',
  toilet: 'restroom_ground',
  lobby: 'front_desk',
  reception: 'front_desk',
};

const resolveKnownDestKey = (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();
  const mapped = DESTINATION_ALIASES[trimmed] || trimmed;
  return HOTEL_DESTINATIONS[mapped] ? mapped : null;
};

const normalizeDestKey = (rawKey) => {
  return resolveKnownDestKey(rawKey) || 'infinity_pool';
};

export const computeOrthogonalHeadingAngle = (startPt) => {
  return startPt && startPt.x >= 920 ? 90 : -90;
};

const projectPointToSvgScreen = (x, y, rotZ) => {
  if (rotZ === -90) {
    return { sx: y, sy: 1840 - x };
  }
  if (rotZ === 90) {
    return { sx: 1174 - y, sy: x };
  }
  return { sx: x, sy: y };
};

export const computeSmartRouteFrame = (pathStr, startPt, endPt, mode = 'heading') => {
  const nums = (String(pathStr || '').match(/-?\d+(\.\d+)?/g) || []).map(Number);
  let minX = Math.min(startPt.x, endPt.x);
  let maxX = Math.max(startPt.x, endPt.x);
  let minY = Math.min(startPt.y, endPt.y);
  let maxY = Math.max(startPt.y, endPt.y);

  for (let i = 0; i < nums.length - 1; i += 2) {
    const px = nums[i];
    const py = nums[i + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  const midX = Math.round((minX + maxX) / 2);
  const midY = Math.round((minY + maxY) / 2);

  const isHeading = mode === 'heading';
  const rotZ = isHeading ? computeOrthogonalHeadingAngle(startPt) : 0;
  const svgW = rotZ === 0 ? 1840 : 1174;
  const svgH = rotZ === 0 ? 1174 : 1840;

  const sStart = projectPointToSvgScreen(startPt.x, startPt.y, rotZ);
  const sEnd = projectPointToSvgScreen(endPt.x, endPt.y, rotZ);
  let minSX = Math.min(sStart.sx, sEnd.sx);
  let maxSX = Math.max(sStart.sx, sEnd.sx);
  let minSY = Math.min(sStart.sy, sEnd.sy);
  let maxSY = Math.max(sStart.sy, sEnd.sy);

  for (let i = 0; i < nums.length - 1; i += 2) {
    const pt = projectPointToSvgScreen(nums[i], nums[i + 1], rotZ);
    if (pt.sx < minSX) minSX = pt.sx;
    if (pt.sx > maxSX) maxSX = pt.sx;
    if (pt.sy < minSY) minSY = pt.sy;
    if (pt.sy > maxSY) maxSY = pt.sy;
  }

  const midSX = (minSX + maxSX) / 2;
  const midSY = (minSY + maxSY) / 2;
  const spanSW = Math.max(340, maxSX - minSX);
  const spanSH = Math.max(380, maxSY - minSY);

  const cw = typeof window !== 'undefined' && window.innerWidth ? Math.min(window.innerWidth, 430) : 390;
  const ch = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 760;
  const svgScale = Math.min(cw / svgW, ch / svgH);

  const fitW = (cw * 0.82) / ((spanSW + 340) * svgScale);
  const fitH = (ch * 0.62) / ((spanSH + 420) * svgScale);
  const zoom = Number(Math.min(1.65, Math.max(1.06, Math.min(fitW, fitH))).toFixed(2));

  const panX = Math.round((svgW / 2 - midSX) * svgScale * zoom);
  const panY = Math.round((svgH / 2 - midSY) * svgScale * zoom);

  if (mode === 'flat2d') {
    return {
      midX,
      midY,
      baseW: 1840,
      baseH: 1174,
      zoom: 1.05,
      panX,
      panY,
      tiltX: 0,
      rotZ: 0,
    };
  }

  return {
    midX,
    midY,
    baseW: svgW,
    baseH: svgH,
    zoom,
    panX,
    panY,
    tiltX: 20,
    rotZ,
  };
};

export const parseGuestMapParams = (searchStr = '') => {
  let destKey = 'infinity_pool';
  let expiresAt = Date.now() + 15 * 60 * 1000;
  let ticketId = '';

  try {
    const params = new URLSearchParams(searchStr);
    const tokenParam = params.get('t') || params.get('token');
    const destParam = params.get('dest');

    if (tokenParam) {
      try {
        let b64 = tokenParam.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const parsed = JSON.parse(atob(b64));
        const resolvedFromToken = resolveKnownDestKey(parsed.d);
        if (resolvedFromToken) {
          destKey = resolvedFromToken;
        } else if (destParam) {
          destKey = normalizeDestKey(destParam);
        }
        if (parsed.e && !Number.isNaN(Number(parsed.e))) expiresAt = Number(parsed.e);
        if (parsed.n) ticketId = String(parsed.n);
      } catch {
        let recovered = false;
        if (tokenParam.includes('_')) {
          const parts = tokenParam.split('_');
          const maybeExpire = Number(parts[parts.length - 1]);
          const maybeDest = resolveKnownDestKey(parts.slice(0, -1).join('_'));
          if (maybeDest && !Number.isNaN(maybeExpire) && maybeExpire > 1000000000000) {
            destKey = maybeDest;
            expiresAt = maybeExpire;
            recovered = true;
          }
        }
        if (!recovered && destParam) {
          destKey = normalizeDestKey(destParam);
        }
      }
    } else if (destParam) {
      destKey = normalizeDestKey(destParam);
    }
  } catch {
    destKey = 'infinity_pool';
  }

  return { destKey, expiresAt, ticketId };
};
