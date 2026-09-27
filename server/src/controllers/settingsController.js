const ClubSettings = require('../models/ClubSettings');

// Public contact & social details — safe to expose to anonymous visitors and
// consumed by the website footer.
const CONTACT_FIELDS = [
  'phoneNumber',
  'emailAddress',
  'mapsUrl',
  'facebookUrl',
  'instagramUrl',
  'whatsappUrl',
  'youtubeUrl',
];

// Officer signature images. Served to any signed-in member (they appear on the
// ID cards members may download) but kept out of the public settings payload.
const SIGNATURE_FIELDS = ['secretarySignatureUrl', 'presidentSignatureUrl'];

const SETTING_FIELDS = [...CONTACT_FIELDS, ...SIGNATURE_FIELDS];

const EMPTY = CONTACT_FIELDS.concat(SIGNATURE_FIELDS).reduce((acc, f) => {
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

// Public: fetch the active contact & social settings
exports.getSettings = async (req, res) => {
  try {
    const doc = await getOrCreate();
    return res.json({ settings: pickSettings(doc, CONTACT_FIELDS) });
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