const mongoose = require('mongoose');

const GallerySchema = new mongoose.Schema(
  {
    // Event / program title, e.g. "Onam Celebration 2026"
    title: { type: String, required: true, trim: true },
    // Relative storage paths; photos[0] is used as the album cover
    photos: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gallery', GallerySchema);