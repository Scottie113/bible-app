#!/usr/bin/env node
/**
 * Draws the Notes tab icon (a page with lines and a folded corner) as
 * black-on-transparent PNGs at 24/48/72 px, matching the other tab icons.
 *   node scripts/make-notes-icon.mjs
 */
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const out = join(dirname(fileURLToPath(import.meta.url)), '../assets/images/tabIcons');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function draw(size) {
  const s = size / 24; // design on a 24px grid
  const alpha = new Float32Array(size * size);
  // Anti-aliased by 4x4 supersampling of simple shapes.
  const inside = (x, y) => {
    const X = x / s;
    const Y = y / s;
    const stroke = 1.8;
    // page outline: rect 4..20 x 2..22 with folded corner at top-right (15..20, 2..7)
    const inPage = X >= 4 && X <= 20 && Y >= 2 && Y <= 22 && !(X > 15 && Y < 7 && X - 15 > Y - 2);
    const inInner =
      X >= 4 + stroke && X <= 20 - stroke && Y >= 2 + stroke && Y <= 22 - stroke && !(X > 15 - stroke * 0.4 && Y < 7 + stroke * 0.4 && X - 15 > Y - 2 - stroke * 1.4);
    const outline = inPage && !inInner;
    const fold = X >= 15 - stroke / 2 && X <= 15 + stroke / 2 && Y >= 2 && Y <= 7 + stroke / 2;
    const foldBottom = Y >= 7 - stroke / 2 && Y <= 7 + stroke / 2 && X >= 15 && X <= 20;
    const lines = [10.5, 14, 17.5].some((ly) => Y >= ly - 0.8 && Y <= ly + 0.8 && X >= 7.5 && X <= (ly === 17.5 ? 13.5 : 16.5));
    return outline || fold || foldBottom || lines;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++;
      alpha[y * size + x] = hits / 16;
    }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw[y * (size * 4 + 1) + 1 + x * 4 + 3] = Math.round(alpha[y * size + x] * 255);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['notes.png', 24], ['notes@2x.png', 48], ['notes@3x.png', 72]]) {
  writeFileSync(join(out, name), draw(size));
}
console.log('wrote notes.png, notes@2x.png, notes@3x.png');
