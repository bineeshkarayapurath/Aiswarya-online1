const config = require('../config/constants');
const User = require('../models/User');
const CommunityService = require('../models/CommunityService');
const { publicUrl } = require('../utils/storage');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function eventSummary(e) {
  const totalCollected = Math.round((e.collections || []).reduce((s, c) => s + (c.amount || 0), 0) * 100) / 100;
  const totalSpent = Math.round((e.expenses || []).reduce((s, x) => s + (x.amount || 0), 0) * 100) / 100;
  return {
    totalCollected,
    totalSpent,
    balance: Math.round((totalCollected - totalSpent) * 100) / 100,
    collectionCount: (e.collections || []).length,
    expenseCount: (e.expenses || []).length,
    photoCount: (e.photos || []).length,
  };
}

function toView(e) {
  const o = e.toObject ? e.toObject() : e;
  return {
    ...o,
    _id: String(o._id),
    eventDate: o.eventDate ? new Date(o.eventDate).toISOString() : null,
    photos: (o.photos || []).map((p) => publicUrl(p)),
  };
}

exports.searchMembers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { status: config.STATUS.APPROVED, membershipId: { $ne: '' } };
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ membershipId: rx }, { phoneNumber: rx }, { fullName: rx }];
    }
    const users = await User.find(filter)
      .select('membershipId fullName phoneNumber')
      .limit(15)
      .sort({ membershipId: 1 });
    const members = users
      .filter((u) => u.membershipId)
      .map((u) => ({ membershipId: u.membershipId, fullName: u.fullName, phoneNumber: u.phoneNumber }));
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, category, coordinator, eventDate, description, status } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!['Wedding', 'Funeral Support', 'Medical Assistance', 'General Charity'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    let coord = { memberId: '', name: '', phone: '' };
    if (coordinator) {
      const c = typeof coordinator === 'string' ? JSON.parse(coordinator) : coordinator;
      if (c.memberId) {
        const member = await User.findOne({ membershipId: c.memberId, status: config.STATUS.APPROVED });
        if (member) {
          coord = { memberId: member.membershipId, name: member.fullName, phone: member.phoneNumber };
        } else if (c.name) {
          coord = { memberId: '', name: c.name, phone: c.phone || '' };
        }
      } else if (c.name) {
        coord = { memberId: '', name: c.name, phone: c.phone || '' };
      }
    }

    // Handle file uploads via multer
    let photos = [];
    const files = req.files || [];
    if (files.length) {
      photos = files.map((f) => `photos/${f.filename}`);
    }

    const event = await CommunityService.create({
      title: String(title).trim(),
      category,
      coordinator: coord,
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      description: String(description || '').trim(),
      photos,
      status: status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: 'Initiative created', event: toView(event) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listEvents = async (req, res) => {
  try {
    const { status, category, q } = req.query;
    const filter = {};
    if (['ACTIVE', 'COMPLETED'].includes(status)) filter.status = status;
    if (['Wedding', 'Funeral Support', 'Medical Assistance', 'General Charity'].includes(category)) {
      filter.category = category;
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
      filter.$or = [
        { title: rx },
        { 'coordinator.name': rx },
        { 'coordinator.memberId': rx },
        { description: rx },
      ];
    }

    const events = await CommunityService.find(filter).sort({ eventDate: -1 }).lean();

    const summary = { activeCount: 0, completedCount: 0, totalCollected: 0, totalSpent: 0 };
    const viewEvents = events.map((e) => {
      const s = eventSummary(e);
      if (e.status === 'ACTIVE') summary.activeCount++;
      else summary.completedCount++;
      summary.totalCollected += s.totalCollected;
      summary.totalSpent += s.totalSpent;
      return {
        ...s,
        _id: String(e._id),
        title: e.title,
        category: e.category,
        coordinator: e.coordinator,
        eventDate: e.eventDate ? new Date(e.eventDate).toISOString() : null,
        status: e.status,
        createdAt: e.createdAt,
      };
    });

    return res.json({ events: viewEvents, summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getEvent = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const v = toView(event);
    const s = eventSummary(event);
    return res.json({ event: { ...v, ...s } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { title, category, coordinator, eventDate, description, status } = req.body;
    if (title) event.title = String(title).trim();
    if (category && ['Wedding', 'Funeral Support', 'Medical Assistance', 'General Charity'].includes(category)) {
      event.category = category;
    }
    if (eventDate) event.eventDate = new Date(eventDate);
    if (description !== undefined) event.description = String(description).trim();
    if (status && ['ACTIVE', 'COMPLETED'].includes(status)) event.status = status;

    if (coordinator) {
      const c = typeof coordinator === 'string' ? JSON.parse(coordinator) : coordinator;
      if (c.memberId) {
        const member = await User.findOne({ membershipId: c.memberId, status: config.STATUS.APPROVED });
        if (member) {
          event.coordinator = { memberId: member.membershipId, name: member.fullName, phone: member.phoneNumber };
        } else if (c.name) {
          event.coordinator = { memberId: '', name: c.name, phone: c.phone || '' };
        }
      } else if (c.name) {
        event.coordinator = { memberId: '', name: c.name, phone: c.phone || '' };
      }
    }

    await event.save();
    const v = toView(event);
    const s = eventSummary(event);
    return res.json({ message: 'Event updated', event: { ...v, ...s } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.addCollection = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { memberId, memberName, amount, date } = req.body;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }

    let name = String(memberName || '').trim();
    let phone = '';
    let mid = String(memberId || '').trim();

    if (mid) {
      const member = await User.findOne({ membershipId: mid, status: config.STATUS.APPROVED });
      if (member) {
        name = member.fullName;
        phone = member.phoneNumber;
      }
    }
    if (!name) {
      return res.status(400).json({ message: 'Donor name is required' });
    }

    event.collections.push({
      memberId: mid,
      memberName: name,
      amount: Math.round(amt * 100) / 100,
      date: date ? new Date(date) : new Date(),
    });
    await event.save();

    const s = eventSummary(event);
    const added = event.collections[event.collections.length - 1];
    return res.status(201).json({
      message: 'Collection recorded',
      collection: { _id: String(added._id), memberId: added.memberId, memberName: added.memberName, amount: added.amount, date: added.date },
      ...s,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.removeCollection = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    event.collections = event.collections.filter((c) => String(c._id) !== req.params.collId);
    await event.save();
    const s = eventSummary(event);
    return res.json({ message: 'Collection removed', ...s });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const { itemOrPurpose, amount, type, remarks } = req.body;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }
    if (!itemOrPurpose || !String(itemOrPurpose).trim()) {
      return res.status(400).json({ message: 'Item / purpose is required' });
    }
    if (type && !['CASH_GIFT', 'PURCHASE'].includes(type)) {
      return res.status(400).json({ message: 'type must be CASH_GIFT or PURCHASE' });
    }

    event.expenses.push({
      itemOrPurpose: String(itemOrPurpose).trim(),
      amount: Math.round(amt * 100) / 100,
      type: type || 'CASH_GIFT',
      remarks: String(remarks || '').trim(),
    });
    await event.save();

    const s = eventSummary(event);
    const added = event.expenses[event.expenses.length - 1];
    return res.status(201).json({
      message: 'Expense recorded',
      expense: { _id: String(added._id), ...added.toObject() },
      ...s,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.removeExpense = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    event.expenses = event.expenses.filter((e) => String(e._id) !== req.params.expId);
    await event.save();
    const s = eventSummary(event);
    return res.json({ message: 'Expense removed', ...s });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.addPhotos = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const newPhotos = [];

    // File uploads via multer
    const files = req.files || [];
    if (files.length) {
      newPhotos.push(...files.map((f) => `photos/${f.filename}`));
    }

    // External / local upload URLs from body (POST /api/upload result)
    const rawUrls = req.body.photoUrls;
    if (rawUrls) {
      const parsed = Array.isArray(rawUrls)
        ? rawUrls
        : (() => {
            try { return JSON.parse(String(rawUrls)); }
            catch { return String(rawUrls).split(',').map((s) => s.trim()).filter(Boolean); }
          })();
      const urls = Array.isArray(parsed) ? parsed.filter((u) => /^(https?:\/\/|\/uploads\/)/i.test(String(u))) : [];
      newPhotos.push(...urls);
    }

    if (!newPhotos.length) {
      return res.status(400).json({ message: 'Upload at least one photo or provide a photo URL' });
    }

    event.photos.push(...newPhotos);
    await event.save();
    return res.json({
      message: `${newPhotos.length} photo(s) added`,
      photos: event.photos.map((p) => publicUrl(p)),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.removePhoto = async (req, res) => {
  try {
    const event = await CommunityService.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const idx = parseInt(req.params.idx, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= event.photos.length) {
      return res.status(400).json({ message: 'Invalid photo index' });
    }

    event.photos.splice(idx, 1);
    await event.save();
    return res.json({
      message: 'Photo removed',
      photos: event.photos.map((p) => publicUrl(p)),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
