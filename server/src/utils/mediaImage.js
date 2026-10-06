const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/constants');
const { localMediaFile } = require('./storage');

// PDFKit can only embed a local file path or a Buffer, never a remote URL. So a
// photo stored on an external CDN (ImgBB, Cloudinary, Firebase Storage, or any
// other host) has to be fetched and cached on disk before it can go on a
// generated document.
//
// This is the general form of what signatureService does for officer signatures,
// lifted here so member photos use the same path. Without it, localMediaFile()
// returns null for every remote URL and the document silently prints an empty
// frame where the photo should be — the bug this exists to prevent.
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

const DOWNLOAD_TIMEOUT_MS = 15000;

function cacheDirFor(subdir) {
  const dir = path.join(config.STORAGE_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataUriToBuffer(raw) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(raw);
  if (!m) return null;
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return buf.length ? buf : null;
}

// Resolve any stored media reference into something PDFKit can embed.
// Returns an absolute file path, a Buffer for a data URI, or null.
// `subdir` is the cache folder for downloaded copies; pick one that is not the
// publicly served /uploads tree, so cached CDN copies are never exposed.
async function resolveMediaImage(stored, { subdir = 'media-cache', label = 'media' } = {}) {
  const raw = String(stored || '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) return dataUriToBuffer(raw);

  const local = localMediaFile(raw);
  if (local) return local;

  if (!/^https?:\/\//i.test(raw)) return null;

  // One cached copy per source URL, so re-rendering a card or a document for a
  // member whose photo never changes costs no network traffic.
  const dir = cacheDirFor(subdir);
  const key = crypto.createHash('sha1').update(raw).digest('hex');
  const cached = fs.readdirSync(dir).find((f) => f.startsWith(key));
  if (cached) return path.join(dir, cached);

  try {
    const res = await fetch(raw, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[${label}] HTTP ${res.status} fetching ${raw}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const dest = path.join(dir, `${key}${EXT_BY_MIME[mime] || '.img'}`);
    fs.writeFileSync(dest, buf);
    return dest;
  } catch (e) {
    console.warn(`[${label}] download failed for ${raw}: ${e.message}`);
    return null;
  }
}

// A recorded photo that cannot be read is almost always either a dead CDN link or
// an ephemeral host that wiped storage/. Say so once in the log, rather than
// letting every document quietly print a blank frame.
const warned = new Map();
function warnUnreadableOnce(subdir, raw, hint = '') {
  const seen = warned.get(subdir) || new Set();
  if (seen.has(raw)) return;
  seen.add(raw);
  warned.set(subdir, seen);
  console.warn(
    `[${subdir}] could not read "${raw}" for embedding. ${hint}`.trim(),
  );
}

module.exports = {
  resolveMediaImage,
  warnUnreadableOnce,
  dataUriToBuffer,
  cacheDirFor,
  EXT_BY_MIME,
  DOWNLOAD_TIMEOUT_MS,
};