const mongoose = require('mongoose');

const ClubSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    address: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    emailAddress: { type: String, default: '' },
    // Published phone numbers for the two officer posts. Left empty these resolve
    // to the phone number on the member account currently holding the post (see
    // services/clubContactService.js), so electing a new President or Secretary
    // updates the footer and every document with no second edit. Set a value only
    // to publish a different number, e.g. a club landline.
    presidentPhone: { type: String, default: '' },
    secretaryPhone: { type: String, default: '' },
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
    // Master switch for the New Year Annual Celebration program registration.
    // When false, members and the public cannot register and the entry form /
    // their own registration list is hidden from the member profile. The admin
    // panel always shows the register so it can be managed.
    programRegistrationOpen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClubSettings', ClubSettingsSchema);