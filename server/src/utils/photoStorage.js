const fs = require('fs');
const path = require('path');
const config = require('../config/constants');
const { uploadToImgBB } = require('./imgbb');
const { publicUrl } = require('./storage');

// Turn the files multer just wrote into the references we persist in MongoDB.
//
// Returns either an absolute https URL (ImgBB / any external host) or a storage
// relative path like "photos/photo-123.jpg". Both shapes are what the rest of
// the gallery code already knows how to resolve and render.
//
// Centralised so every upload path makes the same hosting decision. Previously
// only /api/upload consulted IMG_BB_API_KEY, so an album created through the
// multipart endpoint silently stayed on local disk even with external hosting
// configured — which on a host with an ephemeral filesystem meant the photos
// vanished on the next redeploy while MongoDB still listed the album.
async function persistUploadedFiles(files) {
  const refs = [];
  for (const f of files) {
    const rel = `photos/${f.filename}`;
    if (config.IMG_BB_API_KEY) {
      try {
        const external = await uploadToImgBB({ filePath: f.path, mime: f.mimetype });
        if (external) {
          // Hosted externally, so the local copy is redundant. Removing it keeps
          // the server's disk from growing with every upload.
          try {
            fs.unlinkSync(f.path);
          } catch (e) {
            // A leftover temp file is not worth failing the upload over.
          }
          refs.push(external);
          continue;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[upload] ImgBB failed for ${f.filename}: ${e.message}. Using local storage.`);
      }
    }
    refs.push(rel);
  }
  return refs;
}

module.exports = { persistUploadedFiles };