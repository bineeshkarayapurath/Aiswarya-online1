const config = require('../config/constants');
const User = require('../models/User');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const ProgramMinutes = require('../models/ProgramMinutes');
const publicCache = require('../services/publicCache');

const ACTIVE_ISSUE_STATUSES = [config.ISSUE_STATUS.ISSUED, config.ISSUE_STATUS.OVERDUE];

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

// "Total Approved Members" / "Active Members" is the club's member roll, so it
// counts approved *members* — not authority logins.
//
// The previous filter also required role === 'MEMBER', which silently dropped
// every approved officer: giving someone a designation (or a manual role) moves
// them to ADMIN via syncDesignationRole, so a Treasurer or President vanished
// from the total while still appearing in the Approved Members list. Approval
// status alone decides membership, so the role must not.
//
// Requiring a membership ID is what separates real members from authority
// login accounts, which adminLoginVerify auto-provisions with a phone number
// as the name and no membership ID. approveRequest always allocates one, and
// nextMembershipId() and the member pickers already use the same guard.
const APPROVED_MEMBER_FILTER = {
  status: config.STATUS.APPROVED,
  membershipId: { $exists: true, $nin: ['', null] },
};

// Public reads are identical for every visitor and change rarely, so they are
// worth caching at the HTTP layer too. `stale-while-revalidate` lets a browser
// (or the CDN in front of the API) answer instantly from cache and refresh in
// the background, which removes the home page's "Loading catalog..." pause even
// before the request reaches this process.
const PUBLIC_CACHE_CONTROL = 'public, max-age=15, stale-while-revalidate=120';

function sendPublic(res, payload) {
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  res.set('X-Cache', payload.hit ? 'HIT' : 'MISS');
  return res.json(payload.data);
}

exports.stats = async (req, res) => {
  try {
    const payload = await publicCache.remember('stats', async () => {
      // Three independent counts: run them concurrently instead of chaining
      // three sequential round trips on every home page load.
      const [activeMembers, pending, bookCount] = await Promise.all([
        User.countDocuments(APPROVED_MEMBER_FILTER),
        User.countDocuments({ status: config.STATUS.PENDING }),
        Book.countDocuments(),
      ]);
      return {
        books: bookCount || POPULAR_BOOKS.length * 85,
        activeMembers,
        pendingApplications: pending,
        years: new Date().getFullYear() - 1985,
      };
    });
    return sendPublic(res, payload);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Default (no query) shows a small "popular" preview; a search returns the full
// matching set so members can browse the whole catalogue. Capped so a hand-made
// `?limit=99999` can never ask for the entire collection.
const MAX_CATALOG_LIMIT = 120;

function normalizeCatalogQuery({ q, limit }) {
  const term = q ? String(q).trim() : '';
  const requested = Number.parseInt(limit ?? '', 10);
  const fallback = term ? 60 : 8;
  const max = Math.min(Number.isFinite(requested) && requested > 0 ? requested : fallback, MAX_CATALOG_LIMIT);
  return { term, max };
}

// Builds the catalog payload. Split out of the handler so the cache wraps a
// single function rather than the whole request/response cycle.
async function buildCatalog({ term, max }) {
  const query = {};

  if (term) {
    // Escaped so an accession number like "A-001" searches literally. This is a
    // substring match, which cannot use an index — it is why browse requests
    // (index-backed) are the ones worth caching.
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: rx }, { author: rx }, { stockNumber: rx }, { category: rx }];
  }

  // Books and events are independent, so they run concurrently. Both are
  // read-only projections: `.lean()` skips Mongoose document hydration and
  // `.select()` stops transferring the dozen fields the UI never touches.
  // The sort is already index-backed via Book's unique stockNumber index.
  const [books, events] = await Promise.all([
    Book.find(query)
      .select('stockNumber title author category')
      .sort({ stockNumber: 1 })
      .limit(max)
      .lean(),
    ProgramMinutes.find({ status: config.STATUS.APPROVED })
      .select('section title date')
      .sort({ date: -1 })
      .limit(6)
      .lean(),
  ]);

  // Live availability: stock numbers currently on loan (ISSUED or OVERDUE).
  // This used to load EVERY active loan in the collection on every request,
  // regardless of which books were being returned. Scoping the lookup to the
  // accession numbers actually on this page turns a full collection read into
  // an indexed $in over at most `max` keys.
  const stockNumbers = books.map((b) => b.stockNumber);
  const activeLoans = stockNumbers.length
    ? await BookIssue.find({
        'book.stockNumber': { $in: stockNumbers },
        status: { $in: ACTIVE_ISSUE_STATUSES },
      })
        .select('book.stockNumber dueDate')
        .lean()
    : [];
  const loaned = new Map(activeLoans.map((l) => [l.book.stockNumber, l.dueDate]));

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
  const mappedEvents = events.map((e) => ({
    id: e._id,
    type: e.section,
    title: e.title,
    date: e.date ? new Date(e.date).toISOString().slice(0, 10) : null,
    place: config.CLUB.place,
    emoji: eventEmoji(e.section),
  }));

  return { books: mapped.length ? mapped : POPULAR_BOOKS, events: mappedEvents };
}

exports.catalog = async (req, res) => {
  try {
    const { term, max } = normalizeCatalogQuery(req.query);

    // Only unfiltered browse views are cached, keyed by page size. Search terms
    // are user input, so caching them would serve one visitor's results to
    // another and grow the cache without bound.
    if (term) {
      return sendPublic(res, { data: await buildCatalog({ term, max }), hit: false });
    }

    return sendPublic(res, await publicCache.remember(`catalog:${max}`, () => buildCatalog({ term, max })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};