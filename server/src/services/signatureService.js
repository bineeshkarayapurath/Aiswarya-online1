const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/constants');
const ClubSettings = require('../models/ClubSettings');
const { getClubContact } = require('./clubContactService');

// Officer signatures are uploaded through the same POST /api/upload endpoint as
// member photos, so the stored value is either a local storage path
// ("/uploads/photos/x.png") or a remote ImgBB CDN URL, depending on whether an
// ImgBB API key is configured.
//
// PDFKit can only embed a local file path or a Buffer, so remote signatures are
// downloaded once and cached under storage/signatures/; every later render
// reuses the cached copy instead of re-fetching from ImgBB.

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const DOWNLOAD_TIMEOUT_MS = 15000;

function signatureCacheDir() {
  const dir = path.join(config.STORAGE_DIR, 'signatures');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Local storage paths recorded by uploadController/publicUrl(). Accepts a bare
// relative path, a root-relative "/uploads/..." path, or an absolute URL that
// happens to point at this server's own /uploads/ mount.
function localFileFor(stored) {
  let rel = String(stored).replace(/^https?:\/\/[^/]+/i, '');
  rel = rel.replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  if (!rel) return null;
  const abs = path.resolve(config.STORAGE_DIR, rel);
  // Reject anything that escapes the storage directory.
  const root = path.resolve(config.STORAGE_DIR);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return fs.existsSync(abs) ? abs : null;
}

function dataUriToBuffer(raw) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(raw);
  if (!m) return null;
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  return buf.length ? buf : null;
}

async function resolveSignatureImage(stored) {
  const raw = String(stored || '').trim();
  if (!raw) return null;

  if (raw.startsWith('data:')) return dataUriToBuffer(raw);

  if (/^https?:\/\//i.test(raw)) {
    // Local file on this same host — prefer it over a network round-trip.
    const local = localFileFor(raw);
    if (local) return local;

    const key = crypto.createHash('sha1').update(raw).digest('hex');
    const cachedAny = fs
      .readdirSync(signatureCacheDir())
      .find((f) => f.startsWith(key));
    if (cachedAny) return path.join(signatureCacheDir(), cachedAny);

    try {
      const res = await fetch(raw, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!res.ok) {
        console.warn(`[signature] HTTP ${res.status} fetching ${raw}`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) return null;
      const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
      const dest = path.join(signatureCacheDir(), `${key}${EXT_BY_MIME[mime] || '.img'}`);
      fs.writeFileSync(dest, buf);
      return dest;
    } catch (e) {
      console.warn(`[signature] download failed for ${raw}: ${e.message}`);
      return null;
    }
  }

  return localFileFor(raw);
}

// Draw a signature so it rests on the rule underneath it. Returns true when an
// image was actually embedded — callers use this to decide whether a signature
// exists at all (an absent signature must not silently produce a blank document
// that looks signed).
async function drawSignature(doc, stored, { x, y, w, h }) {
  const img = await resolveSignatureImage(stored);
  if (!img) return false;
  try {
    doc.image(img, x, y, { fit: [w, h], align: 'center', valign: 'bottom' });
    return true;
  } catch (e) {
    console.warn(`[signature] PDF embed failed: ${e.message}`);
    return false;
  }
}

// Current officer signature URLs plus the names and published phone numbers of
// the members currently holding those posts, so PDFs can caption a signature with
// a real name and a contactable number. Officer identity comes from
// clubContactService, the same resolver the footer and the rest of the documents
// read, so a signature block can never disagree with the contact details printed
// beside it. Best-effort throughout: a document must still generate if the
// database is unhappy.
async function getClubSignatures() {
  const out = {
    presidentSignatureUrl: '',
    secretarySignatureUrl: '',
    presidentName: '',
    presidentPhone: '',
    secretaryName: '',
    secretaryPhone: '',
  };

  try {
    const doc = await ClubSettings.findOne({ key: 'default' }).lean();
    out.presidentSignatureUrl = (doc && doc.presidentSignatureUrl) || '';
    out.secretarySignatureUrl = (doc && doc.secretarySignatureUrl) || '';
  } catch (e) {
    console.warn(`[signature] settings lookup failed: ${e.message}`);
  }

  const contact = await getClubContact();
  out.presidentName = contact.presidentName;
  out.presidentPhone = contact.presidentPhone;
  out.secretaryName = contact.secretaryName;
  out.secretaryPhone = contact.secretaryPhone;

  return out;
}

module.exports = { resolveSignatureImage, drawSignature, getClubSignatures };
