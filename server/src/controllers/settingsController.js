const ClubSettings = require('../models/ClubSettings');

const SETTING_FIELDS = [
  'phoneNumber',
  'emailAddress',
  'mapsUrl',
  'facebookUrl',
  'instagramUrl',
  'whatsappUrl',
  'youtubeUrl',
];

function pickSettings(doc) {
  if (!doc) return { phoneNumber: '', emailAddress: '', mapsUrl: '', facebookUrl: '', instagramUrl: '', whatsappUrl: '', youtubeUrl: '' };
  const out = { phoneNumber: '', emailAddress: '', mapsUrl: '', facebookUrl: '', instagramUrl: '', whatsappUrl: '', youtubeUrl: '' };
  SETTING_FIELDS.forEach((f) => {
    out[f] = doc[f] || '';
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
    return res.json({ settings: pickSettings(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Admin: update contact & social links (persisted globally)
exports.updateSettings = async (req, res) => {
  try {
    const doc = await getOrCreate();
    SETTING_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) {
        doc[f] = String(req.body[f]).trim();
      }
    });
    await doc.save();
    return res.json({ message: 'Settings saved', settings: pickSettings(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};