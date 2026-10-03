const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const { storagePath, publicUrl } = require('../utils/storage');
const { syncDesignationRole } = require('../services/roleService');
const { generateApplicationPdf, generateIdCardPdf } = require('../services/pdfService');

// Normalised member view: media paths stored as relative /uploads/... (or
// "photos/x.jpg") are exposed to the client as fully-qualified public URLs so
// profile photos and document links always resolve from the frontend domain.
function userView(u) {
  const obj = u.toObject();
  delete obj.lowerPhone;
  if (obj.photoUrl) obj.photoUrl = publicUrl(obj.photoUrl);
  if (obj.applicationPdfUrl) obj.applicationPdfUrl = publicUrl(obj.applicationPdfUrl);
  if (obj.idCardPdfUrl) obj.idCardPdfUrl = publicUrl(obj.idCardPdfUrl);
  return obj;
}

exports.myProfile = async (req, res) => {
  await syncDesignationRole(req.user);
  res.json({ user: userView(req.user) });
};

// Render's filesystem is ephemeral: every redeploy or restart wipes
// STORAGE_DIR, while MongoDB keeps the document URLs written at approval time.
// The PDFs are therefore allowed to go missing, and a member who was approved
// last month can be left holding a URL that resolves to nothing. Regeneration is
// keyed per member+type so a double click (or two tabs) produces one file
// rather than two concurrent writes to the same path.
const inflight = new Map();

// The filename pdfService writes. Derived rather than trusted from the stored
// URL, because a membershipId can change after approval (the club has moved
// between AISC- and ALC- prefixes), which would leave the old URL pointing at a
// file nothing regenerates any more.
function canonicalPdfName(type, user) {
  const slug = user.membershipId || user._id;
  return type === 'application' ? `application_${slug}.pdf` : `idcard_${slug}.pdf`;
}

// Resolve a stored URL back to a path inside STORAGE_DIR. Returns null when it
// escapes the storage root, so a crafted "../" URL cannot walk out of it. The
// storage root itself is also rejected: it is a directory, and serving one
// would otherwise let an empty stored URL resolve to something "existing".
function safeStoragePath(rel) {
  const root = path.resolve(config.STORAGE_DIR);
  const abs = path.resolve(storagePath(rel));
  if (!abs.startsWith(root + path.sep)) return null;
  return abs;
}

// Recover the storage-relative path from either shape the URL is stored in:
// a bare relative path ("pdfs/x.pdf") or a public URL that includes /pdfs/.
// The "pdfs/" segment is part of the path relative to the storage root, so it
// has to be kept — slicing past it would look for storage/x.pdf instead of
// storage/pdfs/x.pdf and miss every real file.
function relativeFromStoredUrl(url) {
  const p = String(url).replace(/\\/g, '/');
  const marker = p.lastIndexOf('/pdfs/');
  const rel = marker >= 0 ? p.slice(marker + 1) : p.replace(/^\/uploads\//, '');
  if (!rel || !rel.toLowerCase().endsWith('.pdf')) return null;
  return safeStoragePath(rel);
}

exports.serveFile = async (req, res) => {
  const { type } = req.params;
  if (!['application', 'idcard'].includes(type)) {
    return res.status(400).json({ message: 'Invalid document type' });
  }

  const user = req.user;
  const filename = canonicalPdfName(type, user);
  let abs = relativeFromStoredUrl(
    type === 'application' ? user.applicationPdfUrl : user.idCardPdfUrl,
  );

  // Missing on disk: either the URL was never written, or the host wiped it.
  // Rebuild from the member record instead of 404ing — pdfService is
  // self-contained and its optional assets (logo, officer signatures) already
  // degrade gracefully, so it is safe to call on demand.
  if (!abs || !fs.existsSync(abs)) {
    const key = `${user._id}:${type}`;
    if (!inflight.has(key)) {
      inflight.set(
        key,
        (async () => {
          if (type === 'application') {
            const generated = await generateApplicationPdf(user, {
              approvedBy: user.approvedBy,
              approvedAt: user.approvedAt,
            });
            user.applicationPdfUrl = publicUrl(path.relative(config.STORAGE_DIR, generated));
          } else {
            const generated = await generateIdCardPdf(user);
            user.idCardPdfUrl = publicUrl(path.relative(config.STORAGE_DIR, generated));
          }
          // Repoint the record at the file that now exists so the next download
          // is a plain read.
          await user.save();
          return safeStoragePath(`pdfs/${filename}`);
        })().finally(() => inflight.delete(key)),
      );
    }

    try {
      abs = await inflight.get(key);
    } catch (err) {
      console.error(`[member/document] Failed to regenerate ${type} PDF for ${user._id}: ${err.message}`);
      return res.status(500).json({ message: 'Could not generate this document. Please try again.' });
    }

    if (!abs || !fs.existsSync(abs)) {
      return res.status(404).json({ message: 'Document not generated yet' });
    }
  }

  // Set the type explicitly rather than relying on res.download() sniffing the
  // extension, and strip anything that could break out of the header.
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(abs).replace(/["\r\n]/g, '')}"`,
  );
  return res.sendFile(abs, (err) => {
    if (!err) return;
    // Headers are already flushed by the time sendFile reports a mid-stream
    // error, so the status is no longer changeable — log and drop the socket.
    console.error(`[member/document] sendFile failed for ${path.basename(abs)}: ${err.message}`);
    if (!res.headersSent) return res.status(500).json({ message: 'Download failed' });
    return res.destroy(err);
  });
};