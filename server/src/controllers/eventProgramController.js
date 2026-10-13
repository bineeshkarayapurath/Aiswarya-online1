const EventProgram = require('../models/EventProgram');
const EventRegistration = require('../models/EventRegistration');

function matchesAudience(eventAudience, user) {
  if (eventAudience === 'Open to All') return true;
  if (!user) return false;
  // Wing membership lives in subCommittees[].committeeName ('Balavedi' /
  // 'Vanithavedi') as well as any legacy top-level committee fields. Join them
  // all so a wing-specific event is matched for the members actually in it,
  // instead of always failing the audience filter.
  const wings = [user.committeeName, user.committee]
    .concat((user.subCommittees || []).map((s) => s.committeeName))
    .filter(Boolean)
    .join(' ');
  if (eventAudience === 'Balavedi') return /balavedi/i.test(wings) || user.isBalavedi;
  if (eventAudience === 'Vanithavedi') return /vanithavedi/i.test(wings) || user.isVanithavedi;
  if (eventAudience === 'Library members') return true;
  return false;
}

// A program with a registration window only accepts entries inside it; without
// dates the manual isRegistrationOpen toggle is the only gate.
function registrationOpenNow(event, now = new Date()) {
  const start = event.registrationStartDate ? new Date(event.registrationStartDate) : null;
  const end = event.registrationEndDate ? new Date(event.registrationEndDate) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function cleanUserId(id) {
  if (!id) return null;
  if (typeof id === 'object' && id._id) return id._id;
  return id;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function normalizeSubPrograms(subPrograms) {
  if (!Array.isArray(subPrograms)) return [];
  return subPrograms
    .filter((sp) => sp && sp.name && String(sp.name).trim())
    .map((sp) => ({
      name: String(sp.name).trim(),
      isGroup: Boolean(sp.isGroup),
      maxParticipants: Number(sp.maxParticipants) || 0,
      description: String(sp.description || '').trim(),
    }));
}

exports.createEvent = async (req, res) => {
  try {
    const {
      type,
      name,
      targetAudience,
      description,
      registrationStartDate,
      registrationEndDate,
      programDate,
      subPrograms,
    } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Program heading is required' });
    }
    const kind = type === 'single' ? 'single' : 'multi';
    const subs = kind === 'multi' ? normalizeSubPrograms(subPrograms) : [];
    if (kind === 'multi' && subs.length === 0) {
      return res.status(400).json({ message: 'Add at least one sub-program for a multi-item program' });
    }
    if (registrationStartDate && registrationEndDate && new Date(registrationStartDate) > new Date(registrationEndDate)) {
      return res.status(400).json({ message: 'Registration close date must be after the start date' });
    }
    const event = await EventProgram.create({
      type: kind,
      name: String(name).trim(),
      targetAudience: targetAudience || 'Open to All',
      description: String(description || '').trim(),
      registrationStartDate: toDate(registrationStartDate),
      registrationEndDate: toDate(registrationEndDate),
      programDate: toDate(programDate),
      subPrograms: subs,
      createdBy: req.user ? req.user._id : null,
      isRegistrationOpen: false,
    });
    res.status(201).json({ event });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.listEvents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.openOnly === 'true') filter.isRegistrationOpen = true;
    const events = await EventProgram.find(filter).sort({ createdAt: -1 });
    res.json({ events });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getEvent = async (req, res) => {
  try {
    const event = await EventProgram.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ event });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await EventProgram.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const {
      type,
      name,
      targetAudience,
      description,
      registrationStartDate,
      registrationEndDate,
      programDate,
      subPrograms,
      isRegistrationOpen,
    } = req.body;
    if (type !== undefined) event.type = type === 'single' ? 'single' : 'multi';
    if (name !== undefined) event.name = String(name).trim();
    if (targetAudience !== undefined) event.targetAudience = targetAudience;
    if (description !== undefined) event.description = String(description || '').trim();
    if (registrationStartDate !== undefined) event.registrationStartDate = toDate(registrationStartDate);
    if (registrationEndDate !== undefined) event.registrationEndDate = toDate(registrationEndDate);
    if (programDate !== undefined) event.programDate = toDate(programDate);
    if (subPrograms !== undefined && Array.isArray(subPrograms)) {
      event.subPrograms = normalizeSubPrograms(subPrograms);
    }
    if (isRegistrationOpen !== undefined) event.isRegistrationOpen = Boolean(isRegistrationOpen);
    await event.save();
    res.json({ event });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await EventProgram.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.toggleRegistration = async (req, res) => {
  try {
    const event = await EventProgram.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    event.isRegistrationOpen = Boolean(req.body.isRegistrationOpen);
    await event.save();
    res.json({ event });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getOpenForUser = async (req, res) => {
  try {
    const now = new Date();
    const events = await EventProgram.find({ isRegistrationOpen: true });
    const eligible = events.filter(
      (e) => matchesAudience(e.targetAudience, req.user) && registrationOpenNow(e, now)
    );
    res.json({ events: eligible });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.register = async (req, res) => {
  try {
    const {
      eventId,
      subProgramId,
      subProgramName,
      membershipId,
      participantName,
      contactNumber,
      isGroup,
      leadName,
      otherParticipants,
    } = req.body;
    const event = await EventProgram.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.isRegistrationOpen) return res.status(403).json({ message: 'Registration is closed for this program' });
    if (!registrationOpenNow(event)) {
      return res.status(403).json({ message: 'Registration is outside the registration window for this program' });
    }
    if (!matchesAudience(event.targetAudience, req.user)) {
      return res.status(403).json({ message: 'Not eligible for this event' });
    }

    // Single programs register against the event itself; multi-item programs
    // require the member to choose one of the configured sub-programs.
    const isSingle = event.type === 'single';
    let sub = null;
    if (!isSingle) {
      sub = event.subPrograms.id(subProgramId) || event.subPrograms.find((s) => s.name === subProgramName);
      if (!sub) return res.status(400).json({ message: 'Please select a valid sub-program / competition' });
    }

    const user = req.user;
    // Member ID is the key the club matches entries against, so it is required;
    // it defaults to the signed-in member's own ID but may be typed by hand.
    const memberId = String(membershipId || (user && user.membershipId) || '').trim();
    if (!memberId) return res.status(400).json({ message: 'Member ID is required' });
    const name = String(participantName || (user && user.fullName) || '').trim();
    if (!name) return res.status(400).json({ message: 'Participant name is required' });

    // One entry per member per program (or per sub-program for multi items).
    const duplicate = await EventRegistration.findOne({
      event: event._id,
      ...(isSingle ? {} : { subProgram: sub._id }),
      membershipId: memberId,
      status: 'REGISTERED',
    });
    if (duplicate) {
      return res.status(409).json({ message: 'This member is already registered for this program' });
    }

    const group = !isSingle && Boolean(isGroup || sub.isGroup);
    const record = {
      event: event._id,
      subProgram: isSingle ? null : sub._id,
      // For single programs the event name doubles as the "item" label so the
      // admin registrations list still groups cleanly.
      subProgramName: isSingle ? event.name : sub.name,
      member: cleanUserId(user && user._id),
      membershipId: memberId,
      participantName: name,
      contactNumber: String(contactNumber || (user && user.phoneNumber) || '').trim(),
      isGroup: group,
      leadName: group ? String(leadName || name).trim() : '',
      otherParticipants:
        group && Array.isArray(otherParticipants)
          ? otherParticipants
              .filter((p) => p && p.name && String(p.name).trim())
              .map((p) => ({
                name: String(p.name).trim(),
                membershipId: String(p.membershipId || '').trim(),
                phoneNumber: String(p.phoneNumber || '').trim(),
              }))
          : [],
    };

    let attempts = 0;
    let saved = null;
    while (!saved && attempts < 5) {
      attempts++;
      const chestNumber = await EventRegistration.nextChestNumber('EVT');
      try {
        saved = await EventRegistration.create({ ...record, chestNumber });
      } catch (e) { if (e.code !== 11000) throw e; }
    }
    if (!saved) return res.status(500).json({ message: 'Could not assign chest number' });
    res.status(201).json({ registration: saved });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.myRegistrations = async (req, res) => {
  try {
    const user = req.user;
    const or = [];
    if (user && user._id) or.push({ member: user._id });
    if (user && user.membershipId) or.push({ membershipId: user.membershipId });
    // The $or list below is required: the previous query sent an empty field
    // path (''), which MongoDB rejects, so this endpoint returned 500 for every
    // approved member - and since the member panel loads this next to
    // /events/open in one Promise.all, the failure hid open events behind
    // "Registration is CLOSED" even when the admin had enabled one.
    const filter = or.length > 0 ? { $or: or } : {};
    const regs = await EventRegistration.find(filter)
      .populate('event', 'name type targetAudience programDate')
      .sort({ createdAt: -1 });
    res.json({ registrations: regs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.listRegistrations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventId) filter.event = req.query.eventId;
    const regs = await EventRegistration.find(filter)
      .populate('event', 'name type')
      .sort({ createdAt: 1 });
    res.json({ registrations: regs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
