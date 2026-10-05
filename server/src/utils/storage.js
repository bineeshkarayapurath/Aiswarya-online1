const path = require('path');
const fs = require('fs');
const config = require('../config/constants');

function ensureDir() {
  fs.mkdirSync(path.join(config.STORAGE_DIR, 'pdfs'), { recursive: true });
  fs.mkdirSync(path.join(config.STORAGE_DIR, 'qr'), { recursive: true });
}

ensureDir();

const pdfDir = () => path.join(config.STORAGE_DIR, 'pdfs');
const qrDir = () => path.join(config.STORAGE_DIR, 'qr');

function publicUrl(relativePath) {
  // Relative storage paths are exposed to the client, e.g. /uploads/pdf/xyz.pdf.
  // Absolute URLs (ImgBB / Firebase download URLs, data URIs, protocol-relative)
  // are passed through untouched so uploaded images always resolve.
  if (!relativePath) return '';
  const p = String(relativePath).replace(/\\/g, '/');
  if (/^(https?:)?\/\//i.test(p) || p.startsWith('data:')) return p;
  // In production the API lives on its own domain (Render), so root-relative
  // URLs must be prefixed with the public API base to be reachable from Vercel.
  const base = (config.PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (p.startsWith('/uploads/')) return base ? `${base}${p}` : p;
  return base ? `${base}/uploads/${p}` : `/uploads/${p}`;
}

function storagePath(relativePath) {
  return path.join(config.STORAGE_DIR, String(relativePath));
}

// Resolve a stored media reference to a real absolute path inside STORAGE_DIR.
// Accepts every shape the upload pipeline can produce: a bare relative path
// ("photos/x.jpg"), a root-relative "/uploads/photos/x.jpg", or an absolute URL
// pointing back at this server. Returns null when it cannot be resolved to a
// file that exists, so callers fall back instead of embedding a broken image.
//
// Do not replace this with path.resolve(STORAGE_DIR, stored): a leading slash
// makes the second argument absolute, so path.resolve discards STORAGE_DIR
// entirely and looks for C:\uploads\x.jpg. That is why member photos silently
// never appeared on generated PDFs.
function localMediaFile(stored) {
  if (!stored) return null;
  let rel = String(stored).replace(/\\/g, '/');
  rel = rel.replace(/^https?:\/\/[^/]+/i, '');
  rel = rel.replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  if (!rel) return null;
  const root = path.resolve(config.STORAGE_DIR);
  const abs = path.resolve(root, rel);
  // Refuse anything that escapes the storage directory.
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

module.exports = { pdfDir, qrDir, publicUrl, storagePath, localMediaFile };