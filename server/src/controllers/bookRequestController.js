const mongoose = require('mongoose');
const BookRequest = require('../models/BookRequest');
const BookRequestConfig = require('../models/BookRequestConfig');

const STATUSES = ['Pending', 'Approved', 'Procured'];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------------------------- Form configuration ---------------------------- */

async function getOrCreateConfig() {
  let doc = await BookRequestConfig.findOne({ key: 'default' });
  if (!doc) doc = await BookRequestConfig.create({ key: 'default' });
  return doc;
}

function activeFields(doc) {
  const fields = doc && Array.isArray(doc.fields) && doc.fields.length ? doc.fields : BookRequestConfig.DEFAULT_FIELDS;
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    placeholder: f.placeholder || '',
    required: !!f.required,
    type: f.type === 'textarea' ? 'textarea' : 'text',
  }));
}

function publicConfig(doc) {
  return {
    formTitle: (doc && doc.formTitle) || BookRequestConfig.DEFAULT_CONFIG.formTitle,
    formDescription: (doc && doc.formDescription) || BookRequestConfig.DEFAULT_CONFIG.formDescription,
    submitLabel: (doc && doc.submitLabel) || BookRequestConfig.DEFAULT_CONFIG.submitLabel,
    fields: activeFields(doc),
  };
}

// Normalise an admin-supplied field list: drop blanks, cap the count, guarantee
// unique ids, and constrain the type to the two we render.
function sanitizeFields(input) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw) continue;
    const label = String(raw.label || '').trim().slice(0, 120);
    if (!label) continue;
    let id =
      String(raw.id || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
      `field-${out.length + 1}`;
    while (seen.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    seen.add(id);
    out.push({
      id,
      label,
      placeholder: String(raw.placeholder || '').trim().slice(0, 200),
      required: Boolean(raw.required),
      type: raw.type === 'textarea' ? 'textarea' : 'text',
    });
    if (out.length >= BookRequestConfig.MAX_FIELDS) break;
  }
  return out;
}

/* ------------------------------ Serialisation ------------------------------ */

// A request's answers, falling back to the legacy fixed columns for records
// created before the form became configurable.
function answersFor(doc) {
  if (Array.isArray(doc.answers) && doc.answers.length) {
    return doc.answers
      .map((a) => ({ id: a.id || '', label: a.label || '', value: a.value || '' }))
      .filter((a) => a.value);
  }
  const legacy = [];
  if (doc.bookTitle) legacy.push({ id: 'bookTitle', label: 'Book Title', value: doc.bookTitle });
  if (doc.author) legacy.push({ id: 'author', label: 'Author Name', value: doc.author });
  if (doc.language) legacy.push({ id: 'language', label: 'Language', value: doc.language });
  if (doc.notes) legacy.push({ id: 'notes', label: 'Notes', value: doc.notes });
  return legacy;
}

// The public/member view of a request. The list is a shared noticeboard, so the
// requester is shown as a name (never a contact detail) and internal fields are
// trimmed away.
function toPublic(doc) {
  const answers = answersFor(doc);
  return {
    id: doc._id,
    answers,
    title: (answers[0] && answers[0].value) || doc.bookTitle || '',
    memberName: doc.memberName || '',
    membershipId: doc.membershipId || '',
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

/* -------------------------------- Public --------------------------------- */

exports.getConfig = async (req, res) => {
  try {
    const doc = await getOrCreateConfig();
    return res.json({ config: publicConfig(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Live list shown to everyone: newest first, with an optional case-insensitive
// search so a member can quickly check whether their title is already there.
exports.listPublic = async (req, res) => {
  try {
    const filter = {};
    const q = String(req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ searchText: rx }, { bookTitle: rx }, { author: rx }];
    }
    const requests = await BookRequest.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.json({ requests: requests.map(toPublic) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Member --------------------------------- */

// A member's own submissions, highlighted on the member dashboard.
exports.listMine = async (req, res) => {
  try {
    const requests = await BookRequest.find({ requestedBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ requests: requests.map(toPublic) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const fields = activeFields(config);
    const input = req.body && typeof req.body.values === 'object' && req.body.values ? req.body.values : {};

    const answers = [];
    for (const f of fields) {
      const value = String(input[f.id] ?? '').trim();
      if (f.required && !value) {
        return res.status(400).json({ message: `Please fill in "${f.label}"` });
      }
      if (value) answers.push({ id: f.id, label: f.label, value: value.slice(0, 2000) });
    }
    if (!answers.length) {
      return res.status(400).json({ message: 'Please fill in the form before submitting' });
    }

    const searchText = [...answers.map((a) => a.value), req.user.fullName || '', req.user.membershipId || '']
      .join(' ')
      .toLowerCase();

    const request = await BookRequest.create({
      answers,
      searchText,
      requestedBy: req.user._id,
      memberName: req.user.fullName || '',
      membershipId: req.user.membershipId || '',
      status: 'Pending',
    });
    return res.status(201).json({ request: toPublic(request) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// A member may withdraw their own request while it is still Pending, so a typo
// can be corrected without a trip to the committee.
exports.removeMine = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const request = await BookRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (String(request.requestedBy || '') !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only withdraw your own request' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending requests can be withdrawn' });
    }
    await request.deleteOne();
    return res.json({ message: 'Request withdrawn' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* -------------------------------- Admin ---------------------------------- */

// Admin: edit the shared form (title, description, submit label, input fields).
exports.updateConfig = async (req, res) => {
  try {
    const doc = await getOrCreateConfig();
    const body = req.body || {};
    if (body.formTitle !== undefined) {
      doc.formTitle =
        String(body.formTitle || '').trim().slice(0, 160) || BookRequestConfig.DEFAULT_CONFIG.formTitle;
    }
    if (body.formDescription !== undefined) {
      doc.formDescription = String(body.formDescription || '').trim().slice(0, 1000);
    }
    if (body.submitLabel !== undefined) {
      doc.submitLabel =
        String(body.submitLabel || '').trim().slice(0, 60) || BookRequestConfig.DEFAULT_CONFIG.submitLabel;
    }
    if (body.fields !== undefined) {
      const fields = sanitizeFields(body.fields);
      if (!fields.length) return res.status(400).json({ message: 'Add at least one input field' });
      doc.fields = fields;
    }
    await doc.save();
    return res.json({ message: 'Form settings saved', config: publicConfig(doc) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function buildFilter(query) {
  const filter = {};
  const status = String(query.status || '').trim();
  if (STATUSES.includes(status)) filter.status = status;
  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ searchText: rx }, { bookTitle: rx }, { author: rx }, { memberName: rx }, { membershipId: rx }];
  }
  return filter;
}

exports.listAll = async (req, res) => {
  try {
    const requests = await BookRequest.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(1000);
    const counts = { Pending: 0, Approved: 0, Procured: 0 };
    for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;
    return res.json({ requests: requests.map(toPublic), counts, total: requests.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Admin: download the (filtered) list as CSV. One column per currently-configured
// field, so the export matches the form an officer is looking at. Answers are
// matched by field id first, then by label, so a renamed field still lines up.
exports.exportCsv = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const fields = activeFields(config);
    const requests = await BookRequest.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(5000);

    const columns = [...fields.map((f) => f.label), 'Member', 'Membership ID', 'Date', 'Status'];
    const rows = requests.map((r) => {
      const answers = answersFor(r);
      const byId = new Map(answers.filter((a) => a.id).map((a) => [a.id, a.value]));
      const byLabel = new Map(answers.map((a) => [a.label, a.value]));
      const cells = fields.map((f) => byId.get(f.id) ?? byLabel.get(f.label) ?? '');
      return [
        ...cells,
        r.memberName || '',
        r.membershipId || '',
        r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
        r.status,
      ];
    });

    const csv = [columns, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="book-requests-${stamp}.csv"`);
    // BOM so Excel opens the Malayalam/UTF-8 text correctly.
    return res.send('\uFEFF' + csv);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    // Guard before touching status: if the ':id' slot ever receives a
    // non-ObjectId (e.g. the literal "config" leaking through an outdated router
    // that lacks the /config route), answer 404 rather than the misleading
    // "Invalid status" that made a routing problem look like bad payload data.
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const status = String((req.body && req.body.status) || '').trim();
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Expected one of: ${STATUSES.join(', ')}`,
      });
    }
    const request = await BookRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = status;
    await request.save();
    return res.json({ request: toPublic(request) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const request = await BookRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    await request.deleteOne();
    return res.json({ message: 'Request deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
