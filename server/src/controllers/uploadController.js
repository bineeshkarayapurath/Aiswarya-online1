const path = require('path');
const fs = require('fs');
const { uploadDir } = require('../middleware/upload');
const config = require('../config/constants');
const { publicUrl } = require('../utils/storage');
const { uploadToImgBB } = require('../utils/imgbb');

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

    const urls = [];
    for (const f of files) {
      const rel = path.join('photos', f.filename);
      if (config.IMG_BB_API_KEY) {
        try {
          const external = await uploadToImgBB({ filePath: f.path, mime: f.mimetype });
          if (external) {
            // Hosted externally — remove the local copy.
            fs.unlink(f.path, () => {});
            urls.push(external);
            continue;
          }
        } catch (e) {
          console.warn(`[upload] ImgBB failed for ${f.filename}: ${e.message}. Using local storage.`);
        }
      }
      urls.push(publicUrl(rel));
    }

    return res.status(201).json({
      message: 'Upload complete',
      urls,
      storage: config.IMG_BB_API_KEY ? 'imgbb' : 'local',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};