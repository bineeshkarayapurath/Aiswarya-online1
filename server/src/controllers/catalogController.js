const XLSX = require('xlsx');
const Book = require('../models/Book');

// Accession numbers are normalised (trim + uppercase) so "a-012" and "A-012"
// both resolve to the same unique record.
const normalizeAccession = (v) => String(v || '').trim().toUpperCase();

const text = (v) => String(v ?? '').trim();

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Canonicalise a header: lowercase, strip punctuation, collapse whitespace.
// "Acc. No.", "Accn No", "STOCK_NO" and "Stock No." all collapse to the same
// tokens, so real-world registers like demo-data.xlsx map correctly.
const canon = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ');

// Filler tokens that never identify a field on their own.
const STOP = new Set([
  'no', 'number', 'num', 'id', 'sl', 'serial', 'date', 'year', 'pages', 'page',
  'vol', 'volume', 'remarks', 'remark', 'book', 'of', 'the', 'in', 'and', 'srn', 'reg',
]);

// Field detection: specific keywords score 2, generic ones score 1, so a
// header like "Author Name" cleanly resolves to author, not title.
const FIELDS = [
  { field: 'stockNumber', keywords: ['stock', 'accession', 'accn', 'acc', 'stockno', 'stocknumber', 'accessionno', 'accno'] },
  { field: 'callNumber', keywords: ['call'] },
  { field: 'title', keywords: ['title'], generic: ['name'] },
  { field: 'author', keywords: ['author'] },
  { field: 'language', keywords: ['language', 'lang'] },
  { field: 'category', keywords: ['category', 'genre', 'subject'], generic: ['class', 'section'] },
  { field: 'price', keywords: ['price', 'cost', 'amount', 'rate'], generic: ['value'] },
  { field: 'publisher', keywords: ['publisher', 'publication'], generic: ['pub'] },
  { field: 'edition', keywords: ['edition'] },
  { field: 'shelf', keywords: ['shelf', 'rack'] },
  { field: 'barcode', keywords: ['barcode', 'isbn'], generic: ['code'] },
  { field: 'bookType', keywords: ['type', 'kind', 'material'] },
];

function fieldFor(tokens) {
  const present = tokens.filter((t) => !STOP.has(t));
  let best = null;
  let bestScore = 0;
  for (const f of FIELDS) {
    let score = 0;
    for (const k of f.keywords) if (present.includes(k)) score += 2;
    for (const k of f.generic || []) if (present.includes(k)) score += 1;
    if (score > bestScore) {
      best = f.field;
      bestScore = score;
    }
  }
  return best;
}

// Map a spreadsheet row to the Book schema. Cells are always read as strings
// (so numeric accession numbers like 1234 stay "1234") and stockNumber is
// normalised (trim + uppercase) so duplicate detection is case-insensitive.
function mapRow(r) {
  const byField = {};
  for (const k of Object.keys(r || {})) {
    const field = fieldFor(canon(k));
    if (field && !Object.prototype.hasOwnProperty.call(byField, field)) {
      byField[field] = r[k];
    }
  }
  const get = (field) => {
    const v = byField[field];
    return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : '';
  };
  return {
    stockNumber: normalizeAccession(get('stockNumber')),
    callNumber: get('callNumber'),
    title: get('title'),
    author: get('author'),
    language: get('language'),
    category: get('category'),
    price: num(get('price')),
    publisher: get('publisher'),
    edition: get('edition'),
    shelf: get('shelf'),
    barcode: get('barcode'),
    bookType: get('bookType') || 'Book',
  };
}

// Prefer the "Books" sheet, then any book/data sheet, then the first sheet
// that actually holds rows. Falls back to the first sheet overall.
function pickSheet(workbook) {
  const names = workbook.SheetNames || [];
  if (!names.length) return null;
  const byName = (re) => names.find((n) => re.test(n.trim()));
  const direct = byName(/^books?$/i);
  if (direct) return workbook.Sheets[direct];
  const data = byName(/book|data|import|inventory/i);
  if (data) return workbook.Sheets[data];
  const firstWithRows = names.find((n) => workbook.Sheets[n] && workbook.Sheets[n]['!ref']);
  if (firstWithRows) return workbook.Sheets[firstWithRows];
  return workbook.Sheets[names[0]] || null;
}

function bodyToBook(body) {
  return {
    stockNumber: normalizeAccession(body.stockNumber),
    callNumber: text(body.callNumber),
    title: text(body.title),
    author: text(body.author),
    language: text(body.language),
    category: text(body.category),
    price: num(body.price),
    publisher: text(body.publisher),
    edition: text(body.edition),
    shelf: text(body.shelf),
    barcode: text(body.barcode),
    bookType: text(body.bookType) || 'Book',
  };
}

exports.listBooks = async (req, res) => {
  try {
    const { q, category, language } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (q) {
      // Regex, case-insensitive, partial (substring) match. Works for Unicode /
      // Malayalam as well as Latin accession numbers. Special chars in the query
      // are escaped so things like "A-001" search literally.
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { stockNumber: rx },
        { title: rx },
        { author: rx },
        { category: rx },
        { publisher: rx },
        { callNumber: rx },
      ];
    }
    const books = await Book.find(filter).sort({ stockNumber: 1 });
    return res.json({ books, count: books.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.bookMeta = async (req, res) => {
  try {
    const categories = (await Book.distinct('category')).filter(Boolean).sort();
    const languages = (await Book.distinct('language')).filter(Boolean).sort();
    return res.json({ categories, languages });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const book = bodyToBook(req.body);
    if (!book.stockNumber) {
      return res.status(400).json({ message: 'Accession No (stockNumber) is required' });
    }
    if (!book.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const existing = await Book.findOne({ stockNumber: book.stockNumber });
    if (existing) {
      return res.status(400).json({ message: `Accession No ${book.stockNumber} is already in the catalog` });
    }
    const created = await Book.create(book);
    return res.status(201).json({ message: 'Book added to catalog', book: created });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: `Accession No ${normalizeAccession(req.body.stockNumber)} is already in the catalog` });
    }
    return res.status(500).json({ message: err.message });
  }
};

exports.bulkUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a .xlsx / .xls / .csv file to upload' });
    }

    const isCsv = /\.csv$/i.test(req.file.originalname || '');
    const buf = req.file.buffer;
    let workbook;
    if (isCsv) {
      // CSV is decoded as UTF-8 explicitly. A UTF-8 BOM written by Excel is
      // stripped first so "Title" headers / first Malayalam cells never get a
      // phantom \uFEFF character. codepage 65001 pins the decoder to UTF-8 so
      // Malayalam glyphs arrive intact instead of being mangled to Latin-1.
      const csvText = buf.toString('utf8').replace(/^\uFEFF/, '');
      workbook = XLSX.read(csvText, { type: 'string', codepage: 65001 });
    } else {
      workbook = XLSX.read(buf, { type: 'buffer', cellText: true });
    }
    const sheet = pickSheet(workbook);
    if (!sheet || !sheet['!ref']) {
      return res.status(400).json({ message: 'The spreadsheet appears to be empty' });
    }
    // raw:false reads formatted cell text; defval:'' guarantees a field exists
    // for every cell so Malayalam strings (and prices) keep their display value.
    const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    if (!parsed || !parsed.length) {
      return res.status(400).json({ message: 'No data rows found in the spreadsheet' });
    }

    // 1. Normalise rows, keep only valid ones, and dedupe stock numbers
    //    appearing more than once within this same file.
    const seen = new Set();
    const incoming = [];
    let invalid = 0;
    for (const r of parsed) {
      const row = mapRow(r);
      if (!row.stockNumber || !row.title) {
        invalid += 1; // missing accessory number or title → skipped
        continue;
      }
      if (seen.has(row.stockNumber)) continue; // duplicate within file → skipped
      seen.add(row.stockNumber);
      incoming.push(row);
    }

    // 2. Check the database for accession numbers that already exist. stockNumber
    //    is normalised to uppercase everywhere, so this find is case-sensitive-safe.
    const existingDocs = incoming.length
      ? await Book.find({ stockNumber: { $in: incoming.map((b) => b.stockNumber) } }).select(
          'stockNumber'
        )
      : [];
    const existingSet = new Set(existingDocs.map((b) => b.stockNumber));
    const newBooks = incoming.filter((b) => !existingSet.has(b.stockNumber));

    // 3. Insert only the unique new books. `ordered: false` lets valid rows
    //    survive even if a stray duplicate sneaks in behind a race; on any
    //    duplicate-key error we recount what actually exists in the database.
    let added = 0;
    if (newBooks.length) {
      try {
        const inserted = await Book.insertMany(newBooks, { ordered: false });
        added = inserted.length;
      } catch (err) {
        if (err.code === 11000 || (err.writeErrors && err.writeErrors.length)) {
          const nowExists = await Book.find({
            stockNumber: { $in: incoming.map((b) => b.stockNumber) },
          }).select('stockNumber');
          const present = new Set(nowExists.map((x) => x.stockNumber));
          added = incoming.filter((b) => present.has(b.stockNumber)).length;
        } else {
          throw err;
        }
      }
    }

    const skipped = parsed.length - added - invalid;
    const message = `Successfully added ${added} new books. ${skipped} duplicates skipped.`;
    return res.json({
      message,
      added,
      skipped,
      invalid,
      total: parsed.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to parse the spreadsheet' });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    await Book.findByIdAndDelete(book._id);
    return res.json({ message: 'Book removed from catalog' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};