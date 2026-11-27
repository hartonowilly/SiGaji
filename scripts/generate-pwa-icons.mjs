/**
 * Ikon PWA SiGaji (PNG RGBA) tanpa dependensi.
 * node scripts/generate-pwa-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons', 'pwa');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || y < y0 || x > x1 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  if (cx === x || cy === y) return true;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function paintIcon(size, padFrac) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = Math.round(size * padFrac);
  const x0 = pad;
  const y0 = pad;
  const x1 = size - 1 - pad;
  const y1 = size - 1 - pad;
  const r = Math.round((x1 - x0) * 0.22);
  const inner = Math.round((x1 - x0) * 0.16);
  const sx0 = x0 + inner;
  const sy0 = y0 + inner;
  const sx1 = x1 - inner;
  const sy1 = y1 - inner;
  const sr = Math.round((sx1 - sx0) * 0.14);
  const lineX0 = sx0 + Math.round((sx1 - sx0) * 0.22);
  const lineX1 = sx1 - Math.round((sx1 - sx0) * 0.22);
  const lineH = Math.max(2, Math.round(size * 0.035));
  const lines = [0.32, 0.48, 0.64];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let rC = 12, gC = 25, bC = 41, aC = 255;
      if (inRoundRect(x, y, x0, y0, x1, y1, r)) {
        rC = 26;
        gC = 86;
        bC = 160;
      }
      if (inRoundRect(x, y, sx0, sy0, sx1, sy1, sr)) {
        rC = 255;
        gC = 255;
        bC = 255;
      }
      for (let li = 0; li < lines.length; li++) {
        const ly = sy0 + Math.round((sy1 - sy0) * lines[li]);
        if (x >= lineX0 && x <= lineX1 && y >= ly && y < ly + lineH) {
          rC = 26;
          gC = 86;
          bC = 160;
        }
      }
      rgba[i] = rC;
      rgba[i + 1] = gC;
      rgba[i + 2] = bC;
      rgba[i + 3] = aC;
    }
  }
  return encodePng(size, size, rgba);
}

fs.mkdirSync(outDir, { recursive: true });
const files = {
  'sigaji-180.png': paintIcon(180, 0.06),
  'sigaji-192.png': paintIcon(192, 0.06),
  'sigaji-512.png': paintIcon(512, 0.06),
  'sigaji-maskable-192.png': paintIcon(192, 0.18),
  'sigaji-maskable-512.png': paintIcon(512, 0.18),
};
for (const [name, buf] of Object.entries(files)) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, buf);
  console.log('wrote', p, buf.length);
}
