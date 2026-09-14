const path = require('path');
const fs = require('fs');
const config = require('../config/constants');
const Gallery = require('../models/Gallery');
const { publicUrl } = require('../utils/storage');

exports.listAlbums = async (req, res) => {
  try {
    const albums = await Gallery.find().sort({ createdAt: -1 });
    const items = albums.map((a) => ({
      _id: a._id,
      title: a.title,
      count: a.photos.length,
      cover: a.photos[0] ? publicUrl(a.photos[0]) : '',
      photos: a.photos.map((p) => publicUrl(p)),
      createdAt: a.createdAt,
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
    const items = albums.map((a) => ({
      _id: a._id,
      title: a.title,
      count: a.photos.length,
      cover: a.photos[0] ? publicUrl(a.photos[0]) : '',
      photos: a.photos.map((p) => publicUrl(p)),
      createdAt: a.createdAt,
    }));
    return res.json({ albums: items });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createAlbum = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const files = req.files || [];

    // External hosting path: the client uploads photos to POST /api/upload
    // (local storage or ImgBB) and sends the returned public HTTPS URLs here.
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
      externalUrls = Array.isArray(parsed) ? parsed.filter((u) => /^(https?:\/\/|\/uploads\/)/i.test(String(u))) : [];
    }

    if (!title) return res.status(400).json({ message: 'Event / program title is required' });
    if (!externalUrls.length && !files.length) {
      return res.status(400).json({ message: 'Upload at least one photo for the album' });
    }

    const photos = externalUrls.length
      ? externalUrls
      : files.map((f) => `photos/${f.filename}`);

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