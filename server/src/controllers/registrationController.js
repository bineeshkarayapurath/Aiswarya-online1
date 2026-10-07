const config = require('../config/constants');
const ClubSettings = require('../models/ClubSettings');
const ProgramRegistration = require('../models/ProgramRegistration');
const User = require('../models/User');
const { nextChestNumber } = require('../models/ProgramRegistration');

const CATEGORIES = config.PROGRAM_CATEGORIES;

async function getSettings() {
  let doc = await ClubSettings.findOne({ key: 'default' });
  if (!doc) doc = await ClubSettings.create({ key: 'default' });
  return doc;
}

// Normalise a stored registration into the shape the client consumes.
function toView(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  o._id = String(o._id);
  o.member = o.member ? String(o.member) : null;
  o.members = (o.members || []).map((m) => ({
    name: m.name || '',
    phoneNumber: m.phoneNumber || '',
    membershipId: m.membershipId || '',
  }));
  return o;
}

function cleanMember(entry = {}) {
  return {
    name: String(entry.name || '').trim(),
    phoneNumber: String(entry.phoneNumber || '').replace(/\D/g, ''),
    membershipId: String(entry.membershipId || '').trim().toUpperCase(),
  };
}

function cleanLead(raw = {}, fallback = {}) {
  return {
    name: String(raw.name || fallback.name || '').trim(),
    phoneNumber: String(raw.phoneNumber || fallback.phoneNumber || '').replace(/\D/g, ''),
    email: String(raw.email || fallback.email || '').trim(),
    membershipId: String(raw.membershipId || fallback.membershipId || '').trim().toUpperCase(),
    address: String(raw.address || fallback.address || '').trim(),
  };
}

// Public: whether registration is open, plus the category list for the form.
exports.getConfig = async (req, res) => {
  try {
    const settings = await getSettings();
    return res.json({
      open: Boolean(settings.programRegistrationOpen),
      categories: CATEGORIES,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Public: look up an approved member by membership ID so the registration form
// can autofill their name and phone number. Deliberately returns only the
// fields the form needs.
exports.lookupMember = async (req, res) => {
  try {
    const id = String(req.params.membershipId || '').trim();
    if (!id) return res.status(400).json({ message: 'Membership ID is required' });
    const user = await User.findOne({
      membershipId: { $regex: `^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      status: config.STATUS.APPROVED,
    }).select('fullName phoneNumber email membershipId address authorityLogin');
    // Placeholder authority accounts are not real members and must not autofill.
    if (!user || user.authorityLogin || user.fullName === user.phoneNumber) {
      return res.json({ found: false });
    }
    return res.json({
      found: true,
      member: {
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email || '',
        membershipId: user.membershipId,
        address: user.address || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Public (optionally authenticated): create a solo or group registration and
// assign the next chest number.
exports.create = async (req, res) => {
  try {
    const settings = await getSettings();
    // The admin toggle gates new registrations only; the admin panel keeps its
    // full list regardless.
    if (!settings.programRegistrationOpen) {
      return res.status(403).json({
        message: 'Program registration is currently closed. Please check back later.',
      });
    }

    const {
      participantName,
      contactNumber,
      category,
      itemTitle,
      isGroup,
      lead: rawLead,
      members: rawMembers,
    } = req.body || {};

    const name = String(participantName || '').trim();
    const phone = String(contactNumber || '').replace(/\D/g, '');
    const cat = String(category || '').trim();
    const title = String(itemTitle || '').trim();
    const group = Boolean(isGroup);

    if (!name) return res.status(400).json({ message: 'Participant / team name is required' });
    if (!phone || phone.length < 10) {
      return res.status(400).json({ message: 'A valid contact number (10 digits) is required' });
    }
    if (!cat) return res.status(400).json({ message: 'Program category is required' });
    if (!CATEGORIES.includes(cat)) {
      return res.status(400).json({ message: 'Please choose a valid program category' });
    }
    if (!title) return res.status(400).json({ message: 'Item / performance title is required' });

    // Resolve the linked member: an explicit Member ID on the form wins, else a
    // signed-in member's own account.
    const bodyMemberId = String(req.body?.membershipId || rawLead?.membershipId || '')
      .trim()
      .toUpperCase();
    let linked = null;
    const lookupId = bodyMemberId || req.user?.membershipId || '';
    if (lookupId) {
      linked = await User.findOne({
        membershipId: { $regex: `^${lookupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        status: config.STATUS.APPROVED,
      }).select('fullName phoneNumber email membershipId address authorityLogin');
      if (linked && (linked.authorityLogin || linked.fullName === linked.phoneNumber)) linked = null;
    }
    // A signed-in member with no membership ID provided still gets linked.
    if (!linked && req.user?._id && !bodyMemberId) linked = req.user;

    const lead = cleanLead(rawLead, {
      name: linked?.fullName || name,
      phoneNumber: linked?.phoneNumber || phone,
      email: linked?.email || '',
      membershipId: linked?.membershipId || lookupId,
      address: linked?.address || '',
    });

    if (group && !lead.name) {
      return res.status(400).json({ message: "The lead person's name is required for a group entry" });
    }

    const members = Array.isArray(rawMembers)
      ? rawMembers
          .map(cleanMember)
          .filter((m) => m.name)
      : [];
    if (group && members.length === 0) {
      return res
        .status(400)
        .json({ message: 'Add at least one other team member for a group entry' });
    }

    // Mint a unique chest number, retrying if a concurrent registration grabs
    // the same sequence (the unique index would otherwise reject the save).
    let saved = null;
    let attempts = 0;
    while (!saved && attempts < 5) {
      attempts += 1;
      const chestNumber = await nextChestNumber(config.CHEST_NUMBER_PREFIX);
      try {
        // eslint-disable-next-line no-await-in-loop
        saved = await ProgramRegistration.create({
          participantName: name,
          contactNumber: phone,
          category: cat,
          itemTitle: title,
          isGroup: group,
          lead,
          members,
          member: linked?._id || null,
          membershipId: lead.membershipId || linked?.membershipId || '',
          chestNumber,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }
    if (!saved) {
      return res.status(500).json({ message: 'Could not assign a chest number. Please try again.' });
    }

    return res.status(201).json({
      message: `Registration successful. Chest number: ${saved.chestNumber}`,
      registration: toView(saved),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Member: only this member's own registrations and chest numbers.
exports.myRegistrations = async (req, res) => {
  try {
    const user = req.user;
    const or = [{ member: user._id }];
    if (user.membershipId) {
      or.push({
        membershipId: {
          $regex: `^${escapeRegex(user.membershipId)}$`,
          $options: 'i',
        },
      });
    }
    const docs = await ProgramRegistration.find({
      status: { $ne: 'CANCELLED' },
      $or: or,
    }).sort({ category: 1, chestNumber: 1 });
    return res.json({ registrations: docs.map(toView) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Admin: the complete register, grouped by category.
exports.listAdmin = async (req, res) => {
  try {
    const { category, q } = req.query;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (q && String(q).trim()) {
      const re = new RegExp(escapeRegex(String(q).trim()), 'i');
      filter.$or = [
        { participantName: re },
        { itemTitle: re },
        { chestNumber: re },
        { contactNumber: re },
        { membershipId: re },
        { 'lead.name': re },
        { 'members.name': re },
      ];
    }

    const docs = await ProgramRegistration.find(filter).sort({ category: 1, chestNumber: 1 });
    const registrations = docs.map(toView);

    // Categories follow the configured order, then any unforeseen ones, so the
    // admin sees a stable grouping rather than alphabetical noise.
    const present = [...new Set(registrations.map((r) => r.category))];
    const ordered = [
      ...CATEGORIES.filter((c) => present.includes(c)),
      ...present.filter((c) => !CATEGORIES.includes(c)),
    ];
    const grouped = ordered.map((c) => ({
      category: c,
      count: registrations.filter((r) => r.category === c).length,
      registrations: registrations.filter((r) => r.category === c),
    }));

    return res.json({ registrations, grouped, categories: CATEGORIES, total: registrations.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const doc = await ProgramRegistration.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Registration not found' });
    return res.json({ registration: toView(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const doc = await ProgramRegistration.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Registration not found' });
    await doc.deleteOne();
    return res.json({ message: 'Registration removed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Admin: flip the registration on/off.
exports.updateConfig = async (req, res) => {
  try {
    const settings = await getSettings();
    if (req.body.open !== undefined) {
      settings.programRegistrationOpen = Boolean(req.body.open);
    }
    await settings.save();
    return res.json({
      message: settings.programRegistrationOpen
        ? 'Program registration is now OPEN'
        : 'Program registration is now CLOSED',
      open: Boolean(settings.programRegistrationOpen),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
