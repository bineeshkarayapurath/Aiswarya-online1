const EventProgram = require('../models/EventProgram');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const config = require('../config/constants');

function matchesAudience(eventAudience, user) {
  if (eventAudience === 'Open to All') return true;
  if (!user) return false;
  const committee = user.committeeName || user.committee || '';
  if (eventAudience === 'Balavedi') return /balavedi/i.test(committee) || user.isBalavedi;
  if (eventAudience === 'Vanithavedi') return /vanithavedi/i.test(committee) || user.isVanithavedi;
  if (eventAudience === 'Library members') return true;
  return false;
}

function cleanUserId(id) {
  if (!id) return null;
  if (typeof id === 'object' && id._id) return id._id;
  return id;
}

exports.createEvent = async (req, res) => {
  try {
    const { name, targetAudience, description, startDate, endDate, subPrograms } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Event name is required' });
    const event = await EventProgram.create({
      name: String(name).trim(),
      targetAudience: targetAudience || 'Open to All',
      description: String(description || '').trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      subPrograms: Array.isArray(subPrograms) ? subPrograms.filter(sp=>sp&&sp.name).map(sp=>({name:String(sp.name).trim(),isGroup:Boolean(sp.isGroup),maxParticipants:Number(sp.maxParticipants)||0,description:String(sp.description||'').trim()})) : [],
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
    const { name, targetAudience, description, startDate, endDate, subPrograms, isRegistrationOpen } = req.body;
    if (name !== undefined) event.name = String(name).trim();
    if (targetAudience !== undefined) event.targetAudience = targetAudience;
    if (description !== undefined) event.description = String(description||'').trim();
    if (startDate !== undefined) event.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) event.endDate = endDate ? new Date(endDate) : null;
    if (subPrograms !== undefined && Array.isArray(subPrograms)) {
      event.subPrograms = subPrograms.filter(sp=>sp&&(sp.name||sp._id)).map(sp=>({_id:sp._id,name:String(sp.name).trim(),isGroup:Boolean(sp.isGroup),maxParticipants:Number(sp.maxParticipants)||0,description:String(sp.description||'').trim()}));
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
    const events = await EventProgram.find({ isRegistrationOpen: true });
    const eligible = events.filter(e => matchesAudience(e.targetAudience, req.user));
    res.json({ events: eligible });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.register = async (req, res) => {
  try {
    const { eventId, subProgramId, subProgramName, participantName, contactNumber, isGroup, leadName, otherParticipants } = req.body;
    const event = await EventProgram.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.isRegistrationOpen) return res.status(403).json({ message: 'Registration is closed for this event' });
    if (!matchesAudience(event.targetAudience, req.user)) return res.status(403).json({ message: 'Not eligible for this event' });
    const sub = event.subPrograms.id(subProgramId) || event.subPrograms.find(s => s.name === subProgramName);
    if (!sub) return res.status(400).json({ message: 'Invalid sub-program' });
    const user = req.user;
    const name = String(participantName || (user && user.fullName) || '').trim();
    if (!name) return res.status(400).json({ message: 'Participant name is required' });
    let attempts = 0, saved = null;
    while (!saved && attempts < 5) {
      attempts++;
      const chestNumber = await EventRegistration.nextChestNumber('EVT');
      try {
        saved = await EventRegistration.create({
          event: event._id,
          subProgram: sub._id,
          subProgramName: sub.name,
          member: cleanUserId(user && user._id),
          membershipId: user && user.membershipId ? user.membershipId : '',
          participantName: name,
          contactNumber: String(contactNumber || (user && user.phoneNumber) || '').trim(),
          isGroup: Boolean(isGroup || sub.isGroup),
          leadName: String(leadName || name).trim(),
          otherParticipants: Array.isArray(otherParticipants) ? otherParticipants.filter(p=>p&&p.name).map(p=>({name:String(p.name).trim(),membershipId:String(p.membershipId||'').trim(),phoneNumber:String(p.phoneNumber||'').trim()})) : [],
          chestNumber,
        });
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
    const filter = or.length > 0 ? { '': or } : {};
    const regs = await EventRegistration.find(filter).populate('event', 'name targetAudience').sort({ createdAt: -1 });
    res.json({ registrations: regs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.listRegistrations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventId) filter.event = req.query.eventId;
    const regs = await EventRegistration.find(filter).populate('event', 'name').sort({ createdAt: 1 });
    res.json({ registrations: regs });
  } catch (err) { res.status(500).json({ message: err.message }); }
};
