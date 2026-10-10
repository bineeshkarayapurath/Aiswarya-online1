const UpcomingEvent = require('../models/UpcomingEvent');
const publicCache = require('../services/publicCache');

const CATEGORIES = ['Sports', 'Cultural', 'Other'];

// The home page reads events inside the cached /public/catalog payload, so every
// write here must drop that cache or an officer would add an event and not see
// it on the website until the short TTL happened to lapse.
function invalidatePublicEvents() {
  publicCache.invalidate('catalog');
}

// Parse a date from the many shapes a browser or an API client can send:
//   "2026-10-10"            (an <input type="date"> value)
//   "2026-10-10T00:00:00Z"  (an ISO string from a previous read)
//   1735689600000           (a millisecond timestamp)
//   a Date instance         (already parsed)
// Returns a valid Date, or null when the value is empty/unparseable, so the
// caller can answer with a clear 400 instead of a bare Mongoose CastError.
function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Build a patch from only the fields actually present, so a PUT that omits a
// field never blanks it out by accident.
function pickFields(body = {}) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title || '').trim();
  if (body.date !== undefined) out.date = parseDate(body.date);
  if (body.time !== undefined) out.time = String(body.time || '').trim();
  if (body.category !== undefined) {
    out.category = CATEGORIES.includes(body.category) ? body.category : 'Other';
  }
  if (body.venue !== undefined) out.venue = String(body.venue || '').trim();
  if (body.description !== undefined) out.description = String(body.description || '').trim();
  // Poster: the client uploads the file through POST /api/upload and sends back
  // the resulting public URL. Accept a couple of common aliases, always store a
  // trimmed string, and refuse a pasted data: URL (it would blow past the JSON
  // body limit and was never the intended path).
  const posterRaw = body.posterUrl !== undefined ? body.posterUrl : body.poster;
  if (posterRaw !== undefined) {
    const poster = String(posterRaw || '').trim();
    if (poster.startsWith('data:')) {
      const err = new Error('Upload the poster image instead of pasting image data');
      err.status = 400;
      throw err;
    }
    out.posterUrl = poster;
  }
  if (body.isPublished !== undefined) out.isPublished = Boolean(body.isPublished);
  return out;
}

// Trim what we log: a poster URL is fine, but never dump a whole request body
// full of image data into the logs.
function safeBody(body = {}) {
  const clone = { ...body };
  if (typeof clone.posterUrl === 'string' && clone.posterUrl.length > 120) {
    clone.posterUrl = `${clone.posterUrl.slice(0, 120)}… (${clone.posterUrl.length} chars)`;
  }
  if (typeof clone.poster === 'string' && clone.poster.length > 120) {
    clone.poster = `${clone.poster.slice(0, 120)}… (${clone.poster.length} chars)`;
  }
  return clone;
}

// One place that logs the real cause (with the request context) and answers the
// client with a usable message. Before this, every failure returned a bare
// err.message with nothing written to the server logs, so a reported "Save
// failed" left no trace of what actually went wrong.
function fail(res, err, scope, req) {
  console.error(
    `[upcoming-events] ${scope} failed: ${err.name || 'Error'}: ${err.message}`
  );
  console.error(
    '[upcoming-events] context:',
    JSON.stringify({
      method: req.method,
      url: req.originalUrl,
      userId: req.user ? String(req.user._id) : null,
      body: safeBody(req.body),
    })
  );
  if (err.stack) console.error(err.stack);

  if (res.headersSent) return undefined;

  if (err.name === 'ValidationError') {
    const message =
      Object.values(err.errors || {})
        .map((e) => e.message)
        .join('; ') || 'Invalid event data';
    return res.status(400).json({ message, detail: message });
  }
  if (err.name === 'CastError') {
    const message = `Invalid value for "${err.path}"`;
    return res.status(400).json({ message, detail: err.message });
  }
  // An explicit status (e.g. the data-URL guard above) is honoured; anything
  // else is a genuine 500 and its message is returned so the officer sees the
  // real reason instead of a generic "Save failed".
  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    message: err.message || 'Could not save the event',
    detail: err.message || '',
  });
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
    return fail(res, err, 'list', req);
  }
};

exports.create = async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.title) return res.status(400).json({ message: 'Event title is required' });
    if (!data.date) {
      return res.status(400).json({
        message: 'A valid event date is required (use the date picker, e.g. 2026-10-10)',
      });
    }
    const event = await UpcomingEvent.create({
      ...data,
      createdBy: req.user ? req.user._id : null,
    });
    invalidatePublicEvents();
    return res.status(201).json({ event });
  } catch (err) {
    return fail(res, err, 'create', req);
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
      return res
        .status(400)
        .json({ message: 'A valid event date is required (use the date picker, e.g. 2026-10-10)' });
    }
    Object.assign(event, data);
    await event.save();
    invalidatePublicEvents();
    return res.json({ event });
  } catch (err) {
    return fail(res, err, 'update', req);
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
    return fail(res, err, 'remove', req);
  }
};
