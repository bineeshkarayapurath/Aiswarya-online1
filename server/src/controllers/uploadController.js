const config = require('../config/constants');
const { publicUrl } = require('../utils/storage');
const { persistUploadedFiles } = require('../utils/photoStorage');

// Generic image upload endpoint. Files are saved to the server's storage/ dir
// by multer, then returned as public HTTPS URLs. When an ImgBB API key is
// configured, each file is relayed to ImgBB (free hosting) and the permanent
// ImgBB CDN URL is returned instead, so images never bloat the server disk.
exports.uploadPhotos = async (req, res) => {
  try {
    const files = (req.files || []).slice(0, 20);
    if (!files.length) {
      return res.status(400).json({ message: 'No files received (expected field "photos")' });
    }

    // Same helper the gallery album endpoint uses, so both make one hosting
    // decision in one place.
    const refs = await persistUploadedFiles(files);

    return res.status(201).json({
      message: 'Upload complete',
      urls: refs.map((r) => publicUrl(r)),
      storage: config.IMG_BB_API_KEY ? 'imgbb' : 'local',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};