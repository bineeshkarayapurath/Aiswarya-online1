const EventProgram = require('../models/EventProgram');
const EventRegistration = require('../models/EventRegistration');

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function normSubs(subs) {
  if (!Array.isArray(subs)) return [];
  return subs
    .filter((s) => s && s.name && String(s.name).trim())
    .map((s) => ({ name: String(s.name).trim(), isGroup: Boolean(s.isGroup) }));
}

// Collapse an audience/group label to a comparison token by lowercasing and
// dropping every non-alphanumeric character. This is what makes the club's
// canonical wing name ('Vanitha Vedi' / 'Bala Vedi', stored with a space in
// user.subCommittees[].committeeName) compare equal to the label an admin types
// into the program form ('Vanithavedi' / 'Balavedi'). A previous exact-string
// comparison silently hid every wing program from the very members it targeted.
function normalizeToken(v) {
  return String(v == null ? '' : v)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// A program whose target is one of these is meant for every approved member.
// "Open to All" / "Library members" are the legacy enum values still present on
// programs created before the audience field was free-text.
const UNIVERSAL_TARGETS = new Set([
  'general',
  'all',
  'open',
  'opentoall',
  'everyone',
  'anyone',
  'members',
  'librarymembers',
]);

// Spelling variants that all mean the same wing. Admins pick from the preset
// group list ("Vanithavedi", "Women", "Womens Forum") but can also type a value,
// so the aliases are grouped into one bucket instead of compared literally.
const WING_ALIASES = {
  vanithavedi: ['vanitha', 'vanithavedi', 'vanithavedhi', 'women', 'woman', 'womens', 'womensforum', 'womenforum', 'ladies', 'lady', 'mahila', 'mahilavedi'],
  balavedi: ['bala', 'balavedi', 'balavedhi', 'balabhavan', 'children', 'kids'],
  yuvatha: ['yuvatha', 'yuvathavedi', 'yuvajana', 'youth'],
};

// Map any wing label to its canonical bucket key, or null when it is a plain
// value (a committee name, designation, …) that should match literally.
function wingBucket(value) {
  const token = normalizeToken(value);
  if (!token) return null;
  for (const [bucket, aliases] of Object.entries(WING_ALIASES)) {
    if (aliases.includes(token)) return bucket;
  }
  return null;
}

// Should this program be shown to this member? A program with no target groups
// and a General/blank audience is open to everyone; otherwise the member must
// match the audience or at least one target group. Matches are normalised so
// wing membership ('Vanitha Vedi' → vanithavedi), gender ('Female') and the
// common aliases ('Women', "Women's Forum") all resolve correctly.
function inTarget(ev, user) {
  if (!ev) return true;

  const groups = (ev.targetGroups || []).filter((g) => g && String(g).trim());
  const audienceRaw = String(ev.targetAudience || '').trim();
  const audienceToken = normalizeToken(audienceRaw);

  const groupsAreUniversal = groups.length === 0
    || groups.every((g) => UNIVERSAL_TARGETS.has(normalizeToken(g)));
  if (groupsAreUniversal && (!audienceRaw || UNIVERSAL_TARGETS.has(audienceToken))) {
    return true;
  }
  if (!user) return false;

  // Every value that identifies the member's wing/committee membership and
  // categories, both as raw tokens (for committee names) and as resolved
  // buckets (so 'Vanitha Vedi' satisfies a 'Women' / 'Vanithavedi' audience).
  const memberTokens = new Set();
  const memberBuckets = new Set();
  const add = (value) => {
    const token = normalizeToken(value);
    if (!token) return;
    memberTokens.add(token);
    const bucket = wingBucket(token);
    if (bucket) memberBuckets.add(bucket);
  };
  [
    user.committeeName,
    user.committee,
    user.committeeId,
    user.wing,
    user.designation,
    user.gender,
    user.isVanithavedi ? 'vanithavedi' : '',
    user.isBalavedi ? 'balavedi' : '',
  ].forEach(add);
  (user.subCommittees || []).forEach((s) => add(s && (s.committeeName || s.name)));

  const matches = (value) => {
    const token = normalizeToken(value);
    if (!token) return false;
    if (UNIVERSAL_TARGETS.has(token)) return true;
    if (memberTokens.has(token)) return true;
    const bucket = wingBucket(token);
    return bucket ? memberBuckets.has(bucket) : false;
  };

  if (groups.some((g) => matches(g))) return true;
  if (audienceRaw && matches(audienceRaw)) return true;
  return false;
}

exports.createEvent = async (req, res) => {
  try {
    const { type, name, registrationStartDate, registrationEndDate, programDate, description, subPrograms, targetAudience, targetGroups } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Heading is required' });
    const t = type === 'multi' ? 'multi' : 'single';
    const subs = t === 'multi' ? normSubs(subPrograms) : [];
    if (t === 'multi' && subs.length === 0) return res.status(400).json({ message: 'Add at least one sub-program' });
    if (registrationStartDate && registrationEndDate && toDate(registrationStartDate) > toDate(registrationEndDate)) {
      return res.status(400).json({ message: 'Registration close date must be after start date' });
    }
    const groups = Array.isArray(targetGroups) ? targetGroups.filter((g) => g && String(g).trim()) : [];
    const ev = await EventProgram.create({
      type: t,
      name: String(name).trim(),
      targetAudience: String(targetAudience || 'General').trim(),
      targetGroups: groups,
      registrationStartDate: toDate(registrationStartDate),
      registrationEndDate: toDate(registrationEndDate),
      programDate: toDate(programDate),
      description: String(description || '').trim(),
      subPrograms: subs,
      isRegistrationOpen: false,
      createdBy: req.user ? req.user._id : null,
    });
    res.status(201).json({ event: ev });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
exports.listEvents = async (req, res) => { try { const events = await EventProgram.find().sort({ createdAt: -1 }); res.json({ events }); } catch (e) { res.status(500).json({ message: e.message }); } };
exports.getEvent = async (req, res) => { try { const ev = await EventProgram.findById(req.params.id); if (!ev) return res.status(404).json({ message: 'Event not found' }); res.json({ event: ev }); } catch (e) { res.status(500).json({ message: e.message }); } };
exports.updateEvent = async (req, res) => {
  try {
    const ev = await EventProgram.findById(req.params.id);
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    const { name, registrationStartDate, registrationEndDate, programDate, description, subPrograms, isRegistrationOpen, type, targetAudience, targetGroups } = req.body;
    if (name !== undefined) ev.name = String(name).trim();
    if (registrationStartDate !== undefined) ev.registrationStartDate = toDate(registrationStartDate);
    if (registrationEndDate !== undefined) ev.registrationEndDate = toDate(registrationEndDate);
    if (programDate !== undefined) ev.programDate = toDate(programDate);
    if (description !== undefined) ev.description = String(description || '').trim();
    if (subPrograms !== undefined && Array.isArray(subPrograms)) ev.subPrograms = normSubs(subPrograms);
    if (isRegistrationOpen !== undefined) ev.isRegistrationOpen = Boolean(isRegistrationOpen);
    if (type !== undefined) ev.type = type === 'multi' ? 'multi' : 'single';
    if (targetAudience !== undefined) ev.targetAudience = String(targetAudience || 'General').trim();
    if (targetGroups !== undefined && Array.isArray(targetGroups)) ev.targetGroups = targetGroups.filter((g) => g && String(g).trim());
    await ev.save();
    res.json({ event: ev });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
exports.deleteEvent = async (req, res) => { try { const ev = await EventProgram.findById(req.params.id); if (!ev) return res.status(404).json({ message: 'Event not found' }); await ev.deleteOne(); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: e.message }); } };
exports.toggle = async (req, res) => { try { const ev = await EventProgram.findById(req.params.id); if (!ev) return res.status(404).json({ message: 'Event not found' }); ev.isRegistrationOpen = Boolean(req.body.isRegistrationOpen); await ev.save(); res.json({ event: ev }); } catch (e) { res.status(500).json({ message: e.message }); } };
// Active programs for the signed-in member: enabled by an admin AND currently
// inside their registration window AND targeted at a wing/category the member
// belongs to (or open to all). Returning an empty list here is what the member
// dashboard renders as "registration closed", so the target check must be
// correct — see inTarget().
exports.getOpen = async (req, res) => {
  try {
    const now = new Date();
    const events = await EventProgram.find({ isRegistrationOpen: true }).sort({ programDate: 1, createdAt: -1 });
    const filtered = events.filter((e) => {
      if (e.registrationStartDate && now < e.registrationStartDate) return false;
      if (e.registrationEndDate && now > e.registrationEndDate) return false;
      if (!inTarget(e, req.user)) return false;
      return true;
    });
    res.json({ events: filtered });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
exports.register = async (req, res) => {
  try {
    const { eventId, subProgramId, membershipId, participantName, contactNumber, isGroup, leadName, otherParticipants } = req.body;
    const ev = await EventProgram.findById(eventId);
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    if (!ev.isRegistrationOpen) return res.status(403).json({ message: 'Registration closed' });
    const now = new Date();
    if (ev.registrationStartDate && now < ev.registrationStartDate) return res.status(403).json({ message: 'Registration not started' });
    if (ev.registrationEndDate && now > ev.registrationEndDate) return res.status(403).json({ message: 'Registration closed' });
    if (!inTarget(ev, req.user)) return res.status(403).json({ message: 'Not eligible for this event' });
    const user = req.user;
    const mid = String(membershipId || (user && user.membershipId) || '').trim();
    if (!mid) return res.status(400).json({ message: 'Member ID is required' });
    const name = String(participantName || (user && user.fullName) || '').trim();
    if (!name) return res.status(400).json({ message: 'Participant name is required' });
    const isSingle = ev.type === 'single';
    let sub = null; let subName = ev.name;
    if (!isSingle) {
      sub = ev.subPrograms.id(subProgramId);
      if (!sub) return res.status(400).json({ message: 'Select a sub-program' });
      subName = sub.name;
    }
    const dup = await EventRegistration.findOne({ event: ev._id, ...(isSingle ? {} : { subProgram: sub._id }), membershipId: mid, status: 'REGISTERED' });
    if (dup) return res.status(409).json({ message: 'Already registered' });
    const group = !isSingle && Boolean(isGroup || sub.isGroup);
    const record = {
      event: ev._id,
      subProgram: isSingle ? null : sub._id,
      subProgramName: subName,
      member: user && user._id ? user._id : null,
      membershipId: mid,
      participantName: name,
      contactNumber: String(contactNumber || (user && user.phoneNumber) || '').trim(),
      isGroup: group,
      leadName: group ? String(leadName || name).trim() : '',
      otherParticipants: group && Array.isArray(otherParticipants) ? otherParticipants.filter((p) => p && p.name && String(p.name).trim()).map((p) => ({ name: String(p.name).trim(), membershipId: String(p.membershipId || '').trim(), phoneNumber: String(p.phoneNumber || '').trim() })) : [],
    };
    let saved = null; let attempts = 0;
    while (!saved && attempts < 5) {
      attempts++;
      try {
        const chestNumber = await EventRegistration.nextChestNumber('EVT');
        saved = await EventRegistration.create({ ...record, chestNumber });
      } catch (e) { if (e.code !== 11000) throw e; }
    }
    if (!saved) return res.status(500).json({ message: 'Could not assign chest number' });
    res.status(201).json({ registration: saved });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
exports.myRegistrations = async (req, res) => { try { const user = req.user; const or = []; if (user && user._id) or.push({ member: user._id }); if (user && user.membershipId) or.push({ membershipId: user.membershipId }); const filter = or.length > 0 ? { $or: or } : {}; const regs = await EventRegistration.find(filter).populate('event', 'name type').sort({ createdAt: -1 }); res.json({ registrations: regs }); } catch (e) { res.status(500).json({ message: e.message }); } };
exports.listRegistrations = async (req, res) => { try { const filter = {}; if (req.query.eventId) filter.event = req.query.eventId; const regs = await EventRegistration.find(filter).populate('event', 'name type').sort({ createdAt: 1 }); res.json({ registrations: regs }); } catch (e) { res.status(500).json({ message: e.message }); } };
