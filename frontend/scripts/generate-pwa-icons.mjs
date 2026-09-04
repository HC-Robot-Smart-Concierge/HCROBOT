import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(scriptDirectory, '..', 'public');

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const makeChunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const insideRoundedRect = (x, y, left, top, width, height, radius) => {
  const right = left + width;
  const bottom = top + height;
  const closestX = Math.max(left + radius, Math.min(x, right - radius));
  const closestY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - closestX;
  const dy = y - closestY;
  return x >= left && x <= right && y >= top && y <= bottom && ((dx * dx) + (dy * dy) <= radius * radius);
};

const createIcon = (size) => {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const scale = size / 512;
  const colors = {
    dark: [23, 23, 22, 255],
    light: [245, 242, 235, 255],
    muted: [140, 133, 123, 255],
  };

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const sx = x / scale;
      const sy = y / scale;
      let color = colors.dark;
      if (insideRoundedRect(sx, sy, 82, 118, 348, 276, 92)) color = colors.light;
      if (insideRoundedRect(sx, sy, 133, 218, 96, 52, 26)) color = colors.dark;
      if (insideRoundedRect(sx, sy, 283, 218, 96, 52, 26)) color = colors.dark;
      if (insideRoundedRect(sx, sy, 181, 317, 150, 18, 9)) color = colors.muted;
      const offset = rowStart + 1 + x * 4;
      raw.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', header),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
};

mkdirSync(publicDirectory, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(resolve(publicDirectory, `icon-${size}.png`), createIcon(size));
}

console.log('Generated icon-192.png and icon-512.png');
