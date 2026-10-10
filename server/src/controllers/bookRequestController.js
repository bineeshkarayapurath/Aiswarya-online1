const BookRequest = require('../models/BookRequest');

const STATUSES = ['Pending', 'Approved', 'Procured'];

// The public/member view of a request. The list is a shared noticeboard, so the
// requester is shown as a name (never a contact detail) and internal fields are
// trimmed away.
function toPublic(doc) {
  return {
    id: doc._id,
    bookTitle: doc.bookTitle,
    author: doc.author || '',
    language: doc.language || '',
    notes: doc.notes || '',
    memberName: doc.memberName || '',
    membershipId: doc.membershipId || '',
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Live list shown to everyone: newest first, with an optional case-insensitive
// search so a member can quickly check whether their title is already there.
exports.listPublic = async (req, res) => {
  try {
    const filter = {};
    const q = String(req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ bookTitle: rx }, { author: rx }];
    }
    const requests = await BookRequest.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.json({ requests: requests.map(toPublic) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

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
    const bookTitle = String(req.body.bookTitle || '').trim();
    if (!bookTitle) return res.status(400).json({ message: 'Please enter the book title' });

    const request = await BookRequest.create({
      bookTitle,
      author: String(req.body.author || '').trim(),
      language: String(req.body.language || '').trim(),
      notes: String(req.body.notes || '').trim(),
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

/* ------------------------------- Admin ------------------------------- */

exports.listAll = async (req, res) => {
  try {
    const filter = {};
    const status = String(req.query.status || '').trim();
    if (STATUSES.includes(status)) filter.status = status;
    const q = String(req.query.q || '').trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ bookTitle: rx }, { author: rx }, { memberName: rx }, { membershipId: rx }];
    }
    const requests = await BookRequest.find(filter).sort({ createdAt: -1 }).limit(1000);

    const counts = { Pending: 0, Approved: 0, Procured: 0 };
    for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;

    return res.json({ requests: requests.map(toPublic), counts, total: requests.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
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
    const request = await BookRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    await request.deleteOne();
    return res.json({ message: 'Request deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
