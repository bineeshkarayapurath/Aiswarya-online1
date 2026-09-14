const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/constants');

const uploadDir = path.join(config.STORAGE_DIR, 'photos');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '.jpg').toLowerCase();
    cb(null, `photo-${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Multi-field uploader for the Program & Minutes module (photos or PDFs).
const uploadManager = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    if (isImage || isPdf) cb(null, true);
    else cb(new Error('Only images or PDFs are allowed'));
  },
});

// Dedicated gallery uploader: photos only, with a roomier limit so camera
// phone photos (which frequently exceed 5 MB) import without MulterError.
const galleryUpload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

module.exports = upload;
module.exports.uploadDir = uploadDir;
module.exports.uploadManager = uploadManager;
module.exports.galleryUpload = galleryUpload;

// In-memory uploader for spreadsheet bulk import (.xlsx / .xls / .csv).
const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const okMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/csv',
      'text/csv',
      'text/plain',
    ].includes(mime);
    const okExt = /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    if (okMime || okExt) cb(null, true);
    else cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
  },
});
module.exports.spreadsheetUpload = spreadsheetUpload;