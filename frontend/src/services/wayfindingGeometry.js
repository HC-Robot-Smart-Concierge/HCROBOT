export const MAP_WIDTH = 1840;
export const MAP_HEIGHT = 1174;

export const FLOOR_ELEMENT_TYPES = {
  corridor: ['Hành lang', '#D4EAE2', 360, 100],
  room: ['Phòng / khu vực', '#DFE6F1', 220, 150],
  wall: ['Tường', '#56657B', 200, 12],
  label: ['Nhãn', '#263955', 170, 36],
};

export function getFloorSize(floor) {
  return { width: floor?.width ?? MAP_WIDTH, height: floor?.height ?? MAP_HEIGHT };
}

export function floorPolygonPoints(element) {
  return element.vertices.map(({ x, y }) => ({ x: element.x + x * element.width, y: element.y + y * element.height }));
}

export function normalizeFloorPolygon(points) {
  if (points.length < 3 || points.length > 64) return null;
  const x = Math.min(...points.map((point) => point.x));
  const y = Math.min(...points.map((point) => point.y));
  const width = Math.max(...points.map((point) => point.x)) - x;
  const height = Math.max(...points.map((point) => point.y)) - y;
  if (!width || !height) return null;
  const vertices = points.map((point) => ({ x: (point.x - x) / width, y: (point.y - y) / height }));
  if (!isSimpleFloorPolygon(vertices)) return null;
  return { x, y, width, height, vertices };
}

function isSimpleFloorPolygon(vertices) {
  const epsilon = 1e-9;
  const turn = (a, b, c) => {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(cross) <= epsilon ? 0 : Math.sign(cross);
  };
  const insideBounds = (a, b, point) =>
    point.x >= Math.min(a.x, b.x) - epsilon && point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon && point.y <= Math.max(a.y, b.y) + epsilon;
  const intersect = (a, b, c, d) => {
    const abc = turn(a, b, c);
    const abd = turn(a, b, d);
    const cda = turn(c, d, a);
    const cdb = turn(c, d, b);
    return (abc * abd < 0 && cda * cdb < 0) || (abc === 0 && insideBounds(a, b, c)) ||
      (abd === 0 && insideBounds(a, b, d)) || (cda === 0 && insideBounds(c, d, a)) || (cdb === 0 && insideBounds(c, d, b));
  };
  const size = vertices.length;
  if (new Set(vertices.map(({ x, y }) => `${x},${y}`)).size !== size) return false;
  const area = vertices.reduce((sum, a, index) => {
    const b = vertices[(index + 1) % size];
    return sum + a.x * b.y - b.x * a.y;
  }, 0);
  if (Math.abs(area) <= epsilon) return false;
  return vertices.every((a, index) => {
    const b = vertices[(index + 1) % size];
    const c = vertices[(index + 2) % size];
    if (turn(a, b, c) === 0 && (insideBounds(a, b, c) || insideBounds(b, c, a))) return false;
    for (let other = index + 2; other < size - (index === 0 ? 1 : 0); other += 1) {
      if (intersect(a, b, vertices[other], vertices[(other + 1) % size])) return false;
    }
    return true;
  });
}

export function getFloorLabelLayout(item, rotation = 0, minFontSize = 1) {
  const words = item.text?.trim().split(/\s+/).filter(Boolean);
  if (!words?.length) return null;
  const angle = item.kind === 'label' ? 0 : rotation + (item.rotation || 0);
  const quarterTurn = Math.round(angle / 90);
  const turns = Math.abs(quarterTurn) % 2 === 1;
  const baseWidth = turns ? item.height : item.width;
  const baseHeight = turns ? item.width : item.height;
  const remainder = Math.abs(angle - quarterTurn * 90) * Math.PI / 180;
  const cosine = Math.cos(remainder);
  const sine = Math.sin(remainder);
  const fit = Math.min(1, baseWidth / (cosine * baseWidth + sine * baseHeight), baseHeight / (sine * baseWidth + cosine * baseHeight));
  const width = baseWidth * 0.88 * fit;
  const height = baseHeight * 0.84 * fit;
  const minimum = Math.max(1, minFontSize);
  const maximum = Math.floor(Math.min(46, height / 1.16));

  for (let fontSize = maximum; fontSize >= minimum; fontSize -= 1) {
    const capacity = Math.floor(width / (fontSize * 0.67));
    if (words.some((word) => Array.from(word).length > capacity)) continue;
    const lines = [''];
    for (const word of words) {
      const current = lines.at(-1);
      const next = current ? `${current} ${word}` : word;
      if (Array.from(next).length <= capacity) lines[lines.length - 1] = next;
      else lines.push(word);
    }
    if (lines.length <= 2 && lines.length * fontSize * 1.16 <= height) return { fontSize, lines };
  }

  const capacity = Math.floor(width / (minimum * 0.67));
  if (minimum > maximum || capacity < 4) return null;
  return { fontSize: minimum, lines: [`${Array.from(words.join(' ')).slice(0, capacity - 1).join('').trimEnd()}…`] };
}

export function getFloorLabelMinimum(viewport, viewWidth, viewHeight, zoom) {
  if (!viewport.width || !viewport.height) return 1;
  const scale = Math.min(viewport.width / viewWidth, viewport.height / viewHeight) * zoom;
  return Math.ceil(9 / scale);
}

export function shouldRotateWayfindingFloor(viewport, floor) {
  if (!viewport.width || !viewport.height) return true;
  const { width, height } = getFloorSize(floor);
  const flatScale = Math.min(viewport.width / width, viewport.height / height);
  const rotatedScale = Math.min(viewport.width / height, viewport.height / width);
  return rotatedScale >= flatScale;
}

export function rotateMapOffset(x, y, degrees) {
  const angle = degrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: x * cosine - y * sine, y: x * sine + y * cosine };
}

export function getFloorElementPadding({ width, height, rotation = 0 }) {
  if (!rotation) return { x: 0, y: 0 };
  const { x: cosine, y: sine } = rotateMapOffset(1, 0, rotation);
  return {
    x: Math.max(0, (Math.abs(cosine) * width + Math.abs(sine) * height - width) / 2),
    y: Math.max(0, (Math.abs(sine) * width + Math.abs(cosine) * height - height) / 2),
  };
}

export function fitFloorElement(element, floor) {
  const padding = getFloorElementPadding(element);
  const maxX = floor.width - element.width - padding.x;
  const maxY = floor.height - element.height - padding.y;
  if (padding.x > maxX + 1e-6 || padding.y > maxY + 1e-6) return null;
  return { x: Math.max(padding.x, Math.min(element.x, maxX)), y: Math.max(padding.y, Math.min(element.y, maxY)) };
}

export function resizeWayfindingFloor(snapshot, floorId, width, height) {
  const floor = snapshot.floors.find((item) => item.id === floorId);
  const scale = ({ x, y }) => ({ x: (x * width) / floor.width, y: (y * height) / floor.height });
  const updatedFloor = {
    ...floor, width, height, entry: scale(floor.entry),
    elements: floor.elements.map((item) => ({
      ...item, ...scale(item), width: (item.width * width) / floor.width, height: (item.height * height) / floor.height,
    })),
  };
  if (floor.elements.some((item) => item.rotation)) {
    const uniform = Math.min(width / floor.width, height / floor.height);
    updatedFloor.elements = floor.elements.map((item, index) => {
      if (!item.rotation) return updatedFloor.elements[index];
      const center = scale({ x: item.x + item.width / 2, y: item.y + item.height / 2 });
      const next = { ...item, width: item.width * uniform, height: item.height * uniform };
      const position = fitFloorElement({ ...next, x: center.x - next.width / 2, y: center.y - next.height / 2 }, updatedFloor);
      return { ...next, ...position };
    });
  }
  return {
    ...snapshot,
    floors: snapshot.floors.map((item) => item.id === floorId ? updatedFloor : item),
    ...(floorId === snapshot.lobbyFloorId && { lobbyStart: scale(snapshot.lobbyStart), lobbyRoute: snapshot.lobbyRoute.map(scale) }),
    destinations: snapshot.destinations.map((place) => place.floorId === floorId ? {
      ...place, coords: scale(place.coords), points: place.points?.map(scale) ?? null,
    } : place),
  };
}

export const PLACE_ICONS = {
  pin: ['📍', 'Vị trí'], desk: ['ℹ️', 'Lễ tân'], pool: ['🏊', 'Hồ bơi'], gym: ['🏋️', 'Phòng gym'],
  spa: ['🌿', 'Spa'], food: ['🍴', 'Ẩm thực'], elevator: ['🛗', 'Thang máy'], room: ['🛏️', 'Phòng nghỉ'],
  parking: ['🅿️', 'Bãi xe'], restroom: ['🚻', 'Vệ sinh'],
};

export function routePath(start, points, end) {
  return `M ${[start, ...points, end].map(({ x, y }) => `${x} ${y}`).join(' L ')}`;
}

export function findWayfindingPlace(snapshot, id) {
  const place = snapshot?.destinations.find((item) => item.id === id);
  if (!place) return undefined;
  return {
    ...place,
    floorLevel: snapshot.floors.find((floor) => floor.id === place.floorId).level,
    isDifferentFloor: place.enabled && place.floorId !== snapshot.lobbyFloorId,
  };
}

export function getWayfindingLeg(snapshot, place, step) {
  const lobby = snapshot.floors.find((floor) => floor.id === snapshot.lobbyFloorId);
  const destinationFloor = snapshot.floors.find((floor) => floor.id === place.floorId);
  const differentFloor = place.floorId !== snapshot.lobbyFloorId;
  const firstLeg = step === 1 && differentFloor && place.enabled;
  const floor = firstLeg ? lobby : destinationFloor;
  const start = firstLeg || !differentFloor ? snapshot.lobbyStart : floor.entry;
  const end = firstLeg ? lobby.entry : place.coords;
  const points = firstLeg ? snapshot.lobbyRoute : place.points;
  return { floor, start, end, path: place.enabled && points ? routePath(start, points, end) : '' };
}
