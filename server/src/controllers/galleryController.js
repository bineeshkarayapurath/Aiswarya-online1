const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const Gallery = require('../models/Gallery');
const { publicUrl, storagePath } = require('../utils/storage');
const { persistUploadedFiles } = require('../utils/photoStorage');

// How many of an album's photos are referenced in the database but absent from
// disk. This is the failure the gallery cannot show on its own: the album record
// is intact and the public page happily lists it, so the photos simply render as
// grey "Image unavailable" tiles with nothing in the UI explaining why.
//
// It happens whenever an upload is written to one storage directory and read from
// another, or when the host's filesystem is ephemeral and a redeploy discards
// the files while MongoDB keeps the references. Surfacing the count lets an
// officer see the damage and re-upload, instead of concluding that the upload
// never worked.
//
// Only local paths are checked. Externally hosted photos (ImgBB / Firebase)
// are addressed by absolute URL and are not expected to exist on this disk.
function countMissingFiles(photos) {
  let missing = 0;
  for (const rel of photos) {
    if (/^(https?:)?\/\//i.test(String(rel))) continue;
    if (!fs.existsSync(storagePath(String(rel).replace(/^\/+/g, '')))) missing += 1;
  }
  return missing;
}

function albumView(a) {
  return {
    _id: a._id,
    title: a.title,
    count: a.photos.length,
    cover: a.photos[0] ? publicUrl(a.photos[0]) : '',
    photos: a.photos.map((p) => publicUrl(p)),
    createdAt: a.createdAt,
  };
}

exports.listAlbums = async (req, res) => {
  try {
    const albums = await Gallery.find().sort({ createdAt: -1 });
    const items = albums.map((a) => ({
      ...albumView(a),
      missing: countMissingFiles(a.photos),
    }));
    return res.json({ albums: items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listPublicAlbums = async (req, res) => {
  try {
    const albums = await Gallery.find({ 'photos.0': { $exists: true } }).sort({
      createdAt: -1,
    });
    return res.json({ albums: albums.map(albumView) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createAlbum = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const files = req.files || [];

    // Pre-uploaded URL path: the client uploaded the photos to POST /api/upload
    // itself and is handing back the URLs it got. Kept for compatibility with
    // any client that still does this; the bundled panel now posts the files
    // directly so the album and its photos are created by a single request.
    let externalUrls = [];
    const rawUrls = req.body.photoUrls ?? req.body.firebaseUrls;
    if (rawUrls) {
      const parsed = Array.isArray(rawUrls) ? rawUrls : (() => {
        try {
          return JSON.parse(String(rawUrls));
        } catch {
          return String(rawUrls).split(',').map((s) => s.trim()).filter(Boolean);
        }
      })();
      // Anything that is not an http(s) or /uploads/ URL is rejected. This used
      // to be a silent filter, so a client sending a shape we did not expect got
      // "upload at least one photo" with no clue which value was wrong — and the
      // panel then swallowed that error and reported success anyway.
      const rejected = Array.isArray(parsed)
        ? parsed.filter((u) => !/^(https?:\/\/|\/uploads\/)/i.test(String(u)))
        : [];
      if (rejected.length) {
        return res.status(400).json({
          message: `Unsupported photo URL: ${String(rejected[0])}`,
          rejected,
        });
      }
      externalUrls = Array.isArray(parsed) ? parsed : [];
    }

    if (!title) return res.status(400).json({ message: 'Event / program title is required' });
    if (!externalUrls.length && !files.length) {
      return res.status(400).json({ message: 'Upload at least one photo for the album' });
    }

    // Files uploaded with this request go through the same hosting decision as
    // /api/upload, so external image hosting is honoured either way.
    const photos = externalUrls.length ? externalUrls : await persistUploadedFiles(files);

    const album = await Gallery.create({
      title,
      photos,
      createdBy: req.user && req.user._id,
    });

    return res.status(201).json({
      message: 'Album created',
      album: {
        _id: album._id,
        title: album.title,
        count: album.photos.length,
        cover: publicUrl(album.photos[0]),
        photos: album.photos.map((p) => publicUrl(p)),
        missing: countMissingFiles(album.photos),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteAlbum = async (req, res) => {
  try {
    const album = await Gallery.findById(req.params.id);
    if (!album) return res.status(404).json({ message: 'Album not found' });

    for (const rel of album.photos) {
      // Photos hosted on Firebase Storage have absolute http(s) URLs — nothing
      // to delete from local disk.
      if (/^https?:\/\//i.test(String(rel))) continue;
      const abs = path.join(config.STORAGE_DIR, String(rel).replace(/^\/+/g, ''));
      if (abs.startsWith(config.STORAGE_DIR) && fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch (e) {
          // ignore per-file errors
        }
      }
    }

    await Gallery.findByIdAndDelete(album._id);
    return res.json({ message: 'Album and its photos deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};