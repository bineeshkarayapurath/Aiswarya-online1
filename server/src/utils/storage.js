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

module.exports = { pdfDir, qrDir, publicUrl, storagePath };