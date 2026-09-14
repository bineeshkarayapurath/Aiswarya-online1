const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const { storagePath } = require('../utils/storage');

exports.myProfile = async (req, res) => {
  const u = req.user.toObject();
  delete u.lowerPhone;
  res.json({ user: u });
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
    const abs = storagePath(url.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
    return res.download(abs, path.basename(abs));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};