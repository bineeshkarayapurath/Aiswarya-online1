/**
 * Generates a placeholder club logo (club-logo.png) using only Node built-ins.
 * Replace the generated file with the real club logo later.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 512;

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const EMERALD = { r: 15, g: 61, b: 46, a: 255 };
const GOLD = { r: 184, g: 134, b: 11, a: 255 };
const CREAM = { r: 248, g: 250, b: 252, a: 255 };

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function colorAt(x, y) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const d = Math.hypot(x - cx, y - cy);

  // gold ring
  if (d >= 168 && d <= 192) return GOLD;
  // inner disc
  if (d < 168) {
    // letter "A" as three segments
    const segs = [
      [256, 96, 196, 420], // left leg
      [256, 96, 316, 420], // right leg
      [222, 300, 290, 300], // crossbar
    ];
    for (const [ax, ay, bx, by] of segs) {
      if (distToSegment(x, y, ax, ay, bx, by) <= 14 && x > 196 && x < 316) {
        return GOLD;
      }
    }
    // open-book base line
    if (Math.hypot(y - 444, 0) <= 8 && x >= 176 && x <= 336) return GOLD;
    return EMERALD;
  }
  return GOLD;
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const c = colorAt(x, y);
    const i = (y * SIZE + x) * 4;
    rgba[i] = c.r;
    rgba[i + 1] = c.g;
    rgba[i + 2] = c.b;
    rgba[i + 3] = c.a;
  }
}

const outDir = path.join(__dirname, '..', 'client', 'public', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'club-logo.png');
fs.writeFileSync(out, encodePng(SIZE, SIZE, rgba));
console.log('Placeholder logo written to', out);