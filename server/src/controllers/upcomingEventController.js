const UpcomingEvent = require('../models/UpcomingEvent');
const publicCache = require('../services/publicCache');

const CATEGORIES = ['Sports', 'Cultural', 'Other'];

// The home page reads events inside the cached /public/catalog payload, so every
// write here must drop that cache or an officer would add an event and not see
// it on the website until the short TTL happened to lapse.
function invalidatePublicEvents() {
  publicCache.invalidate('catalog');
}

// Build a patch from only the fields actually present, so a PUT that omits a
// field never blanks it out by accident.
function pickFields(body = {}) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title || '').trim();
  if (body.date !== undefined) {
    const d = body.date ? new Date(body.date) : null;
    out.date = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (body.time !== undefined) out.time = String(body.time || '').trim();
  if (body.category !== undefined) {
    out.category = CATEGORIES.includes(body.category) ? body.category : 'Other';
  }
  if (body.venue !== undefined) out.venue = String(body.venue || '').trim();
  if (body.description !== undefined) out.description = String(body.description || '').trim();
  if (body.posterUrl !== undefined) out.posterUrl = String(body.posterUrl || '').trim();
  if (body.isPublished !== undefined) out.isPublished = Boolean(body.isPublished);
  return out;
}

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.publishedOnly === 'true') filter.isPublished = true;
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 100, 200);
    const events = await UpcomingEvent.find(filter).sort({ date: 1, createdAt: -1 }).limit(limit);
    return res.json({ events });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.title) return res.status(400).json({ message: 'Event title is required' });
    if (!data.date) return res.status(400).json({ message: 'A valid event date is required' });
    const event = await UpcomingEvent.create({
      ...data,
      createdBy: req.user ? req.user._id : null,
    });
    invalidatePublicEvents();
    return res.status(201).json({ event });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const event = await UpcomingEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const data = pickFields(req.body);
    if (data.title !== undefined && !data.title) {
      return res.status(400).json({ message: 'Event title is required' });
    }
    if (data.date !== undefined && !data.date) {
      return res.status(400).json({ message: 'A valid event date is required' });
    }
    Object.assign(event, data);
    await event.save();
    invalidatePublicEvents();
    return res.json({ event });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const event = await UpcomingEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    await event.deleteOne();
    invalidatePublicEvents();
    return res.json({ message: 'Event deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
