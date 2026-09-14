const config = require('../config/constants');
const User = require('../models/User');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const ProgramMinutes = require('../models/ProgramMinutes');

const POPULAR_BOOKS = [
  { id: 1, title: 'Enthu Kalath', author: 'D. Vinayachandran', category: 'Poetry', emoji: '📜' },
  { id: 2, title: 'Pathummayude Aadu', author: 'Vaikom Muhammad Basheer', category: 'Novel', emoji: '📖' },
  { id: 3, title: 'Randamoozham', author: 'M. T. Vasudevan Nair', category: 'Novel', emoji: '📚' },
  { id: 4, title: 'Aarachar', author: 'K. R. Meera', category: 'Novel', emoji: '🪔' },
  { id: 5, title: 'Khasakkinte Itihasam', author: 'O. V. Vijayan', category: 'Novel', emoji: '🌿' },
  { id: 6, title: 'Manushyanu Oru Aamukham', author: 'Sukumar Azhikode', category: 'Essays', emoji: '🧠' },
];

const EVENTS_EMOJI = {
  Main: '🏛️',
  'Vanitha Vedi': '🌸',
  'Bala Vedi': '🧒',
  Yuvatha: '⚡',
};

function eventEmoji(section) {
  return EVENTS_EMOJI[section] || '📢';
}

function emojiFor(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('poetry') || c.includes('kavitha')) return '📜';
  if (c.includes('novel') || c.includes('fiction') || c.includes('kadha')) return '📖';
  if (c.includes('essay') || c.includes('bio') || c.includes('life')) return '🧠';
  if (c.includes('children') || c.includes('bala')) return '🧒';
  if (c.includes('science')) return '🔬';
  if (c.includes('sports')) return '🏏';
  if (c.includes('art') || c.includes('music') || c.includes('kala')) return '🎭';
  return '📚';
}

exports.stats = async (req, res) => {
  const activeMembers = await User.countDocuments({
    role: config.ROLES.MEMBER,
    status: config.STATUS.APPROVED,
  });
  const pending = await User.countDocuments({ status: config.STATUS.PENDING });
  const bookCount = await Book.countDocuments();
  res.json({
    books: bookCount || POPULAR_BOOKS.length * 85,
    activeMembers,
    pendingApplications: pending,
    years: new Date().getFullYear() - 1985,
  });
};

exports.catalog = async (req, res) => {
  try {
    const { q, limit } = req.query;
    const query = {};

    // Live availability: stock numbers currently on loan (ISSUED or OVERDUE).
    const activeLoans = await BookIssue.find({
      status: { $in: [config.ISSUE_STATUS.ISSUED, config.ISSUE_STATUS.OVERDUE] },
    }).select('book.stockNumber dueDate');
    const loaned = new Map(activeLoans.map((l) => [l.book.stockNumber, l.dueDate]));

    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: rx }, { author: rx }, { stockNumber: rx }, { category: rx }];
    }

    // Default (no query) shows a small "popular" preview; a search returns the
    // full matching set so members can browse the whole catalogue.
    const effectiveLimit = Math.min(parseInt(limit || (q ? 60 : 8), 10), 120);
    const books = await Book.find(query).sort({ stockNumber: 1 }).limit(effectiveLimit);
    const mapped = books.map((b) => ({
      id: b._id,
      stockNumber: b.stockNumber,
      title: b.title,
      author: b.author || '—',
      category: b.category || 'General',
      emoji: emojiFor(b.category),
      available: !loaned.has(b.stockNumber),
      dueDate: loaned.get(b.stockNumber) || null,
    }));

    // Home Page events come ONLY from records explicitly approved by the
    // admin (status APPROVED) — no hardcoded or pending items are published.
    const events = await ProgramMinutes.find({ status: config.STATUS.APPROVED })
      .sort({ date: -1 })
      .limit(6);
    const mappedEvents = events.map((e) => ({
      id: e._id,
      type: e.section,
      title: e.title,
      date: e.date ? new Date(e.date).toISOString().slice(0, 10) : null,
      place: config.CLUB.place,
      emoji: eventEmoji(e.section),
    }));

    return res.json({ books: mapped.length ? mapped : POPULAR_BOOKS, events: mappedEvents });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};