const ClubSettings = require('../models/ClubSettings');
const { getClubContact } = require('../services/clubContactService');

// Public contact & social details — safe to expose to anonymous visitors and
// consumed by the website footer.
const CONTACT_FIELDS = [
  'address',
  'phoneNumber',
  'emailAddress',
  'presidentPhone',
  'secretaryPhone',
];

const SOCIAL_FIELDS = [
  'mapsUrl',
  'facebookUrl',
  'instagramUrl',
  'whatsappUrl',
  'youtubeUrl',
];

// Officer signature images. Served to any signed-in member (they appear on the
// ID cards members may download) but kept out of the public settings payload.
const SIGNATURE_FIELDS = ['secretarySignatureUrl', 'presidentSignatureUrl'];

const SETTING_FIELDS = [...CONTACT_FIELDS, ...SOCIAL_FIELDS, ...SIGNATURE_FIELDS];

const EMPTY = SETTING_FIELDS.reduce((acc, f) => {
  acc[f] = '';
  return acc;
}, {});

function pickSettings(doc, fields = SETTING_FIELDS) {
  const out = {};
  fields.forEach((f) => {
    out[f] = (doc && doc[f]) || '';
  });
  return out;
}

async function getOrCreate() {
  let doc = await ClubSettings.findOne({ key: 'default' });
  if (!doc) {
    doc = await ClubSettings.create({ key: 'default' });
  }
  return doc;
}

// Public: the resolved contact details plus the social links. The contact block
// comes from clubContactService rather than the raw row so the footer shows the
// same numbers the PDFs and ID cards print — including officer numbers that are
// following the current office-bearer instead of being pinned in settings.
exports.getSettings = async (req, res) => {
  try {
    const [doc, contact] = await Promise.all([getOrCreate(), getClubContact()]);
    return res.json({
      settings: {
        ...pickSettings(doc, SOCIAL_FIELDS),
        address: contact.address,
        phoneNumber: contact.phone,
        emailAddress: contact.email,
        presidentPhone: contact.presidentPhone,
        secretaryPhone: contact.secretaryPhone,
      },
      // Lets the settings screen tell a blank officer input ("follow whoever holds
      // the post") apart from a deliberately published number, so opening and
      // saving the form cannot pin the current office-bearer's number in place.
      officerPhonesFromAccount: {
        president: contact.presidentPhoneFromAccount,
        secretary: contact.secretaryPhoneFromAccount,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Authenticated: fetch only the officer signature URLs. The ID card front/back
// needs the Secretary's signature, and the settings screen previews both.
exports.getSignatures = async (req, res) => {
  try {
    const doc = await getOrCreate();
    return res.json({ signatures: pickSettings(doc, SIGNATURE_FIELDS) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Admin: update contact, social links and officer signatures (persisted globally)
exports.updateSettings = async (req, res) => {
  try {
    const doc = await getOrCreate();
    SETTING_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) {
        doc[f] = String(req.body[f]).trim();
      }
    });
    await doc.save();
    return res.json({
      message: 'Settings saved',
      settings: pickSettings(doc),
      signatures: pickSettings(doc, SIGNATURE_FIELDS),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.EMPTY_SETTINGS = EMPTY;