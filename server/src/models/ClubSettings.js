const mongoose = require('mongoose');

const ClubSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    phoneNumber: { type: String, default: '' },
    emailAddress: { type: String, default: '' },
    mapsUrl: { type: String, default: '' },
    facebookUrl: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    whatsappUrl: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClubSettings', ClubSettingsSchema);