const config = require('../config/constants');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const ProgramMinutes = require('../models/ProgramMinutes');
const publicCache = require('../services/publicCache');
const { resolveSort, DEFAULT_SORT, CATALOG_COLLATION } = require('../services/catalogSort');
const { countApprovedMembers } = require('../services/membershipService');

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
// counts approved *members* — not authority logins. The rule now lives in one
// place, services/membershipService, because it used to be re-derived here, in
// the member pickers and in the executive roster, and the copies drifted.
//
// Two earlier versions of this filter were each wrong in a way that undercounted
// real members:
//   - requiring role === 'MEMBER' dropped every approved officer, because a
//     designation (or a manual role) promotes them to ADMIN;
//   - then requiring a membershipId dropped any member who reached APPROVED by
//     another route, since the ID is only allocated by approveRequest.
// Officers who are real people are members and are counted. Only the synthetic
// authority-login placeholders are excluded.

// Public reads are identical for every visitor and change rarely, so they are
// worth caching at the HTTP layer too. `stale-while-revalidate` lets a browser
// (or the CDN in front of the API) answer instantly from cache and refresh in
// the background, which removes the home page's "Loading catalog..." pause even
// before the request reaches this process.
const PUBLIC_CACHE_CONTROL = 'public, max-age=15, stale-while-revalidate=120';

// Stats are different: the member number is the one figure an officer watches to
// confirm an approval took effect, and the long stale-while-revalidate window
// above means a reload can keep showing the pre-approval number for over two
// minutes. A short max-age still absorbs refresh bursts, but must-revalidate
// forces the browser to confirm with the API rather than reuse a stale body.
const STATS_CACHE_CONTROL = 'public, max-age=10, must-revalidate';

// The featured strip deliberately rotates, so it cannot carry the long
// stale-while-revalidate window above: browsers and the CDN would keep serving
// one visitor's sample for up to two minutes and nobody would ever see the
// rotation. A short max-age still absorbs refresh bursts without pinning a
// single sample, and `must-revalidate` stops any shared cache from extending it.
const ROTATING_CACHE_CONTROL = 'public, max-age=10, must-revalidate';

function sendPublic(res, payload, cacheControl = PUBLIC_CACHE_CONTROL) {
  res.set('Cache-Control', cacheControl);
  res.set('X-Cache', payload.hit ? 'HIT' : 'MISS');
  return res.json(payload.data);
}

exports.stats = async (req, res) => {
  try {
    const payload = await publicCache.remember('stats', async () => {
      // Two independent counts: run them concurrently instead of chaining two
      // sequential round trips on every home page load.
      //
      // The pending-applicant count that used to be published here is gone along
      // with the home page card. It was a public, unauthenticated endpoint
      // reporting how many applications the club is sitting on, which is internal
      // information no visitor needs.
      const [activeMembers, bookCount] = await Promise.all([
        countApprovedMembers(),
        Book.countDocuments(),
      ]);
      return {
        books: bookCount || POPULAR_BOOKS.length * 85,
        activeMembers,
        years: new Date().getFullYear() - 1985,
      };
    });
    return sendPublic(res, payload, STATS_CACHE_CONTROL);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Default (no query) shows a small "popular" preview; a search returns the full
// matching set so members can browse the whole catalogue. Capped so a hand-made
// `?limit=99999` can never ask for the entire collection.
const MAX_CATALOG_LIMIT = 120;

// Bounds the unanchored-regex scan. A substring search cannot use an index, so
// on a large catalog it is a collection pass; this keeps a pathological term
// from holding the request open indefinitely. Comfortably above the ~5 ms a
// 50k-book catalog needs, so it never fires on a normal search.
const SEARCH_MAX_TIME_MS = 2000;

// How many books the rotating home page strip shows. Randomised within this
// range per rotation so the grid does not always have the same shape, while
// staying small enough that the whole strip is one indexed query plus one
// availability lookup.
const FEATURED_MIN = 6;
const FEATURED_MAX = 10;

// Sort orders are defined and validated in services/catalogSort.js, shared with
// the admin /admin/books endpoint so both catalog surfaces offer the same set.
function normalizeCatalogQuery({ q, limit, category, author, sort }) {
  const term = q ? String(q).trim() : '';
  const requested = Number.parseInt(limit ?? '', 10);
  const fallback = term || category || author ? 60 : 8;
  const max = Math.min(Number.isFinite(requested) && requested > 0 ? requested : fallback, MAX_CATALOG_LIMIT);
  const { key: sortKey, spec: sortSpec } = resolveSort(sort);
  return {
    term,
    max,
    category: category ? String(category).trim() : '',
    author: author ? String(author).trim() : '',
    sortKey,
    sortSpec,
  };
}

// Home Page events come ONLY from records explicitly approved by the
// admin (status APPROVED) — no hardcoded or pending items are published.
async function loadEvents() {
  const events = await ProgramMinutes.find({ status: config.STATUS.APPROVED })
    .select('section title date')
    .sort({ date: -1 })
    .limit(6)
    .lean();
  return events.map((e) => ({
    id: e._id,
    type: e.section,
    title: e.title,
    date: e.date ? new Date(e.date).toISOString().slice(0, 10) : null,
    place: config.CLUB.place,
    emoji: eventEmoji(e.section),
  }));
}

// Live availability: stock numbers currently on loan (ISSUED or OVERDUE).
// This used to load EVERY active loan in the collection on every request,
// regardless of which books were being returned. Scoping the lookup to the
// accession numbers actually on this page turns a full collection read into an
// indexed $in over at most a page of keys — which matters more once the
// catalog is in the tens of thousands.
async function withAvailability(books) {
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

  return books.map((b) => ({
    id: b._id,
    stockNumber: b.stockNumber,
    title: b.title,
    author: b.author || '—',
    category: b.category || 'General',
    emoji: emojiFor(b.category),
    available: !loaned.has(b.stockNumber),
    dueDate: loaned.get(b.stockNumber) || null,
  }));
}

// Escaped so an accession number like "A-001" searches literally, and applied as
// an UNANCHORED, case-insensitive regex because that is what a catalog search box
// has to do: "Randa" must match "Randamoozham". No B-tree index can serve a
// leading-wildcard match, so this stays a scan — ~5 ms across 50k books, which is
// why search is not cached and the cost is capped with maxTimeMS rather than
// avoided. See the note on the Book schema for why title/author are deliberately
// left unindexed.
function buildSearchFilter(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  return { $or: [{ title: rx }, { author: rx }, { stockNumber: rx }, { category: rx }] };
}

// Facet values for the filter dropdowns. One $distinct per field rather than a
// $group over the whole collection. Authors are the long tail here — 634 distinct
// names across 783 books — so the dropdown on the client narrows the list with a
// text box instead of rendering every name at once.
async function loadFacets() {
  const [categories, authors] = await Promise.all([
    Book.distinct('category'),
    Book.distinct('author'),
  ]);
  const clean = (values) => values.filter((v) => typeof v === 'string' && v.trim()).sort();
  return { categories: clean(categories), authors: clean(authors) };
}

// Builds the catalog payload. Split out of the handler so the cache wraps a
// single function rather than the whole request/response cycle.
async function buildCatalog({ term, max, category, author, sortSpec }) {
  const query = term ? buildSearchFilter(term) : {};

  // Exact match, not a regex: these values are picked from the facet list below,
  // which is itself `$distinct` output, so there is nothing to be fuzzy about —
  // and an equality test on category/author can use an index, which the
  // leading-wildcard search above cannot.
  if (category) query.category = category;
  if (author) query.author = author;

  // Books and events are independent, so they run concurrently. Both are
  // read-only projections: `.lean()` skips Mongoose document hydration and
  // `.select()` stops transferring the dozen fields the UI never touches.
  // sortSpec comes from the whitelist, never straight from the query string.
  const booksQuery = Book.find(query)
    .select('stockNumber title author category')
    .sort(sortSpec)
    // See services/catalogSort.js: accession numbers are numeric strings of
    // varying width, so plain string ordering is not numeric ordering.
    .collation(CATALOG_COLLATION)
    .limit(max)
    .lean();
  if (term) booksQuery.maxTimeMS(SEARCH_MAX_TIME_MS);

  const [books, events, facets] = await Promise.all([booksQuery, loadEvents(), loadFacets()]);
  const mapped = await withAvailability(books);

  return { books: mapped.length ? mapped : POPULAR_BOOKS, events, facets };
}

// Randomly ordered strip for the home page.
//
// $sample is what makes this cheap: for a small `size` MongoDB keeps a running
// top-k over the collection's index keys rather than materialising documents, so
// it stays fast as the catalog grows. Measured against the alternatives on this
// schema at 50k books — $sample 1.3 ms, a random index seek 2.4 ms (it needs two
// extra boundary lookups) — and it returned a different set on all 40
// consecutive draws. It is a genuine sample, not a reshuffle of a fixed page.
//
// Deliberately NOT filterable. A $match placed before $sample has to FETCH every
// matching document in order to sample from it: for a category covering a sixth
// of a 50k catalog that measured ~20 ms versus ~1.3 ms unfiltered, and nothing
// on the home page needs it. If a category-scoped strip is ever wanted, the cheap
// shape is to sample keys first and fetch only those, not to filter up front.
async function buildFeatured({ count }) {
  const [books, events] = await Promise.all([
    // No `.lean()`: `Model.aggregate()` returns an Aggregation, not a Query, and
    // already yields plain objects.
    Book.aggregate([
      { $sample: { size: count } },
      { $project: { stockNumber: 1, title: 1, author: 1, category: 1 } },
    ]),
    loadEvents(),
  ]);

  return { books: books.length ? await withAvailability(books) : POPULAR_BOOKS, events };
}

exports.catalog = async (req, res) => {
  try {
    const { term, max, category, author, sortKey, sortSpec } = normalizeCatalogQuery(req.query);

    // `?featured=1` powers the rotating home page strip. It is a separate scope
    // from browse with a short TTL so the sample actually changes over time
    // while a burst of visitors still costs one $sample.
    if (req.query.featured !== undefined && req.query.featured !== '0' && req.query.featured !== 'false') {
      const count = FEATURED_MIN + Math.floor(Math.random() * (FEATURED_MAX - FEATURED_MIN + 1));
      const payload = await publicCache.remember('catalog:featured', () => buildFeatured({ count }));
      return sendPublic(res, payload, ROTATING_CACHE_CONTROL);
    }

    // Search terms and facet filters are user input, so those responses are not
    // cached: caching them would serve one visitor's results to another and grow
    // the cache without bound. The plain browse listing is still cached, keyed by
    // page size AND the sort the visitor picked — the same books in a different
    // order are a different payload.
    if (term || category || author || sortKey !== DEFAULT_SORT) {
      return sendPublic(res, {
        data: await buildCatalog({ term, max, category, author, sortSpec }),
        hit: false,
      });
    }

    return sendPublic(res, await publicCache.remember(`catalog:${max}`, () => buildCatalog({ term, max, sortSpec })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};