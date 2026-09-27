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
    // Officer signature images, uploaded through the same /upload endpoint as
    // member photos (local storage, or ImgBB when an API key is configured).
    // The Secretary's signature is printed on the back of every digital ID card;
    // both are appended to official PDF documents and letterheads.
    secretarySignatureUrl: { type: String, default: '' },
    presidentSignatureUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClubSettings', ClubSettingsSchema);