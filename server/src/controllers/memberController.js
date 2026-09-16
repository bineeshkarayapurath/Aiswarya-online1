const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const { storagePath, publicUrl } = require('../utils/storage');

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
  res.json({ user: userView(req.user) });
};

exports.serveFile = async (req, res) => {
  try {
    const { type } = req.params;
    if (!['application', 'idcard'].includes(type)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }
    const user = req.user;
    const url = type === 'application' ? user.applicationPdfUrl : user.idCardPdfUrl;
    if (!url) return res.status(404).json({ message: 'Document not generated yet' });
    // The stored URL may be a relative path (/uploads/pdfs/x.pdf) or a fully
    // qualified public URL; recover the storage-relative path either way.
    const marker = String(url).lastIndexOf('/pdfs/');
    const rel = marker >= 0 ? String(url).slice(marker + 1) : String(url).replace(/^\/uploads\//, '');
    const abs = storagePath(rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
    return res.download(abs, path.basename(abs));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};